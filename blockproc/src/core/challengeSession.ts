import type { Question } from "./questions";
import type { Random } from "./random";
import { shuffleWithRandom } from "./random";

// RF-37: al mostrar una pregunta, se baraja el orden de sus opciones. Se
// baraja por posición (índices originales), no por texto: así una pregunta
// con dos opciones de texto idéntico sigue señalando la correcta que
// corresponde, no la primera coincidencia de texto.
export function shuffleQuestionOptions(question: Question, random: Random): Question {
  const originalIndices = question.options.map((_, index) => index);
  const shuffledIndices = shuffleWithRandom(originalIndices, random);
  const options = shuffledIndices.map((index) => question.options[index]);
  const correctIndex = shuffledIndices.indexOf(question.correctIndex);

  return {
    id: question.id,
    area: question.area,
    question: question.question,
    options,
    correctIndex,
    explanation: question.explanation,
  };
}

/** RF-11, RF-37: las preguntas ya elegidas para el reto, con sus opciones barajadas. */
export function prepareChallengeQuestions(questions: Question[], random: Random): Question[] {
  return questions.map((question) => shuffleQuestionOptions(question, random));
}
