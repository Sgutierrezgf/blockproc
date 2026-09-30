import {
  confirmRestBlock,
  getRestBlockStatus,
  isRestBlockActive,
  markRestBlockWarned,
  REST_BLOCK_WARNING_MS,
  shouldShowRestBlockWarning,
} from "../../blockproc/src/core/restBlock";

const HORA_21 = { hour: 21, minute: 0 };
const HORA_06 = { hour: 6, minute: 0 };

const CONFIRMA_10AM = new Date(2026, 0, 5, 10, 0).getTime();
const JUSTO_EL_INICIO = new Date(2026, 0, 5, 21, 0).getTime();
const DOS_MIN_ANTES = JUSTO_EL_INICIO - 2 * 60_000;
const TRES_MIN_ANTES = JUSTO_EL_INICIO - 3 * 60_000;
const UN_MIN_ANTES = JUSTO_EL_INICIO - 60_000;

describe("REST_BLOCK_WARNING_MS", () => {
  it("son 2 minutos", () => {
    expect(REST_BLOCK_WARNING_MS).toBe(2 * 60_000);
  });
});

// RF-33: aviso 2 minutos antes de que empiece el bloqueo, una sola vez.
describe("shouldShowRestBlockWarning", () => {
  it("no avisa si todavía faltan más de 2 minutos", () => {
    const state = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    expect(shouldShowRestBlockWarning(state, TRES_MIN_ANTES)).toBe(false);
  });

  it("avisa al llegar a los 2 minutos de margen", () => {
    const state = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    expect(shouldShowRestBlockWarning(state, DOS_MIN_ANTES)).toBe(true);
  });

  it("una vez marcado como avisado, no vuelve a avisar aunque siga dentro de la ventana", () => {
    let state = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    expect(shouldShowRestBlockWarning(state, DOS_MIN_ANTES)).toBe(true);

    state = markRestBlockWarned(state);
    expect(shouldShowRestBlockWarning(state, DOS_MIN_ANTES)).toBe(false);
    expect(shouldShowRestBlockWarning(state, UN_MIN_ANTES)).toBe(false);
  });

  it("no avisa una vez que el bloqueo ya empezó", () => {
    const state = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    expect(shouldShowRestBlockWarning(state, JUSTO_EL_INICIO)).toBe(false);
  });

  it("no avisa si el bloqueo se canceló", () => {
    const state = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    const cancelado = { ...state, cancelled: true };
    expect(shouldShowRestBlockWarning(cancelado, DOS_MIN_ANTES)).toBe(false);
  });
});

// RF-34: con menos de 2 minutos de margen, se activa de inmediato y nunca
// se muestra el aviso previo.
describe("confirmRestBlock con menos de 2 minutos de margen (RF-34)", () => {
  it("confirmado a 1 minuto del inicio, se activa de inmediato", () => {
    const confirmaA1Min = UN_MIN_ANTES;
    const state = confirmRestBlock(HORA_21, HORA_06, confirmaA1Min);
    expect(state.startAt).toBe(confirmaA1Min);
    expect(isRestBlockActive(state, confirmaA1Min)).toBe(true);
  });

  it("al activarse de inmediato por poco margen, nunca se muestra el aviso", () => {
    const confirmaA1Min = UN_MIN_ANTES;
    const state = confirmRestBlock(HORA_21, HORA_06, confirmaA1Min);
    expect(shouldShowRestBlockWarning(state, confirmaA1Min)).toBe(false);
  });

  it("confirmado con exactamente 2 minutos de margen, sí se programa (no es inmediato)", () => {
    const state = confirmRestBlock(HORA_21, HORA_06, DOS_MIN_ANTES);
    expect(state.startAt).toBe(JUSTO_EL_INICIO); // se programó, no se activó ya
    expect(getRestBlockStatus(state, DOS_MIN_ANTES)).toBe("scheduled");
    expect(shouldShowRestBlockWarning(state, DOS_MIN_ANTES)).toBe(true); // y el aviso ya toca
  });
});

// RF-42: el bloqueo termina en el instante marcado, sin importar qué hora
// "local" o zona horaria muestre el reloj en ese momento. startAt/endAt son
// marcas de tiempo absolutas (epoch), no "hora del día"; un viaje con
// cambio de zona horaria o el horario de verano no las altera, porque la
// comparación con `now` es puramente numérica, nunca vuelve a interpretar
// horas locales.
describe("RF-42: robustez ante cambios de reloj (horario de verano, viajes)", () => {
  it("el bloqueo activo termina exactamente en endAt, sin importar cómo se interprete la hora local", () => {
    const state = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    // Un "salto" del reloj (adelanto o atraso de una hora, cambio de zona
    // horaria) solo cambia qué hora local corresponde a un instante, nunca
    // el instante mismo: por eso basta comparar contra el mismo endAt.
    expect(getRestBlockStatus(state, state.endAt - 1)).toBe("active");
    expect(getRestBlockStatus(state, state.endAt)).toBe("ended");
  });
});
