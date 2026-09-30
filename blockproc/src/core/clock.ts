import type { Timestamp } from "./types";

// El core nunca lee Date.now() directamente: siempre recibe un Clock. Así,
// en los tests, un reloj falso puede saltar los 3 min de penalización o la
// ventana de 5-10 min sin esperarlos de verdad (constitución, principio 7).
export interface Clock {
  now(): Timestamp;
}

export function createSystemClock(): Clock {
  return {
    now: () => Date.now(),
  };
}

export interface FakeClock extends Clock {
  /** Adelanta el reloj `ms` milisegundos. */
  advance(ms: number): void;
  /** Fija el reloj a un instante arbitrario. */
  set(timestamp: Timestamp): void;
}

export function createFakeClock(initial: Timestamp = 0): FakeClock {
  let current = initial;
  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
    },
    set: (timestamp) => {
      current = timestamp;
    },
  };
}

// RF-7: "el día de uso va de 04:00 a 04:00 hora local", no de medianoche a
// medianoche. Antes de esa hora, un instante pertenece todavía al día de uso
// anterior.
export const USAGE_DAY_START_HOUR = 4;

/**
 * Identificador del "día de uso" (RF-7) al que pertenece un instante, con
 * el corte a las USAGE_DAY_START_HOUR en hora local del dispositivo. Dos
 * instantes con la misma clave pertenecen al mismo día de uso, aunque
 * crucen la medianoche real.
 */
export function getUsageDayKey(timestamp: Timestamp): string {
  const date = new Date(timestamp);
  if (date.getHours() < USAGE_DAY_START_HOUR) {
    date.setDate(date.getDate() - 1);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
