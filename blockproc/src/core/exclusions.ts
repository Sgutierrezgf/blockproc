// RF-1, RF-28, RF-48, RF-49: una app instalada tal como la reporta lo nativo
// (T46, T82). `iconUri`/`category` son opcionales: los tests de este core no
// necesitan darlos, y `iconUri` es de mejor esfuerzo (puede venir null si el
// sistema no pudo generar el ícono).
export interface InstalledApp {
  packageName: string;
  label: string;
  iconUri?: string | null;
  category?: number | null;
}

/**
 * RF-28: quita de la lista las apps esenciales (teléfono, Ajustes,
 * lanzador, cámara) y la propia app, para que nunca se ofrezcan como
 * restringibles. Qué paquete real corresponde a cada una la identifica lo
 * nativo, de mejor esfuerzo; esta función solo aplica el filtro ya
 * decidido, así que se prueba sin depender de ningún dispositivo.
 */
export function filterEssentialApps(
  apps: InstalledApp[],
  essentialPackages: string[]
): InstalledApp[] {
  const essential = new Set(essentialPackages);
  return apps.filter((app) => !essential.has(app.packageName));
}

/** RF-1 (T54): marca o desmarca un paquete en el selector de apps a restringir. */
export function toggleRestrictedPackage(restrictedPackages: string[], packageName: string): string[] {
  if (restrictedPackages.includes(packageName)) {
    return restrictedPackages.filter((pkg) => pkg !== packageName);
  }
  return [...restrictedPackages, packageName];
}
