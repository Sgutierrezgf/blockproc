import { hasMinimumQuestionsPerArea, isValidQuestionBank } from "../../blockproc/src/core/questions";
// require en vez de "import ... from" para el JSON: un import por defecto de
// un módulo JSON necesita el ayudante de Babel interopRequireDefault, que
// falla al resolverse desde tests/ (ver memoria: sin node_modules ancestro).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const questionsEs = require("../../blockproc/src/data/questions.es.json");

// RF-23: el banco local en español, validado con el mismo validador de la
// T19 (formato correcto, sin ids duplicados).
describe("questions.es.json", () => {
  it("es un banco de preguntas válido", () => {
    expect(isValidQuestionBank(questionsEs)).toBe(true);
  });

  // T45 / criterios de finalización: al menos 60 preguntas por área de texto.
  it("tiene al menos 60 preguntas en cada área de texto", () => {
    expect(hasMinimumQuestionsPerArea(questionsEs)).toBe(true);
  });
});
