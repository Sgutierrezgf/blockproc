import type { Area } from "./types";

// RF-2: configuración global única para todas las apps restringidas.
export interface Config {
  restrictedPackages: string[];
  dailyLimitMin: number;
  questionCount: number;
  accessWindowMin: number;
  areas: Area[];
  focusMessage: string;
  restBlockMessage: string;
}

export const AREAS: readonly Area[] = ["general", "technology", "health", "science", "math"];

// RF-4: límite diario de 5 a 240 minutos, en pasos de 5.
export const DAILY_LIMIT_MIN = 5;
export const DAILY_LIMIT_MAX = 240;
export const DAILY_LIMIT_STEP = 5;
// RF-3: 30 minutos si el usuario no define un límite.
export const DAILY_LIMIT_DEFAULT = 30;

// RF-4: de 1 a 3 preguntas por reto.
export const QUESTION_COUNT_MIN = 1;
export const QUESTION_COUNT_MAX = 3;
// RF-41: 2 preguntas en la configuración por defecto.
export const QUESTION_COUNT_DEFAULT = 2;

// RF-4: ventana de acceso de 5 a 10 minutos.
export const ACCESS_WINDOW_MIN = 5;
export const ACCESS_WINDOW_MAX = 10;
// RF-41: 5 minutos en la configuración por defecto.
export const ACCESS_WINDOW_DEFAULT = 5;

// RF-6, RF-35: mensajes de hasta 120 caracteres.
export const FOCUS_MESSAGE_MAX_LENGTH = 120;
export const REST_BLOCK_MESSAGE_MAX_LENGTH = 120;

export const DEFAULT_FOCUS_MESSAGE =
  "Vuelve a lo que estabas haciendo. Tú decides en qué inviertes tu tiempo.";
export const DEFAULT_REST_BLOCK_MESSAGE =
  "Bloqueo activo hasta las {hora de fin}. Este tiempo es para ti.";

// RF-41: área de conocimiento general en la configuración por defecto.
export const DEFAULT_AREAS: Area[] = ["general"];

export function createDefaultConfig(): Config {
  return {
    restrictedPackages: [],
    dailyLimitMin: DAILY_LIMIT_DEFAULT,
    questionCount: QUESTION_COUNT_DEFAULT,
    accessWindowMin: ACCESS_WINDOW_DEFAULT,
    areas: [...DEFAULT_AREAS],
    focusMessage: DEFAULT_FOCUS_MESSAGE,
    restBlockMessage: DEFAULT_REST_BLOCK_MESSAGE,
  };
}

export function isValidDailyLimitMin(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= DAILY_LIMIT_MIN &&
    value <= DAILY_LIMIT_MAX &&
    value % DAILY_LIMIT_STEP === 0
  );
}

export function isValidQuestionCount(value: number): boolean {
  return Number.isInteger(value) && value >= QUESTION_COUNT_MIN && value <= QUESTION_COUNT_MAX;
}

export function isValidAccessWindowMin(value: number): boolean {
  return Number.isInteger(value) && value >= ACCESS_WINDOW_MIN && value <= ACCESS_WINDOW_MAX;
}

// RF-5: mínimo una área, todas de la lista conocida.
export function isValidAreas(areas: Area[]): boolean {
  return Array.isArray(areas) && areas.length >= 1 && areas.every((area) => AREAS.includes(area));
}

export function isValidMessage(message: string, maxLength: number = FOCUS_MESSAGE_MAX_LENGTH): boolean {
  return typeof message === "string" && message.length <= maxLength;
}

/** RF-5 (T56): marca o desmarca un área; no hace nada si dejaría cero áreas marcadas. */
export function toggleArea(areas: Area[], area: Area): Area[] {
  if (areas.includes(area)) {
    return areas.length > 1 ? areas.filter((a) => a !== area) : areas;
  }
  return [...areas, area];
}
