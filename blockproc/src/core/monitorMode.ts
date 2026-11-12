import type { Timestamp } from "./types";
import type { PolicyState } from "./policy";

/**
 * D4 (batería): "watch" sondea rápido (500 ms, Tick cada 10 s); "idle"
 * espacia ambos porque no hay nada que vigilar. Lo decide JS, que es quien
 * conoce los bloqueos, y se lo pasa a MonitorService.
 */
export type MonitorMode = "watch" | "idle";

/**
 * Cuánto antes de que empiece un bloqueo se pasa a "watch": el aviso de 2 min
 * (RF-68) más un Tick de "idle" de margen, para no llegar tarde al aviso.
 */
export const WATCH_LEAD_MS = 3 * 60_000;

export function getMonitorMode(state: PolicyState, now: Timestamp): MonitorMode {
  const blockNeedsWatch = state.blocks.some((block) => block.startAt - now <= WATCH_LEAD_MS && now < block.endAt);
  if (blockNeedsWatch) {
    return "watch";
  }
  // RF-66/67: una ventana o una espera vigente tiene que vencer a tiempo.
  const timerNeedsWatch = Object.values(state.apps).some(
    (app) => (app.windowEndsAt !== null && now < app.windowEndsAt) || (app.cooldownUntil !== null && now < app.cooldownUntil)
  );
  return timerNeedsWatch ? "watch" : "idle";
}
