import { createDefaultConfig } from "../../blockproc/src/core/config";
import type { Config } from "../../blockproc/src/core/config";
import {
  createPolicyState,
  grantAccessWindow,
  handleForegroundChanged,
  handleTick,
} from "../../blockproc/src/core/policy";

const PKG_A = "com.instagram.android";
const PKG_B = "com.spotify.music";

function configCon(cambios: Partial<Config>): Config {
  return { ...createDefaultConfig(), restrictedPackages: [PKG_A, PKG_B], dailyLimitMin: 10, accessWindowMin: 5, ...cambios };
}

// RF-12: la ventana se concede solo a la app que pasó el reto.
describe("grantAccessWindow — RF-12", () => {
  it("conceder la ventana a una app no desbloquea ninguna otra", () => {
    const config = configCon({});
    let state = createPolicyState();

    // PKG_B agota su límite (10 min en un solo tramo).
    state = handleForegroundChanged(state, PKG_B, config, 0).state;
    state = handleForegroundChanged(state, PKG_A, config, 600_000).state; // cierra el tramo de B

    state = grantAccessWindow(state, PKG_A, config, 600_000); // ventana para A: hasta 900_000

    const resultadoA = handleForegroundChanged(state, PKG_A, config, 610_000);
    expect(resultadoA.actions).toEqual([]); // A, dentro de la ventana: uso libre
    state = resultadoA.state;

    const resultadoB = handleForegroundChanged(state, PKG_B, config, 620_000);
    expect(resultadoB.actions).toEqual([{ type: "ShowChallenge", packageName: PKG_B }]); // B sigue bloqueada
  });
});

// RF-15: aviso 1 minuto antes de que termine la ventana, solo si sigue en
// primer plano.
describe("aviso de fin de ventana — RF-15", () => {
  it("avisa al faltar 1 minuto para que termine la ventana, con la app en primer plano", () => {
    const config = configCon({});
    let state = createPolicyState();
    state = handleForegroundChanged(state, PKG_A, config, 0).state;
    state = grantAccessWindow(state, PKG_A, config, 0); // ventana: 0 a 300_000 (5 min)

    const result = handleTick(state, config, 300_000 - 60_000);
    expect(result.actions).toEqual([{ type: "NotifyWindowEnding", packageName: PKG_A }]);
  });

  it("no avisa si el usuario ya salió de la app antes de que falte el minuto", () => {
    const config = configCon({});
    let state = createPolicyState();
    state = handleForegroundChanged(state, PKG_A, config, 0).state;
    state = grantAccessWindow(state, PKG_A, config, 0);
    state = handleForegroundChanged(state, PKG_B, config, 100_000).state; // sale de A hacia B

    const result = handleTick(state, config, 300_000 - 60_000); // ahora en B
    expect(result.actions).toEqual([]);
  });

  it("no repite el aviso en un sondeo posterior, dentro de la misma ventana", () => {
    const config = configCon({});
    let state = createPolicyState();
    state = handleForegroundChanged(state, PKG_A, config, 0).state;
    state = grantAccessWindow(state, PKG_A, config, 0);

    const primerAviso = handleTick(state, config, 300_000 - 60_000);
    state = primerAviso.state;
    const segundoSondeo = handleTick(state, config, 300_000 - 30_000);
    expect(segundoSondeo.actions).toEqual([]);
  });
});

// RF-16: al terminar la ventana, se exige un nuevo reto.
describe("fin de la ventana — RF-16", () => {
  it("con la app en primer plano, exige el reto de inmediato al terminar la ventana", () => {
    const config = configCon({});
    let state = createPolicyState();
    state = handleForegroundChanged(state, PKG_A, config, 0).state;
    state = grantAccessWindow(state, PKG_A, config, 0);

    const result = handleTick(state, config, 300_000); // termina la ventana, sigue en A
    expect(result.actions).toEqual([{ type: "ShowChallenge", packageName: PKG_A }]);
  });

  it("sin estar en primer plano, el reto aparece recién al volver a abrirla", () => {
    const config = configCon({});
    let state = createPolicyState();
    state = handleForegroundChanged(state, PKG_A, config, 0).state;
    state = grantAccessWindow(state, PKG_A, config, 0);
    state = handleForegroundChanged(state, PKG_B, config, 100_000).state; // sale de A

    const sondeo = handleTick(state, config, 300_000); // la ventana vence, pero A no está en primer plano
    expect(sondeo.actions).toEqual([]);
    state = sondeo.state;

    const reapertura = handleForegroundChanged(state, PKG_A, config, 350_000);
    expect(reapertura.actions).toEqual([{ type: "ShowChallenge", packageName: PKG_A }]);
  });
});
