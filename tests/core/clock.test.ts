import { createFakeClock, createSystemClock, getUsageDayKey, USAGE_DAY_START_HOUR } from "../../blockproc/src/core/clock";

describe("createSystemClock", () => {
  it("devuelve el instante actual real", () => {
    const before = Date.now();
    const clock = createSystemClock();
    const now = clock.now();
    const after = Date.now();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(after);
  });
});

describe("createFakeClock", () => {
  it("empieza en el instante dado", () => {
    const clock = createFakeClock(1000);
    expect(clock.now()).toBe(1000);
  });

  it("avanza a voluntad con advance()", () => {
    const clock = createFakeClock(1000);
    clock.advance(500);
    expect(clock.now()).toBe(1500);
    clock.advance(3 * 60 * 1000); // los 3 min de penalización, sin esperarlos de verdad
    expect(clock.now()).toBe(1500 + 3 * 60 * 1000);
  });

  it("se puede fijar a un instante arbitrario con set()", () => {
    const clock = createFakeClock(0);
    clock.set(999);
    expect(clock.now()).toBe(999);
  });
});

// RF-7: "el día de uso va de 04:00 a 04:00" — corte a las 04:00 hora local.
describe("getUsageDayKey", () => {
  it("USAGE_DAY_START_HOUR es 4 (04:00)", () => {
    expect(USAGE_DAY_START_HOUR).toBe(4);
  });

  it("las 03:59 y las 04:00 del mismo día caen en días de uso distintos", () => {
    const antes = new Date(2026, 0, 5, 3, 59).getTime();
    const despues = new Date(2026, 0, 5, 4, 0).getTime();
    expect(getUsageDayKey(antes)).not.toBe(getUsageDayKey(despues));
  });

  it("las 03:59 del día 5 caen en el día de uso del día 4", () => {
    const antes = new Date(2026, 0, 5, 3, 59).getTime();
    const diaAnteriorAlMediodia = new Date(2026, 0, 4, 12, 0).getTime();
    expect(getUsageDayKey(antes)).toBe(getUsageDayKey(diaAnteriorAlMediodia));
  });

  it("dos instantes después de las 04:00 del mismo día caen en el mismo día de uso", () => {
    const manana = new Date(2026, 0, 5, 8, 0).getTime();
    const noche = new Date(2026, 0, 5, 23, 30).getTime();
    expect(getUsageDayKey(manana)).toBe(getUsageDayKey(noche));
  });

  it("cruzar la medianoche antes de las 04:00 sigue en el mismo día de uso", () => {
    const antesDeMedianoche = new Date(2026, 0, 5, 23, 0).getTime();
    const despuesDeMedianoche = new Date(2026, 0, 6, 1, 0).getTime();
    expect(getUsageDayKey(antesDeMedianoche)).toBe(getUsageDayKey(despuesDeMedianoche));
  });

  it("formatea con ceros a la izquierda (mes y día de un dígito)", () => {
    const fecha = new Date(2026, 0, 5, 10, 0).getTime(); // 5 de enero
    expect(getUsageDayKey(fecha)).toBe("2026-01-05");
  });
});
