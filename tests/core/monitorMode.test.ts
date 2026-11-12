import type { Block } from "../../blockproc/src/core/blocks";
import { getMonitorMode, WATCH_LEAD_MS } from "../../blockproc/src/core/monitorMode";
import { createPolicyState } from "../../blockproc/src/core/policy";
import type { PolicyState } from "../../blockproc/src/core/policy";

function makeBlock(overrides: Partial<Block> = {}): Block {
  return {
    id: "b1",
    packages: ["com.example.app"],
    type: "scheduled",
    startAt: 1_000_000,
    endAt: 2_000_000,
    category: "general",
    focusMessage: "foco",
    blockMessage: "bloqueado",
    warnedStart: false,
    extreme: false,
    ...overrides,
  };
}

function stateWith(overrides: Partial<PolicyState>): PolicyState {
  return { ...createPolicyState(), ...overrides };
}

// D4 (batería): el servicio sondea rápido ("watch") solo cuando hay algo que
// vigilar; si no, espacia el sondeo y el Tick ("idle").
describe("getMonitorMode", () => {
  it("sin bloqueos ni cronómetros es idle", () => {
    expect(getMonitorMode(createPolicyState(), 0)).toBe("idle");
  });

  it("con un bloqueo activo es watch", () => {
    const state = stateWith({ blocks: [makeBlock()] });
    expect(getMonitorMode(state, 1_500_000)).toBe("watch");
  });

  it("un bloqueo programado pasa a watch justo WATCH_LEAD_MS antes de empezar", () => {
    const state = stateWith({ blocks: [makeBlock()] });
    expect(getMonitorMode(state, 1_000_000 - WATCH_LEAD_MS - 1)).toBe("idle");
    expect(getMonitorMode(state, 1_000_000 - WATCH_LEAD_MS)).toBe("watch");
  });

  it("un bloqueo terminado (aún sin limpiar) es idle", () => {
    const state = stateWith({ blocks: [makeBlock()] });
    expect(getMonitorMode(state, 2_000_000)).toBe("idle");
  });

  it("una ventana de acceso o una espera vigentes son watch; vencidas, idle", () => {
    const window = stateWith({ apps: { a: { windowEndsAt: 500, cooldownUntil: null } } });
    const cooldown = stateWith({ apps: { a: { windowEndsAt: null, cooldownUntil: 500 } } });
    expect(getMonitorMode(window, 499)).toBe("watch");
    expect(getMonitorMode(cooldown, 499)).toBe("watch");
    expect(getMonitorMode(window, 500)).toBe("idle");
    expect(getMonitorMode(cooldown, 500)).toBe("idle");
  });
});
