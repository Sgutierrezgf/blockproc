import { isValidQuestionBank, type Question } from "../../blockproc/src/core/questions";
import { createSeededRandom, generateMathQuestions } from "../../blockproc/src/core/mathQuestions";

// Vuelve a calcular la respuesta a partir del propio enunciado, para
// comprobar que es matemáticamente cierta sin depender de los detalles
// internos del generador.
function verificarRespuestaCorrecta(q: Question) {
  const aritmetica = q.question.match(/¿Cuánto es (-?\d+) (\+|-|×) (-?\d+)\?/);
  if (aritmetica) {
    const a = Number(aritmetica[1]);
    const operador = aritmetica[2];
    const b = Number(aritmetica[3]);
    const esperado = operador === "+" ? a + b : operador === "-" ? a - b : a * b;
    expect(Number(q.options[q.correctIndex])).toBe(esperado);
    return;
  }

  const secuencia = q.question.match(/secuencia ([-\d, ]+), __\?/);
  if (secuencia) {
    const terminos = secuencia[1].split(",").map((s) => Number(s.trim()));
    const paso = terminos[1] - terminos[0];
    const esperado = terminos[terminos.length - 1] + paso;
    expect(Number(q.options[q.correctIndex])).toBe(esperado);
    return;
  }

  throw new Error(`No se reconoció el formato de la pregunta: "${q.question}"`);
}

describe("createSeededRandom", () => {
  it("genera siempre números en [0, 1)", () => {
    const random = createSeededRandom(123);
    for (let i = 0; i < 1000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("la misma semilla produce la misma secuencia de números", () => {
    const a = createSeededRandom(7);
    const b = createSeededRandom(7);
    const valoresA = Array.from({ length: 20 }, () => a());
    const valoresB = Array.from({ length: 20 }, () => b());
    expect(valoresA).toEqual(valoresB);
  });
});

// RF-24: generador local de secuencias numéricas y problemas aritméticos
// simples, para la categoría de matemática y lógica.
describe("generateMathQuestions", () => {
  it("100 preguntas con una semilla fija cumplen el mismo formato que el banco", () => {
    const questions = generateMathQuestions(100, createSeededRandom(42));
    expect(questions).toHaveLength(100);
    expect(isValidQuestionBank(questions)).toBe(true);
    questions.forEach((q) => expect(q.area).toBe("math"));
  });

  it("la respuesta correcta de cada pregunta generada es matemáticamente cierta", () => {
    const questions = generateMathQuestions(100, createSeededRandom(42));
    questions.forEach(verificarRespuestaCorrecta);
  });

  it("con la misma semilla se generan siempre las mismas preguntas", () => {
    const a = generateMathQuestions(10, createSeededRandom(99));
    const b = generateMathQuestions(10, createSeededRandom(99));
    expect(a).toEqual(b);
  });

  it("con semillas distintas se generan preguntas distintas", () => {
    const a = generateMathQuestions(10, createSeededRandom(1));
    const b = generateMathQuestions(10, createSeededRandom(2));
    expect(a).not.toEqual(b);
  });
});
