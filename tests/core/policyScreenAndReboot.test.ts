import { createDefaultConfig } from "../../blockproc/src/core/config";
import type { Config } from "../../blockproc/src/core/config";
import {
  createPolicyState,
  handleForegroundChanged,
  handleScreenOff,
  handleScreenOn,
  handleTick,
} from "../../blockproc/src/core/policy";
import type { PolicyState } from "../../blockproc/src/core/policy";
import { getUsedMsIncludingOpenSegment } from "../../blockproc/src/core/usage";

const PKG_A = "com.instagram.android";

function configCon(cambios: Partial<Config>): Config {
  return { ...createDefaultConfig(), restrictedPackages: [PKG_A], dailyLimitMin: 10, ...cambios }; // 600_000 ms
}

// RF-43: con la pantalla apagada no se acumula uso.
describe("handleScreenOff / handleScreenOn — RF-43", () => {
  it("el tiempo con la pantalla apagada no cuenta, sin importar cuánto dure", () => {
    const config = configCon({});
    let state = createPolicyState();
    state = handleForegroundChanged(state, PKG_A, config, 0).state; // abre A
    state = handleScreenOff(state, 5_000).state; // se apaga a los 5 s (sí cuenta ese tramo)

    // Pasan "muchas horas" con la pantalla apagada, sin ningún sondeo.
    const result = handleScreenOn(state, config, 10_000_000);

    expect(getUsedMsIncludingOpenSegment(result.state.usage, PKG_A, 10_000_000)).toBe(5_000);
    expect(result.actions).toEqual([]); // muy lejos del límite: nada del hueco apagado se sumó
  });

  it("al encender la pantalla, se reevalúa de inmediato (no hay que esperar el próximo sondeo)", () => {
    const config = configCon({ dailyLimitMin: 10 });
    let state = createPolicyState();
    state = handleForegroundChanged(state, PKG_A, config, 0).state;
    state = handleScreenOff(state, 600_000).state; // ya lleva 10 min al apagar: al límite

    const result = handleScreenOn(state, config, 700_000);
    expect(result.actions).toEqual([{ type: "ShowChallenge", packageName: PKG_A }]);
  });
});

// RF-45: tras un reinicio, se retoma ventana, espera y bloqueo horario por
// sus marcas de tiempo, sin ninguna función especial de "reanudar": basta
// con que el estado guardado sea el mismo tipo de dato de siempre.
describe("retomar tras un reinicio — RF-45", () => {
  it("una ventana guardada sigue vigente (o vencida) según su marca de tiempo, igual que si no hubiera reinicio", () => {
    const config = configCon({});
    const estadoTrasReinicio: PolicyState = {
      usage: { usedMs: {}, foregroundPackage: PKG_A, segmentStartedAt: null, screenOn: true, dayKey: null },
      apps: {
        [PKG_A]: { windowEndsAt: 500_000, cooldownUntil: null, warnedLimit: false, warnedWindow: false },
      },
      restBlock: null,
      nextRestBlock: null,
    };

    expect(handleTick(estadoTrasReinicio, config, 100_000).actions).toEqual([]); // dentro de la ventana
    expect(handleTick(estadoTrasReinicio, config, 600_000).actions).toEqual([
      { type: "ShowChallenge", packageName: PKG_A }, // vencida: nuevo reto, como en la T30
    ]);
  });

  it("una espera guardada se respeta y, al cumplirse, exige un nuevo reto", () => {
    const config = configCon({ dailyLimitMin: 10 });
    const estadoTrasReinicio: PolicyState = {
      usage: {
        usedMs: { [PKG_A]: 600_000 }, // ya había agotado su límite antes de fallar
        foregroundPackage: PKG_A,
        segmentStartedAt: null,
        screenOn: true,
        dayKey: null,
      },
      apps: {
        [PKG_A]: { windowEndsAt: null, cooldownUntil: 180_000, warnedLimit: false, warnedWindow: false },
      },
      restBlock: null,
      nextRestBlock: null,
    };

    expect(handleTick(estadoTrasReinicio, config, 100_000).actions).toEqual([
      { type: "ShowWait", packageName: PKG_A, until: 180_000 },
    ]);
    expect(handleTick(estadoTrasReinicio, config, 180_000).actions).toEqual([
      { type: "ShowChallenge", packageName: PKG_A },
    ]);
  });

  it("un bloqueo horario guardado sigue activo (o terminado) según su marca de tiempo", () => {
    const config = configCon({});
    const estadoTrasReinicio: PolicyState = {
      usage: { usedMs: {}, foregroundPackage: PKG_A, segmentStartedAt: null, screenOn: true, dayKey: null },
      apps: {},
      restBlock: { startAt: 0, endAt: 500_000, cancelled: false, warned2min: false },
      nextRestBlock: null,
    };

    expect(handleTick(estadoTrasReinicio, config, 100_000).actions).toEqual([{ type: "ShowRestBlock" }]);
    expect(handleTick(estadoTrasReinicio, config, 600_000).actions).toEqual([]); // ya terminó, y sin uso acumulado
  });
});
