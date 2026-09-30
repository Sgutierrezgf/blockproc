import { formatRestBlockMessage } from "../../blockproc/src/core/restBlock";

function endAtHora(hour: number, minute: number): number {
  const date = new Date(0);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

// RF-35: el mensaje (por defecto o personalizado) puede traer el marcador
// literal "{hora de fin}", que se sustituye por la hora real de fin del
// bloqueo horario, en formato HH:mm.
describe("formatRestBlockMessage", () => {
  it("sustituye el marcador por la hora de fin, con ceros a la izquierda", () => {
    const mensaje = formatRestBlockMessage("Bloqueo activo hasta las {hora de fin}.", endAtHora(6, 5));
    expect(mensaje).toBe("Bloqueo activo hasta las 06:05.");
  });

  it("un mensaje sin el marcador queda igual", () => {
    const mensaje = formatRestBlockMessage("Descansa un poco.", endAtHora(6, 0));
    expect(mensaje).toBe("Descansa un poco.");
  });

  it("solo sustituye la primera aparición si se repitiera", () => {
    const mensaje = formatRestBlockMessage("{hora de fin} y {hora de fin}", endAtHora(9, 30));
    expect(mensaje).toBe("09:30 y {hora de fin}");
  });
});
