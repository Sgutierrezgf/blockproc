import {
  findDuplicateQuestionIds,
  hasMinimumQuestionsPerArea,
  isValidQuestion,
  isValidQuestionBank,
  MIN_QUESTIONS_PER_TEXT_AREA,
  OPTIONS_COUNT,
  selectQuestionBank,
  type Question,
} from "../../blockproc/src/core/questions";

const preguntaValida: Question = {
  id: "general-001",
  area: "general",
  question: "¿Cuál es la capital de Francia?",
  options: ["Madrid", "París", "Roma", "Berlín"],
  correctIndex: 1,
  explanation: "París es la capital de Francia desde hace siglos.",
};

// RF-23: formato del banco de preguntas — 4 opciones, correctIndex válido,
// área conocida, sin ids duplicados.
describe("isValidQuestion", () => {
  it("acepta una pregunta válida", () => {
    expect(isValidQuestion(preguntaValida)).toBe(true);
  });

  it("acepta una pregunta válida sin explicación (es opcional)", () => {
    const sinExplicacion = {
      id: preguntaValida.id,
      area: preguntaValida.area,
      question: preguntaValida.question,
      options: preguntaValida.options,
      correctIndex: preguntaValida.correctIndex,
    };
    expect(isValidQuestion(sinExplicacion)).toBe(true);
  });

  it("OPTIONS_COUNT es 4", () => {
    expect(OPTIONS_COUNT).toBe(4);
  });

  it("rechaza una pregunta con menos de 4 opciones", () => {
    expect(isValidQuestion({ ...preguntaValida, options: ["Madrid", "París", "Roma"] })).toBe(false);
  });

  it("rechaza una pregunta con más de 4 opciones", () => {
    expect(
      isValidQuestion({ ...preguntaValida, options: ["Madrid", "París", "Roma", "Berlín", "Lisboa"] })
    ).toBe(false);
  });

  it("rechaza correctIndex fuera de rango", () => {
    expect(isValidQuestion({ ...preguntaValida, correctIndex: 4 })).toBe(false);
    expect(isValidQuestion({ ...preguntaValida, correctIndex: -1 })).toBe(false);
  });

  it("rechaza correctIndex no entero", () => {
    expect(isValidQuestion({ ...preguntaValida, correctIndex: 1.5 })).toBe(false);
  });

  it("rechaza un área desconocida", () => {
    expect(isValidQuestion({ ...preguntaValida, area: "deportes" })).toBe(false);
  });

  it("rechaza sin id o con id vacío", () => {
    const sinId = {
      area: preguntaValida.area,
      question: preguntaValida.question,
      options: preguntaValida.options,
      correctIndex: preguntaValida.correctIndex,
    };
    expect(isValidQuestion(sinId)).toBe(false);
    expect(isValidQuestion({ ...preguntaValida, id: "" })).toBe(false);
  });

  it("rechaza un enunciado vacío", () => {
    expect(isValidQuestion({ ...preguntaValida, question: "" })).toBe(false);
  });

  it("rechaza una opción vacía", () => {
    expect(isValidQuestion({ ...preguntaValida, options: ["Madrid", "", "Roma", "Berlín"] })).toBe(false);
  });

  it("rechaza valores que no son un objeto", () => {
    expect(isValidQuestion(null)).toBe(false);
    expect(isValidQuestion(undefined)).toBe(false);
    expect(isValidQuestion("pregunta")).toBe(false);
    expect(isValidQuestion([])).toBe(false);
  });
});

describe("findDuplicateQuestionIds", () => {
  it("no encuentra duplicados en una lista con ids únicos", () => {
    const otra: Question = { ...preguntaValida, id: "general-002" };
    expect(findDuplicateQuestionIds([preguntaValida, otra])).toEqual([]);
  });

  it("encuentra un id repetido", () => {
    const repetida: Question = { ...preguntaValida, question: "Otra pregunta con el mismo id" };
    expect(findDuplicateQuestionIds([preguntaValida, repetida])).toEqual([preguntaValida.id]);
  });
});

describe("isValidQuestionBank", () => {
  it("acepta un banco con preguntas válidas y sin ids duplicados", () => {
    const otra: Question = { ...preguntaValida, id: "general-002" };
    expect(isValidQuestionBank([preguntaValida, otra])).toBe(true);
  });

  it("acepta un banco vacío (el mínimo por área se comprueba aparte, en la T45)", () => {
    expect(isValidQuestionBank([])).toBe(true);
  });

  it("rechaza un banco con ids duplicados", () => {
    const repetida: Question = { ...preguntaValida, question: "Otra pregunta con el mismo id" };
    expect(isValidQuestionBank([preguntaValida, repetida])).toBe(false);
  });

  it("rechaza un banco con una pregunta inválida", () => {
    expect(isValidQuestionBank([preguntaValida, { ...preguntaValida, id: "x", area: "deportes" }])).toBe(
      false
    );
  });

  it("rechaza algo que no es una lista", () => {
    expect(isValidQuestionBank({})).toBe(false);
    expect(isValidQuestionBank(null)).toBe(false);
  });
});

// RF-23 / criterios de finalización: cada área de texto (todas menos "math",
// que la genera mathQuestions.ts) necesita al menos 60 preguntas.
function preguntasDelArea(area: Question["area"], cantidad: number): Question[] {
  return Array.from({ length: cantidad }, (_, i) => ({
    ...preguntaValida,
    id: `${area}-generada-${i}`,
    area,
  }));
}

describe("hasMinimumQuestionsPerArea", () => {
  it("MIN_QUESTIONS_PER_TEXT_AREA es 60", () => {
    expect(MIN_QUESTIONS_PER_TEXT_AREA).toBe(60);
  });

  it("rechaza si un área de texto tiene menos de 60 (aunque las demás sí lleguen)", () => {
    const banco = [
      ...preguntasDelArea("general", 60),
      ...preguntasDelArea("technology", 60),
      ...preguntasDelArea("health", 60),
      ...preguntasDelArea("science", 59), // le falta una
    ];
    expect(hasMinimumQuestionsPerArea(banco)).toBe(false);
  });

  it("rechaza si a un área de texto le faltan por completo las preguntas", () => {
    const banco = [
      ...preguntasDelArea("general", 60),
      ...preguntasDelArea("technology", 60),
      ...preguntasDelArea("health", 60),
      // "science" no aparece en absoluto
    ];
    expect(hasMinimumQuestionsPerArea(banco)).toBe(false);
  });

  it("acepta cuando las 4 áreas de texto llegan exactamente a 60", () => {
    const banco = [
      ...preguntasDelArea("general", 60),
      ...preguntasDelArea("technology", 60),
      ...preguntasDelArea("health", 60),
      ...preguntasDelArea("science", 60),
    ];
    expect(hasMinimumQuestionsPerArea(banco)).toBe(true);
  });

  it("no exige ninguna preguntas de \"math\": esas las genera mathQuestions.ts, no el banco", () => {
    const banco = [
      ...preguntasDelArea("general", 60),
      ...preguntasDelArea("technology", 60),
      ...preguntasDelArea("health", 60),
      ...preguntasDelArea("science", 60),
    ];
    expect(hasMinimumQuestionsPerArea(banco)).toBe(true); // sin ninguna "math" y aun así pasa
  });
});

// RF-77: elige el banco del idioma activo entre los ya cargados.
describe("selectQuestionBank", () => {
  const bankEs: Question[] = [{ ...preguntaValida, id: "es-001" }];
  const bankEn: Question[] = [{ ...preguntaValida, id: "en-001", question: "What is the capital of France?" }];
  const banks = { es: bankEs, en: bankEn };

  it("devuelve el banco en español cuando el idioma es 'es'", () => {
    expect(selectQuestionBank("es", banks)).toBe(bankEs);
  });

  it("devuelve un banco distinto cuando el idioma es 'en'", () => {
    expect(selectQuestionBank("en", banks)).toBe(bankEn);
  });
});
