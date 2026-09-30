import { getUsageDayKey } from "./clock";
import type { Timestamp } from "./types";

// RF-36: solo cuenta el tiempo en primer plano con la pantalla encendida, e
// ignora los intervalos de menos de 1 segundo (un cambio rápido entre apps
// no debe sumar). El estado es inmutable: cada función devuelve un estado
// nuevo, para que sea fácil de probar y de trazar.
const MIN_SEGMENT_MS = 1000;

export interface UsageState {
  /** Tiempo acumulado por paquete, en ms, ya cerrado (no incluye el tramo en curso). */
  usedMs: Record<string, number>;
  /** Paquete que Android reporta como último en primer plano, o null si ninguno. */
  foregroundPackage: string | null;
  /** Instante en que empezó a contar el tramo en curso, o null si no se está contando. */
  segmentStartedAt: Timestamp | null;
  screenOn: boolean;
  /** Día de uso (RF-7, corte a las 04:00) al que pertenece `usedMs`, o null si aún no se supo la hora. */
  dayKey: string | null;
}

export function createUsageState(): UsageState {
  return {
    usedMs: {},
    foregroundPackage: null,
    segmentStartedAt: null,
    screenOn: true,
    dayKey: null,
  };
}

function closeSegment(state: UsageState, now: Timestamp): UsageState {
  if (state.foregroundPackage === null || state.segmentStartedAt === null) {
    return state;
  }
  const duration = now - state.segmentStartedAt;
  if (duration < MIN_SEGMENT_MS) {
    return { ...state, segmentStartedAt: null };
  }
  const pkg = state.foregroundPackage;
  return {
    ...state,
    usedMs: { ...state.usedMs, [pkg]: (state.usedMs[pkg] ?? 0) + duration },
    segmentStartedAt: null,
  };
}

/** La app que Android reporta en primer plano acaba de cambiar. */
export function onForegroundChanged(
  state: UsageState,
  packageName: string | null,
  now: Timestamp
): UsageState {
  const closed = closeSegment(state, now);
  const startNow = closed.screenOn && packageName !== null;
  return {
    ...closed,
    foregroundPackage: packageName,
    segmentStartedAt: startNow ? now : null,
  };
}

export function onScreenOn(state: UsageState, now: Timestamp): UsageState {
  if (state.screenOn) return state;
  const next: UsageState = { ...state, screenOn: true };
  if (next.foregroundPackage !== null) {
    return { ...next, segmentStartedAt: now };
  }
  return next;
}

export function onScreenOff(state: UsageState, now: Timestamp): UsageState {
  if (!state.screenOn) return state;
  const closed = closeSegment(state, now);
  return { ...closed, screenOn: false };
}

/** Tiempo acumulado y cerrado para un paquete (no incluye el tramo en curso). */
export function getUsedMs(state: UsageState, packageName: string): number {
  return state.usedMs[packageName] ?? 0;
}

/**
 * RF-7: el día de uso va de 04:00 a 04:00. Se llama en cada sondeo (además
 * de en cada evento): si el día cambió desde la última vez, cierra el tramo
 * en curso (se acredita al día que termina) y reinicia los contadores para
 * el día nuevo, reabriendo un tramo si la app seguía en primer plano con la
 * pantalla encendida.
 */
export function checkDayRollover(state: UsageState, now: Timestamp): UsageState {
  const dayKey = getUsageDayKey(now);
  if (state.dayKey === dayKey) {
    return state;
  }
  const closed = closeSegment(state, now);
  const reopen = closed.screenOn && closed.foregroundPackage !== null;
  return {
    ...closed,
    usedMs: {},
    dayKey,
    segmentStartedAt: reopen ? now : null,
  };
}

/**
 * Tiempo efectivo de uso "ahora mismo", sumando al total ya cerrado el
 * tramo en curso si `packageName` es la app en primer plano. A diferencia
 * de closeSegment, no descarta un tramo en curso de menos de 1 s: es una
 * lectura en vivo, no un cierre definitivo (RF-36 solo pide ignorar tramos
 * ya terminados, no retrasar la detección del límite).
 */
export function getUsedMsIncludingOpenSegment(
  state: UsageState,
  packageName: string,
  now: Timestamp
): number {
  const closedMs = getUsedMs(state, packageName);
  const hasOpenSegment =
    state.screenOn && state.foregroundPackage === packageName && state.segmentStartedAt !== null;
  return hasOpenSegment ? closedMs + (now - (state.segmentStartedAt as Timestamp)) : closedMs;
}

/** RF-8: si el uso efectivo de hoy alcanzó (o superó) el límite diario configurado. */
export function hasReachedDailyLimit(
  state: UsageState,
  packageName: string,
  dailyLimitMin: number,
  now: Timestamp
): boolean {
  return getUsedMsIncludingOpenSegment(state, packageName, now) >= dailyLimitMin * 60_000;
}

/** RF-29 (T57): si alguna de las apps restringidas ya está bloqueada por límite diario. */
export function hasAnyAppReachedDailyLimit(
  state: UsageState,
  restrictedPackages: string[],
  dailyLimitMin: number,
  now: Timestamp
): boolean {
  return restrictedPackages.some((packageName) => hasReachedDailyLimit(state, packageName, dailyLimitMin, now));
}
