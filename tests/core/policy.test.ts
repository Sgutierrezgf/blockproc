import type { Block } from "../../blockproc/src/core/blocks";
import {
  ACCESS_WINDOW_MS,
  COOLDOWN_MS,
  createPolicyState,
  grantAccessWindow,
  handleForegroundChanged,
  handleScreenOff,
  handleScreenOn,
  handleTick,
  recordChallengeFailure,
} from "../../blockproc/src/core/policy";
import type { PolicyState } from "../../blockproc/src/core/policy";

const PKG = "com.instagram.android";

function makeBlock(overrides: Partial<Block> = {}): Block {
  return {
    id: "b1",
    packages: [PKG],
    type: "duration",
    startAt: 0,
    endAt: 10_000,
    category: "general",
    focusMessage: "foco",
    blockMessage: "bloqueado",
    warnedStart: false,
    ...overrides,
  };
}

function withBlocks(blocks: Block[]): PolicyState {
  return { ...createPolicyState(), blocks };
}

describe("createPolicyState", () => {
  it("arranca vacío: sin app en primer plano, sin bloqueos, sin estado por app", () => {
    expect(createPolicyState()).toEqual({ foregroundPackage: null, blocks: [], apps: {} });
  });
});

// RF-62, RF-63: sin bloqueo activo, nada; con uno activo, ShowAccess.
describe("handleForegroundChanged", () => {
  it("sin ningún bloqueo cubriendo la app, no hace nada", () => {
    const result = handleForegroundChanged(createPolicyState(), PKG, 1000);
    expect(result.actions).toEqual([]);
  });

  it("con un bloqueo activo cubriendo la app, pide ShowAccess", () => {
    const state = withBlocks([makeBlock({ startAt: 0, endAt: 10_000 })]);
    const result = handleForegroundChanged(state, PKG, 5000);
    expect(result.actions).toEqual([{ type: "ShowAccess", packageName: PKG }]);
  });

  it("con un bloqueo solo programado (no activo todavía), no hace nada", () => {
    const state = withBlocks([makeBlock({ startAt: 5000, endAt: 10_000 })]);
    const result = handleForegroundChanged(state, PKG, 1000);
    expect(result.actions).toEqual([]);
  });

  it("quita los bloqueos ya terminados antes de evaluar (RF-55)", () => {
    const state = withBlocks([makeBlock({ startAt: 0, endAt: 1000 })]);
    const result = handleForegroundChanged(state, PKG, 5000);
    expect(result.state.blocks).toEqual([]);
    expect(result.actions).toEqual([]);
  });

  it("con cooldown vigente, pide ShowWait en vez de ShowAccess (prioridad)", () => {
    let state = withBlocks([makeBlock({ startAt: 0, endAt: 100_000 })]);
    state = recordChallengeFailure(state, PKG, 1000);
    const result = handleForegroundChanged(state, PKG, 2000);
    expect(result.actions).toEqual([{ type: "ShowWait", packageName: PKG, until: 1000 + COOLDOWN_MS }]);
  });

  it("con ventana de acceso vigente, no hace nada (uso libre)", () => {
    let state = withBlocks([makeBlock({ startAt: 0, endAt: 100_000 })]);
    state = grantAccessWindow(state, PKG, 1000);
    const result = handleForegroundChanged(state, PKG, 1500);
    expect(result.actions).toEqual([]);
  });

  it("al vencer la ventana de acceso, con el bloqueo todavía activo, vuelve a pedir ShowAccess", () => {
    let state = withBlocks([makeBlock({ startAt: 0, endAt: 1_000_000 })]);
    state = grantAccessWindow(state, PKG, 1000);
    const result = handleForegroundChanged(state, PKG, 1000 + ACCESS_WINDOW_MS);
    expect(result.actions).toEqual([{ type: "ShowAccess", packageName: PKG }]);
  });

  it("al vencer la espera, con el bloqueo todavía activo, vuelve a pedir ShowAccess", () => {
    let state = withBlocks([makeBlock({ startAt: 0, endAt: 1_000_000 })]);
    state = recordChallengeFailure(state, PKG, 1000);
    const result = handleForegroundChanged(state, PKG, 1000 + COOLDOWN_MS);
    expect(result.actions).toEqual([{ type: "ShowAccess", packageName: PKG }]);
  });

  it("si el bloqueo termina mientras había una espera o ventana, se libera la app de inmediato", () => {
    let state = withBlocks([makeBlock({ startAt: 0, endAt: 2000 })]);
    state = recordChallengeFailure(state, PKG, 1000); // espera hasta 1000+5min, muy después de que el bloqueo termine
    const result = handleForegroundChanged(state, PKG, 2500); // el bloqueo ya terminó
    expect(result.state.blocks).toEqual([]);
    expect(result.actions).toEqual([]); // libre, sin ShowWait aunque el cooldown (por reloj) siga vigente
  });
});

describe("handleTick", () => {
  it("re-evalúa la app en primer plano sin que haya cambiado de app", () => {
    let state = withBlocks([makeBlock({ startAt: 0, endAt: 100_000 })]);
    state = handleForegroundChanged(state, PKG, 1000).state;
    const result = handleTick(state, 2000);
    expect(result.actions).toEqual([{ type: "ShowAccess", packageName: PKG }]);
  });

  it("quita un bloqueo vencido en el primer tick tras su fin", () => {
    let state = withBlocks([makeBlock({ startAt: 0, endAt: 1000 })]);
    state = handleForegroundChanged(state, PKG, 500).state;
    const result = handleTick(state, 1500);
    expect(result.state.blocks).toEqual([]);
  });

  it("avisa 2 minutos antes de que empiece un bloqueo programado, una sola vez", () => {
    const block = makeBlock({ type: "scheduled", startAt: 100_000, endAt: 200_000 });
    let state = withBlocks([block]);

    const before = handleTick(state, 100_000 - 3 * 60_000); // 3 min antes, todavía no
    expect(before.actions).toEqual([]);

    const warned = handleTick(before.state, 100_000 - 60_000); // 1 min antes, dentro del margen de 2 min
    expect(warned.actions).toEqual([{ type: "NotifyBlockStarting", blockId: "b1" }]);
    expect(warned.state.blocks[0].warnedStart).toBe(true);

    const again = handleTick(warned.state, 100_000 - 30_000); // sigue antes del inicio, ya avisado
    expect(again.actions).toEqual([]);
  });

  it("no avisa de un bloqueo tipo 'duration' (siempre arranca ya, nunca hay margen que avisar)", () => {
    const block = makeBlock({ type: "duration", startAt: 0, endAt: 100_000, warnedStart: false });
    const state = withBlocks([block]);
    const result = handleTick(state, 1000);
    expect(result.actions).toEqual([]);
  });
});

describe("handleScreenOn / handleScreenOff", () => {
  it("handleScreenOn reevalúa de inmediato, igual que un tick", () => {
    const state = withBlocks([makeBlock({ startAt: 0, endAt: 100_000 })]);
    const foreground = handleForegroundChanged(state, PKG, 500).state;
    const result = handleScreenOn(foreground, 1000);
    expect(result.actions).toEqual([{ type: "ShowAccess", packageName: PKG }]);
  });

  it("handleScreenOff no hace nada (sin acumulación de uso que cerrar)", () => {
    const state = withBlocks([makeBlock()]);
    const result = handleScreenOff(state);
    expect(result).toEqual({ state, actions: [] });
  });
});

describe("grantAccessWindow / recordChallengeFailure", () => {
  it("grantAccessWindow concede exactamente 2 minutos y limpia cualquier espera previa", () => {
    let state = createPolicyState();
    state = recordChallengeFailure(state, PKG, 1000);
    state = grantAccessWindow(state, PKG, 2000);
    expect(state.apps[PKG]).toEqual({ windowEndsAt: 2000 + ACCESS_WINDOW_MS, cooldownUntil: null });
  });

  it("recordChallengeFailure fija 5 minutos exactos y limpia cualquier ventana previa", () => {
    let state = createPolicyState();
    state = grantAccessWindow(state, PKG, 1000);
    state = recordChallengeFailure(state, PKG, 2000);
    expect(state.apps[PKG]).toEqual({ cooldownUntil: 2000 + COOLDOWN_MS, windowEndsAt: null });
  });

  it("solo afecta el estado de la app indicada, otras apps no se tocan", () => {
    let state = createPolicyState();
    state = recordChallengeFailure(state, PKG, 1000);
    expect(state.apps["com.whatsapp"]).toBeUndefined();
  });
});
