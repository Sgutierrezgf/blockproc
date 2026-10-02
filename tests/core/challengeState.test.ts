import type { Question } from "../../blockproc/src/core/questions";
import type { Block } from "../../blockproc/src/core/blocks";
import {
  answerCurrentQuestion,
  getCurrentQuestion,
  isChallengeExpired,
  startChallenge,
} from "../../blockproc/src/core/challengeState";

function q(id: string, correctIndex = 0): Question {
  return {
    id,
    area: "general",
    question: `Pregunta ${id}`,
    options: ["a", "b", "c", "d"],
    correctIndex,
  };
}

function makeBlock(overrides: Partial<Block> = {}): Block {
  return {
    id: "b1",
    packages: ["com.example.app"],
    type: "duration",
    startAt: 0,
    endAt: 10_000,
    category: "general",
    focusMessage: "foco",
    blockMessage: "bloqueado",
    warnedStart: false,
    ...overrides,
  };
}

const T0 = 1000;

// RF-65: siempre hasta 3 preguntas; corta en "failure" al acumular 2
// incorrectas, sin importar la posición.
describe("answerCurrentQuestion", () => {
  it("éxito cuando se responden las 3 preguntas correctamente", () => {
    let state = startChallenge([q("p1"), q("p2"), q("p3")], "b1");
    state = answerCurrentQuestion(state, 0).state;
    state = answerCurrentQuestion(state, 0).state;
    const result = answerCurrentQuestion(state, 0);
    expect(result.correct).toBe(true);
    expect(result.state.outcome).toBe("success");
  });

  it("éxito con 1 fallo y 2 aciertos (fallo en la primera, luego 2 aciertos)", () => {
    let state = startChallenge([q("p1"), q("p2"), q("p3")], "b1");
    state = answerCurrentQuestion(state, 1).state; // p1 incorrecta (correctIndex 0)
    expect(state.outcome).toBe("in_progress");
    state = answerCurrentQuestion(state, 0).state; // p2 correcta
    const result = answerCurrentQuestion(state, 0); // p3 correcta
    expect(result.state.outcome).toBe("success");
    expect(result.state.wrongCount).toBe(1);
  });

  it("éxito con un fallo intercalado (correcta, incorrecta, correcta)", () => {
    let state = startChallenge([q("p1"), q("p2"), q("p3")], "b1");
    state = answerCurrentQuestion(state, 0).state; // correcta
    state = answerCurrentQuestion(state, 1).state; // incorrecta
    const result = answerCurrentQuestion(state, 0); // correcta
    expect(result.state.outcome).toBe("success");
  });

  it("corta en 'failure' apenas se acumulan 2 incorrectas consecutivas, sin mostrar la 3ª pregunta", () => {
    let state = startChallenge([q("p1"), q("p2"), q("p3")], "b1");
    state = answerCurrentQuestion(state, 1).state; // p1 incorrecta
    const result = answerCurrentQuestion(state, 1); // p2 incorrecta
    expect(result.correct).toBe(false);
    expect(result.state.outcome).toBe("failure");
    expect(result.state.currentIndex).toBe(1); // nunca avanzó a la 3ª
    expect(getCurrentQuestion(result.state)).toBeNull();
  });

  it("corta en 'failure' con incorrecta-correcta-incorrecta (el 2º fallo cae en la 3ª pregunta)", () => {
    let state = startChallenge([q("p1"), q("p2"), q("p3")], "b1");
    state = answerCurrentQuestion(state, 1).state; // incorrecta
    state = answerCurrentQuestion(state, 0).state; // correcta
    const result = answerCurrentQuestion(state, 1); // incorrecta, 2º fallo
    expect(result.state.outcome).toBe("failure");
  });

  it("acumula ambas preguntas falladas en failedQuestions", () => {
    let state = startChallenge([q("p1"), q("p2"), q("p3")], "b1");
    state = answerCurrentQuestion(state, 1).state;
    const result = answerCurrentQuestion(state, 1);
    expect(result.state.failedQuestions.map((f) => f.id)).toEqual(["p1", "p2"]);
  });

  it("una vez en éxito o fallo, no se puede seguir respondiendo", () => {
    let state = startChallenge([q("p1"), q("p2")], "b1");
    state = answerCurrentQuestion(state, 1).state;
    state = answerCurrentQuestion(state, 1).state;
    expect(state.outcome).toBe("failure");

    const result = answerCurrentQuestion(state, 0);
    expect(result.correct).toBe(false);
    expect(result.state).toBe(state); // no cambia nada
  });
});

describe("getCurrentQuestion", () => {
  it("devuelve la pregunta en curso, y null cuando el reto ya terminó", () => {
    let state = startChallenge([q("p1"), q("p2")], "b1");
    expect(getCurrentQuestion(state)?.id).toBe("p1");
    state = answerCurrentQuestion(state, 0).state;
    expect(getCurrentQuestion(state)?.id).toBe("p2");
    state = answerCurrentQuestion(state, 0).state;
    expect(state.outcome).toBe("success");
    expect(getCurrentQuestion(state)).toBeNull();
  });

  it("al reabrir sin haber respondido, se conserva el mismo progreso", () => {
    let state = startChallenge([q("p1"), q("p2"), q("p3")], "b1");
    state = answerCurrentQuestion(state, 0).state; // responde p1 y "abandona"
    const reabierto = state;
    expect(getCurrentQuestion(reabierto)?.id).toBe("p2");
    expect(reabierto.currentIndex).toBe(1);
  });
});

// RF-39 adaptado (C32): el reto se conserva hasta que el bloqueo que lo
// generó deje de estar activo, ya no hay corte a las 04:00.
describe("isChallengeExpired", () => {
  it("no ha caducado mientras el bloqueo que lo generó sigue activo", () => {
    const block = makeBlock({ id: "b1", startAt: 0, endAt: 10_000 });
    const state = startChallenge([q("p1")], "b1");
    expect(isChallengeExpired(state, [block], T0)).toBe(false);
  });

  it("caduca si el bloqueo que lo generó ya terminó", () => {
    const block = makeBlock({ id: "b1", startAt: 0, endAt: 500 });
    const state = startChallenge([q("p1")], "b1");
    expect(isChallengeExpired(state, [block], T0)).toBe(true);
  });

  it("caduca si el bloqueo que lo generó ya no existe en la lista", () => {
    const state = startChallenge([q("p1")], "b1");
    expect(isChallengeExpired(state, [], T0)).toBe(true);
  });
});
