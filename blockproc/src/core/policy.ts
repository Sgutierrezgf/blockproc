import type { Config } from "./config";
import { isRestBlockActive, markRestBlockWarned, shouldShowRestBlockWarning } from "./restBlock";
import type { RestBlockState } from "./restBlock";
import type { Timestamp } from "./types";
import { createUsageState, getUsedMsIncludingOpenSegment, onForegroundChanged, onScreenOff, onScreenOn } from "./usage";
import type { UsageState } from "./usage";

// El reductor central (plan.md): combina el estado por app con la
// configuración para decidir qué mostrar. Cubre el límite diario (T29:
// RF-8, RF-9, RF-10, RF-30, RF-31), la ventana de acceso (T30: RF-12,
// RF-15, RF-16), la espera tras un fallo (T31: RF-13, RF-14, RF-38) y el
// bloqueo horario (T32: RF-18, RF-19, RF-21, RF-22, RF-33, RF-40), que
// tiene prioridad sobre todo lo demás.
export interface AppPolicyState {
  /** Fin de la ventana de acceso concedida (RF-12), o null si no hay ninguna. */
  windowEndsAt: Timestamp | null;
  /** Fin de la espera de 3 min tras un fallo (RF-13), o null si no hay ninguna. */
  cooldownUntil: Timestamp | null;
  /** Ya se avisó del límite en esta visita (RF-30), para no repetirlo. */
  warnedLimit: boolean;
  /** Ya se avisó del fin de la ventana (RF-15), para no repetirlo. */
  warnedWindow: boolean;
}

function createAppPolicyState(): AppPolicyState {
  return { windowEndsAt: null, cooldownUntil: null, warnedLimit: false, warnedWindow: false };
}

export interface PolicyState {
  usage: UsageState;
  apps: Record<string, AppPolicyState>;
  /** El bloqueo horario vigente (T25/T26), o null si no hay ninguno. */
  restBlock: RestBlockState | null;
}

export function createPolicyState(): PolicyState {
  return { usage: createUsageState(), apps: {}, restBlock: null };
}

function getAppState(state: PolicyState, packageName: string): AppPolicyState {
  return state.apps[packageName] ?? createAppPolicyState();
}

function setAppState(state: PolicyState, packageName: string, appState: AppPolicyState): PolicyState {
  return { ...state, apps: { ...state.apps, [packageName]: appState } };
}

export type PolicyAction =
  | { type: "ShowChallenge"; packageName: string }
  | { type: "ShowWait"; packageName: string; until: Timestamp }
  | { type: "ShowRestBlock" }
  | { type: "NotifyLimitWarning"; packageName: string }
  | { type: "NotifyWindowEnding"; packageName: string }
  | { type: "NotifyRestBlockStarting" };

export interface PolicyResult {
  state: PolicyState;
  actions: PolicyAction[];
}

const LIMIT_WARNING_MS = 60_000;
const WINDOW_WARNING_MS = 60_000;
// RF-13: exactamente 3 minutos de espera tras un fallo.
const CHALLENGE_COOLDOWN_MS = 3 * 60_000;

function evaluateForegroundApp(state: PolicyState, config: Config, now: Timestamp): PolicyResult {
  const packageName = state.usage.foregroundPackage;
  if (packageName === null || !config.restrictedPackages.includes(packageName)) {
    return { state, actions: [] };
  }

  // RF-18, RF-21, RF-22, RF-40: el bloqueo horario tiene prioridad sobre
  // todo lo demás (límite, ventana, espera) y corta cualquier ventana o
  // espera en curso, para que no puedan resurgir después de que termine.
  if (state.restBlock !== null && isRestBlockActive(state.restBlock, now)) {
    const appState = getAppState(state, packageName);
    const nextState =
      appState.windowEndsAt !== null || appState.cooldownUntil !== null
        ? setAppState(state, packageName, { ...appState, windowEndsAt: null, cooldownUntil: null })
        : state;
    return { state: nextState, actions: [{ type: "ShowRestBlock" }] };
  }

  const appState = getAppState(state, packageName);

  // RF-13, RF-38: mientras dura la espera tras un fallo, pantalla de
  // espera; al cumplirse, se limpia y se sigue evaluando normalmente
  // (RF-14: un nuevo intento cae en el chequeo del límite de más abajo,
  // que vuelve a pedir un reto, esta vez con preguntas nuevas).
  if (appState.cooldownUntil !== null) {
    if (now < appState.cooldownUntil) {
      return { state, actions: [{ type: "ShowWait", packageName, until: appState.cooldownUntil }] };
    }
    const cleared = setAppState(state, packageName, { ...appState, cooldownUntil: null });
    return evaluateForegroundApp(cleared, config, now);
  }

  // RF-16: la ventana ya venció (aunque sea la primera vez que se comprueba
  // desde entonces): se exige un reto nuevo sin importar el uso acumulado,
  // porque lo que se acabó es la excepción temporal, no el límite en sí.
  if (appState.windowEndsAt !== null && now >= appState.windowEndsAt) {
    const nextState = setAppState(state, packageName, {
      windowEndsAt: null,
      cooldownUntil: null,
      warnedLimit: false,
      warnedWindow: false,
    });
    return { state: nextState, actions: [{ type: "ShowChallenge", packageName }] };
  }

  // RF-12: dentro de una ventana de acceso vigente, uso libre; RF-15: aviso
  // al faltar 1 minuto para que termine, una sola vez.
  if (appState.windowEndsAt !== null) {
    const remainingMs = appState.windowEndsAt - now;
    if (remainingMs <= WINDOW_WARNING_MS && !appState.warnedWindow) {
      const nextState = setAppState(state, packageName, { ...appState, warnedWindow: true });
      return { state: nextState, actions: [{ type: "NotifyWindowEnding", packageName }] };
    }
    return { state, actions: [] };
  }

  // Sin ventana vigente: el chequeo normal del límite diario.
  const usedMs = getUsedMsIncludingOpenSegment(state.usage, packageName, now);
  const limitMs = config.dailyLimitMin * 60_000;

  // RF-9, RF-31: al llegar al límite, con la app en primer plano (recién
  // abierta o ya abierta desde antes), se muestra el reto de inmediato.
  if (usedMs >= limitMs) {
    return { state, actions: [{ type: "ShowChallenge", packageName }] };
  }

  // RF-30: aviso al faltar 1 minuto, una sola vez por visita.
  const remainingMs = limitMs - usedMs;
  if (remainingMs <= LIMIT_WARNING_MS && !appState.warnedLimit) {
    const nextState = setAppState(state, packageName, { ...appState, warnedLimit: true });
    return { state: nextState, actions: [{ type: "NotifyLimitWarning", packageName }] };
  }

  // RF-10: todavía lejos del límite, se usa sin interrupciones.
  return { state, actions: [] };
}

/** La app en primer plano cambió (evento nativo ForegroundChanged). */
export function handleForegroundChanged(
  state: PolicyState,
  packageName: string | null,
  config: Config,
  now: Timestamp
): PolicyResult {
  const usage = onForegroundChanged(state.usage, packageName, now);
  let nextState: PolicyState = { ...state, usage };

  if (packageName !== null && packageName !== state.usage.foregroundPackage) {
    // Empieza una visita nueva a esta app: se puede volver a avisar.
    const appState = getAppState(nextState, packageName);
    nextState = setAppState(nextState, packageName, { ...appState, warnedLimit: false });
  }

  return evaluateForegroundApp(nextState, config, now);
}

/**
 * RF-33: aviso 2 minutos antes de que empiece el bloqueo horario, sin
 * importar qué app esté en primer plano (o si no hay ninguna).
 */
function evaluateRestBlockWarning(state: PolicyState, now: Timestamp): PolicyResult {
  if (state.restBlock === null || !shouldShowRestBlockWarning(state.restBlock, now)) {
    return { state, actions: [] };
  }
  const restBlock = markRestBlockWarned(state.restBlock);
  return { state: { ...state, restBlock }, actions: [{ type: "NotifyRestBlockStarting" }] };
}

/** Sondeo periódico (evento Tick), mientras no cambia la app en primer plano. */
export function handleTick(state: PolicyState, config: Config, now: Timestamp): PolicyResult {
  const warning = evaluateRestBlockWarning(state, now);
  const app = evaluateForegroundApp(warning.state, config, now);
  return { state: app.state, actions: [...warning.actions, ...app.actions] };
}

/**
 * RF-43: la pantalla se enciende. Vuelve a consultarse de inmediato (no
 * hay que esperar el próximo sondeo): si algo venció mientras estuvo
 * apagada (una ventana, una espera), se detecta ya mismo.
 */
export function handleScreenOn(state: PolicyState, config: Config, now: Timestamp): PolicyResult {
  const usage = onScreenOn(state.usage, now);
  const withUsage: PolicyState = { ...state, usage };
  const warning = evaluateRestBlockWarning(withUsage, now);
  const app = evaluateForegroundApp(warning.state, config, now);
  return { state: app.state, actions: [...warning.actions, ...app.actions] };
}

/**
 * RF-43: la pantalla se apaga. Cierra el tramo de uso en curso; a partir de
 * aquí no se vuelve a evaluar nada hasta el próximo handleScreenOn (el
 * propio servicio nativo deja de sondear con la pantalla apagada, T09).
 */
export function handleScreenOff(state: PolicyState, now: Timestamp): PolicyResult {
  const usage = onScreenOff(state.usage, now);
  return { state: { ...state, usage }, actions: [] };
}

/** RF-12: se acertó el reto; se concede la ventana de acceso solo a esa app. */
export function grantAccessWindow(
  state: PolicyState,
  packageName: string,
  config: Config,
  now: Timestamp
): PolicyState {
  const appState = getAppState(state, packageName);
  const windowEndsAt = now + config.accessWindowMin * 60_000;
  return setAppState(state, packageName, {
    ...appState,
    windowEndsAt,
    warnedWindow: false,
    cooldownUntil: null,
  });
}

/** RF-13: se falló el reto; empieza la espera de 3 minutos, solo para esa app. */
export function recordChallengeFailure(
  state: PolicyState,
  packageName: string,
  now: Timestamp
): PolicyState {
  const appState = getAppState(state, packageName);
  return setAppState(state, packageName, {
    ...appState,
    cooldownUntil: now + CHALLENGE_COOLDOWN_MS,
    windowEndsAt: null,
    warnedWindow: false,
  });
}
