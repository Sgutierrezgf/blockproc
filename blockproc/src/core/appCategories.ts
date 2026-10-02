import type { InstalledApp } from "./exclusions";

// RF-49: valores de `ApplicationInfo.category` (Android API 26+) traducidos
// a una etiqueta en español. `CATEGORY_UNDEFINED` (-1) ya llega como `null`
// desde lo nativo (T82); cualquier valor fuera de esta lista también cae en
// "Otras", nunca se excluye una app por tener una categoría desconocida.
const CATEGORY_LABELS: Record<number, string> = {
  0: "Juegos",
  1: "Audio",
  2: "Video",
  3: "Imágenes",
  4: "Redes sociales",
  5: "Noticias",
  6: "Mapas",
  7: "Productividad",
  8: "Accesibilidad",
};

const OTHER_LABEL = "Otras";

const CATEGORY_ORDER = [...Object.values(CATEGORY_LABELS), OTHER_LABEL];

export function categoryLabel(category: number | null | undefined): string {
  if (category == null) {
    return OTHER_LABEL;
  }
  return CATEGORY_LABELS[category] ?? OTHER_LABEL;
}

export interface AppCategoryGroup {
  label: string;
  apps: InstalledApp[];
}

/**
 * RF-49: agrupa las apps por categoría traducida, en un orden fijo y
 * legible (las categorías conocidas primero, "Otras" al final), sin incluir
 * categorías que no tengan ninguna app en esta lista.
 */
export function groupAppsByCategory(apps: InstalledApp[]): AppCategoryGroup[] {
  const buckets = new Map<string, InstalledApp[]>();
  for (const app of apps) {
    const label = categoryLabel(app.category);
    const bucket = buckets.get(label);
    if (bucket) {
      bucket.push(app);
    } else {
      buckets.set(label, [app]);
    }
  }
  return CATEGORY_ORDER.filter((label) => buckets.has(label)).map((label) => ({
    label,
    apps: buckets.get(label) as InstalledApp[],
  }));
}

