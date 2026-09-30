import type { Config } from "../core/config";
import { applyConfigUpdate, resolvePendingConfig } from "../core/configUpdate";
import type { PendingConfig } from "../core/configUpdate";
import { isRestBlockActive } from "../core/restBlock";
import { hasAnyAppReachedDailyLimit } from "../core/usage";
import { loadConfig, loadPendingConfig, saveConfig, savePendingConfig } from "../storage/appRepository";
import type { KeyValueStore } from "../storage/keyValueStore";
import { loadPolicyState } from "../supervisor/policyRepository";

export interface ConfigSyncResult {
  config: Config;
  pending: PendingConfig | null;
  /** RF-19: con el bloqueo horario activo no se permite editar nada. */
  isEditingLocked: boolean;
}

function isEditingLockedNow(store: KeyValueStore, now: number): boolean {
  const { restBlock } = loadPolicyState(store);
  return restBlock !== null && isRestBlockActive(restBlock, now);
}

/**
 * RF-29: al abrir los ajustes, resuelve lo que haya quedado pendiente de una
 * sesión anterior si ya cruzó las 04:00 (applyConfigUpdate/resolvePendingConfig,
 * ya probados en la fase 2), y guarda el resultado para no repetir el
 * cálculo en cada lectura.
 */
export function readCurrentConfigState(store: KeyValueStore, now: number): ConfigSyncResult {
  const storedPending = loadPendingConfig(store);
  const resolved = resolvePendingConfig(loadConfig(store), storedPending, now);

  if (resolved.pending === null && storedPending !== null) {
    saveConfig(store, resolved.effectiveConfig);
    savePendingConfig(store, null);
  }

  return {
    config: resolved.effectiveConfig,
    pending: resolved.pending,
    isEditingLocked: isEditingLockedNow(store, now),
  };
}

/**
 * RF-19, RF-29: aplica un cambio de configuración según haya o no una app
 * bloqueada por límite diario y un bloqueo horario activo en este instante
 * (leídos del estado real del supervisor), y guarda el resultado.
 */
export function applyAndSaveConfig(
  store: KeyValueStore,
  oldConfig: Config,
  newConfig: Config,
  now: number
): ConfigSyncResult {
  const policyState = loadPolicyState(store);
  const restBlockActive = policyState.restBlock !== null && isRestBlockActive(policyState.restBlock, now);
  const hasBlockedApp = hasAnyAppReachedDailyLimit(
    policyState.usage,
    oldConfig.restrictedPackages,
    oldConfig.dailyLimitMin,
    now
  );

  const result = applyConfigUpdate(oldConfig, newConfig, now, {
    hasBlockedApp,
    isRestBlockActive: restBlockActive,
  });

  saveConfig(store, result.effectiveConfig);
  savePendingConfig(store, result.pending);

  return { config: result.effectiveConfig, pending: result.pending, isEditingLocked: restBlockActive };
}
