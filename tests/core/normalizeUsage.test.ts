import { normalizePersistedUsage, parseStoredUsage } from "../../blockproc/src/core/normalizeUsage";

// RF-41: contadores de uso dañados o inexistentes → a cero, no algo a medias.
describe("normalizePersistedUsage", () => {
  it("undefined (primera ejecución) da contadores en cero", () => {
    expect(normalizePersistedUsage(undefined)).toEqual({ usedMs: {}, dayKey: null });
  });

  it("un valor que no es un objeto (corrupto) da contadores en cero", () => {
    expect(normalizePersistedUsage("no soy un contador")).toEqual({ usedMs: {}, dayKey: null });
    expect(normalizePersistedUsage(42)).toEqual({ usedMs: {}, dayKey: null });
    expect(normalizePersistedUsage([])).toEqual({ usedMs: {}, dayKey: null });
  });

  it("conserva usedMs y dayKey válidos", () => {
    const valido = { usedMs: { "com.instagram.android": 120_000 }, dayKey: "2026-01-05" };
    expect(normalizePersistedUsage(valido)).toEqual(valido);
  });

  it("repara usedMs si no es un mapa de números (deja los contadores en cero)", () => {
    const dañado = { usedMs: "no es un mapa", dayKey: "2026-01-05" };
    expect(normalizePersistedUsage(dañado)).toEqual({ usedMs: {}, dayKey: "2026-01-05" });
  });

  it("repara un valor de usedMs que no es un número", () => {
    const dañado = { usedMs: { "com.instagram.android": "no es un número" }, dayKey: "2026-01-05" };
    expect(normalizePersistedUsage(dañado)).toEqual({ usedMs: {}, dayKey: "2026-01-05" });
  });

  it("repara dayKey si no es un texto", () => {
    const dañado = { usedMs: {}, dayKey: 5 };
    expect(normalizePersistedUsage(dañado)).toEqual({ usedMs: {}, dayKey: null });
  });
});

describe("parseStoredUsage", () => {
  it("un texto que no es JSON válido (corrupto) da contadores en cero", () => {
    expect(parseStoredUsage("esto no es json{")).toEqual({ usedMs: {}, dayKey: null });
  });

  it("null o vacío (nada guardado) da contadores en cero", () => {
    expect(parseStoredUsage(null)).toEqual({ usedMs: {}, dayKey: null });
    expect(parseStoredUsage("")).toEqual({ usedMs: {}, dayKey: null });
  });

  it("un JSON válido se conserva tal cual", () => {
    const valido = { usedMs: { "com.spotify.music": 60_000 }, dayKey: "2026-01-05" };
    expect(parseStoredUsage(JSON.stringify(valido))).toEqual(valido);
  });
});
