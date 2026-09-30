import type { Question } from "./questions";
import { randomInt } from "./random";
import type { Random } from "./random";
import type { Area } from "./types";

// RF-11: exactamente la cantidad pedida, mezcladas de las áreas marcadas,
// sin repetir una pregunta hasta haber usado todas las de esas áreas. Si
// quedan menos preguntas sin usar que las pedidas, reinicia el ciclo y
// completa el reto sin repetir ninguna pregunta dentro de ese mismo reto.
export interface QuestionCycleState {
  /** Ids ya usados en el ciclo actual (se reinicia al agotarse). */
  usedIds: Set<string>;
}

export function createQuestionCycleState(): QuestionCycleState {
  return { usedIds: new Set() };
}

export interface SelectQuestionsResult {
  questions: Question[];
  state: QuestionCycleState;
}

export function selectQuestions(
  state: QuestionCycleState,
  pool: Question[],
  areas: Area[],
  count: number,
  random: Random
): SelectQuestionsResult {
  const candidates = pool.filter((question) => areas.includes(question.area));

  let usedIds = new Set(state.usedIds);
  let available = candidates.filter((question) => !usedIds.has(question.id));

  const selected: Question[] = [];
  const selectedIds = new Set<string>();

  while (selected.length < count) {
    if (available.length === 0) {
      // Se agotó el ciclo: se reinicia, pero sin repetir lo que ya se dio
      // en ESTE reto (aunque venga de un ciclo anterior).
      usedIds = new Set();
      available = candidates.filter((question) => !selectedIds.has(question.id));
      if (available.length === 0) {
        break; // el pool entero es más chico que `count`: no hay más que dar
      }
    }
    const index = randomInt(random, 0, available.length - 1);
    const [question] = available.splice(index, 1);
    selected.push(question);
    selectedIds.add(question.id);
    usedIds.add(question.id);
  }

  return { questions: selected, state: { usedIds } };
}
