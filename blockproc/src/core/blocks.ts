import type { Area, Timestamp } from "./types";

// Fase 10 (rediseño): reemplaza core/restBlock.ts. Un "bloqueo" cubre un
// grupo de apps durante una franja concreta (startAt/endAt), sea porque el
// usuario eligió una duración desde ahora ("duration") o una hora de inicio
// y fin ("scheduled", D25) — ambos terminan con el mismo shape, para que el
// resto del sistema (estado, solapamiento) no distinga entre tipos.
export type BlockType = "duration" | "scheduled";

export interface Block {
  id: string;
  packages: string[];
  type: BlockType;
  startAt: Timestamp;
  endAt: Timestamp;
  /** RF-57: una sola categoría por bloqueo. */
  category: Area;
  focusMessage: string;
  blockMessage: string;
  /** RF-68: si ya se mostró el aviso de 2 minutos (solo relevante para "scheduled"). */
  warnedStart: boolean;
  /** RF-73, RF-74, D41: sin ninguna salida mientras está activo (ni confirmación ni reto). */
  extreme: boolean;
}

export type BlockStatus = "scheduled" | "active" | "ended";

/** RF-55: según la hora, un bloqueo está programado, activo o ya terminó. */
export function getBlockStatus(block: Block, now: Timestamp): BlockStatus {
  if (now < block.startAt) return "scheduled";
  if (now < block.endAt) return "active";
  return "ended";
}

export function isBlockActive(block: Block, now: Timestamp): boolean {
  return getBlockStatus(block, now) === "active";
}

// RF-56: misma duración máxima que el viejo bloqueo horario (D25).
export const BLOCK_MAX_DURATION_MIN = 12 * 60;

/** RF-56: más de 0 minutos y hasta 12 horas, para ambos tipos de bloqueo. */
export function isValidBlockDuration(startAt: Timestamp, endAt: Timestamp): boolean {
  const durationMin = (endAt - startAt) / 60_000;
  return durationMin > 0 && durationMin <= BLOCK_MAX_DURATION_MIN;
}

/** RF-55, D33: quita los bloqueos ya terminados; nunca se persiste un estado "terminado". */
export function removeEndedBlocks(blocks: Block[], now: Timestamp): Block[] {
  return blocks.filter((block) => getBlockStatus(block, now) !== "ended");
}

/** RF-62, RF-72: el bloqueo activo que cubre esa app, o null si ninguno. */
export function findActiveBlockForPackage(blocks: Block[], packageName: string, now: Timestamp): Block | null {
  return (
    blocks.find((block) => block.packages.includes(packageName) && isBlockActive(block, now)) ?? null
  );
}

/**
 * RF-61, RF-62: solo un bloqueo que sigue programado (todavía guardado y sin
 * empezar) se puede editar o borrar. Se comprueba de nuevo al confirmar,
 * contra lo guardado y la hora de ese momento: el bloqueo puede empezar
 * mientras el formulario o el diálogo de confirmación siguen abiertos.
 */
export function isBlockModifiable(blocks: Block[], blockId: string, now: Timestamp): boolean {
  const block = blocks.find((candidate) => candidate.id === blockId);
  return block !== undefined && getBlockStatus(block, now) === "scheduled";
}

export interface TimeOfDay {
  hour: number; // 0-23
  minute: number; // 0-59
}

function setTimeOfDay(reference: Timestamp, time: TimeOfDay): Timestamp {
  const date = new Date(reference);
  date.setHours(time.hour, time.minute, 0, 0);
  return date.getTime();
}

const MS_PER_DAY = 24 * 60 * 60_000;

// RF-68: mismo margen que el aviso de 2 minutos — si al elegir la hora de
// inicio de un bloqueo "programado" queda menos margen que este (o ya
// pasó), no tiene sentido programarlo: arranca de inmediato (mismo criterio
// que el viejo RF-34).
export const SCHEDULED_START_MARGIN_MS = 2 * 60_000;

export interface BlockRange {
  startAt: Timestamp;
  endAt: Timestamp;
}

/**
 * RF-56: bloqueo "programado" — franja horaria de inicio y fin, cruzando la
 * medianoche si hace falta. Si a la hora de inicio elegida (hoy) le queda
 * menos de 2 minutos o ya pasó, arranca de inmediato en su lugar.
 */
export function computeScheduledRange(start: TimeOfDay, end: TimeOfDay, now: Timestamp): BlockRange {
  const todayStart = setTimeOfDay(now, start);
  const marginMs = todayStart - now;
  const startAt = marginMs < SCHEDULED_START_MARGIN_MS ? now : todayStart;
  let endAt = setTimeOfDay(startAt, end);
  if (endAt <= startAt) {
    endAt += MS_PER_DAY;
  }
  return { startAt, endAt };
}

/** RF-56: bloqueo "por tiempo" — arranca ahora mismo, dura lo elegido en horas y minutos. */
export function computeDurationRange(hours: number, minutes: number, now: Timestamp): BlockRange {
  return { startAt: now, endAt: now + (hours * 60 + minutes) * 60_000 };
}

export interface BlockOverlap {
  block: Block;
  packageName: string;
}

/**
 * RF-59, RF-61, D26: antes de crear o editar un bloqueo, busca si alguna de
 * las `packages` ya pertenece a otro bloqueo (programado o activo, nunca
 * terminado) cuya franja se superponga con [startAt, endAt). Dos franjas que
 * solo se tocan en un extremo (el fin de una es el inicio de la otra) no se
 * consideran superpuestas. `excludeId` se usa al editar, para no comparar un
 * bloqueo programado contra sí mismo.
 */
export function findOverlap(
  blocks: Block[],
  packages: string[],
  startAt: Timestamp,
  endAt: Timestamp,
  now: Timestamp,
  excludeId?: string
): BlockOverlap | null {
  for (const block of blocks) {
    if (block.id === excludeId) continue;
    if (getBlockStatus(block, now) === "ended") continue;
    const rangesOverlap = startAt < block.endAt && block.startAt < endAt;
    if (!rangesOverlap) continue;
    const sharedPackage = block.packages.find((pkg) => packages.includes(pkg));
    if (sharedPackage !== undefined) {
      return { block, packageName: sharedPackage };
    }
  }
  return null;
}
