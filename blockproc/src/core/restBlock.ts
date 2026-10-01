import type { Timestamp } from "./types";

// RF-17: bloqueo horario, con hora de inicio y de fin del día (no una fecha
// concreta): el usuario elige, por ejemplo, "21:00 a 06:00", y esa franja
// se aplicará cuando corresponda (T25 decide si está activa ahora mismo).
export interface TimeOfDay {
  hour: number; // 0-23
  minute: number; // 0-59
}

const MINUTES_PER_DAY = 24 * 60;

// RF-17: duración máxima de 12 horas.
export const REST_BLOCK_MAX_DURATION_MIN = 12 * 60;

function toMinutesOfDay(time: TimeOfDay): number {
  return time.hour * 60 + time.minute;
}

/**
 * Duración en minutos entre el inicio y el fin, cruzando la medianoche si
 * hace falta (RF-17: "21:00 a 06:00" es un rango válido). La misma hora de
 * inicio y fin dura 0 minutos, no 24 horas.
 */
export function getRestBlockDurationMin(start: TimeOfDay, end: TimeOfDay): number {
  const diff = toMinutesOfDay(end) - toMinutesOfDay(start);
  return ((diff % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** RF-17: más de 0 minutos y sin superar las 12 horas. */
export function isValidRestBlockRange(start: TimeOfDay, end: TimeOfDay): boolean {
  const duration = getRestBlockDurationMin(start, end);
  return duration > 0 && duration <= REST_BLOCK_MAX_DURATION_MIN;
}

// RF-18, RF-19, RF-20, RF-34: ciclo de vida de un bloqueo horario ya
// confirmado. No es un horario que se repite cada día: es un bloqueo
// puntual, con un inicio y un fin concretos.
export type RestBlockStatus = "scheduled" | "active" | "ended" | "cancelled";

export interface RestBlockState {
  startAt: Timestamp;
  endAt: Timestamp;
  cancelled: boolean;
  /** RF-33/RF-34: si ya se mostró el aviso de 2 minutos (para no repetirlo). */
  warned2min: boolean;
}

// RF-33: aviso 2 minutos antes de que empiece. RF-34: con menos margen que
// este (o con la hora ya pasada) no da tiempo a avisar, así que se activa
// de inmediato en su lugar.
export const REST_BLOCK_WARNING_MS = 2 * 60_000;

function setTimeOfDay(reference: Timestamp, time: TimeOfDay): Timestamp {
  const date = new Date(reference);
  date.setHours(time.hour, time.minute, 0, 0);
  return date.getTime();
}

/**
 * RF-17, RF-32: calcula el bloqueo concreto a partir del rango ya validado
 * y del instante de la confirmación. RF-34: si a la hora de inicio elegida
 * le queda menos de 2 minutos (o ya pasó), se activa de inmediato en vez de
 * programarlo, y nunca se muestra el aviso previo.
 */
export function confirmRestBlock(start: TimeOfDay, end: TimeOfDay, now: Timestamp): RestBlockState {
  const durationMin = getRestBlockDurationMin(start, end);
  const todayStart = setTimeOfDay(now, start);
  const marginMs = todayStart - now;
  const startsImmediately = marginMs < REST_BLOCK_WARNING_MS;
  const startAt = startsImmediately ? now : todayStart;
  const endAt = startAt + durationMin * 60_000;
  return { startAt, endAt, cancelled: false, warned2min: startsImmediately };
}

const MS_PER_DAY = 24 * 60 * 60_000;

/**
 * RF-54, C14/D22b (Fase 9): a diferencia de `confirmRestBlock`, el inicio se
 * calcula relativo al **fin del bloqueo activo** (`currentEndAt`), no a
 * "ahora": mientras se programa el próximo, "ahora" siempre cae dentro del
 * bloqueo en curso, así que una hora de mañana que ya "pasó hoy" no debe
 * interpretarse como "empezar ya" (esa lógica es de RF-34, para confirmar
 * desde un estado libre). Si la hora elegida, tomada el mismo día que
 * `currentEndAt`, cae en ese instante o después, se usa tal cual; si no, se
 * busca al día siguiente. Nunca rechaza un rango válido (RF-17).
 */
export function computeNextRestBlockStart(start: TimeOfDay, currentEndAt: Timestamp): Timestamp {
  const sameDayAsEnd = setTimeOfDay(currentEndAt, start);
  return sameDayAsEnd >= currentEndAt ? sameDayAsEnd : sameDayAsEnd + MS_PER_DAY;
}

/** RF-53, RF-54: arma el bloqueo horario "próximo" completo, para `nextRestBlock`. */
export function confirmNextRestBlock(start: TimeOfDay, end: TimeOfDay, currentEndAt: Timestamp): RestBlockState {
  const durationMin = getRestBlockDurationMin(start, end);
  const startAt = computeNextRestBlockStart(start, currentEndAt);
  const endAt = startAt + durationMin * 60_000;
  return { startAt, endAt, cancelled: false, warned2min: false };
}

/** RF-18: si el bloqueo está en curso ahora mismo, según su estado. */
export function getRestBlockStatus(state: RestBlockState, now: Timestamp): RestBlockStatus {
  if (state.cancelled) return "cancelled";
  if (now < state.startAt) return "scheduled";
  if (now < state.endAt) return "active";
  return "ended";
}

export function isRestBlockActive(state: RestBlockState, now: Timestamp): boolean {
  return getRestBlockStatus(state, now) === "active";
}

/**
 * RF-50, D23 (Fase 9): el bloqueo a mostrar como "programado para más
 * tarde" fuera de la pestaña Bloqueo horario — el propio `restBlock` si
 * todavía no empezó (caso ya existente, antes invisible en Ajustes/Apps:
 * la causa real del bug reportado), si no el "próximo" si hay uno
 * (mientras el actual está activo), si no nada.
 */
export function getPendingRestBlock(
  restBlock: RestBlockState | null,
  nextRestBlock: RestBlockState | null,
  now: Timestamp
): RestBlockState | null {
  if (restBlock !== null && getRestBlockStatus(restBlock, now) === "scheduled") {
    return restBlock;
  }
  return nextRestBlock;
}

export interface RestBlockPair {
  restBlock: RestBlockState | null;
  nextRestBlock: RestBlockState | null;
}

/**
 * RF-53, D21 (Fase 9): el único lugar donde "nextRestBlock" deja de ser
 * invisible y pasa a ser el bloqueo vigente — nunca se evalúa por su cuenta
 * (isRestBlockActive/getRestBlockStatus siempre miran "restBlock"). Solo
 * asciende cuando el actual terminó de verdad (no cuando se cancela: eso no
 * cuenta como terminado, RF-20).
 */
export function resolveRestBlocks(
  restBlock: RestBlockState | null,
  nextRestBlock: RestBlockState | null,
  now: Timestamp
): RestBlockPair {
  if (restBlock !== null && nextRestBlock !== null && getRestBlockStatus(restBlock, now) === "ended") {
    return { restBlock: nextRestBlock, nextRestBlock: null };
  }
  return { restBlock, nextRestBlock };
}

/**
 * RF-20: cancela si todavía no empezó. RF-19: una vez empezado (incluido el
 * instante exacto de inicio), no hay marcha atrás y esta función no hace
 * nada.
 */
export function cancelRestBlock(state: RestBlockState, now: Timestamp): RestBlockState {
  if (now >= state.startAt) {
    return state;
  }
  return { ...state, cancelled: true };
}

/**
 * RF-33: si faltan 2 minutos o menos para el inicio, todavía no empezó, no
 * se canceló y no se avisó antes. Una sola vez por bloqueo: quien la llama
 * debe invocar markRestBlockWarned() tras mostrar el aviso.
 */
export function shouldShowRestBlockWarning(state: RestBlockState, now: Timestamp): boolean {
  if (state.cancelled || state.warned2min) return false;
  if (now >= state.startAt) return false;
  return state.startAt - now <= REST_BLOCK_WARNING_MS;
}

export function markRestBlockWarned(state: RestBlockState): RestBlockState {
  return { ...state, warned2min: true };
}

const END_TIME_PLACEHOLDER = "{hora de fin}";

/**
 * RF-35: el mensaje (por defecto o personalizado) puede traer el marcador
 * literal "{hora de fin}", que se sustituye por la hora real de fin del
 * bloqueo horario (hora local del dispositivo, formato HH:mm).
 */
export function formatRestBlockMessage(message: string, endAt: Timestamp): string {
  const date = new Date(endAt);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return message.replace(END_TIME_PLACEHOLDER, `${hours}:${minutes}`);
}
