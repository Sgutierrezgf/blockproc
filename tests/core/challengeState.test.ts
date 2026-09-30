import type { Question } from "../../blockproc/src/core/questions";
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

const DIA1 = new Date(2026, 0, 5, 10, 0).getTime(); // día de uso del 5 de enero
const DIA1_MAS_TARDE = new Date(2026, 0, 5, 20, 0).getTime(); // sigue siendo el día de uso del 5
const DIA2 = new Date(2026, 0, 6, 10, 0).getTime(); // día de uso del 6

// RF-12, RF-13: éxito al responder todo bien, fallo al primer error.
describe("answerCurrentQuestion", () => {
  it("éxito cuando se responden todas las preguntas correctamente", () => {
    let state = startChallenge([q("p1"), q("p2"), q("p3")], DIA1);

    let result = answerCurrentQuestion(state, 0); // p1, correcta
    expect(result.correct).toBe(true);
    expect(result.state.outcome).toBe("in_progress");
    state = result.state;

    result = answerCurrentQuestion(state, 0); // p2, correcta
    expect(result.correct).toBe(true);
    expect(result.state.outcome).toBe("in_progress");
    state = result.state;

    result = answerCurrentQuestion(state, 0); // p3, correcta y última
    expect(result.correct).toBe(true);
    expect(result.state.outcome).toBe("success");
  });

  it("falla en la primera respuesta incorrecta y corta el reto ahí mismo", () => {
    let state = startChallenge([q("p1"), q("p2"), q("p3")], DIA1);

    state = answerCurrentQuestion(state, 0).state; // p1, correcta
    const result = answerCurrentQuestion(state, 1); // p2, incorrecta (correctIndex es 0)

    expect(result.correct).toBe(false);
    expect(result.state.outcome).toBe("failure");
    expect(result.state.failedQuestion?.id).toBe("p2");
  });

  it("una vez en éxito o fallo, no se puede seguir respondiendo", () => {
    let state = startChallenge([q("p1")], DIA1);
    state = answerCurrentQuestion(state, 0).state;
    expect(state.outcome).toBe("success");

    const result = answerCurrentQuestion(state, 0);
    expect(result.correct).toBe(false);
    expect(result.state).toBe(state); // no cambia nada
  });
});

describe("getCurrentQuestion", () => {
  it("devuelve la pregunta en curso, y null cuando el reto ya terminó", () => {
    let state = startChallenge([q("p1"), q("p2")], DIA1);
    expect(getCurrentQuestion(state)?.id).toBe("p1");

    state = answerCurrentQuestion(state, 0).state;
    expect(getCurrentQuestion(state)?.id).toBe("p2");

    state = answerCurrentQuestion(state, 0).state;
    expect(state.outcome).toBe("success");
    expect(getCurrentQuestion(state)).toBeNull();
  });

  // RF-39: si el usuario abandona el reto (Atrás, Inicio, llamada, pantalla
  // apagada) y vuelve, ve la misma pregunta y el mismo progreso.
  it("al reabrir sin haber respondido, se conserva el mismo progreso", () => {
    let state = startChallenge([q("p1"), q("p2"), q("p3")], DIA1);
    state = answerCurrentQuestion(state, 0).state; // responde p1 y "abandona"

    // "Reabrir" es solo volver a consultar el mismo estado guardado.
    const reabierto = state;
    expect(getCurrentQuestion(reabierto)?.id).toBe("p2");
    expect(reabierto.currentIndex).toBe(1);
  });
});

// RF-39: el reto abandonado se descarta al cruzar el día de uso (04:00).
describe("isChallengeExpired", () => {
  it("no ha caducado dentro del mismo día de uso", () => {
    const state = startChallenge([q("p1")], DIA1);
    expect(isChallengeExpired(state, DIA1_MAS_TARDE)).toBe(false);
  });

  it("caduca al cruzar las 04:00 al día siguiente", () => {
    const state = startChallenge([q("p1")], DIA1);
    expect(isChallengeExpired(state, DIA2)).toBe(true);
  });
});
