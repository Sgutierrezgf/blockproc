import { createDefaultConfig } from "../../blockproc/src/core/config";
import { createInMemoryStore } from "../../blockproc/src/storage/keyValueStore";
import {
  loadConfig,
  loadPendingConfig,
  loadUsage,
  saveConfig,
  savePendingConfig,
  saveUsage,
} from "../../blockproc/src/storage/appRepository";

// RF-25: guardar y leer el estado (config y contadores de uso) en el
// dispositivo. RF-41: ante datos dañados, valores por defecto y contadores a
// cero. El "doble en memoria" (T35) hace de MMKV para poder probar esto sin
// dispositivo; T49 conectará el mismo repositorio a MMKV real.
describe("appRepository — config", () => {
  it("sin nada guardado, da la configuración por defecto", () => {
    const store = createInMemoryStore();
    expect(loadConfig(store)).toEqual(createDefaultConfig());
  });

  it("guarda y vuelve a leer la misma configuración", () => {
    const store = createInMemoryStore();
    const config = { ...createDefaultConfig(), dailyLimitMin: 45, restrictedPackages: ["com.instagram.android"] };
    saveConfig(store, config);
    expect(loadConfig(store)).toEqual(config);
  });

  it("ante un dato de config dañado, restaura los valores por defecto (RF-41)", () => {
    const store = createInMemoryStore();
    store.setString("config", "esto no es json{");
    expect(loadConfig(store)).toEqual(createDefaultConfig());
  });
});

describe("appRepository — usage", () => {
  it("sin nada guardado, da los contadores en cero", () => {
    const store = createInMemoryStore();
    expect(loadUsage(store)).toEqual({ usedMs: {}, dayKey: null });
  });

  it("guarda y vuelve a leer los mismos contadores", () => {
    const store = createInMemoryStore();
    const usage = { usedMs: { "com.instagram.android": 300_000 }, dayKey: "2026-01-05" };
    saveUsage(store, usage);
    expect(loadUsage(store)).toEqual(usage);
  });

  it("ante un dato de uso dañado, pone los contadores a cero (RF-41)", () => {
    const store = createInMemoryStore();
    store.setString("usage", "esto no es json{");
    expect(loadUsage(store)).toEqual({ usedMs: {}, dayKey: null });
  });

  it("un dato de config dañado no afecta al de uso guardado (claves independientes)", () => {
    const store = createInMemoryStore();
    const usage = { usedMs: { "com.instagram.android": 120_000 }, dayKey: "2026-01-05" };
    saveUsage(store, usage);
    store.setString("config", "esto no es json{");
    expect(loadUsage(store)).toEqual(usage);
    expect(loadConfig(store)).toEqual(createDefaultConfig());
  });
});

// RF-19, RF-29 (T57): el cambio que queda pendiente hasta las 04:00
// siguientes también tiene que sobrevivir a cerrar y reabrir la app.
describe("appRepository — pendingConfig", () => {
  it("sin nada guardado, da null", () => {
    const store = createInMemoryStore();
    expect(loadPendingConfig(store)).toBeNull();
  });

  it("guarda y vuelve a leer el mismo pendiente", () => {
    const store = createInMemoryStore();
    const pending = { config: { ...createDefaultConfig(), dailyLimitMin: 60 }, dayKey: "2026-01-05" };
    savePendingConfig(store, pending);
    expect(loadPendingConfig(store)).toEqual(pending);
  });

  it("guardar null borra el pendiente anterior", () => {
    const store = createInMemoryStore();
    const pending = { config: createDefaultConfig(), dayKey: "2026-01-05" };
    savePendingConfig(store, pending);
    savePendingConfig(store, null);
    expect(loadPendingConfig(store)).toBeNull();
  });

  it("ante un dato dañado, da null (no revienta)", () => {
    const store = createInMemoryStore();
    store.setString("pendingConfig", "esto no es json{");
    expect(loadPendingConfig(store)).toBeNull();
  });
});
