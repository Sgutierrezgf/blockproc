import { isBlockActive } from "./blocks";
import type { Block } from "./blocks";
import type { Question } from "./questions";
import type { Timestamp } from "./types";

// Fase 10 (rediseño): el estado de un reto de hasta 3 preguntas (RF-65),
// siempre asociado al bloqueo que lo generó (`blockId`), no a un día de uso
// — ya no existe el concepto de "día de uso" (RF-7 retirado). Inmutable,
// como el resto del core: cada respuesta produce un estado nuevo.
export type ChallengeOutcome = "in_progress" | "success" | "failure";

export interface ChallengeState {
  /** Hasta 3 preguntas, en el orden fijo con que se mostrarán (ya barajadas). */
  questions: Question[];
  currentIndex: number;
  /** RF-65: el intento corta al llegar a 2, sin importar en qué posición cayeron. */
  wrongCount: number;
  /** RF-66: las preguntas falladas, para mostrar ambas respuestas correctas (D29). */
  failedQuestions: Question[];
  outcome: ChallengeOutcome;
  /** El bloqueo que generó este reto; isChallengeExpired lo consulta (RF-39 adaptado). */
  blockId: string;
}

export function startChallenge(questions: Question[], blockId: string): ChallengeState {
  return {
    questions,
    currentIndex: 0,
    wrongCount: 0,
    failedQuestions: [],
    outcome: "in_progress",
    blockId,
  };
}

export interface AnswerResult {
  state: ChallengeState;
  correct: boolean;
}

/**
 * RF-65: hasta 3 preguntas; el intento corta en "failure" apenas se acumulan
 * 2 respuestas incorrectas (en cualquier posición), sin mostrar una pregunta
 * más. Llegar a la última pregunta solo es posible con 0 o 1 fallo previo,
 * así que responderla (bien o mal) siempre termina en "success" (D28): no
 * hace falta una cuenta aparte de "al menos 2 de 3 correctas".
 */
export function answerCurrentQuestion(state: ChallengeState, selectedIndex: number): AnswerResult {
  if (state.outcome !== "in_progress") {
    return { state, correct: false };
  }

  const currentQuestion = state.questions[state.currentIndex];
  const correct = selectedIndex === currentQuestion.correctIndex;
  const nextIndex = state.currentIndex + 1;
  const isLastQuestion = nextIndex >= state.questions.length;

  if (!correct) {
    const wrongCount = state.wrongCount + 1;
    const failedQuestions = [...state.failedQuestions, currentQuestion];
    if (wrongCount >= 2) {
      return {
        correct: false,
        state: { ...state, wrongCount, failedQuestions, outcome: "failure" },
      };
    }
    return {
      correct: false,
      state: {
        ...state,
        currentIndex: nextIndex,
        wrongCount,
        failedQuestions,
        outcome: isLastQuestion ? "success" : "in_progress",
      },
    };
  }

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
 * RF-39 adaptado (C32): un reto abandonado se conserva (mismas preguntas,
 * mismo progreso) hasta resolverse, fallar, o que el bloqueo que lo generó
 * deje de estar activo — ya no hay corte a las 04:00, porque no hay más
 * "día de uso". Caso límite (spec): si el bloqueo termina a mitad del reto,
 * se considera expirado (se libera la app de inmediato, sin exigir terminar).
 */
export function isChallengeExpired(state: ChallengeState, blocks: Block[], now: Timestamp): boolean {
  const owningBlock = blocks.find((block) => block.id === state.blockId);
  return owningBlock === undefined || !isBlockActive(owningBlock, now);
}
