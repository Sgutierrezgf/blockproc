import type { Area } from "./types";

// Fase 10 (rediseño): ya no hay configuración global de límite/preguntas/
// ventana/áreas/apps restringidas — todo eso ahora vive por bloqueo
// (core/blocks.ts). Lo único que queda en Personalización son los mensajes
// por defecto que prellenan el paso de mensajes al crear un bloqueo (RF-70).
// Fase 11: se suma el idioma de la app (RF-78), español por defecto.
export type Language = "es" | "en";

export interface Config {
  defaultFocusMessage: string;
  defaultBlockMessage: string;
  language: Language;
}

export const AREAS: readonly Area[] = ["general", "technology", "health", "science", "math"];

// RF-70: mensajes de hasta 120 caracteres (mismo límite que antes, RF-6/RF-35).
export const FOCUS_MESSAGE_MAX_LENGTH = 120;
export const BLOCK_MESSAGE_MAX_LENGTH = 120;

export const DEFAULT_FOCUS_MESSAGE =
  "Vuelve a lo que estabas haciendo. Tú decides en qué inviertes tu tiempo.";
export const DEFAULT_BLOCK_MESSAGE = "Bloqueo activo hasta las {hora de fin}. Este tiempo es para ti.";

export function createDefaultConfig(): Config {
  return {
    defaultFocusMessage: DEFAULT_FOCUS_MESSAGE,
    defaultBlockMessage: DEFAULT_BLOCK_MESSAGE,
    language: "es",
  };
}

export function isValidMessage(message: string, maxLength: number = FOCUS_MESSAGE_MAX_LENGTH): boolean {
  return typeof message === "string" && message.length <= maxLength;
}
