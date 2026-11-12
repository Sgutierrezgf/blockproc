import { summarizeAppLabels } from "../../blockproc/src/core/appLabels";
import type { InstalledApp } from "../../blockproc/src/core/exclusions";

// RF-81, D44: nombres visibles de las apps de un bloqueo, en el orden del
// bloqueo, con respaldo al nombre de paquete y corte en `max` (C46).
describe("summarizeAppLabels", () => {
  const apps: InstalledApp[] = [
    { packageName: "com.instagram.android", label: "Instagram" },
    { packageName: "com.spotify.music", label: "Spotify" },
    { packageName: "com.whatsapp", label: "WhatsApp" },
  ];

  it("devuelve los nombres visibles en el orden de los paquetes del bloqueo", () => {
    expect(summarizeAppLabels(["com.whatsapp", "com.instagram.android"], apps, 5)).toEqual({
      labels: ["WhatsApp", "Instagram"],
      remaining: 0,
    });
  });

  it("usa el nombre de paquete si la app ya no está instalada", () => {
    expect(summarizeAppLabels(["com.borrada.app", "com.spotify.music"], apps, 5)).toEqual({
      labels: ["com.borrada.app", "Spotify"],
      remaining: 0,
    });
  });

  it("muestra como mucho `max` nombres e informa cuántos quedan", () => {
    const packages = ["a", "b", "c", "d", "e", "f", "g"];
    expect(summarizeAppLabels(packages, [], 5)).toEqual({
      labels: ["a", "b", "c", "d", "e"],
      remaining: 2,
    });
  });

  it("con exactamente `max` apps no queda ninguna restante", () => {
    const packages = ["a", "b", "c", "d", "e"];
    expect(summarizeAppLabels(packages, [], 5)).toEqual({ labels: packages, remaining: 0 });
  });

  it("sin `max` devuelve la lista completa", () => {
    const packages = ["a", "b", "c", "d", "e", "f", "g"];
    expect(summarizeAppLabels(packages, [])).toEqual({ labels: packages, remaining: 0 });
  });

  it("una lista vacía no tiene nombres ni restantes", () => {
    expect(summarizeAppLabels([], apps, 5)).toEqual({ labels: [], remaining: 0 });
  });
});
