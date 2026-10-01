import { confirmRestBlock, resolveRestBlocks } from "../../blockproc/src/core/restBlock";

const HORA_21 = { hour: 21, minute: 0 };
const HORA_06 = { hour: 6, minute: 0 }; // bloqueo de 21:00 a 06:00, 9 horas

const CONFIRMA_10AM = new Date(2026, 0, 5, 10, 0).getTime();
const ANTES_DEL_INICIO = new Date(2026, 0, 5, 15, 0).getTime();
const JUSTO_EL_INICIO = new Date(2026, 0, 5, 21, 0).getTime();
const DURANTE_EL_BLOQUEO = new Date(2026, 0, 5, 22, 0).getTime();
const TRAS_EL_FIN = new Date(2026, 0, 6, 7, 0).getTime(); // 06:00 del día 6 ya pasó

// RF-53, D21: nextRestBlock solo se asciende a restBlock cuando este terminó.
describe("resolveRestBlocks", () => {
  it("sin ningún bloqueo, no hace nada", () => {
    const result = resolveRestBlocks(null, null, CONFIRMA_10AM);
    expect(result).toEqual({ restBlock: null, nextRestBlock: null });
  });

  it("con el bloqueo actual todavía programado, no asciende el próximo", () => {
    const restBlock = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    const nextRestBlock = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    const result = resolveRestBlocks(restBlock, nextRestBlock, ANTES_DEL_INICIO);
    expect(result.restBlock).toBe(restBlock);
    expect(result.nextRestBlock).toBe(nextRestBlock);
  });

  it("con el bloqueo actual activo, no asciende el próximo", () => {
    const restBlock = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    const nextRestBlock = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    const result = resolveRestBlocks(restBlock, nextRestBlock, DURANTE_EL_BLOQUEO);
    expect(result.restBlock).toBe(restBlock);
    expect(result.nextRestBlock).toBe(nextRestBlock);
  });

  it("cuando el actual termina y hay uno próximo, lo asciende y limpia nextRestBlock", () => {
    const restBlock = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    const nextRestBlock = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    const result = resolveRestBlocks(restBlock, nextRestBlock, TRAS_EL_FIN);
    expect(result.restBlock).toBe(nextRestBlock);
    expect(result.nextRestBlock).toBeNull();
  });

  it("cuando el actual termina sin ninguno próximo, no cambia nada", () => {
    const restBlock = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    const result = resolveRestBlocks(restBlock, null, TRAS_EL_FIN);
    expect(result.restBlock).toBe(restBlock);
    expect(result.nextRestBlock).toBeNull();
  });

  it("un bloqueo cancelado no cuenta como terminado: no asciende el próximo", () => {
    const restBlock = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    const cancelado = { ...restBlock, cancelled: true };
    const nextRestBlock = confirmRestBlock(HORA_21, HORA_06, CONFIRMA_10AM);
    const result = resolveRestBlocks(cancelado, nextRestBlock, TRAS_EL_FIN);
    expect(result.restBlock).toBe(cancelado);
    expect(result.nextRestBlock).toBe(nextRestBlock);
  });
});
