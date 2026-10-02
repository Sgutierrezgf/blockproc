import { createSeededRandom } from "../../blockproc/src/core/random";
import type { Question } from "../../blockproc/src/core/questions";
import { loadOrStartChallenge, submitAnswer } from "../../blockproc/src/challenge/challengeFlow";
import { loadChallenge } from "../../blockproc/src/storage/challengeRepository";
import { createInMemoryStore } from "../../blockproc/src/storage/keyValueStore";
import { ACCESS_WINDOW_MS, COOLDOWN_MS, createPolicyState } from "../../blockproc/src/core/policy";
import { loadPolicyState, savePolicyState } from "../../blockproc/src/supervisor/policyRepository";
import type { Block } from "../../blockproc/src/core/blocks";
import type { KeyValueStore } from "../../blockproc/src/storage/keyValueStore";

const PKG = "com.instagram.android";
const BLOCK_ID = "b1";

function bank(): Question[] {
  return [
    { id: "g1", area: "general", question: "¿Pregunta 1?", options: ["a", "b", "c", "d"], correctIndex: 0 },
    { id: "g2", area: "general", question: "¿Pregunta 2?", options: ["a", "b", "c", "d"], correctIndex: 1 },
    { id: "g3", area: "general", question: "¿Pregunta 3?", options: ["a", "b", "c", "d"], correctIndex: 2 },
    { id: "g4", area: "general", question: "¿Pregunta 4?", options: ["a", "b", "c", "d"], correctIndex: 3 },
  ];
}

function seedActiveBlock(store: KeyValueStore, overrides: Partial<Block> = {}): void {
  const block: Block = {
    id: BLOCK_ID,
    packages: [PKG],
    type: "duration",
    startAt: 0,
    endAt: 1_000_000,
    category: "general",
    focusMessage: "foco",
    blockMessage: "bloqueado",
    warnedStart: false,
    ...overrides,
  };
  savePolicyState(store, { ...createPolicyState(), blocks: [block] });
}

// RF-65, RF-39 (adaptado): conecta las piezas del core con el almacenamiento
// real para la pantalla `challenge.tsx`: arma o retoma el reto, y aplica el
// resultado de responder.
describe("loadOrStartChallenge", () => {
  it("sin reto guardado, arma uno de 3 preguntas de la categoría del bloqueo y lo persiste", () => {
    const store = createInMemoryStore();
    const random = createSeededRandom(1);
    seedActiveBlock(store);

    const { challenge } = loadOrStartChallenge(store, PKG, BLOCK_ID, "general", bank(), 1000, random);

    expect(challenge.questions).toHaveLength(3);
    expect(challenge.outcome).toBe("in_progress");
    expect(challenge.blockId).toBe(BLOCK_ID);
    expect(loadChallenge(store, PKG)).toEqual(challenge);
  });

  it("con un reto guardado y el bloqueo todavía activo, retoma el mismo", () => {
    const store = createInMemoryStore();
    const random = createSeededRandom(1);
    seedActiveBlock(store);
    const primero = loadOrStartChallenge(store, PKG, BLOCK_ID, "general", bank(), 1000, random).challenge;

    const retomado = loadOrStartChallenge(store, PKG, BLOCK_ID, "general", bank(), 2000, random).challenge;

    expect(retomado).toEqual(primero);
  });

  it("con un reto guardado pero el bloqueo que lo generó ya no está activo, arma uno nuevo", () => {
    const store = createInMemoryStore();
    const random = createSeededRandom(1);
    seedActiveBlock(store, { endAt: 1500 });
    const primero = loadOrStartChallenge(store, PKG, BLOCK_ID, "general", bank(), 1000, random).challenge;

    // El bloqueo ya terminó: un bloqueo nuevo y distinto cubre la app ahora.
    seedActiveBlock(store, { id: "b2", startAt: 1500, endAt: 100_000 });
    const { challenge } = loadOrStartChallenge(store, PKG, "b2", "general", bank(), 2000, random);

    expect(challenge).not.toEqual(primero);
    expect(challenge.blockId).toBe("b2");
  });
});

describe("submitAnswer", () => {
  it("al acertar las 3 preguntas, concede la ventana de 2 min y descarta el reto guardado", () => {
    const store = createInMemoryStore();
    const random = createSeededRandom(1);
    seedActiveBlock(store);
    let { challenge } = loadOrStartChallenge(store, PKG, BLOCK_ID, "general", bank(), 1000, random);

    for (const pregunta of challenge.questions) {
      const result = submitAnswer(store, PKG, challenge, pregunta.correctIndex, 1000);
      challenge = result.challenge;
      expect(result.correct).toBe(true);
    }

    expect(challenge.outcome).toBe("success");
    expect(loadChallenge(store, PKG)).toBeNull();
    const policy = loadPolicyState(store);
    expect(policy.apps[PKG].windowEndsAt).toBe(1000 + ACCESS_WINDOW_MS);
  });

  it("al fallar 2 preguntas, corta el reto, registra la espera de 5 min y descarta el reto guardado", () => {
    const store = createInMemoryStore();
    const random = createSeededRandom(1);
    seedActiveBlock(store);
    const { challenge } = loadOrStartChallenge(store, PKG, BLOCK_ID, "general", bank(), 1000, random);
    const incorrectaDe = (q: Question) => (q.correctIndex + 1) % q.options.length;

    const first = submitAnswer(store, PKG, challenge, incorrectaDe(challenge.questions[0]), 1000);
    expect(first.challenge.outcome).toBe("in_progress");
    const second = submitAnswer(store, PKG, first.challenge, incorrectaDe(challenge.questions[1]), 1000);

    expect(second.correct).toBe(false);
    expect(second.challenge.outcome).toBe("failure");
    expect(second.challenge.failedQuestions).toHaveLength(2);
    expect(loadChallenge(store, PKG)).toBeNull();
    const policy = loadPolicyState(store);
    expect(policy.apps[PKG].cooldownUntil).toBe(1000 + COOLDOWN_MS);
  });

  it("mientras el reto sigue en curso (acertó la primera, faltan más), persiste el avance", () => {
    const store = createInMemoryStore();
    const random = createSeededRandom(1);
    seedActiveBlock(store);
    const { challenge } = loadOrStartChallenge(store, PKG, BLOCK_ID, "general", bank(), 1000, random);

    const result = submitAnswer(store, PKG, challenge, challenge.questions[0].correctIndex, 1000);

    expect(result.challenge.outcome).toBe("in_progress");
    expect(loadChallenge(store, PKG)).toEqual(result.challenge);
  });
});
