import type { ChallengeState } from "../core/challengeState";
import { createQuestionCycleState } from "../core/questionSelector";
import type { QuestionCycleState } from "../core/questionSelector";
import type { KeyValueStore } from "./keyValueStore";

// RF-25, RF-39: el reto en curso de cada app se guarda aparte (para
// conservarlo si se abandona sin resolver, hasta las 04:00), y el ciclo de
// preguntas usadas (RF-11) es uno solo, compartido: es el mismo banco de
// preguntas para todas las apps restringidas.
const QUESTION_CYCLE_KEY = "questionCycle";
const CHALLENGE_KEY_PREFIX = "challenge:";

export function loadQuestionCycleState(store: KeyValueStore): QuestionCycleState {
  const raw = store.getString(QUESTION_CYCLE_KEY);
  if (!raw) {
    return createQuestionCycleState();
  }
  try {
    const usedIds = JSON.parse(raw) as string[];
    return { usedIds: new Set(usedIds) };
  } catch {
    return createQuestionCycleState();
  }
}

export function saveQuestionCycleState(store: KeyValueStore, state: QuestionCycleState): void {
  store.setString(QUESTION_CYCLE_KEY, JSON.stringify([...state.usedIds]));
}

export function loadChallenge(store: KeyValueStore, packageName: string): ChallengeState | null {
  const raw = store.getString(CHALLENGE_KEY_PREFIX + packageName);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as ChallengeState;
  } catch {
    return null;
  }
}

export function saveChallenge(store: KeyValueStore, packageName: string, state: ChallengeState | null): void {
  const key = CHALLENGE_KEY_PREFIX + packageName;
  if (state === null) {
    store.delete(key);
  } else {
    store.setString(key, JSON.stringify(state));
  }
}
