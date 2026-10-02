import { createDefaultConfig } from "../../blockproc/src/core/config";
import type { Config } from "../../blockproc/src/core/config";
import { normalizeConfig, parseStoredConfig } from "../../blockproc/src/core/normalizeConfig";

const defaults = createDefaultConfig();

// RF-41: configuración corrupta, del modelo anterior, o primera ejecución → valores por defecto.
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

  it("datos con la forma del modelo anterior (dailyLimitMin, restrictedPackages) se tratan como corruptos", () => {
    const result = normalizeConfig({ dailyLimitMin: 60, restrictedPackages: ["com.example.app"] });
    expect(result).toEqual(defaults);
  });

  it("conserva un mensaje válido y repara solo el dañado", () => {
    const result = normalizeConfig({ defaultFocusMessage: "Mi mensaje", defaultBlockMessage: "a".repeat(121) });
    expect(result.defaultFocusMessage).toBe("Mi mensaje");
    expect(result.defaultBlockMessage).toBe(defaults.defaultBlockMessage);
  });

  it("repara un mensaje demasiado largo", () => {
    const result = normalizeConfig({ defaultFocusMessage: "a".repeat(121) });
    expect(result.defaultFocusMessage).toBe(defaults.defaultFocusMessage);
  });

  it("una configuración completa y válida se conserva tal cual", () => {
    const valid: Config = {
      defaultFocusMessage: "Mensaje propio",
      defaultBlockMessage: "Otro mensaje",
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
      defaultFocusMessage: "Mensaje propio",
      defaultBlockMessage: "Otro mensaje",
    };
    expect(parseStoredConfig(JSON.stringify(valid))).toEqual(valid);
  });

  it("un JSON del modelo anterior se descarta y arranca con los valores de fábrica", () => {
    const result = parseStoredConfig(JSON.stringify({ dailyLimitMin: 60, questionCount: -1 }));
    expect(result).toEqual(defaults);
  });
});
