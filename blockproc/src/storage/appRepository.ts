import type { Config } from "../core/config";
import type { PendingConfig } from "../core/configUpdate";
import { parseStoredConfig } from "../core/normalizeConfig";
import type { PersistedUsage } from "../core/normalizeUsage";
import { parseStoredUsage } from "../core/normalizeUsage";
import type { KeyValueStore } from "./keyValueStore";

// RF-25: guarda y lee el estado de la app en el `KeyValueStore` (MMKV en
// producción, T49). RF-41: la reparación ante datos dañados vive en
// normalizeConfig/normalizeUsage; aquí solo se conectan con el almacén.
const CONFIG_KEY = "config";
const USAGE_KEY = "usage";
const PENDING_CONFIG_KEY = "pendingConfig";

export function loadConfig(store: KeyValueStore): Config {
  return parseStoredConfig(store.getString(CONFIG_KEY));
}

export function saveConfig(store: KeyValueStore, config: Config): void {
  store.setString(CONFIG_KEY, JSON.stringify(config));
}

export function loadUsage(store: KeyValueStore): PersistedUsage {
  return parseStoredUsage(store.getString(USAGE_KEY));
}

export function saveUsage(store: KeyValueStore, usage: PersistedUsage): void {
  store.setString(USAGE_KEY, JSON.stringify(usage));
}

// RF-19, RF-29 (T57): el cambio de configuración que queda pendiente hasta
// las 04:00 siguientes (applyConfigUpdate, fase 2) también se guarda, para
// sobrevivir a cerrar y reabrir la app. Sin validación de forma: si el dato
// está dañado, se trata como si no hubiera ningún pendiente (RF-41).
export function loadPendingConfig(store: KeyValueStore): PendingConfig | null {
  const raw = store.getString(PENDING_CONFIG_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as PendingConfig;
  } catch {
    return null;
  }
}

export function savePendingConfig(store: KeyValueStore, pending: PendingConfig | null): void {
  if (pending === null) {
    store.delete(PENDING_CONFIG_KEY);
  } else {
    store.setString(PENDING_CONFIG_KEY, JSON.stringify(pending));
  }
}
