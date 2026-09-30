import { createSystemRandom } from "../../blockproc/src/core/random";

// Igual que createSystemClock (T02): el único punto donde el core toca
// Math.random() de verdad, para que las pantallas de producción no lo
// llamen directamente (principio 7 de la constitución).
describe("createSystemRandom", () => {
  it("devuelve un número en [0, 1)", () => {
    const random = createSystemRandom();
    const value = random();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });
});
