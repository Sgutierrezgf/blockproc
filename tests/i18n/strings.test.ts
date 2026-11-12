import { STRINGS } from "../../blockproc/src/i18n/strings";

// RF-77, T162: recorre el diccionario como árbol (una función es una hoja,
// no se mete adentro) y junta las rutas de clave, ej. "createBlock.areaLabels.general".
function collectKeyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value === "function") {
    return [prefix];
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(value as Record<string, unknown>).flatMap((key) =>
      collectKeyPaths((value as Record<string, unknown>)[key], prefix ? `${prefix}.${key}` : key)
    );
  }
  return [prefix];
}

describe("i18n STRINGS", () => {
  it("tiene exactamente las mismas claves en español e inglés", () => {
    const esKeys = collectKeyPaths(STRINGS.es).sort();
    const enKeys = collectKeyPaths(STRINGS.en).sort();
    expect(enKeys).toEqual(esKeys);
  });
});
