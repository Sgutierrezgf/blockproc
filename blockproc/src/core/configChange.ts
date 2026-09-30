import type { Config } from "./config";

// RF-29: un cambio de configuración endurece la restricción, la relaja, o
// es neutral. T28 decide, a partir de esta clasificación, qué se aplica de
// inmediato y qué espera a las 04:00.
export type ConfigChangeClassification = "harden" | "relax" | "neutral";

export interface ConfigFieldChange {
  field: keyof Config;
  classification: ConfigChangeClassification;
}

function areSetsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((item) => setA.has(item));
}

/**
 * Compara una configuración anterior con una propuesta y clasifica cada
 * cambio real (los campos sin cambios no aparecen en el resultado). Un
 * mismo campo puede aparecer dos veces: por ejemplo, restrictedPackages
 * puede endurecer (apps que se añaden) y relajar (apps que se quitan) a la
 * vez, si el usuario cambia ambas cosas en el mismo momento.
 */
export function classifyConfigChanges(oldConfig: Config, newConfig: Config): ConfigFieldChange[] {
  const changes: ConfigFieldChange[] = [];

  if (newConfig.dailyLimitMin !== oldConfig.dailyLimitMin) {
    changes.push({
      field: "dailyLimitMin",
      // Bajar el límite endurece; subirlo relaja.
      classification: newConfig.dailyLimitMin < oldConfig.dailyLimitMin ? "harden" : "relax",
    });
  }

  if (newConfig.questionCount !== oldConfig.questionCount) {
    changes.push({
      field: "questionCount",
      // Más preguntas endurece; menos preguntas relaja.
      classification: newConfig.questionCount > oldConfig.questionCount ? "harden" : "relax",
    });
  }

  if (newConfig.accessWindowMin !== oldConfig.accessWindowMin) {
    changes.push({
      field: "accessWindowMin",
      // Una ventana más corta endurece; una más larga relaja.
      classification: newConfig.accessWindowMin < oldConfig.accessWindowMin ? "harden" : "relax",
    });
  }

  const addedPackages = newConfig.restrictedPackages.filter(
    (pkg) => !oldConfig.restrictedPackages.includes(pkg)
  );
  const removedPackages = oldConfig.restrictedPackages.filter(
    (pkg) => !newConfig.restrictedPackages.includes(pkg)
  );
  if (addedPackages.length > 0) {
    changes.push({ field: "restrictedPackages", classification: "harden" });
  }
  if (removedPackages.length > 0) {
    changes.push({ field: "restrictedPackages", classification: "relax" });
  }

  if (!areSetsEqual(newConfig.areas, oldConfig.areas)) {
    changes.push({ field: "areas", classification: "neutral" });
  }
  if (newConfig.focusMessage !== oldConfig.focusMessage) {
    changes.push({ field: "focusMessage", classification: "neutral" });
  }
  if (newConfig.restBlockMessage !== oldConfig.restBlockMessage) {
    changes.push({ field: "restBlockMessage", classification: "neutral" });
  }

  return changes;
}
