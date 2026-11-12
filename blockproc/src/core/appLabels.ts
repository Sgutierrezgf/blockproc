import type { InstalledApp } from "./exclusions";

export interface AppLabelSummary {
  labels: string[];
  remaining: number;
}

// RF-81, D44: nombres visibles de las apps de un bloqueo, en el orden en que
// las guarda el bloqueo. Si una app ya no está instalada se muestra su nombre
// de paquete; con `max`, se cortan los primeros `max` y se informa cuántos
// quedan (C46: el resumen y el detalle muestran 5 y "+N más").
export function summarizeAppLabels(
  packages: string[],
  apps: InstalledApp[],
  max: number = Infinity
): AppLabelSummary {
  const labelByPackage = new Map(apps.map((app) => [app.packageName, app.label]));
  const labels = packages.map((packageName) => labelByPackage.get(packageName) ?? packageName);
  return {
    labels: labels.slice(0, max),
    remaining: Math.max(0, labels.length - max),
  };
}
