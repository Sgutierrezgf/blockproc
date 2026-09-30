import { createDefaultConfig } from "../../blockproc/src/core/config";
import type { Config } from "../../blockproc/src/core/config";
import { createPolicyState } from "../../blockproc/src/core/policy";
import type { PolicyState } from "../../blockproc/src/core/policy";
import { getUsageDayKey } from "../../blockproc/src/core/clock";
import { applyAndSaveConfig, readCurrentConfigState } from "../../blockproc/src/settings/applyAndSaveConfig";
import { loadConfig, loadPendingConfig, savePendingConfig } from "../../blockproc/src/storage/appRepository";
import { createInMemoryStore } from "../../blockproc/src/storage/keyValueStore";
import { savePolicyState } from "../../blockproc/src/supervisor/policyRepository";

const PKG = "com.instagram.android";
const MIN = 60_000;

function configCon(cambios: Partial<Config>): Config {
  return { ...createDefaultConfig(), restrictedPackages: [PKG], dailyLimitMin: 30, ...cambios };
}

function guardarEstado(store: ReturnType<typeof createInMemoryStore>, cambios: Partial<PolicyState>) {
  savePolicyState(store, { ...createPolicyState(), ...cambios });
}

// RF-19, RF-29 (T57): conecta applyConfigUpdate (fase 2, ya probado a fondo)
// con el almacenamiento real y con el estado del supervisor, para saber si
// hay una app bloqueada o un bloqueo horario activo en este mismo instante.
describe("applyAndSaveConfig", () => {
  it("sin ninguna app bloqueada, un cambio que relaja se aplica de inmediato", () => {
    const store = createInMemoryStore();
    const oldConfig = configCon({ dailyLimitMin: 30 });
    guardarEstado(store, { usage: { ...createPolicyState().usage, usedMs: {} } });

    const result = applyAndSaveConfig(store, oldConfig, { ...oldConfig, dailyLimitMin: 60 }, 0);

    expect(result.config.dailyLimitMin).toBe(60);
    expect(result.pending).toBeNull();
    expect(loadConfig(store).dailyLimitMin).toBe(60);
  });

  it("con una app ya bloqueada, subir el límite (relaja) queda pendiente", () => {
    const store = createInMemoryStore();
    const oldConfig = configCon({ dailyLimitMin: 30 });
    // La app ya agotó su límite de hoy.
    guardarEstado(store, { usage: { ...createPolicyState().usage, usedMs: { [PKG]: 30 * MIN } } });

    const result = applyAndSaveConfig(store, oldConfig, { ...oldConfig, dailyLimitMin: 60 }, 0);

    expect(result.config.dailyLimitMin).toBe(30); // sigue el valor de antes por ahora
    expect(result.pending).not.toBeNull();
    expect(result.pending?.config.dailyLimitMin).toBe(60);
    expect(loadConfig(store).dailyLimitMin).toBe(30);
    expect(loadPendingConfig(store)?.config.dailyLimitMin).toBe(60);
  });

  it("con una app bloqueada, bajar el límite (endurece) se aplica de inmediato", () => {
    const store = createInMemoryStore();
    const oldConfig = configCon({ dailyLimitMin: 30 });
    guardarEstado(store, { usage: { ...createPolicyState().usage, usedMs: { [PKG]: 30 * MIN } } });

    const result = applyAndSaveConfig(store, oldConfig, { ...oldConfig, dailyLimitMin: 15 }, 0);

    expect(result.config.dailyLimitMin).toBe(15);
    expect(result.pending).toBeNull();
  });

  it("con un bloqueo horario activo, se rechaza cualquier cambio", () => {
    const store = createInMemoryStore();
    const oldConfig = configCon({ dailyLimitMin: 30 });
    guardarEstado(store, { restBlock: { startAt: 0, endAt: 1000, cancelled: false, warned2min: false } });

    const result = applyAndSaveConfig(store, oldConfig, { ...oldConfig, dailyLimitMin: 60 }, 500);

    expect(result.config.dailyLimitMin).toBe(30);
    expect(result.pending).toBeNull();
    expect(result.isEditingLocked).toBe(true);
    expect(loadConfig(store).dailyLimitMin).toBe(30);
  });
});

describe("readCurrentConfigState", () => {
  it("sin nada pendiente, da la config guardada tal cual", () => {
    const store = createInMemoryStore();
    const result = readCurrentConfigState(store, 0);
    expect(result.config).toEqual(createDefaultConfig());
    expect(result.pending).toBeNull();
    expect(result.isEditingLocked).toBe(false);
  });

  it("dice que está bloqueada la edición si el bloqueo horario sigue activo", () => {
    const store = createInMemoryStore();
    guardarEstado(store, { restBlock: { startAt: 0, endAt: 1000, cancelled: false, warned2min: false } });
    expect(readCurrentConfigState(store, 500).isEditingLocked).toBe(true);
    expect(readCurrentConfigState(store, 2000).isEditingLocked).toBe(false);
  });

  it("resuelve lo pendiente en cuanto cruza las 04:00 (RF-29)", () => {
    const store = createInMemoryStore();
    const config = configCon({ dailyLimitMin: 30 });
    const pendiente = { config: { ...config, dailyLimitMin: 60 }, dayKey: getUsageDayKey(0) };
    savePendingConfig(store, pendiente);

    // Todavía el mismo día de uso: sigue pendiente.
    const antes = readCurrentConfigState(store, 60_000);
    expect(antes.pending).toEqual(pendiente);

    // Ya cruzó a un día de uso distinto: se aplica y se guarda sin nada pendiente.
    const unDiaDespues = 26 * 60 * MIN; // bien pasadas las 04:00 del día siguiente
    const despues = readCurrentConfigState(store, unDiaDespues);
    expect(despues.pending).toBeNull();
    expect(despues.config.dailyLimitMin).toBe(60);
    expect(loadPendingConfig(store)).toBeNull();
  });
});
