import type { Area } from "../../blockproc/src/core/types";
import type { Question } from "../../blockproc/src/core/questions";
import { createSeededRandom } from "../../blockproc/src/core/random";
import { createQuestionCycleState, selectQuestions } from "../../blockproc/src/core/questionSelector";

function q(id: string, area: Area = "general"): Question {
  return {
    id,
    area,
    question: `Pregunta ${id}`,
    options: ["a", "b", "c", "d"],
    correctIndex: 0,
  };
}

// RF-11: exactamente la cantidad pedida, mezcladas de las áreas marcadas,
// sin repetir hasta agotar esas áreas; si quedan menos sin usar que las
// pedidas, reinicia el ciclo y completa sin repetir dentro del mismo reto.
describe("selectQuestions", () => {
  it("no repite ninguna pregunta hasta agotar el ciclo", () => {
    const pool = [q("g1"), q("g2"), q("g3")];
    const random = createSeededRandom(42);
    let state = createQuestionCycleState();
    const vistos = new Set<string>();

    for (let i = 0; i < 3; i += 1) {
      const result = selectQuestions(state, pool, ["general"], 1, random);
      state = result.state;
      expect(vistos.has(result.questions[0].id)).toBe(false);
      vistos.add(result.questions[0].id);
    }

    expect(vistos.size).toBe(3); // se usaron las 3 antes de que ninguna se repitiera
  });

  it("al quedar 2 de 3 sin usar, completa el reto reiniciando el ciclo sin repetir dentro del reto", () => {
    const pool = [q("g1"), q("g2"), q("g3")];
    // Estado de partida: "g1" ya se usó en un reto anterior; quedan 2 sin usar.
    const estadoInicial = { usedIds: new Set(["g1"]) };
    const random = createSeededRandom(7);

    const { questions, state } = selectQuestions(estadoInicial, pool, ["general"], 3, random);

    expect(questions).toHaveLength(3);
    const idsDelReto = questions.map((question) => question.id);
    expect(new Set(idsDelReto).size).toBe(3); // ninguna se repite dentro del mismo reto
    expect(new Set(idsDelReto)).toEqual(new Set(["g1", "g2", "g3"])); // las 3 aparecen

    // El ciclo nuevo queda con constancia de lo usado después del reinicio.
    expect(state.usedIds.size).toBeGreaterThan(0);
  });

  it("mezcla las áreas marcadas", () => {
    const pool = [q("g1", "general"), q("g2", "general"), q("s1", "science"), q("s2", "science")];
    const state = createQuestionCycleState();
    const random = createSeededRandom(5);

    const { questions } = selectQuestions(state, pool, ["general", "science"], 4, random);

    expect(questions).toHaveLength(4);
    const areas = new Set(questions.map((question) => question.area));
    expect(areas.has("general")).toBe(true);
    expect(areas.has("science")).toBe(true);
  });

  it("no toma preguntas de áreas que no están marcadas", () => {
    const pool = [q("g1", "general"), q("s1", "science")];
    const state = createQuestionCycleState();
    const random = createSeededRandom(1);

    const { questions } = selectQuestions(state, pool, ["general"], 1, random);

    expect(questions[0].area).toBe("general");
  });

  it("si el pool tiene menos preguntas que las pedidas, da las que hay sin fallar", () => {
    const pool = [q("g1")];
    const state = createQuestionCycleState();
    const random = createSeededRandom(3);

    const { questions } = selectQuestions(state, pool, ["general"], 3, random);

    expect(questions).toHaveLength(1);
  });

  it("un pool vacío no da ninguna pregunta", () => {
    const state = createQuestionCycleState();
    const random = createSeededRandom(9);

    const { questions } = selectQuestions(state, [], ["general"], 3, random);

    expect(questions).toHaveLength(0);
  });
});
