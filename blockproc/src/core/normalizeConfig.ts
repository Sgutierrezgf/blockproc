import {
  createDefaultConfig,
  isValidAccessWindowMin,
  isValidAreas,
  isValidDailyLimitMin,
  isValidMessage,
  isValidQuestionCount,
} from "./config";
import type { Config } from "./config";
import type { Area } from "./types";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

// RF-41: configuración corrupta o primera ejecución → valores por defecto.
// Repara campo por campo en vez de descartar toda la configuración: un solo
// dato dañado no debería borrar el resto de las preferencias del usuario.
export function normalizeConfig(raw: unknown): Config {
  const defaults = createDefaultConfig();
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return defaults;
  }

  const candidate = raw as Partial<Record<keyof Config, unknown>>;

  const restrictedPackages = isStringArray(candidate.restrictedPackages)
    ? candidate.restrictedPackages
    : defaults.restrictedPackages;

  const dailyLimitMin =
    typeof candidate.dailyLimitMin === "number" && isValidDailyLimitMin(candidate.dailyLimitMin)
      ? candidate.dailyLimitMin
      : defaults.dailyLimitMin;

  const questionCount =
    typeof candidate.questionCount === "number" && isValidQuestionCount(candidate.questionCount)
      ? candidate.questionCount
      : defaults.questionCount;

  const accessWindowMin =
    typeof candidate.accessWindowMin === "number" && isValidAccessWindowMin(candidate.accessWindowMin)
      ? candidate.accessWindowMin
      : defaults.accessWindowMin;

  const areas =
    Array.isArray(candidate.areas) && isValidAreas(candidate.areas as Area[])
      ? (candidate.areas as Area[])
      : defaults.areas;

  const focusMessage =
    typeof candidate.focusMessage === "string" && isValidMessage(candidate.focusMessage)
      ? candidate.focusMessage
      : defaults.focusMessage;

  const restBlockMessage =
    typeof candidate.restBlockMessage === "string" && isValidMessage(candidate.restBlockMessage)
      ? candidate.restBlockMessage
      : defaults.restBlockMessage;

  return {
    restrictedPackages,
    dailyLimitMin,
    questionCount,
    accessWindowMin,
    areas,
    focusMessage,
    restBlockMessage,
  };
}

/**
 * Igual que normalizeConfig, pero a partir del texto tal como sale del
 * almacenamiento (T35). Un JSON corrupto o vacío también cae en los valores
 * por defecto, sin propagar la excepción de JSON.parse.
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
