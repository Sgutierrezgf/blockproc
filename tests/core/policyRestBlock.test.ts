import { createDefaultConfig } from "../../blockproc/src/core/config";
import type { Config } from "../../blockproc/src/core/config";
import type { RestBlockState } from "../../blockproc/src/core/restBlock";
import {
  createPolicyState,
  grantAccessWindow,
  handleForegroundChanged,
  handleTick,
} from "../../blockproc/src/core/policy";
import type { PolicyState } from "../../blockproc/src/core/policy";

const PKG_A = "com.instagram.android"; // restringida
const PKG_LIBRE = "com.chrome.browser"; // no restringida

function configCon(cambios: Partial<Config>): Config {
  return { ...createDefaultConfig(), restrictedPackages: [PKG_A], dailyLimitMin: 10, accessWindowMin: 5, ...cambios };
}

// Se construye directamente (sin pasar por confirmRestBlock, ya probado en
// la T25/T26): aquí solo interesa cómo lo usa policy.ts, no cómo se calculó.
function restBlockActivoDesde(startAt: number, endAt: number): RestBlockState {
  return { startAt, endAt, cancelled: false, warned2min: false };
}

// RF-18, RF-21: mientras el bloqueo horario está activo, sin reto, incluso
// si la app también superó su propio límite diario.
describe("bloqueo horario activo — RF-18, RF-21", () => {
  it("da ShowRestBlock (sin reto), aunque la app ya haya superado su límite", () => {
    const config = configCon({ dailyLimitMin: 10 }); // 600_000 ms
    let state = createPolicyState();
    state = handleForegroundChanged(state, PKG_A, config, 0).state; // A, abierta desde el inicio
    state = { ...state, restBlock: restBlockActivoDesde(500_000, 800_000) };

    const result = handleTick(state, config, 700_000); // superó el límite y el bloqueo está activo
    expect(result.actions).toEqual([{ type: "ShowRestBlock" }]);
  });
});

// RF-22: solo afecta a las apps restringidas.
describe("bloqueo horario activo — RF-22", () => {
  it("no actúa sobre una app que no está restringida", () => {
    const config = configCon({});
    let state = createPolicyState();
    state = { ...state, restBlock: restBlockActivoDesde(0, 300_000) };

    const result = handleForegroundChanged(state, PKG_LIBRE, config, 100_000);
    expect(result.actions).toEqual([]);
  });
});

// RF-40: corta cualquier ventana de acceso activa al empezar el bloqueo, y
// no la deja resurgir después de que termine.
describe("bloqueo horario activo — RF-40", () => {
  it("corta la ventana concedida y no la deja resurgir después de que termine el bloqueo", () => {
    const config = configCon({ dailyLimitMin: 4, accessWindowMin: 5 }); // límite: 240_000 ms; ventana: 300_000 ms
    let state = createPolicyState();
    state = handleForegroundChanged(state, PKG_A, config, 0).state;
    state = grantAccessWindow(state, PKG_A, config, 0); // ventana: 0 a 300_000

    state = { ...state, restBlock: restBlockActivoDesde(100_000, 200_000) };

    // Dentro del bloqueo horario (la ventana "seguiría vigente" hasta 300_000).
    let result = handleTick(state, config, 150_000);
    expect(result.actions).toEqual([{ type: "ShowRestBlock" }]);
    state = result.state;

    // Tras el fin del bloqueo (200_000) pero todavía antes de los 300_000
    // en que la ventana habría terminado por sí sola: si de verdad se
    // cortó, ya no hay ventana y se vuelve al chequeo normal del límite,
    // que a esta altura (250_000 ms de uso, límite 240_000) exige reto.
    result = handleTick(state, config, 250_000);
    expect(result.actions).toEqual([{ type: "ShowChallenge", packageName: PKG_A }]);
  });
});

// RF-33: aviso 2 minutos antes de que empiece el bloqueo horario.
describe("aviso previo del bloqueo horario — RF-33", () => {
  it("avisa en el sondeo cuando faltan 2 minutos, sin importar qué app esté abierta", () => {
    const config = configCon({});
    const state = { ...createPolicyState(), restBlock: restBlockActivoDesde(500_000, 800_000) };

    const result = handleTick(state, config, 500_000 - 2 * 60_000);
    expect(result.actions).toEqual([{ type: "NotifyRestBlockStarting" }]);
  });

  it("no repite el aviso en un sondeo posterior", () => {
    const config = configCon({});
    let state: PolicyState = { ...createPolicyState(), restBlock: restBlockActivoDesde(500_000, 800_000) };

    const primero = handleTick(state, config, 500_000 - 2 * 60_000);
    state = primero.state;
    const segundo = handleTick(state, config, 500_000 - 60_000);
    expect(segundo.actions).toEqual([]);
  });
});
