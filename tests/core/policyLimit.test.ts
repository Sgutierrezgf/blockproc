import { createDefaultConfig } from "../../blockproc/src/core/config";
import type { Config } from "../../blockproc/src/core/config";
import { createPolicyState, handleForegroundChanged, handleTick } from "../../blockproc/src/core/policy";

const PKG = "com.instagram.android";
const OTRO_PKG = "com.spotify.music";

function configCon(cambios: Partial<Config>): Config {
  return { ...createDefaultConfig(), restrictedPackages: [PKG], dailyLimitMin: 10, ...cambios };
}

// RF-10: mientras no llega al límite, se usa sin interrupciones.
describe("handleForegroundChanged — RF-10", () => {
  it("una app restringida que no llegó a su límite no produce ninguna acción", () => {
    const config = configCon({});
    const state = createPolicyState();
    const result = handleForegroundChanged(state, PKG, config, 0);
    expect(result.actions).toEqual([]);
  });

  it("una app que no está restringida nunca produce ninguna acción, sin importar cuánto tiempo pase", () => {
    const config = configCon({});
    let state = createPolicyState();
    const abrir = handleForegroundChanged(state, OTRO_PKG, config, 0);
    state = abrir.state;
    const result = handleTick(state, config, 10_000_000);
    expect(result.actions).toEqual([]);
  });

  it("sin ninguna app en primer plano, el sondeo no hace nada", () => {
    const config = configCon({});
    const state = createPolicyState();
    expect(handleTick(state, config, 1_000_000).actions).toEqual([]);
  });
});

// RF-9: abrir una app ya bloqueada muestra el reto de inmediato.
describe("handleForegroundChanged — RF-9", () => {
  it("abrir una app que ya agotó su límite en una visita anterior muestra el reto ya mismo", () => {
    const config = configCon({ dailyLimitMin: 10 }); // 10 min = 600_000 ms
    let state = createPolicyState();

    let result = handleForegroundChanged(state, PKG, config, 0);
    state = result.state;
    result = handleForegroundChanged(state, OTRO_PKG, config, 600_000); // cierra el tramo: 10 min completos
    state = result.state;

    result = handleForegroundChanged(state, PKG, config, 700_000); // se vuelve a abrir
    expect(result.actions).toEqual([{ type: "ShowChallenge", packageName: PKG }]);
  });
});

// RF-31: llegar al límite con la app ya abierta muestra el reto de inmediato.
describe("handleTick — RF-31", () => {
  it("al llegar exactamente al límite con la app abierta, se muestra el reto", () => {
    const config = configCon({ dailyLimitMin: 10 });
    let state = createPolicyState();

    let result = handleForegroundChanged(state, PKG, config, 0);
    state = result.state;
    expect(result.actions).toEqual([]);

    result = handleTick(state, config, 600_000); // pasan exactamente los 10 min, sigue abierta
    expect(result.actions).toEqual([{ type: "ShowChallenge", packageName: PKG }]);
  });
});

// RF-30: aviso 1 minuto antes de llegar al límite, sin repetirlo.
describe("handleTick — RF-30", () => {
  it("avisa al faltar exactamente 1 minuto para el límite", () => {
    const config = configCon({ dailyLimitMin: 10 });
    let state = createPolicyState();
    state = handleForegroundChanged(state, PKG, config, 0).state;

    const result = handleTick(state, config, 600_000 - 60_000);
    expect(result.actions).toEqual([{ type: "NotifyLimitWarning", packageName: PKG }]);
  });

  it("no repite el aviso en un sondeo posterior, todavía dentro del mismo minuto de margen", () => {
    const config = configCon({ dailyLimitMin: 10 });
    let state = createPolicyState();
    state = handleForegroundChanged(state, PKG, config, 0).state;

    const primerAviso = handleTick(state, config, 600_000 - 60_000);
    state = primerAviso.state;
    const segundoSondeo = handleTick(state, config, 600_000 - 30_000);
    expect(segundoSondeo.actions).toEqual([]);
  });

  it("no avisa todavía si falta más de 1 minuto", () => {
    const config = configCon({ dailyLimitMin: 10 });
    let state = createPolicyState();
    state = handleForegroundChanged(state, PKG, config, 0).state;

    const result = handleTick(state, config, 600_000 - 61_000);
    expect(result.actions).toEqual([]);
  });
});
