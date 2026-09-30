import { getUsageDayKey } from "../../blockproc/src/core/clock";
import { createDefaultConfig } from "../../blockproc/src/core/config";
import type { Config } from "../../blockproc/src/core/config";
import { createSeededRandom } from "../../blockproc/src/core/random";
import type { Question } from "../../blockproc/src/core/questions";
import { loadOrStartChallenge, submitAnswer } from "../../blockproc/src/challenge/challengeFlow";
import { loadChallenge, saveChallenge } from "../../blockproc/src/storage/challengeRepository";
import { createInMemoryStore } from "../../blockproc/src/storage/keyValueStore";
import { loadPolicyState } from "../../blockproc/src/supervisor/policyRepository";

const PKG = "com.instagram.android";

function bank(): Question[] {
  return [
    { id: "g1", area: "general", question: "¿Pregunta 1?", options: ["a", "b", "c", "d"], correctIndex: 0 },
    { id: "g2", area: "general", question: "¿Pregunta 2?", options: ["a", "b", "c", "d"], correctIndex: 1 },
    { id: "g3", area: "general", question: "¿Pregunta 3?", options: ["a", "b", "c", "d"], correctIndex: 2 },
  ];
}

function config(cambios: Partial<Config> = {}): Config {
  return { ...createDefaultConfig(), areas: ["general"], questionCount: 2, accessWindowMin: 5, ...cambios };
}

// RF-11, RF-12, RF-13, RF-37, RF-39 (T59): conecta las piezas del core (T19
// a T23, ya probadas a fondo) con el almacenamiento real, para la pantalla
// `/challenge`: arma o retoma el reto, y aplica el resultado de responder.
describe("loadOrStartChallenge", () => {
  it("sin reto guardado, arma uno nuevo con las preguntas pedidas y lo persiste", () => {
    const store = createInMemoryStore();
    const random = createSeededRandom(1);

    const { challenge } = loadOrStartChallenge(store, PKG, bank(), config(), 1000, random);

    expect(challenge.questions).toHaveLength(2);
    expect(challenge.outcome).toBe("in_progress");
    expect(loadChallenge(store, PKG)).toEqual(challenge);
  });

  it("con un reto guardado sin caducar, retoma el mismo (RF-39)", () => {
    const store = createInMemoryStore();
    const random = createSeededRandom(1);
    const primero = loadOrStartChallenge(store, PKG, bank(), config(), 1000, random).challenge;

    const retomado = loadOrStartChallenge(store, PKG, bank(), config(), 2000, random).challenge;

    expect(retomado).toEqual(primero);
  });

  it("con un reto guardado ya caducado (cruzó las 04:00), arma uno nuevo", () => {
    const store = createInMemoryStore();
    const random = createSeededRandom(1);
    const primerDia = loadOrStartChallenge(store, PKG, bank(), config(), 1000, random).challenge.dayKey;

    // Bien pasadas las 04:00 del día siguiente.
    const unDiaDespues = 30 * 60 * 60_000;
    const { challenge } = loadOrStartChallenge(store, PKG, bank(), config(), unDiaDespues, random);

    expect(challenge.dayKey).not.toBe(primerDia);
    expect(challenge.dayKey).toBe(getUsageDayKey(unDiaDespues));
  });
});

describe("submitAnswer", () => {
  it("al acertar todas, concede la ventana de acceso y descarta el reto guardado", () => {
    const store = createInMemoryStore();
    const random = createSeededRandom(1);
    const cfg = config();
    let { challenge } = loadOrStartChallenge(store, PKG, bank(), cfg, 1000, random);

    for (const pregunta of challenge.questions) {
      const result = submitAnswer(store, PKG, challenge, pregunta.correctIndex, cfg, 1000);
      challenge = result.challenge;
      expect(result.correct).toBe(true);
    }

    expect(challenge.outcome).toBe("success");
    expect(loadChallenge(store, PKG)).toBeNull();
    const policy = loadPolicyState(store);
    expect(policy.apps[PKG].windowEndsAt).toBe(1000 + cfg.accessWindowMin * 60_000);
  });

  it("al fallar, corta el reto, registra la espera de 3 min y descarta el reto guardado", () => {
    const store = createInMemoryStore();
    const random = createSeededRandom(1);
    const cfg = config();
    const { challenge } = loadOrStartChallenge(store, PKG, bank(), cfg, 1000, random);
    const primera = challenge.questions[0];
    const incorrecta = (primera.correctIndex + 1) % primera.options.length;

    const result = submitAnswer(store, PKG, challenge, incorrecta, cfg, 1000);

    expect(result.correct).toBe(false);
    expect(result.challenge.outcome).toBe("failure");
    expect(result.challenge.failedQuestion).toEqual(primera);
    expect(loadChallenge(store, PKG)).toBeNull();
    const policy = loadPolicyState(store);
    expect(policy.apps[PKG].cooldownUntil).toBe(1000 + 3 * 60_000);
  });

  it("mientras el reto sigue en curso (acertó pero no la última), persiste el avance", () => {
    const store = createInMemoryStore();
    const random = createSeededRandom(1);
    const cfg = config({ questionCount: 2 });
    const { challenge } = loadOrStartChallenge(store, PKG, bank(), cfg, 1000, random);

    const result = submitAnswer(store, PKG, challenge, challenge.questions[0].correctIndex, cfg, 1000);

    expect(result.challenge.outcome).toBe("in_progress");
    expect(loadChallenge(store, PKG)).toEqual(result.challenge);
  });
});
