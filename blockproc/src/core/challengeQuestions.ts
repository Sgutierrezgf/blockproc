import { generateMathQuestions } from "./mathQuestions";
import type { Question } from "./questions";
import type { Random } from "./random";
import type { Area, Timestamp } from "./types";

/**
 * RF-11, RF-24: "math" no vive en `data/questions.es.json` (se genera al
 * vuelo), así que para mezclarla con el resto de las áreas marcadas hay que
 * añadirla al pool que recibe `selectQuestions`. Se generan tantas como
 * preguntas pide el reto (`count`), con el instante en que empieza (`now`)
 * en el id: así dos retos nunca comparten un id de math, aunque el ciclo de
 * no-repetición (T21) los marque como usados para siempre sin que importe,
 * ya que jamás vuelven a generarse iguales.
 */
export function buildQuestionPool(
  bank: Question[],
  areas: Area[],
  count: number,
  now: Timestamp,
  random: Random
): Question[] {
  if (!areas.includes("math")) {
    return bank;
  }
  const mathQuestions = generateMathQuestions(count, random).map((question, index) => ({
    ...question,
    id: `math-${now}-${index}`,
  }));
  return [...bank, ...mathQuestions];
}
