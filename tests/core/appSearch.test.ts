import { filterAppsByQuery } from "../../blockproc/src/core/appSearch";
import type { InstalledApp } from "../../blockproc/src/core/exclusions";

// RF-46: el buscador filtra por nombre, sin distinguir mayúsculas ni tildes,
// mostrando coincidencias parciales.
describe("filterAppsByQuery", () => {
  const instagram: InstalledApp = { packageName: "com.instagram.android", label: "Instagram" };
  const spotify: InstalledApp = { packageName: "com.spotify.music", label: "Spotify" };
  const musica: InstalledApp = { packageName: "com.android.music", label: "Música" };

  const todas = [instagram, spotify, musica];

  it("encuentra coincidencias parciales del nombre", () => {
    expect(filterAppsByQuery(todas, "spot")).toEqual([spotify]);
  });

  it("no distingue mayúsculas de minúsculas", () => {
    expect(filterAppsByQuery(todas, "INSTAGRAM")).toEqual([instagram]);
    expect(filterAppsByQuery(todas, "spotify")).toEqual([spotify]);
  });

  it("no distingue tildes", () => {
    expect(filterAppsByQuery(todas, "musica")).toEqual([musica]);
  });

  it("devuelve una lista vacía si ninguna coincide", () => {
    expect(filterAppsByQuery(todas, "whatsapp")).toEqual([]);
  });

  it("con texto vacío devuelve todas las apps", () => {
    expect(filterAppsByQuery(todas, "")).toEqual(todas);
  });

  it("ignora espacios sueltos al principio y al final", () => {
    expect(filterAppsByQuery(todas, "  spot  ")).toEqual([spotify]);
  });

  it("no modifica la lista original", () => {
    const copia = [...todas];
    filterAppsByQuery(todas, "spot");
    expect(todas).toEqual(copia);
  });
});
