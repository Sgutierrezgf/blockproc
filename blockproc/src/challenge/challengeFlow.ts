import { buildQuestionPool } from "../core/challengeQuestions";
import { prepareChallengeQuestions } from "../core/challengeSession";
import { answerCurrentQuestion, isChallengeExpired, startChallenge } from "../core/challengeState";
import type { ChallengeState } from "../core/challengeState";
import { grantAccessWindow, recordChallengeFailure } from "../core/policy";
import { selectQuestions } from "../core/questionSelector";
import type { Question } from "../core/questions";
import type { Random } from "../core/random";
import type { Timestamp } from "../core/types";
import {
  loadChallenge,
  loadQuestionCycleState,
  saveChallenge,
  saveQuestionCycleState,
} from "../storage/challengeRepository";
import type { KeyValueStore } from "../storage/keyValueStore";
import { loadPolicyState, savePolicyState } from "../supervisor/policyRepository";

// RF-65: siempre hasta 3 preguntas por intento, fijo (RF-69).
export const CHALLENGE_QUESTION_COUNT = 3;

export interface LoadOrStartChallengeResult {
  challenge: ChallengeState;
}

/**
 * RF-65, D27: retoma el reto guardado de esta app si sigue vigente (el
 * bloqueo que lo generó sigue activo); si no hay uno, o ya caducó, arma uno
 * nuevo con la categoría del bloqueo que cubre la app ahora mismo y lo
 * persiste de inmediato, así queda conservado aunque el usuario lo abandone
 * sin responder ninguna pregunta (RF-39 adaptado).
 */
export function loadOrStartChallenge(
  store: KeyValueStore,
  packageName: string,
  blockId: string,
  category: Question["area"],
  bank: Question[],
  now: Timestamp,
  random: Random
): LoadOrStartChallengeResult {
  const existing = loadChallenge(store, packageName);
  if (existing !== null && !isChallengeExpired(existing, loadPolicyState(store).blocks, now)) {
    return { challenge: existing };
  }

  const cycle = loadQuestionCycleState(store);
  const pool = buildQuestionPool(bank, [category], CHALLENGE_QUESTION_COUNT, now, random);
  const selection = selectQuestions(cycle, pool, [category], CHALLENGE_QUESTION_COUNT, random);
  const prepared = prepareChallengeQuestions(selection.questions, random);
  const challenge = startChallenge(prepared, blockId);

  saveQuestionCycleState(store, selection.state);
  saveChallenge(store, packageName, challenge);

  return { challenge };
}

export interface SubmitAnswerResult {
  challenge: ChallengeState;
  correct: boolean;
}

/**
 * RF-65, RF-66, RF-67: aplica la respuesta con el core (T110) y conecta el
 * resultado con el resto del sistema: al terminar en éxito, concede la
 * ventana de 2 min (policy.ts); al fallar (2 incorrectas), arranca la
 * espera de 5 min. En ambos casos el reto queda resuelto, así que se
 * descarta de lo guardado; si sigue en curso, se persiste el avance.
 */
export function submitAnswer(
  store: KeyValueStore,
  packageName: string,
  challenge: ChallengeState,
  selectedIndex: number,
  now: Timestamp
): SubmitAnswerResult {
  const result = answerCurrentQuestion(challenge, selectedIndex);

  if (result.state.outcome === "success") {
    savePolicyState(store, grantAccessWindow(loadPolicyState(store), packageName, now));
    saveChallenge(store, packageName, null);
  } else if (result.state.outcome === "failure") {
    savePolicyState(store, recordChallengeFailure(loadPolicyState(store), packageName, now));
    saveChallenge(store, packageName, null);
  } else {
    saveChallenge(store, packageName, result.state);
  }

  return { challenge: result.state, correct: result.correct };
}
