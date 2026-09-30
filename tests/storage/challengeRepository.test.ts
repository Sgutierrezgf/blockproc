import { startChallenge } from "../../blockproc/src/core/challengeState";
import { createQuestionCycleState } from "../../blockproc/src/core/questionSelector";
import type { Question } from "../../blockproc/src/core/questions";
import {
  loadChallenge,
  loadQuestionCycleState,
  saveChallenge,
  saveQuestionCycleState,
} from "../../blockproc/src/storage/challengeRepository";
import { createInMemoryStore } from "../../blockproc/src/storage/keyValueStore";

const PKG_A = "com.instagram.android";
const PKG_B = "com.spotify.music";

function question(id: string): Question {
  return { id, area: "general", question: "¿?", options: ["a", "b", "c", "d"], correctIndex: 0 };
}

// RF-25, RF-39, RF-11 (T59): el reto en curso se guarda por app (para
// conservarlo si se abandona) y el ciclo de preguntas usadas se guarda
// aparte, compartido entre apps (es el mismo banco para todas).
describe("challengeRepository", () => {
  it("sin nada guardado, no hay reto ni ciclo usado", () => {
    const store = createInMemoryStore();
    expect(loadChallenge(store, PKG_A)).toBeNull();
    expect(loadQuestionCycleState(store)).toEqual(createQuestionCycleState());
  });

  it("guarda y recupera el reto de una app sin afectar a otra", () => {
    const store = createInMemoryStore();
    const challenge = startChallenge([question("g1"), question("g2")], 1000);

    saveChallenge(store, PKG_A, challenge);

    expect(loadChallenge(store, PKG_A)).toEqual(challenge);
    expect(loadChallenge(store, PKG_B)).toBeNull();
  });

  it("borra el reto guardado al pasarle null", () => {
    const store = createInMemoryStore();
    const challenge = startChallenge([question("g1")], 1000);
    saveChallenge(store, PKG_A, challenge);

    saveChallenge(store, PKG_A, null);

    expect(loadChallenge(store, PKG_A)).toBeNull();
  });

  it("un JSON dañado se trata como si no hubiera reto (RF-41)", () => {
    const store = createInMemoryStore();
    store.setString("challenge:" + PKG_A, "{no es json");
    expect(loadChallenge(store, PKG_A)).toBeNull();
  });

  it("guarda y recupera el ciclo de preguntas usadas", () => {
    const store = createInMemoryStore();
    const cycle = { usedIds: new Set(["g1", "g2"]) };

    saveQuestionCycleState(store, cycle);

    expect(loadQuestionCycleState(store)).toEqual(cycle);
  });

  it("un ciclo guardado dañado se trata como uno nuevo (RF-41)", () => {
    const store = createInMemoryStore();
    store.setString("questionCycle", "{no es json");
    expect(loadQuestionCycleState(store)).toEqual(createQuestionCycleState());
  });
});
