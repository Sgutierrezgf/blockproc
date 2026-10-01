import { confirmRestBlock, getPendingRestBlock } from "../../blockproc/src/core/restBlock";

const HORA_21 = { hour: 21, minute: 0 };
const HORA_06 = { hour: 6, minute: 0 };

const CONFIRMA_10AM = new Date(2026, 0, 5, 10, 0).getTime();
const ANTES_DEL_INICIO = new Date(2026, 0, 5, 15, 0).getTime();
const DURANTE_EL_BLOQUEO = new Date(2026, 0, 5, 22, 0).getTime();
const TRAS_EL_FIN = new Date(2026, 0, 6, 7, 0).getTime();

// RF-50, D23: qué bloqueo horario mostrar como "programado para más tarde"
// fuera de la pestaña Bloqueo horario (Ajustes, Apps).
describe("getPendingRestBlock", () => {
  it("sin ningún bloqueo, no hay nada pendiente", () => {
    expect(getPendingRestBlock(null, null, ANTES_DEL_INICIO)).toBeNull();
  });

  it("con un bloqueo programado (todavía no activo) y sin próximo, lo devuelve", () => {
    const restBlock = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    expect(getPendingRestBlock(restBlock, null, ANTES_DEL_INICIO)).toBe(restBlock);
  });

  it("con el bloqueo ya activo y sin próximo, no hay nada pendiente (eso lo cubre el banner de activo)", () => {
    const restBlock = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    expect(getPendingRestBlock(restBlock, null, DURANTE_EL_BLOQUEO)).toBeNull();
  });

  it("con el bloqueo activo y uno próximo programado, devuelve el próximo", () => {
    const restBlock = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    const nextRestBlock = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    expect(getPendingRestBlock(restBlock, nextRestBlock, DURANTE_EL_BLOQUEO)).toBe(nextRestBlock);
  });

  it("con el bloqueo ya terminado y sin próximo, no hay nada pendiente", () => {
    const restBlock = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    expect(getPendingRestBlock(restBlock, null, TRAS_EL_FIN)).toBeNull();
  });
});
