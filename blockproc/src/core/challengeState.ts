import { getUsageDayKey } from "./clock";
import type { Question } from "./questions";
import type { Timestamp } from "./types";

// RF-12, RF-13, RF-14, RF-39: el estado de un reto ya preparado (T22, con
// las opciones barajadas) mientras el usuario lo responde. Inmutable, como
// el resto del core: cada respuesta produce un estado nuevo.
export type ChallengeOutcome = "in_progress" | "success" | "failure";

export interface ChallengeState {
  /** Preguntas del reto, en el orden fijo con que se mostrarán (ya barajadas por T22). */
  questions: Question[];
  currentIndex: number;
  outcome: ChallengeOutcome;
  /** Día de uso (RF-7) en que empezó el reto; RF-39 lo descarta al cruzar las 04:00. */
  dayKey: string;
  /** La pregunta en la que falló, para mostrar la respuesta correcta (RF-13). */
  failedQuestion?: Question;
}

export function startChallenge(questions: Question[], now: Timestamp): ChallengeState {
  return {
    questions,
    currentIndex: 0,
    outcome: "in_progress",
    dayKey: getUsageDayKey(now),
  };
}

export interface AnswerResult {
  state: ChallengeState;
  correct: boolean;
}

/**
 * RF-12: si es la última pregunta y se acierta, el reto termina en éxito.
 * RF-13: si se falla, el reto se corta ahí mismo, en fallo, sin seguir a la
 * siguiente pregunta.
 */
export function answerCurrentQuestion(state: ChallengeState, selectedIndex: number): AnswerResult {
  if (state.outcome !== "in_progress") {
    return { state, correct: false };
  }

  const currentQuestion = state.questions[state.currentIndex];
  const correct = selectedIndex === currentQuestion.correctIndex;

  if (!correct) {
    return {
      correct: false,
      state: { ...state, outcome: "failure", failedQuestion: currentQuestion },
    };
  }

  const nextIndex = state.currentIndex + 1;
  const isLastQuestion = nextIndex >= state.questions.length;
  return {
    correct: true,
    state: {
      ...state,
      currentIndex: nextIndex,
      outcome: isLastQuestion ? "success" : "in_progress",
    },
  };
}

/** La pregunta que corresponde mostrar ahora, o null si el reto ya terminó. */
export function getCurrentQuestion(state: ChallengeState): Question | null {
  if (state.outcome !== "in_progress") {
    return null;
  }
  return state.questions[state.currentIndex] ?? null;
}

/**
 * RF-39: un reto abandonado se conserva tal cual (mismas preguntas, mismo
 * progreso) hasta que se resuelva, falle, o cruce las 04:00. Esta función
 * solo informa si ya caducó; quien la llama decide si lo descarta.
 */
export function isChallengeExpired(state: ChallengeState, now: Timestamp): boolean {
  return getUsageDayKey(now) !== state.dayKey;
}
