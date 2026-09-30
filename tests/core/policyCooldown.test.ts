import { createDefaultConfig } from "../../blockproc/src/core/config";
import type { Config } from "../../blockproc/src/core/config";
import {
  createPolicyState,
  handleForegroundChanged,
  handleTick,
  recordChallengeFailure,
} from "../../blockproc/src/core/policy";

const PKG_A = "com.instagram.android";
const PKG_B = "com.spotify.music";
const TRES_MIN_MS = 3 * 60_000;

function configCon(cambios: Partial<Config>): Config {
  return { ...createDefaultConfig(), restrictedPackages: [PKG_A, PKG_B], dailyLimitMin: 10, ...cambios };
}

// RF-13, RF-38: tras fallar el reto, espera de exactamente 3 minutos, por app.
describe("recordChallengeFailure", () => {
  it("muestra la pantalla de espera mientras dura la espera", () => {
    const config = configCon({});
    const state = recordChallengeFailure(createPolicyState(), PKG_A, 0);

    const result = handleForegroundChanged(state, PKG_A, config, 100_000); // 1:40, dentro de la espera
    expect(result.actions).toEqual([{ type: "ShowWait", packageName: PKG_A, until: TRES_MIN_MS }]);
  });

  it("sigue en espera justo antes de que se cumplan los 3 minutos", () => {
    const config = configCon({});
    let state = handleForegroundChanged(createPolicyState(), PKG_A, config, 0).state; // sigue en A
    state = recordChallengeFailure(state, PKG_A, 0);

    const result = handleTick(state, config, TRES_MIN_MS - 1);
    expect(result.actions).toEqual([{ type: "ShowWait", packageName: PKG_A, until: TRES_MIN_MS }]);
  });

  it("permite un nuevo intento (reto nuevo, RF-14) exactamente a los 3 minutos", () => {
    const config = configCon({ dailyLimitMin: 10 });
    let state = createPolicyState();

    // PKG_A agota su límite (10 min en un tramo cerrado).
    state = handleForegroundChanged(state, PKG_A, config, 0).state;
    state = handleForegroundChanged(state, PKG_B, config, 600_000).state; // cierra el tramo: 10 min completos

    // Se reabre, aparece el reto, y esta vez se falla.
    let result = handleForegroundChanged(state, PKG_A, config, 610_000);
    expect(result.actions).toEqual([{ type: "ShowChallenge", packageName: PKG_A }]);
    state = recordChallengeFailure(result.state, PKG_A, 610_000);

    // A los 3 minutos exactos, un nuevo intento: reto nuevo otra vez.
    result = handleForegroundChanged(state, PKG_A, config, 610_000 + TRES_MIN_MS);
    expect(result.actions).toEqual([{ type: "ShowChallenge", packageName: PKG_A }]);
  });

  it("no afecta a ninguna otra app", () => {
    const config = configCon({});
    const state = recordChallengeFailure(createPolicyState(), PKG_A, 0);

    const result = handleForegroundChanged(state, PKG_B, config, 100_000); // B, lejos de su límite
    expect(result.actions).toEqual([]);
  });
});
