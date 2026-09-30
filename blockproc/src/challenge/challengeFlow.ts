import { buildQuestionPool } from "../core/challengeQuestions";
import { prepareChallengeQuestions } from "../core/challengeSession";
import { answerCurrentQuestion, isChallengeExpired, startChallenge } from "../core/challengeState";
import type { ChallengeState } from "../core/challengeState";
import type { Config } from "../core/config";
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

export interface LoadOrStartChallengeResult {
  challenge: ChallengeState;
}

/**
 * RF-11, RF-37, RF-39: retoma el reto guardado de esta app si sigue vigente
 * (mismo día de uso); si no hay uno, o ya caducó, arma uno nuevo con el core
 * ya probado (T19 a T22) y lo persiste de inmediato, así queda conservado
 * aunque el usuario lo abandone sin responder ninguna pregunta.
 */
export function loadOrStartChallenge(
  store: KeyValueStore,
  packageName: string,
  bank: Question[],
  config: Config,
  now: Timestamp,
  random: Random
): LoadOrStartChallengeResult {
  const existing = loadChallenge(store, packageName);
  if (existing !== null && !isChallengeExpired(existing, now)) {
    return { challenge: existing };
  }

  const cycle = loadQuestionCycleState(store);
  const pool = buildQuestionPool(bank, config.areas, config.questionCount, now, random);
  const selection = selectQuestions(cycle, pool, config.areas, config.questionCount, random);
  const prepared = prepareChallengeQuestions(selection.questions, random);
  const challenge = startChallenge(prepared, now);

  saveQuestionCycleState(store, selection.state);
  saveChallenge(store, packageName, challenge);

  return { challenge };
}

export interface SubmitAnswerResult {
  challenge: ChallengeState;
  correct: boolean;
}

/**
 * RF-12, RF-13: aplica la respuesta con el core (T23) y conecta el
 * resultado con el resto del sistema: al acertar la última pregunta,
 * concede la ventana de acceso (policy.ts); al fallar, arranca la espera de
 * 3 min. En ambos casos el reto queda resuelto, así que se descarta de lo
 * guardado; si sigue en curso, se persiste el avance (RF-39).
 */
export function submitAnswer(
  store: KeyValueStore,
  packageName: string,
  challenge: ChallengeState,
  selectedIndex: number,
  config: Config,
  now: Timestamp
): SubmitAnswerResult {
  const result = answerCurrentQuestion(challenge, selectedIndex);

  if (result.state.outcome === "success") {
    savePolicyState(store, grantAccessWindow(loadPolicyState(store), packageName, config, now));
    saveChallenge(store, packageName, null);
  } else if (result.state.outcome === "failure") {
    savePolicyState(store, recordChallengeFailure(loadPolicyState(store), packageName, now));
    saveChallenge(store, packageName, null);
  } else {
    saveChallenge(store, packageName, result.state);
  }

  return { challenge: result.state, correct: result.correct };
}
