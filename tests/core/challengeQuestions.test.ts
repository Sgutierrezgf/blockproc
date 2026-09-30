import { buildQuestionPool } from "../../blockproc/src/core/challengeQuestions";
import type { Question } from "../../blockproc/src/core/questions";
import { createSeededRandom } from "../../blockproc/src/core/random";

function bank(): Question[] {
  return [
    { id: "general-001", area: "general", question: "¿?", options: ["a", "b", "c", "d"], correctIndex: 0 },
    { id: "technology-001", area: "technology", question: "¿?", options: ["a", "b", "c", "d"], correctIndex: 1 },
  ];
}

// RF-11, RF-24: "math" no vive en el banco (se genera al vuelo), así que
// para "mezclar las áreas marcadas" el pool real tiene que incluirla cuando
// el usuario la marcó, sin tocar el banco cuando no la marcó.
describe("buildQuestionPool", () => {
  it("sin el área math marcada, devuelve el banco tal cual", () => {
    const pool = buildQuestionPool(bank(), ["general", "technology"], 2, 1000, createSeededRandom(1));
    expect(pool).toEqual(bank());
  });

  it("con math marcada, añade preguntas generadas de esa área a la vez que el banco", () => {
    const pool = buildQuestionPool(bank(), ["general", "math"], 2, 1000, createSeededRandom(1));

    const mathQuestions = pool.filter((q) => q.area === "math");
    expect(mathQuestions).toHaveLength(2);
    expect(pool).toEqual(expect.arrayContaining(bank()));
  });

  it("dos llamadas con distinto `now` no chocan de id", () => {
    const random = createSeededRandom(1);
    const poolA = buildQuestionPool(bank(), ["math"], 2, 1000, random);
    const poolB = buildQuestionPool(bank(), ["math"], 2, 2000, random);

    const idsA = new Set(poolA.filter((q) => q.area === "math").map((q) => q.id));
    const idsB = poolB.filter((q) => q.area === "math").map((q) => q.id);
    for (const id of idsB) {
      expect(idsA.has(id)).toBe(false);
    }
  });
});
