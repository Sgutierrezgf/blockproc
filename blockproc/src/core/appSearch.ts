import type { InstalledApp } from "./exclusions";

function normalize(text: string): string {
  return text
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** RF-46: coincidencia parcial del nombre, sin distinguir mayúsculas ni tildes. */
export function filterAppsByQuery(apps: InstalledApp[], query: string): InstalledApp[] {
  const normalizedQuery = normalize(query);
  return apps.filter((app) => normalize(app.label).includes(normalizedQuery));
}
