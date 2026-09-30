import { categoryLabel, groupAppsByCategory } from "../../blockproc/src/core/appCategories";
import type { InstalledApp } from "../../blockproc/src/core/exclusions";

// RF-49: traduce la categoría cruda de Android (ApplicationInfo.category) a
// una etiqueta en español, y agrupa apps por esa etiqueta.
describe("categoryLabel", () => {
  it("traduce cada categoría conocida", () => {
    expect(categoryLabel(0)).toBe("Juegos");
    expect(categoryLabel(1)).toBe("Audio");
    expect(categoryLabel(2)).toBe("Video");
    expect(categoryLabel(3)).toBe("Imágenes");
    expect(categoryLabel(4)).toBe("Redes sociales");
    expect(categoryLabel(5)).toBe("Noticias");
    expect(categoryLabel(6)).toBe("Mapas");
    expect(categoryLabel(7)).toBe("Productividad");
    expect(categoryLabel(8)).toBe("Accesibilidad");
  });

  it("cae en 'Otras' si la app no declara categoría (null)", () => {
    expect(categoryLabel(null)).toBe("Otras");
    expect(categoryLabel(undefined)).toBe("Otras");
  });

  it("cae en 'Otras' ante una categoría fuera de las conocidas", () => {
    expect(categoryLabel(999)).toBe("Otras");
  });
});

describe("groupAppsByCategory", () => {
  const juego: InstalledApp = { packageName: "com.game", label: "Juego", category: 0 };
  const spotify: InstalledApp = { packageName: "com.spotify.music", label: "Spotify", category: 1 };
  const otroJuego: InstalledApp = { packageName: "com.game2", label: "Otro juego", category: 0 };
  const sinCategoria: InstalledApp = { packageName: "com.desconocida", label: "Desconocida", category: null };

  it("agrupa las apps por su categoría traducida", () => {
    const grupos = groupAppsByCategory([juego, spotify, otroJuego]);
    expect(grupos).toEqual([
      { label: "Juegos", apps: [juego, otroJuego] },
      { label: "Audio", apps: [spotify] },
    ]);
  });

  it("agrupa las apps sin categoría bajo 'Otras'", () => {
    const grupos = groupAppsByCategory([juego, sinCategoria]);
    expect(grupos).toEqual([
      { label: "Juegos", apps: [juego] },
      { label: "Otras", apps: [sinCategoria] },
    ]);
  });

  it("no incluye categorías sin ninguna app", () => {
    const grupos = groupAppsByCategory([juego]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].label).toBe("Juegos");
  });

  it("con una lista vacía, devuelve una lista vacía de grupos", () => {
    expect(groupAppsByCategory([])).toEqual([]);
  });
});
