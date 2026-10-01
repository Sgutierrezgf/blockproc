import { computeNextRestBlockStart, confirmNextRestBlock } from "../../blockproc/src/core/restBlock";

const CURRENT_END_AT = new Date(2026, 0, 6, 6, 0).getTime(); // el bloqueo activo termina el 6 de enero a las 06:00

// RF-54, C14/D22b: el inicio del "próximo" se calcula relativo al fin del
// bloqueo activo, nunca a "ahora" (ver corrección documentada en plan.md).
describe("computeNextRestBlockStart", () => {
  it("una hora después del fin del bloqueo activo, se usa ese mismo día", () => {
    const start = computeNextRestBlockStart({ hour: 10, minute: 0 }, CURRENT_END_AT);
    expect(start).toBe(new Date(2026, 0, 6, 10, 0).getTime());
  });

  it("exactamente la misma hora en que termina el bloqueo activo, se acepta tal cual", () => {
    const start = computeNextRestBlockStart({ hour: 6, minute: 0 }, CURRENT_END_AT);
    expect(start).toBe(CURRENT_END_AT);
  });

  it("una hora que ya \"pasó\" ese día (antes del fin del bloqueo activo), se programa al día siguiente", () => {
    const start = computeNextRestBlockStart({ hour: 5, minute: 0 }, CURRENT_END_AT);
    expect(start).toBe(new Date(2026, 0, 7, 5, 0).getTime());
  });

  it("una hora nocturna (21:00) después del fin del bloqueo activo, se usa ese mismo día", () => {
    const start = computeNextRestBlockStart({ hour: 21, minute: 0 }, CURRENT_END_AT);
    expect(start).toBe(new Date(2026, 0, 6, 21, 0).getTime());
  });
});

describe("confirmNextRestBlock", () => {
  it("arma el bloqueo completo con el inicio calculado y la duración del rango", () => {
    const state = confirmNextRestBlock({ hour: 10, minute: 0 }, { hour: 12, minute: 0 }, CURRENT_END_AT);
    expect(state.startAt).toBe(new Date(2026, 0, 6, 10, 0).getTime());
    expect(state.endAt).toBe(state.startAt + 2 * 60 * 60_000);
    expect(state.cancelled).toBe(false);
    expect(state.warned2min).toBe(false);
  });

  it("con una hora que ya pasó ese día, igual arma el bloqueo (nunca rechaza) para el día siguiente", () => {
    const state = confirmNextRestBlock({ hour: 5, minute: 0 }, { hour: 5, minute: 30 }, CURRENT_END_AT);
    expect(state.startAt).toBe(new Date(2026, 0, 7, 5, 0).getTime());
    expect(state.endAt).toBe(state.startAt + 30 * 60_000);
  });
});
