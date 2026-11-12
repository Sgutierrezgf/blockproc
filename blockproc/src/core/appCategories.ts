import type { InstalledApp } from "./exclusions";

// RF-49: valores de `ApplicationInfo.category` (Android API 26+) traducidos
// a una clave estable (no a un texto ya en un idioma — eso lo resuelve la UI
// con `useStrings().appPicker.categoryLabels`, RF-76/77). `CATEGORY_UNDEFINED`
// (-1) ya llega como `null` desde lo nativo (T82); cualquier valor fuera de
// esta lista también cae en "other", nunca se excluye una app por tener una
// categoría desconocida.
export type CategoryKey =
  | "games"
  | "audio"
  | "video"
  | "images"
  | "social"
  | "news"
  | "maps"
  | "productivity"
  | "accessibility"
  | "other";

const CATEGORY_KEYS: Record<number, CategoryKey> = {
  0: "games",
  1: "audio",
  2: "video",
  3: "images",
  4: "social",
  5: "news",
  6: "maps",
  7: "productivity",
  8: "accessibility",
};

const OTHER_KEY: CategoryKey = "other";

const CATEGORY_ORDER: CategoryKey[] = [...Object.values(CATEGORY_KEYS), OTHER_KEY];

export function categoryKey(category: number | null | undefined): CategoryKey {
  if (category == null) {
    return OTHER_KEY;
  }
  return CATEGORY_KEYS[category] ?? OTHER_KEY;
}

export interface AppCategoryGroup {
  key: CategoryKey;
  apps: InstalledApp[];
}

/**
 * RF-49: agrupa las apps por clave de categoría, en un orden fijo (las
 * categorías conocidas primero, "other" al final), sin incluir categorías
 * que no tengan ninguna app en esta lista.
 */
export function groupAppsByCategory(apps: InstalledApp[]): AppCategoryGroup[] {
  const buckets = new Map<CategoryKey, InstalledApp[]>();
  for (const app of apps) {
    const key = categoryKey(app.category);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(app);
    } else {
      buckets.set(key, [app]);
    }
  }
  return CATEGORY_ORDER.filter((key) => buckets.has(key)).map((key) => ({
    key,
    apps: buckets.get(key) as InstalledApp[],
  }));
}
