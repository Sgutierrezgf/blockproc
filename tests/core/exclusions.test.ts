import { filterEssentialApps, toggleRestrictedPackage, type InstalledApp } from "../../blockproc/src/core/exclusions";

// RF-28: nunca se ofrecen para restringir el teléfono, Ajustes, el lanzador,
// la cámara ni la propia app. Qué paquete real es cada una la identifica lo
// nativo (T46, verificación manual); aquí solo se prueba el filtro puro,
// dado ya el conjunto de paquetes esenciales.
describe("filterEssentialApps", () => {
  const telefono: InstalledApp = { packageName: "com.android.dialer", label: "Teléfono" };
  const ajustes: InstalledApp = { packageName: "com.android.settings", label: "Ajustes" };
  const lanzador: InstalledApp = { packageName: "com.android.launcher3", label: "Inicio" };
  const camara: InstalledApp = { packageName: "com.android.camera2", label: "Cámara" };
  const propiaApp: InstalledApp = { packageName: "com.segutdev.blockproc", label: "blockproc" };
  const instagram: InstalledApp = { packageName: "com.instagram.android", label: "Instagram" };
  const spotify: InstalledApp = { packageName: "com.spotify.music", label: "Spotify" };

  const todas = [telefono, ajustes, lanzador, camara, propiaApp, instagram, spotify];
  const esenciales = [
    telefono.packageName,
    ajustes.packageName,
    lanzador.packageName,
    camara.packageName,
    propiaApp.packageName,
  ];

  it("quita teléfono, Ajustes, lanzador, cámara y la propia app", () => {
    const resultado = filterEssentialApps(todas, esenciales);
    expect(resultado).toEqual([instagram, spotify]);
  });

  it("no quita nada si la lista de esenciales está vacía", () => {
    expect(filterEssentialApps(todas, [])).toEqual(todas);
  });

  it("no falla si un paquete esencial no está entre las apps instaladas", () => {
    const resultado = filterEssentialApps([instagram, spotify], esenciales);
    expect(resultado).toEqual([instagram, spotify]);
  });

  it("conserva el orden original de las apps que quedan", () => {
    const resultado = filterEssentialApps([spotify, telefono, instagram], esenciales);
    expect(resultado).toEqual([spotify, instagram]);
  });

  it("no modifica la lista original", () => {
    const copia = [...todas];
    filterEssentialApps(todas, esenciales);
    expect(todas).toEqual(copia);
  });
});

// RF-1: el selector de apps marca y desmarca sin más que alternar la
// pertenencia a la lista de paquetes restringidos.
describe("toggleRestrictedPackage", () => {
  it("añade un paquete que todavía no estaba restringido", () => {
    expect(toggleRestrictedPackage(["com.instagram.android"], "com.spotify.music")).toEqual([
      "com.instagram.android",
      "com.spotify.music",
    ]);
  });

  it("quita un paquete que ya estaba restringido", () => {
    expect(
      toggleRestrictedPackage(["com.instagram.android", "com.spotify.music"], "com.instagram.android")
    ).toEqual(["com.spotify.music"]);
  });

  it("parte de una lista vacía", () => {
    expect(toggleRestrictedPackage([], "com.instagram.android")).toEqual(["com.instagram.android"]);
  });

  it("no modifica la lista original", () => {
    const original = ["com.instagram.android"];
    toggleRestrictedPackage(original, "com.spotify.music");
    expect(original).toEqual(["com.instagram.android"]);
  });
});
