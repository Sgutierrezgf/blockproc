import type { Block } from "./blocks";
import { findActiveBlockForPackage, getBlockStatus, removeEndedBlocks } from "./blocks";
import type { Timestamp } from "./types";

// Fase 10 (rediseño): el reductor central. Ya no hay límite diario, ventana
// global ni bloqueo horario único — todo pasa por la lista de `blocks`
// (core/blocks.ts) y un estado de acceso simple por app (ventana de 2 min o
// espera de 5 min, RF-66/RF-67). Sin acumulación de tiempo de uso (RF-36
// retirado): `foregroundPackage` es un campo simple, solo para que `Tick`
// sepa qué app reevaluar.
export interface AppAccessState {
  /** RF-67: cronómetro fijo de 2 min desde que se acierta el reto. */
  windowEndsAt: Timestamp | null;
  /** RF-66: cronómetro fijo de 5 min desde que se acumulan 2 fallos. */
  cooldownUntil: Timestamp | null;
}

function createAppAccessState(): AppAccessState {
  return { windowEndsAt: null, cooldownUntil: null };
}

export interface PolicyState {
  foregroundPackage: string | null;
  blocks: Block[];
  apps: Record<string, AppAccessState>;
}

export function createPolicyState(): PolicyState {
  return { foregroundPackage: null, blocks: [], apps: {} };
}

/**
 * RF-55, D33: punto único donde se quitan los bloqueos ya terminados — se
 * llama al principio de cada evento que evalúa bloqueos, antes de decidir
 * qué mostrar (mismo patrón que `promoteNextRestBlockIfNeeded` de la Fase 9,
 * pero removiendo en vez de ascender: ya no hay un "próximo" que subir).
 *
 * Caso límite (spec, C31): si un bloqueo termina con una espera o ventana en
 * curso para alguna de sus apps, esa espera/ventana queda sin sentido (la
 * app ya es libre) y además podría "filtrarse" hacia un bloqueo nuevo y
 * distinto que más tarde vuelva a cubrir la misma app — por eso se limpia el
 * estado de acceso de cada app del bloqueo removido, no solo el bloqueo.
 */
function removeEndedBlocksIfNeeded(state: PolicyState, now: Timestamp): PolicyState {
  const blocks = removeEndedBlocks(state.blocks, now);
  if (blocks.length === state.blocks.length) {
    return state;
  }
  const endedBlocks = state.blocks.filter((block) => !blocks.includes(block));
  const apps = { ...state.apps };
  for (const block of endedBlocks) {
    for (const packageName of block.packages) {
      delete apps[packageName];
    }
  }
  return { ...state, blocks, apps };
}

function getAppState(state: PolicyState, packageName: string): AppAccessState {
  return state.apps[packageName] ?? createAppAccessState();
}

function setAppState(state: PolicyState, packageName: string, appState: AppAccessState): PolicyState {
  return { ...state, apps: { ...state.apps, [packageName]: appState } };
}

export type PolicyAction =
  | { type: "ShowAccess"; packageName: string }
  | { type: "ShowWait"; packageName: string; until: Timestamp }
  | { type: "NotifyBlockStarting"; blockId: string };

export interface PolicyResult {
  state: PolicyState;
  actions: PolicyAction[];
}

// RF-66, RF-67: valores fijos para todos los bloqueos, no configurables (RF-69).
export const COOLDOWN_MS = 5 * 60_000;
export const ACCESS_WINDOW_MS = 2 * 60_000;
// RF-68: mismo margen de aviso que el viejo bloqueo horario.
export const BLOCK_WARNING_MS = 2 * 60_000;

function evaluateForegroundApp(state: PolicyState, now: Timestamp): PolicyResult {
  const packageName = state.foregroundPackage;
  if (packageName === null) {
    return { state, actions: [] };
  }

  const appState = getAppState(state, packageName);

  // RF-67: dentro de la ventana de acceso ya concedida, uso libre.
  if (appState.windowEndsAt !== null && now < appState.windowEndsAt) {
    return { state, actions: [] };
  }

  // RF-66: mientras dura la espera de 5 min tras fallar, pantalla de espera.
  if (appState.cooldownUntil !== null && now < appState.cooldownUntil) {
    return { state, actions: [{ type: "ShowWait", packageName, until: appState.cooldownUntil }] };
  }

  // RF-62: sin ventana ni espera vigentes, el bloqueo activo (si lo hay)
  // exige el flujo de acceso completo (reflexión → confirmación → reto).
  const activeBlock = findActiveBlockForPackage(state.blocks, packageName, now);
  if (activeBlock === null) {
    return { state, actions: [] };
  }
  return { state, actions: [{ type: "ShowAccess", packageName }] };
}

/** La app en primer plano cambió (evento nativo ForegroundChanged). */
export function handleForegroundChanged(state: PolicyState, packageName: string | null, now: Timestamp): PolicyResult {
  const cleaned = removeEndedBlocksIfNeeded(state, now);
  const nextState: PolicyState = { ...cleaned, foregroundPackage: packageName };
  return evaluateForegroundApp(nextState, now);
}

/**
 * RF-68: aviso 2 minutos antes de que empiece cualquier bloqueo tipo
 * "programado" (generalizado: antes era solo el bloqueo horario único).
 */
function evaluateBlockWarnings(state: PolicyState, now: Timestamp): PolicyResult {
  const actions: PolicyAction[] = [];
  let blocks = state.blocks;
  let changed = false;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (
      block.type === "scheduled" &&
      !block.warnedStart &&
      getBlockStatus(block, now) === "scheduled" &&
      block.startAt - now <= BLOCK_WARNING_MS
    ) {
      if (!changed) {
        blocks = [...blocks];
        changed = true;
      }
      blocks[i] = { ...block, warnedStart: true };
      actions.push({ type: "NotifyBlockStarting", blockId: block.id });
    }
  }

  if (!changed) {
    return { state, actions: [] };
  }
  return { state: { ...state, blocks }, actions };
}

/** Sondeo periódico (evento Tick), mientras no cambia la app en primer plano. */
export function handleTick(state: PolicyState, now: Timestamp): PolicyResult {
  const cleaned = removeEndedBlocksIfNeeded(state, now);
  const warning = evaluateBlockWarnings(cleaned, now);
  const app = evaluateForegroundApp(warning.state, now);
  return { state: app.state, actions: [...warning.actions, ...app.actions] };
}

/**
 * RF-43: la pantalla se enciende. Vuelve a consultarse de inmediato (no hay
 * que esperar el próximo sondeo): si algo venció mientras estuvo apagada
 * (una ventana, una espera, un bloqueo), se detecta ya mismo.
 */
export function handleScreenOn(state: PolicyState, now: Timestamp): PolicyResult {
  return handleTick(state, now);
}

/** RF-43: la pantalla se apaga; no hay nada que cerrar (sin acumulación de uso). */
export function handleScreenOff(state: PolicyState): PolicyResult {
  return { state, actions: [] };
}

/** RF-67: se acertaron al menos 2 de las 3 preguntas; ventana de 2 min fija, solo para esa app. */
export function grantAccessWindow(state: PolicyState, packageName: string, now: Timestamp): PolicyState {
  const appState = getAppState(state, packageName);
  return setAppState(state, packageName, {
    ...appState,
    windowEndsAt: now + ACCESS_WINDOW_MS,
    cooldownUntil: null,
  });
}

/** RF-66: se acumularon 2 respuestas incorrectas; espera de 5 min fija, solo para esa app. */
export function recordChallengeFailure(state: PolicyState, packageName: string, now: Timestamp): PolicyState {
  const appState = getAppState(state, packageName);
  return setAppState(state, packageName, {
    ...appState,
    cooldownUntil: now + COOLDOWN_MS,
    windowEndsAt: null,
  });
}
