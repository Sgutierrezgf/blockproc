import type { Config } from "../core/config";
import { parseStoredConfig } from "../core/normalizeConfig";
import type { KeyValueStore } from "./keyValueStore";

// RF-25: guarda y lee los mensajes por defecto (Personalización) en el
// `KeyValueStore` (MMKV en producción, T49). RF-41: la reparación ante datos
// dañados o del modelo anterior vive en normalizeConfig; aquí solo se
// conecta con el almacén. Fase 10: ya no hay `usage` (RF-36 retirado) ni
// `pendingConfig` (D35: Personalización se guarda directo, sin nada diferido).
const CONFIG_KEY = "config";

export function loadConfig(store: KeyValueStore): Config {
  return parseStoredConfig(store.getString(CONFIG_KEY));
}

export function saveConfig(store: KeyValueStore, config: Config): void {
  store.setString(CONFIG_KEY, JSON.stringify(config));
}
