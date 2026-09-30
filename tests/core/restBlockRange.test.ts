import {
  getRestBlockDurationMin,
  isValidRestBlockRange,
  REST_BLOCK_MAX_DURATION_MIN,
  type TimeOfDay,
} from "../../blockproc/src/core/restBlock";

const horas21 = { hour: 21, minute: 0 };
const horas06 = { hour: 6, minute: 0 };
const horas08 = { hour: 8, minute: 0 };
const horas12 = { hour: 12, minute: 0 };
const horas20 = { hour: 20, minute: 0 };

function t(hour: number, minute = 0): TimeOfDay {
  return { hour, minute };
}

// RF-17: rango de hasta 12 horas, incluso si cruza la medianoche.
describe("getRestBlockDurationMin", () => {
  it("21:00 a 06:00 dura 9 horas (540 min), cruzando la medianoche", () => {
    expect(getRestBlockDurationMin(horas21, horas06)).toBe(9 * 60);
  });

  it("8:00 a 12:00 dura 4 horas (240 min), sin cruzar la medianoche", () => {
    expect(getRestBlockDurationMin(horas08, horas12)).toBe(4 * 60);
  });

  it("8:00 a 21:00 dura 13 horas (780 min)", () => {
    expect(getRestBlockDurationMin(horas08, horas21)).toBe(13 * 60);
  });

  it("la misma hora de inicio y fin dura 0 minutos", () => {
    expect(getRestBlockDurationMin(horas08, horas08)).toBe(0);
  });

  it("REST_BLOCK_MAX_DURATION_MIN son 12 horas (720 min)", () => {
    expect(REST_BLOCK_MAX_DURATION_MIN).toBe(12 * 60);
  });
});

describe("isValidRestBlockRange", () => {
  it("acepta 21:00 a 06:00", () => {
    expect(isValidRestBlockRange(horas21, horas06)).toBe(true);
  });

  it("acepta 8:00 a 12:00", () => {
    expect(isValidRestBlockRange(horas08, horas12)).toBe(true);
  });

  it("rechaza 8:00 a 21:00 (13 horas, supera el máximo)", () => {
    expect(isValidRestBlockRange(horas08, horas21)).toBe(false);
  });

  it("acepta exactamente 12 horas (el máximo permitido, no lo supera)", () => {
    expect(isValidRestBlockRange(horas08, horas20)).toBe(true); // 8:00 a 20:00 = 12 h
  });

  it("rechaza un rango de 0 minutos (misma hora de inicio y fin)", () => {
    expect(isValidRestBlockRange(horas08, horas08)).toBe(false);
  });

  it("acepta rangos con minutos (no solo horas en punto)", () => {
    expect(isValidRestBlockRange(t(22, 30), t(6, 30))).toBe(true); // 8 horas exactas
    expect(getRestBlockDurationMin(t(22, 30), t(6, 30))).toBe(8 * 60);
  });
});
