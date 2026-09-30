import { OPTIONS_COUNT } from "./questions";
import type { Question } from "./questions";
import { randomInt, shuffleWithRandom } from "./random";
import type { Random } from "./random";

export type { Random } from "./random";
export { createSeededRandom } from "./random";

// RF-24: generador local de matemática y lógica (secuencias numéricas y
// problemas aritméticos simples). Recibe el azar como parámetro (nunca usa
// Math.random() directamente) para que los tests sean deterministas.

/** Cuatro opciones únicas (la correcta más tres distractores), en orden barajado. */
function buildOptions(random: Random, correct: number): { options: string[]; correctIndex: number } {
  const values = new Set<number>([correct]);
  let attempts = 0;
  while (values.size < OPTIONS_COUNT && attempts < 100) {
    attempts += 1;
    const sign = randomInt(random, 0, 1) === 0 ? -1 : 1;
    const offset = sign * randomInt(random, 1, 3) * randomInt(random, 1, 5);
    if (offset !== 0) {
      values.add(correct + offset);
    }
  }
  const shuffled = shuffleWithRandom([...values], random);
  return {
    options: shuffled.map(String),
    correctIndex: shuffled.indexOf(correct),
  };
}

function generateArithmeticQuestion(random: Random, id: string): Question {
  const operations = ["+", "-", "×"] as const;
  const operation = operations[randomInt(random, 0, operations.length - 1)];

  let a: number;
  let b: number;
  let correct: number;
  if (operation === "+") {
    a = randomInt(random, 1, 50);
    b = randomInt(random, 1, 50);
    correct = a + b;
  } else if (operation === "-") {
    a = randomInt(random, 10, 50);
    b = randomInt(random, 1, a); // el resultado nunca es negativo
    correct = a - b;
  } else {
    a = randomInt(random, 2, 12);
    b = randomInt(random, 2, 12);
    correct = a * b;
  }

  const { options, correctIndex } = buildOptions(random, correct);
  return {
    id,
    area: "math",
    question: `¿Cuánto es ${a} ${operation} ${b}?`,
    options,
    correctIndex,
  };
}

function generateSequenceQuestion(random: Random, id: string): Question {
  const start = randomInt(random, 1, 20);
  const step = randomInt(random, 2, 9);
  const terms = [start, start + step, start + step * 2, start + step * 3];
  const correct = start + step * 4;

  const { options, correctIndex } = buildOptions(random, correct);
  return {
    id,
    area: "math",
    question: `¿Qué número sigue en la secuencia ${terms.join(", ")}, __?`,
    options,
    correctIndex,
  };
}

export function generateMathQuestion(random: Random, id: string): Question {
  return randomInt(random, 0, 1) === 0
    ? generateArithmeticQuestion(random, id)
    : generateSequenceQuestion(random, id);
}

export function generateMathQuestions(count: number, random: Random): Question[] {
  const questions: Question[] = [];
  for (let i = 0; i < count; i += 1) {
    questions.push(generateMathQuestion(random, `math-generated-${i}`));
  }
  return questions;
}
