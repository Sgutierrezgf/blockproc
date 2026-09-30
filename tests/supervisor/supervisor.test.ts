import { createDefaultConfig } from "../../blockproc/src/core/config";
import type { Config } from "../../blockproc/src/core/config";
import { createFakeClock } from "../../blockproc/src/core/clock";
import { createInMemoryStore } from "../../blockproc/src/storage/keyValueStore";
import { loadPolicyState } from "../../blockproc/src/supervisor/policyRepository";
import { createSupervisor } from "../../blockproc/src/supervisor/supervisor";
import type { NativeAdapter } from "../../blockproc/src/supervisor/nativeAdapter";

const PKG = "com.instagram.android";

type Call =
  | { type: "showChallenge"; packageName: string }
  | { type: "showWait"; packageName: string }
  | { type: "showRestBlock" }
  | { type: "goHome" }
  | { type: "showNotification"; notifyType: string; text: string };

function createFakeNativeAdapter(): NativeAdapter & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    showChallenge: (packageName) => calls.push({ type: "showChallenge", packageName }),
    showWait: (packageName) => calls.push({ type: "showWait", packageName }),
    showRestBlock: () => calls.push({ type: "showRestBlock" }),
    goHome: () => calls.push({ type: "goHome" }),
    showNotification: (notifyType, text) => calls.push({ type: "showNotification", notifyType, text }),
  };
}

function configCon(cambios: Partial<Config>): Config {
  return { ...createDefaultConfig(), restrictedPackages: [PKG], dailyLimitMin: 5, ...cambios }; // 300_000 ms
}

// RF-9, RF-27: el supervisor conecta eventos nativos con el reductor
// (policy.ts) y con lo nativo, guardando el estado tras cada evento.
describe("createSupervisor", () => {
  it("un ForegroundChanged que abre una app ya bloqueada dispara ShowChallenge y guarda el estado", () => {
    const config = configCon({});
    const clock = createFakeClock(0);
    const store = createInMemoryStore();
    const native = createFakeNativeAdapter();
    const supervisor = createSupervisor({ native, store, clock, getConfig: () => config });

    supervisor.onForegroundChanged(PKG); // abre la app restringida
    clock.advance(300_000); // agota el límite mientras sigue abierta
    supervisor.onForegroundChanged(null); // la cierra
    clock.advance(1_000);

    supervisor.onForegroundChanged(PKG); // la vuelve a abrir: ya está bloqueada
    expect(native.calls).toEqual([{ type: "showChallenge", packageName: PKG }]);

    const saved = loadPolicyState(store);
    expect(saved.usage.foregroundPackage).toBe(PKG);
    expect(saved.usage.usedMs[PKG]).toBeGreaterThanOrEqual(300_000);
  });

  it("una app no restringida en primer plano no dispara ninguna acción, pero igual guarda el estado", () => {
    const config = configCon({});
    const clock = createFakeClock(0);
    const store = createInMemoryStore();
    const native = createFakeNativeAdapter();
    const supervisor = createSupervisor({ native, store, clock, getConfig: () => config });

    supervisor.onForegroundChanged("com.chrome.browser");
    expect(native.calls).toEqual([]);

    const saved = loadPolicyState(store);
    expect(saved.usage.foregroundPackage).toBe("com.chrome.browser");
  });

  it("NotifyLimitWarning se traduce en showNotification con el tipo \"limit\"", () => {
    const config = configCon({});
    const clock = createFakeClock(0);
    const store = createInMemoryStore();
    const native = createFakeNativeAdapter();
    const supervisor = createSupervisor({ native, store, clock, getConfig: () => config });

    supervisor.onForegroundChanged(PKG);
    clock.advance(300_000 - 60_000); // a falta de 1 min del límite (RF-30)
    supervisor.onTick();

    expect(native.calls).toEqual([
      { type: "showNotification", notifyType: "limit", text: expect.any(String) },
    ]);
  });

  it("una segunda instancia del supervisor retoma el estado guardado por la primera (como tras un reinicio)", () => {
    const config = configCon({});
    const clock = createFakeClock(0);
    const store = createInMemoryStore();
    const primero = createSupervisor({ native: createFakeNativeAdapter(), store, clock, getConfig: () => config });

    primero.onForegroundChanged(PKG);
    clock.advance(120_000);
    primero.onForegroundChanged(null); // se guarda con 120_000 ms acumulados

    const native = createFakeNativeAdapter();
    const segundo = createSupervisor({ native, store, clock, getConfig: () => config });
    // Si de verdad partió del estado guardado (no de uno nuevo en blanco),
    // con 180_000 ms más alcanza justo el límite de 300_000 ms.
    segundo.onForegroundChanged(PKG);
    clock.advance(180_000);
    segundo.onTick();

    expect(native.calls).toEqual([{ type: "showChallenge", packageName: PKG }]);
  });

  it("onScreenOff / onScreenOn no disparan acciones por sí solos", () => {
    const config = configCon({});
    const clock = createFakeClock(0);
    const store = createInMemoryStore();
    const native = createFakeNativeAdapter();
    const supervisor = createSupervisor({ native, store, clock, getConfig: () => config });

    supervisor.onForegroundChanged(PKG);
    supervisor.onScreenOff();
    clock.advance(10_000_000); // pasa mucho tiempo con la pantalla apagada
    supervisor.onScreenOn();

    expect(native.calls).toEqual([]);
  });
});
