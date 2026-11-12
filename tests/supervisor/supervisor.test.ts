import { createFakeClock } from "../../blockproc/src/core/clock";
import { createInMemoryStore } from "../../blockproc/src/storage/keyValueStore";
import { createPolicyState } from "../../blockproc/src/core/policy";
import type { Block } from "../../blockproc/src/core/blocks";
import { loadPolicyState, savePolicyState } from "../../blockproc/src/supervisor/policyRepository";
import { createSupervisor } from "../../blockproc/src/supervisor/supervisor";
import type { NativeAdapter } from "../../blockproc/src/supervisor/nativeAdapter";
import { loadConfig, saveConfig } from "../../blockproc/src/storage/appRepository";

const PKG = "com.instagram.android";

type Call =
  | { type: "showChallenge"; packageName: string }
  | { type: "showWait"; packageName: string }
  | { type: "goHome" }
  | { type: "showNotification"; notifyType: string; title: string; text: string };

function createFakeNativeAdapter(): NativeAdapter & { calls: Call[]; modes: string[] } {
  const calls: Call[] = [];
  // Aparte de calls: el modo se informa en cada evento (D4) y ensuciaría las
  // aserciones sobre las acciones de la política.
  const modes: string[] = [];
  return {
    calls,
    modes,
    showChallenge: (packageName) => calls.push({ type: "showChallenge", packageName }),
    showWait: (packageName) => calls.push({ type: "showWait", packageName }),
    goHome: () => calls.push({ type: "goHome" }),
    showNotification: (notifyType, title, text) => calls.push({ type: "showNotification", notifyType, title, text }),
    setMonitorMode: (mode) => modes.push(mode),
  };
}

function makeBlock(overrides: Partial<Block> = {}): Block {
  return {
    id: "b1",
    packages: [PKG],
    type: "duration",
    startAt: 0,
    endAt: 1_000_000,
    category: "general",
    focusMessage: "foco",
    blockMessage: "bloqueado",
    warnedStart: false,
    extreme: false,
    ...overrides,
  };
}

function seedBlocks(store: ReturnType<typeof createInMemoryStore>, blocks: Block[]): void {
  savePolicyState(store, { ...createPolicyState(), blocks });
}

// RF-27, RF-62, RF-63: el supervisor conecta eventos nativos con el
// reductor (policy.ts) y con lo nativo, guardando el estado tras cada evento.
describe("createSupervisor", () => {
  it("un ForegroundChanged con un bloqueo activo cubriendo la app dispara ShowAccess y guarda el estado", () => {
    const clock = createFakeClock(0);
    const store = createInMemoryStore();
    seedBlocks(store, [makeBlock()]);
    const native = createFakeNativeAdapter();
    const supervisor = createSupervisor({ native, store, clock });

    supervisor.onForegroundChanged(PKG);

    expect(native.calls).toEqual([{ type: "showChallenge", packageName: PKG }]);
    const saved = loadPolicyState(store);
    expect(saved.foregroundPackage).toBe(PKG);
  });

  it("una app sin ningún bloqueo que la cubra no dispara ninguna acción, pero igual guarda el estado", () => {
    const clock = createFakeClock(0);
    const store = createInMemoryStore();
    const native = createFakeNativeAdapter();
    const supervisor = createSupervisor({ native, store, clock });

    supervisor.onForegroundChanged("com.chrome.browser");
    expect(native.calls).toEqual([]);

    const saved = loadPolicyState(store);
    expect(saved.foregroundPackage).toBe("com.chrome.browser");
  });

  it("NotifyBlockStarting se traduce en showNotification con el tipo \"blockStarting\"", () => {
    const clock = createFakeClock(0);
    const store = createInMemoryStore();
    seedBlocks(store, [makeBlock({ type: "scheduled", startAt: 100_000, endAt: 200_000 })]);
    const native = createFakeNativeAdapter();
    const supervisor = createSupervisor({ native, store, clock });

    clock.advance(100_000 - 60_000); // 1 minuto antes de que empiece (RF-68)
    supervisor.onTick();

    expect(native.calls).toEqual([
      {
        type: "showNotification",
        notifyType: "blockStarting",
        title: "Bloqueo programado",
        text: "El bloqueo programado empieza en 2 minutos.",
      },
    ]);
  });

  // RF-76, RF-77: el aviso sale en el idioma elegido por el usuario, leído de
  // la configuración guardada en cada evento (la tarea Headless no tiene UI).
  it("NotifyBlockStarting usa el idioma configurado (inglés)", () => {
    const clock = createFakeClock(0);
    const store = createInMemoryStore();
    saveConfig(store, { ...loadConfig(store), language: "en" });
    seedBlocks(store, [makeBlock({ type: "scheduled", startAt: 100_000, endAt: 200_000 })]);
    const native = createFakeNativeAdapter();
    const supervisor = createSupervisor({ native, store, clock });

    clock.advance(100_000 - 60_000);
    supervisor.onTick();

    expect(native.calls).toEqual([
      {
        type: "showNotification",
        notifyType: "blockStarting",
        title: "Scheduled block",
        text: "Your scheduled block starts in 2 minutes.",
      },
    ]);
  });

  it("una segunda instancia del supervisor retoma el estado guardado por la primera (como tras un reinicio)", () => {
    const clock = createFakeClock(0);
    const store = createInMemoryStore();
    seedBlocks(store, [makeBlock()]);
    const primero = createSupervisor({ native: createFakeNativeAdapter(), store, clock });

    primero.onForegroundChanged(PKG); // guarda foregroundPackage = PKG

    const native = createFakeNativeAdapter();
    const segundo = createSupervisor({ native, store, clock });
    // Si de verdad partió del estado guardado (no de uno nuevo en blanco),
    // el bloqueo sembrado sigue ahí y un Tick ya dispara ShowAccess.
    segundo.onTick();

    expect(native.calls).toEqual([{ type: "showChallenge", packageName: PKG }]);
  });

  it("onScreenOff / onScreenOn no disparan acciones por sí solos sin ningún bloqueo", () => {
    const clock = createFakeClock(0);
    const store = createInMemoryStore();
    const native = createFakeNativeAdapter();
    const supervisor = createSupervisor({ native, store, clock });

    supervisor.onForegroundChanged(PKG);
    supervisor.onScreenOff();
    clock.advance(10_000_000);
    supervisor.onScreenOn();

    expect(native.calls).toEqual([]);
  });

  // D4 (batería): tras cada evento el supervisor le dice a lo nativo si
  // sondear rápido (watch) o espaciado (idle), según el estado ya guardado.
  it("informa el modo de sondeo tras cada evento", () => {
    const clock = createFakeClock(0);
    const store = createInMemoryStore();
    seedBlocks(store, [makeBlock({ startAt: 10_000_000, endAt: 20_000_000 })]);
    const native = createFakeNativeAdapter();
    const supervisor = createSupervisor({ native, store, clock });

    supervisor.onTick();
    clock.advance(10_000_000 - 60_000);
    supervisor.onScreenOn();
    clock.advance(20_000_000);
    supervisor.onForegroundChanged(PKG);
    supervisor.onScreenOff();

    expect(native.modes).toEqual(["idle", "watch", "idle", "idle"]);
  });
});
