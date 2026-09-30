import type { Config } from "../../blockproc/src/core/config";
import { classifyConfigChanges, type ConfigChangeClassification } from "../../blockproc/src/core/configChange";

// Valores intermedios a propósito (ni el mínimo ni el máximo), para que
// tanto subir como bajar cada campo sea un cambio válido y con sentido.
const base: Config = {
  restrictedPackages: ["com.spotify.music"],
  dailyLimitMin: 30,
  questionCount: 2,
  accessWindowMin: 7,
  areas: ["general"],
  focusMessage: "Mensaje original",
  restBlockMessage: "Mensaje de bloqueo original",
};

function classificationsFor(field: string, changes: { field: string; classification: ConfigChangeClassification }[]) {
  return changes.filter((change) => change.field === field).map((change) => change.classification);
}

// RF-29: los ocho cambios (cuatro que endurecen, cuatro que relajan) más
// las áreas y los mensajes, que son siempre neutrales.
describe("classifyConfigChanges", () => {
  it("bajar el límite diario endurece", () => {
    const changes = classifyConfigChanges(base, { ...base, dailyLimitMin: 15 });
    expect(classificationsFor("dailyLimitMin", changes)).toEqual(["harden"]);
  });

  it("subir el límite diario relaja", () => {
    const changes = classifyConfigChanges(base, { ...base, dailyLimitMin: 60 });
    expect(classificationsFor("dailyLimitMin", changes)).toEqual(["relax"]);
  });

  it("añadir apps restringidas endurece", () => {
    const changes = classifyConfigChanges(base, {
      ...base,
      restrictedPackages: ["com.spotify.music", "com.instagram.android"],
    });
    expect(classificationsFor("restrictedPackages", changes)).toEqual(["harden"]);
  });

  it("quitar apps restringidas relaja", () => {
    const changes = classifyConfigChanges(base, { ...base, restrictedPackages: [] });
    expect(classificationsFor("restrictedPackages", changes)).toEqual(["relax"]);
  });

  it("subir la cantidad de preguntas endurece", () => {
    const changes = classifyConfigChanges(base, { ...base, questionCount: 3 });
    expect(classificationsFor("questionCount", changes)).toEqual(["harden"]);
  });

  it("bajar la cantidad de preguntas relaja", () => {
    const changes = classifyConfigChanges(base, { ...base, questionCount: 1 });
    expect(classificationsFor("questionCount", changes)).toEqual(["relax"]);
  });

  it("acortar la ventana de acceso endurece", () => {
    const changes = classifyConfigChanges(base, { ...base, accessWindowMin: 5 });
    expect(classificationsFor("accessWindowMin", changes)).toEqual(["harden"]);
  });

  it("alargar la ventana de acceso relaja", () => {
    const changes = classifyConfigChanges(base, { ...base, accessWindowMin: 10 });
    expect(classificationsFor("accessWindowMin", changes)).toEqual(["relax"]);
  });

  it("cambiar las áreas de preguntas es neutral", () => {
    const changes = classifyConfigChanges(base, { ...base, areas: ["technology", "science"] });
    expect(classificationsFor("areas", changes)).toEqual(["neutral"]);
  });

  it("cambiar el mensaje de enfoque es neutral", () => {
    const changes = classifyConfigChanges(base, { ...base, focusMessage: "Otro mensaje" });
    expect(classificationsFor("focusMessage", changes)).toEqual(["neutral"]);
  });

  it("cambiar el mensaje del bloqueo horario es neutral", () => {
    const changes = classifyConfigChanges(base, { ...base, restBlockMessage: "Otro mensaje" });
    expect(classificationsFor("restBlockMessage", changes)).toEqual(["neutral"]);
  });

  it("añadir y quitar apps a la vez da ambas clasificaciones", () => {
    const changes = classifyConfigChanges(base, {
      ...base,
      restrictedPackages: ["com.instagram.android"], // se quita spotify, se añade instagram
    });
    expect(classificationsFor("restrictedPackages", changes).sort()).toEqual(["harden", "relax"]);
  });

  it("sin ningún cambio no clasifica nada", () => {
    expect(classifyConfigChanges(base, { ...base })).toEqual([]);
  });

  it("varios cambios a la vez se clasifican cada uno por separado", () => {
    const changes = classifyConfigChanges(base, { ...base, dailyLimitMin: 15, accessWindowMin: 10 });
    expect(classificationsFor("dailyLimitMin", changes)).toEqual(["harden"]);
    expect(classificationsFor("accessWindowMin", changes)).toEqual(["relax"]);
  });
});
