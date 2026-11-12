import { categoryKey, groupAppsByCategory } from "../../blockproc/src/core/appCategories";
import type { InstalledApp } from "../../blockproc/src/core/exclusions";

// RF-49: traduce la categoría cruda de Android (ApplicationInfo.category) a
// una clave estable (RF-76/77: la etiqueta visible la resuelve la UI según
// el idioma, no este módulo), y agrupa apps por esa clave.
describe("categoryKey", () => {
  it("traduce cada categoría conocida", () => {
    expect(categoryKey(0)).toBe("games");
    expect(categoryKey(1)).toBe("audio");
    expect(categoryKey(2)).toBe("video");
    expect(categoryKey(3)).toBe("images");
    expect(categoryKey(4)).toBe("social");
    expect(categoryKey(5)).toBe("news");
    expect(categoryKey(6)).toBe("maps");
    expect(categoryKey(7)).toBe("productivity");
    expect(categoryKey(8)).toBe("accessibility");
  });

  it("cae en 'other' si la app no declara categoría (null)", () => {
    expect(categoryKey(null)).toBe("other");
    expect(categoryKey(undefined)).toBe("other");
  });

  it("cae en 'other' ante una categoría fuera de las conocidas", () => {
    expect(categoryKey(999)).toBe("other");
  });
});

describe("groupAppsByCategory", () => {
  const juego: InstalledApp = { packageName: "com.game", label: "Juego", category: 0 };
  const spotify: InstalledApp = { packageName: "com.spotify.music", label: "Spotify", category: 1 };
  const otroJuego: InstalledApp = { packageName: "com.game2", label: "Otro juego", category: 0 };
  const sinCategoria: InstalledApp = { packageName: "com.desconocida", label: "Desconocida", category: null };

  it("agrupa las apps por su clave de categoría", () => {
    const grupos = groupAppsByCategory([juego, spotify, otroJuego]);
    expect(grupos).toEqual([
      { key: "games", apps: [juego, otroJuego] },
      { key: "audio", apps: [spotify] },
    ]);
  });

  it("agrupa las apps sin categoría bajo 'other'", () => {
    const grupos = groupAppsByCategory([juego, sinCategoria]);
    expect(grupos).toEqual([
      { key: "games", apps: [juego] },
      { key: "other", apps: [sinCategoria] },
    ]);
  });

  it("no incluye categorías sin ninguna app", () => {
    const grupos = groupAppsByCategory([juego]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].key).toBe("games");
  });

  it("con una lista vacía, devuelve una lista vacía de grupos", () => {
    expect(groupAppsByCategory([])).toEqual([]);
  });
});
