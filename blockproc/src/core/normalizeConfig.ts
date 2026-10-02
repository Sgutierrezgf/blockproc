import { createDefaultConfig, isValidMessage } from "./config";
import type { Config } from "./config";

// RF-41: configuración corrupta, del modelo anterior, o primera ejecución →
// valores por defecto. Repara campo por campo en vez de descartar toda la
// configuración: un mensaje dañado no debería borrar el otro.
export function normalizeConfig(raw: unknown): Config {
  const defaults = createDefaultConfig();
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return defaults;
  }

  const candidate = raw as Partial<Record<keyof Config, unknown>>;

  const defaultFocusMessage =
    typeof candidate.defaultFocusMessage === "string" && isValidMessage(candidate.defaultFocusMessage)
      ? candidate.defaultFocusMessage
      : defaults.defaultFocusMessage;

  const defaultBlockMessage =
    typeof candidate.defaultBlockMessage === "string" && isValidMessage(candidate.defaultBlockMessage)
      ? candidate.defaultBlockMessage
      : defaults.defaultBlockMessage;

  return { defaultFocusMessage, defaultBlockMessage };
}

/**
 * Igual que normalizeConfig, pero a partir del texto tal como sale del
 * almacenamiento. Un JSON corrupto, vacío, o con la forma del modelo
 * anterior (campos como `dailyLimitMin`/`restrictedPackages`, que ya no
 * existen en `Config`) cae en los valores por defecto, sin propagar la
 * excepción de JSON.parse.
 */
export function parseStoredConfig(json: string | null | undefined): Config {
  if (!json) {
    return createDefaultConfig();
  }
  try {
    return normalizeConfig(JSON.parse(json));
  } catch {
    return createDefaultConfig();
  }
}
