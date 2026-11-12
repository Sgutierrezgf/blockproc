import { AREAS } from "./config";
import type { Language } from "./config";
import type { Area } from "./types";

// RF-24: "math" no vive en el banco de texto: la genera mathQuestions.ts al
// vuelo, así que no le exigimos un mínimo de preguntas guardadas.
const TEXT_AREAS: Area[] = AREAS.filter((area) => area !== "math");

/** Criterios de finalización de la fase 3: al menos 60 preguntas por área de texto. */
export const MIN_QUESTIONS_PER_TEXT_AREA = 60;

// RF-23: formato de una pregunta del banco local. La matemática y lógica
// (RF-24) no vive en este archivo: la produce un generador, no el banco.
export interface Question {
  id: string;
  area: Area;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export const OPTIONS_COUNT = 4;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Valida el formato de una sola pregunta (no comprueba duplicados: eso es del banco completo). */
export function isValidQuestion(value: unknown): value is Question {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const q = value as Partial<Record<keyof Question, unknown>>;

  if (!isNonEmptyString(q.id)) return false;
  if (typeof q.area !== "string" || !AREAS.includes(q.area as Area)) return false;
  if (!isNonEmptyString(q.question)) return false;
  if (!Array.isArray(q.options) || q.options.length !== OPTIONS_COUNT) return false;
  if (!q.options.every(isNonEmptyString)) return false;
  if (typeof q.correctIndex !== "number" || !Number.isInteger(q.correctIndex)) return false;
  if (q.correctIndex < 0 || q.correctIndex >= OPTIONS_COUNT) return false;
  if (q.explanation !== undefined && typeof q.explanation !== "string") return false;

  return true;
}

/** Los ids que aparecen más de una vez en el banco. */
export function findDuplicateQuestionIds(questions: Question[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const question of questions) {
    if (seen.has(question.id)) {
      duplicates.add(question.id);
    }
    seen.add(question.id);
  }
  return [...duplicates];
}

/** RF-23: cada pregunta tiene un formato válido y no hay ids duplicados en el banco. */
export function isValidQuestionBank(value: unknown): value is Question[] {
  if (!Array.isArray(value)) {
    return false;
  }
  if (!value.every(isValidQuestion)) {
    return false;
  }
  return findDuplicateQuestionIds(value).length === 0;
}

/** T45: ninguna área de texto puede tener menos del mínimo (RF-23, criterios de finalización). */
export function hasMinimumQuestionsPerArea(
  questions: Question[],
  min: number = MIN_QUESTIONS_PER_TEXT_AREA
): boolean {
  const counts = new Map<Area, number>();
  for (const question of questions) {
    counts.set(question.area, (counts.get(question.area) ?? 0) + 1);
  }
  return TEXT_AREAS.every((area) => (counts.get(area) ?? 0) >= min);
}

/** RF-77: elige el banco del idioma activo; quien llama trae los bancos ya cargados (JSON estático). */
export function selectQuestionBank(language: Language, banks: Record<Language, Question[]>): Question[] {
  return banks[language];
}
