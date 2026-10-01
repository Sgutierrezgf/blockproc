import { createDefaultConfig } from "../../blockproc/src/core/config";
import type { Config } from "../../blockproc/src/core/config";
import type { RestBlockState } from "../../blockproc/src/core/restBlock";
import { createPolicyState, handleForegroundChanged, handleScreenOn, handleTick } from "../../blockproc/src/core/policy";
import type { PolicyState } from "../../blockproc/src/core/policy";

const PKG_A = "com.instagram.android";

function configCon(cambios: Partial<Config>): Config {
  return { ...createDefaultConfig(), restrictedPackages: [PKG_A], ...cambios };
}

function bloqueo(startAt: number, endAt: number): RestBlockState {
  return { startAt, endAt, cancelled: false, warned2min: false };
}

// RF-53, D21 (Fase 9): el reductor asciende "nextRestBlock" a "restBlock" al
// evaluar, en cuanto el actual terminó — y lo hace ANTES de decidir qué
// mostrar, no después (si no, el bloqueo recién ascendido tardaría un
// evento más en notarse).
describe("ascenso de nextRestBlock al evaluar — RF-53", () => {
  it("handleTick asciende el próximo bloqueo cuando el actual ya terminó, y lo aplica en el mismo sondeo", () => {
    const config = configCon({});
    const state: PolicyState = {
      ...createPolicyState(),
      restBlock: bloqueo(0, 100_000), // ya terminó
      nextRestBlock: bloqueo(100_000, 200_000), // ya en curso a los 150_000
    };

    const result = handleTick(state, config, 150_000);
    expect(result.state.restBlock).toEqual(bloqueo(100_000, 200_000));
    expect(result.state.nextRestBlock).toBeNull();
  });

  it("handleForegroundChanged asciende el próximo y lo aplica al decidir qué mostrar", () => {
    const config = configCon({});
    const state: PolicyState = {
      ...createPolicyState(),
      restBlock: bloqueo(0, 100_000),
      nextRestBlock: bloqueo(100_000, 200_000),
    };

    const result = handleForegroundChanged(state, PKG_A, config, 150_000);
    expect(result.state.restBlock).toEqual(bloqueo(100_000, 200_000));
    expect(result.state.nextRestBlock).toBeNull();
    expect(result.actions).toEqual([{ type: "ShowRestBlock" }]);
  });

  it("handleScreenOn también asciende el próximo al reevaluar", () => {
    const config = configCon({});
    const state: PolicyState = {
      ...createPolicyState(),
      restBlock: bloqueo(0, 100_000),
      nextRestBlock: bloqueo(100_000, 200_000),
    };

    const result = handleScreenOn(state, config, 150_000);
    expect(result.state.restBlock).toEqual(bloqueo(100_000, 200_000));
    expect(result.state.nextRestBlock).toBeNull();
  });

  it("no asciende nada mientras el bloqueo actual sigue activo", () => {
    const config = configCon({});
    const state: PolicyState = {
      ...createPolicyState(),
      restBlock: bloqueo(0, 200_000),
      nextRestBlock: bloqueo(200_000, 300_000),
    };

    const result = handleTick(state, config, 100_000); // el actual sigue activo
    expect(result.state.restBlock).toEqual(bloqueo(0, 200_000));
    expect(result.state.nextRestBlock).toEqual(bloqueo(200_000, 300_000));
  });
});
