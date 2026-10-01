import { sortAppsWithRestrictedFirst } from "../../blockproc/src/core/appCategories";
import type { InstalledApp } from "../../blockproc/src/core/exclusions";

function app(packageName: string, label: string): InstalledApp {
  return { packageName, label, iconUri: null, category: null };
}

// RF-52 (Fase 9): visibilidad de lo que se va a restringir — las apps ya
// marcadas van primero, alfabético dentro de cada grupo. Esta función no
// sabe nada de buscador ni categorías (RF-46, RF-49): se aplica después,
// sobre lo que ya haya quedado filtrado.
describe("sortAppsWithRestrictedFirst", () => {
  it("pone las restringidas primero, alfabético dentro de cada grupo", () => {
    const apps = [app("z", "Zebra"), app("a", "Apple"), app("b", "Banana"), app("m", "Mango")];
    const result = sortAppsWithRestrictedFirst(apps, ["z", "b"]);
    expect(result.map((a) => a.label)).toEqual(["Banana", "Zebra", "Apple", "Mango"]);
  });

  it("sin ninguna app restringida, queda todo alfabético", () => {
    const apps = [app("z", "Zebra"), app("a", "Apple")];
    const result = sortAppsWithRestrictedFirst(apps, []);
    expect(result.map((a) => a.label)).toEqual(["Apple", "Zebra"]);
  });

  it("con todas restringidas, queda todo alfabético (un solo grupo)", () => {
    const apps = [app("z", "Zebra"), app("a", "Apple")];
    const result = sortAppsWithRestrictedFirst(apps, ["z", "a"]);
    expect(result.map((a) => a.label)).toEqual(["Apple", "Zebra"]);
  });

  it("no muta el array original", () => {
    const apps = [app("z", "Zebra"), app("a", "Apple")];
    sortAppsWithRestrictedFirst(apps, ["a"]);
    expect(apps.map((a) => a.label)).toEqual(["Zebra", "Apple"]);
  });
});
