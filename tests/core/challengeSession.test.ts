import type { Question } from "../../blockproc/src/core/questions";
import { createSeededRandom } from "../../blockproc/src/core/random";
import { prepareChallengeQuestions, shuffleQuestionOptions } from "../../blockproc/src/core/challengeSession";

const preguntaValida: Question = {
  id: "general-001",
  area: "general",
  question: "¿Cuál es la capital de Francia?",
  options: ["Madrid", "París", "Roma", "Berlín"],
  correctIndex: 1,
  explanation: "París es la capital de Francia desde hace siglos.",
};

// RF-37: al mostrar una pregunta, se baraja el orden de sus opciones.
describe("shuffleQuestionOptions", () => {
  it("distintas semillas dan, al menos alguna vez, un orden de opciones distinto", () => {
    const semillas = [1, 2, 3, 4, 5];
    const ordenes = semillas.map((seed) => shuffleQuestionOptions(preguntaValida, createSeededRandom(seed)).options);
    const primero = ordenes[0].join("|");
    const hayAlgunoDistinto = ordenes.some((options) => options.join("|") !== primero);
    expect(hayAlgunoDistinto).toBe(true);
  });

  it("la opción correcta (el texto) es la misma tras barajar, sin importar la semilla", () => {
    const textoCorrecto = preguntaValida.options[preguntaValida.correctIndex];
    [1, 2, 3, 4, 5].forEach((seed) => {
      const resultado = shuffleQuestionOptions(preguntaValida, createSeededRandom(seed));
      expect(resultado.options[resultado.correctIndex]).toBe(textoCorrecto);
    });
  });

  it("las opciones barajadas son las mismas 4, solo reordenadas", () => {
    const resultado = shuffleQuestionOptions(preguntaValida, createSeededRandom(2));
    expect([...resultado.options].sort()).toEqual([...preguntaValida.options].sort());
  });

  it("correctIndex queda dentro de rango tras barajar", () => {
    const resultado = shuffleQuestionOptions(preguntaValida, createSeededRandom(2));
    expect(resultado.correctIndex).toBeGreaterThanOrEqual(0);
    expect(resultado.correctIndex).toBeLessThan(resultado.options.length);
  });

  it("conserva id, área, enunciado y explicación sin cambios", () => {
    const resultado = shuffleQuestionOptions(preguntaValida, createSeededRandom(2));
    expect(resultado.id).toBe(preguntaValida.id);
    expect(resultado.area).toBe(preguntaValida.area);
    expect(resultado.question).toBe(preguntaValida.question);
    expect(resultado.explanation).toBe(preguntaValida.explanation);
  });
});

describe("prepareChallengeQuestions", () => {
  it("baraja cada pregunta de la lista conservando la cantidad y la respuesta correcta", () => {
    const otra: Question = {
      id: "math-001",
      area: "math",
      question: "¿Cuánto es 2 + 2?",
      options: ["3", "4", "5", "6"],
      correctIndex: 1,
    };
    const preparadas = prepareChallengeQuestions([preguntaValida, otra], createSeededRandom(10));

    expect(preparadas).toHaveLength(2);
    expect(preparadas[0].options[preparadas[0].correctIndex]).toBe("París");
    expect(preparadas[1].options[preparadas[1].correctIndex]).toBe("4");
  });
});
