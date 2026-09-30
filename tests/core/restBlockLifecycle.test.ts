import {
  cancelRestBlock,
  confirmRestBlock,
  getRestBlockStatus,
  isRestBlockActive,
} from "../../blockproc/src/core/restBlock";

const HORA_21 = { hour: 21, minute: 0 };
const HORA_06 = { hour: 6, minute: 0 }; // bloqueo de 21:00 a 06:00, 9 horas

const CONFIRMA_10AM = new Date(2026, 0, 5, 10, 0).getTime();
const ANTES_DEL_INICIO = new Date(2026, 0, 5, 15, 0).getTime();
const JUSTO_EL_INICIO = new Date(2026, 0, 5, 21, 0).getTime();
const DURANTE_EL_BLOQUEO = new Date(2026, 0, 5, 22, 0).getTime();
const TRAS_EL_FIN = new Date(2026, 0, 6, 7, 0).getTime(); // 06:00 del día 6 ya pasó

// RF-17, RF-32: al confirmar, se calcula el bloqueo concreto (inicio y fin).
describe("confirmRestBlock", () => {
  it("si la hora de inicio todavía no llegó, se programa para esa hora de hoy", () => {
    const state = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    expect(state.startAt).toBe(JUSTO_EL_INICIO);
    expect(state.endAt).toBe(state.startAt + 9 * 60 * 60_000);
    expect(state.cancelled).toBe(false);
  });

  // RF-34: si la hora de inicio ya pasó, se activa de inmediato.
  it("si la hora de inicio ya pasó hoy, se activa de inmediato (no espera al día siguiente)", () => {
    const confirmaA_LAS_22 = DURANTE_EL_BLOQUEO; // 22:00, después de las 21:00
    const state = confirmRestBlock(HORA_21, HORA_06, confirmaA_LAS_22);
    expect(state.startAt).toBe(confirmaA_LAS_22); // empieza ya, no a las 21:00 de mañana
    expect(state.endAt).toBe(confirmaA_LAS_22 + 9 * 60 * 60_000);
    expect(isRestBlockActive(state, confirmaA_LAS_22)).toBe(true);
  });
});

// RF-18: activo o no según la hora.
describe("getRestBlockStatus", () => {
  it("pasa de programado a activo y a terminado según avanza el reloj", () => {
    const state = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    expect(getRestBlockStatus(state, ANTES_DEL_INICIO)).toBe("scheduled");
    expect(getRestBlockStatus(state, JUSTO_EL_INICIO)).toBe("active");
    expect(getRestBlockStatus(state, DURANTE_EL_BLOQUEO)).toBe("active");
    expect(getRestBlockStatus(state, TRAS_EL_FIN)).toBe("ended");
  });
});

// RF-20: se puede cancelar antes de que empiece; RF-19: ya no, una vez activo.
describe("cancelRestBlock", () => {
  it("cancela correctamente si todavía no empezó", () => {
    const state = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    const cancelado = cancelRestBlock(state, ANTES_DEL_INICIO);
    expect(cancelado.cancelled).toBe(true);
    expect(getRestBlockStatus(cancelado, DURANTE_EL_BLOQUEO)).toBe("cancelled");
  });

  it("no se puede cancelar una vez que ya empezó", () => {
    const state = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    const intento = cancelRestBlock(state, DURANTE_EL_BLOQUEO); // ya está activo
    expect(intento.cancelled).toBe(false);
    expect(getRestBlockStatus(intento, DURANTE_EL_BLOQUEO)).toBe("active");
  });

  it("no se puede cancelar exactamente en el instante de inicio", () => {
    const state = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    const intento = cancelRestBlock(state, JUSTO_EL_INICIO);
    expect(intento.cancelled).toBe(false);
  });
});
