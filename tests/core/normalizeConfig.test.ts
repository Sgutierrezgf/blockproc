import { createDefaultConfig } from "../../blockproc/src/core/config";
import type { Config } from "../../blockproc/src/core/config";
import { normalizeConfig, parseStoredConfig } from "../../blockproc/src/core/normalizeConfig";

const defaults = createDefaultConfig();

// RF-41: configuración corrupta o primera ejecución → valores por defecto.
describe("normalizeConfig", () => {
  it("undefined (primera ejecución) devuelve la configuración por defecto", () => {
    expect(normalizeConfig(undefined)).toEqual(defaults);
  });

  it("null devuelve la configuración por defecto", () => {
    expect(normalizeConfig(null)).toEqual(defaults);
  });

  it("un objeto vacío devuelve la configuración por defecto", () => {
    expect(normalizeConfig({})).toEqual(defaults);
  });

  it("un valor que no es un objeto (corrupto) devuelve la configuración por defecto", () => {
    expect(normalizeConfig("no soy una configuración")).toEqual(defaults);
    expect(normalizeConfig(42)).toEqual(defaults);
    expect(normalizeConfig([])).toEqual(defaults);
  });

  it("conserva los campos válidos y repara solo los dañados", () => {
    const result = normalizeConfig({ dailyLimitMin: 60, questionCount: 999 });
    expect(result.dailyLimitMin).toBe(60);
    expect(result.questionCount).toBe(defaults.questionCount);
  });

  it("repara un límite diario fuera de rango", () => {
    expect(normalizeConfig({ dailyLimitMin: 9999 }).dailyLimitMin).toBe(defaults.dailyLimitMin);
  });

  it("repara áreas vacías o con un valor desconocido", () => {
    expect(normalizeConfig({ areas: [] }).areas).toEqual(defaults.areas);
    expect(normalizeConfig({ areas: ["deportes"] }).areas).toEqual(defaults.areas);
  });

  it("conserva varias áreas válidas", () => {
    expect(normalizeConfig({ areas: ["technology", "science"] }).areas).toEqual([
      "technology",
      "science",
    ]);
  });

  it("repara un mensaje demasiado largo", () => {
    const result = normalizeConfig({ focusMessage: "a".repeat(121) });
    expect(result.focusMessage).toBe(defaults.focusMessage);
  });

  it("repara restrictedPackages si no es una lista de textos", () => {
    expect(normalizeConfig({ restrictedPackages: "com.example" }).restrictedPackages).toEqual([]);
    expect(normalizeConfig({ restrictedPackages: ["com.example.app"] }).restrictedPackages).toEqual([
      "com.example.app",
    ]);
  });

  it("una configuración completa y válida se conserva tal cual", () => {
    const valid: Config = {
      restrictedPackages: ["com.example.app"],
      dailyLimitMin: 45,
      questionCount: 3,
      accessWindowMin: 10,
      areas: ["health"],
      focusMessage: "Mensaje propio",
      restBlockMessage: "Otro mensaje",
    };
    expect(normalizeConfig(valid)).toEqual(valid);
  });
});

describe("parseStoredConfig", () => {
  it("un texto que no es JSON válido (corrupto) devuelve la configuración por defecto", () => {
    expect(parseStoredConfig("esto no es json{")).toEqual(defaults);
  });

  it("una cadena vacía devuelve la configuración por defecto", () => {
    expect(parseStoredConfig("")).toEqual(defaults);
  });

  it("null (nada guardado todavía) devuelve la configuración por defecto", () => {
    expect(parseStoredConfig(null)).toEqual(defaults);
  });

  it("un JSON válido con todos los campos se conserva", () => {
    const valid: Config = {
      restrictedPackages: [],
      dailyLimitMin: 60,
      questionCount: 1,
      accessWindowMin: 7,
      areas: ["math"],
      focusMessage: "Mensaje propio",
      restBlockMessage: "Otro mensaje",
    };
    expect(parseStoredConfig(JSON.stringify(valid))).toEqual(valid);
  });

  it("un JSON válido pero con un campo dañado repara solo ese campo", () => {
    const result = parseStoredConfig(JSON.stringify({ dailyLimitMin: 60, questionCount: -1 }));
    expect(result.dailyLimitMin).toBe(60);
    expect(result.questionCount).toBe(defaults.questionCount);
  });
});
