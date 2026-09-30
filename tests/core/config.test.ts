import {
  AREAS,
  createDefaultConfig,
  isValidAccessWindowMin,
  isValidAreas,
  isValidDailyLimitMin,
  isValidMessage,
  isValidQuestionCount,
  toggleArea,
  FOCUS_MESSAGE_MAX_LENGTH,
} from "../../blockproc/src/core/config";

describe("createDefaultConfig", () => {
  it("usa los valores por defecto de RF-3 y RF-41", () => {
    const config = createDefaultConfig();
    expect(config.dailyLimitMin).toBe(30);
    expect(config.questionCount).toBe(2);
    expect(config.accessWindowMin).toBe(5);
    expect(config.areas).toEqual(["general"]);
    expect(config.restrictedPackages).toEqual([]);
    expect(config.focusMessage.length).toBeGreaterThan(0);
    expect(config.restBlockMessage.length).toBeGreaterThan(0);
  });

  it("los valores por defecto son válidos según sus propios validadores", () => {
    const config = createDefaultConfig();
    expect(isValidDailyLimitMin(config.dailyLimitMin)).toBe(true);
    expect(isValidQuestionCount(config.questionCount)).toBe(true);
    expect(isValidAccessWindowMin(config.accessWindowMin)).toBe(true);
    expect(isValidAreas(config.areas)).toBe(true);
    expect(isValidMessage(config.focusMessage)).toBe(true);
    expect(isValidMessage(config.restBlockMessage)).toBe(true);
  });
});

// RF-4: límite diario de 5 a 240 minutos, en pasos de 5.
describe("isValidDailyLimitMin", () => {
  it("rechaza 4 (por debajo del mínimo)", () => {
    expect(isValidDailyLimitMin(4)).toBe(false);
  });
  it("rechaza 245 (por encima del máximo)", () => {
    expect(isValidDailyLimitMin(245)).toBe(false);
  });
  it("rechaza un valor que no es múltiplo de 5", () => {
    expect(isValidDailyLimitMin(32)).toBe(false);
  });
  it("acepta 5 (mínimo)", () => {
    expect(isValidDailyLimitMin(5)).toBe(true);
  });
  it("acepta 240 (máximo)", () => {
    expect(isValidDailyLimitMin(240)).toBe(true);
  });
});

// RF-4: de 1 a 3 preguntas por reto.
describe("isValidQuestionCount", () => {
  it("rechaza 0 y 4", () => {
    expect(isValidQuestionCount(0)).toBe(false);
    expect(isValidQuestionCount(4)).toBe(false);
  });
  it("acepta 1, 2 y 3", () => {
    expect(isValidQuestionCount(1)).toBe(true);
    expect(isValidQuestionCount(2)).toBe(true);
    expect(isValidQuestionCount(3)).toBe(true);
  });
});

// RF-4: ventana de acceso de 5 a 10 minutos.
describe("isValidAccessWindowMin", () => {
  it("rechaza 4 y 11", () => {
    expect(isValidAccessWindowMin(4)).toBe(false);
    expect(isValidAccessWindowMin(11)).toBe(false);
  });
  it("acepta 5 y 10", () => {
    expect(isValidAccessWindowMin(5)).toBe(true);
    expect(isValidAccessWindowMin(10)).toBe(true);
  });
});

// RF-5: una o varias áreas, mínimo una, de la lista conocida.
describe("isValidAreas", () => {
  it("rechaza una lista vacía (0 áreas)", () => {
    expect(isValidAreas([])).toBe(false);
  });
  it("rechaza un área desconocida", () => {
    // @ts-expect-error: valor fuera del tipo Area, a propósito para la prueba
    expect(isValidAreas(["deportes"])).toBe(false);
  });
  it("acepta una sola área", () => {
    expect(isValidAreas(["general"])).toBe(true);
  });
  it("acepta varias áreas de la lista conocida", () => {
    expect(isValidAreas(["general", "technology"])).toBe(true);
    expect(AREAS).toEqual(["general", "technology", "health", "science", "math"]);
  });
});

// RF-6 y RF-35: mensajes de hasta 120 caracteres.
describe("isValidMessage", () => {
  it("rechaza un mensaje de 121 caracteres", () => {
    expect(isValidMessage("a".repeat(121))).toBe(false);
  });
  it("acepta un mensaje de 120 caracteres", () => {
    expect(isValidMessage("a".repeat(120))).toBe(true);
  });
  it("acepta un mensaje vacío", () => {
    expect(isValidMessage("")).toBe(true);
  });
  it("FOCUS_MESSAGE_MAX_LENGTH es 120", () => {
    expect(FOCUS_MESSAGE_MAX_LENGTH).toBe(120);
  });
});

// RF-5 (T56): el selector de áreas alterna libremente, salvo que dejaría
// cero áreas marcadas; ahí no hace nada, en vez de guardar un estado
// inválido que luego habría que rechazar.
describe("toggleArea", () => {
  it("añade un área que no estaba marcada", () => {
    expect(toggleArea(["general"], "technology")).toEqual(["general", "technology"]);
  });

  it("quita un área marcada si quedan otras", () => {
    expect(toggleArea(["general", "technology"], "general")).toEqual(["technology"]);
  });

  it("no quita la última área marcada", () => {
    expect(toggleArea(["general"], "general")).toEqual(["general"]);
  });
});
