import {
  AREAS,
  BLOCK_MESSAGE_MAX_LENGTH,
  createDefaultConfig,
  FOCUS_MESSAGE_MAX_LENGTH,
  isValidMessage,
} from "../../blockproc/src/core/config";

// RF-70: Ajustes queda reducido a los mensajes por defecto.
describe("createDefaultConfig", () => {
  it("usa los mensajes de fábrica", () => {
    const config = createDefaultConfig();
    expect(config.defaultFocusMessage.length).toBeGreaterThan(0);
    expect(config.defaultBlockMessage.length).toBeGreaterThan(0);
  });

  it("los mensajes por defecto son válidos según su propio validador", () => {
    const config = createDefaultConfig();
    expect(isValidMessage(config.defaultFocusMessage)).toBe(true);
    expect(isValidMessage(config.defaultBlockMessage)).toBe(true);
  });
});

// RF-70: mensajes de hasta 120 caracteres.
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
  it("FOCUS_MESSAGE_MAX_LENGTH y BLOCK_MESSAGE_MAX_LENGTH son 120", () => {
    expect(FOCUS_MESSAGE_MAX_LENGTH).toBe(120);
    expect(BLOCK_MESSAGE_MAX_LENGTH).toBe(120);
  });
});

// RF-57: lista fija de categorías de preguntas, ahora una sola por bloqueo.
describe("AREAS", () => {
  it("mantiene las 5 categorías conocidas", () => {
    expect(AREAS).toEqual(["general", "technology", "health", "science", "math"]);
  });
});
