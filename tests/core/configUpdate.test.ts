import type { Config } from "../../blockproc/src/core/config";
import { applyConfigUpdate, resolvePendingConfig } from "../../blockproc/src/core/configUpdate";

const base: Config = {
  restrictedPackages: ["com.spotify.music"],
  dailyLimitMin: 30,
  questionCount: 2,
  accessWindowMin: 7,
  areas: ["general"],
  focusMessage: "Mensaje original",
  restBlockMessage: "Mensaje de bloqueo original",
};

const DIA1 = new Date(2026, 0, 5, 10, 0).getTime();
const DIA1_MAS_TARDE = new Date(2026, 0, 5, 20, 0).getTime();
const DIA2 = new Date(2026, 0, 6, 10, 0).getTime();

const sinBloqueoHorario = { isRestBlockActive: false };

// RF-29: relajar con una app bloqueada queda pendiente hasta las 04:00.
describe("applyConfigUpdate", () => {
  it("relajar el límite con una app bloqueada queda pendiente, sin aplicarse todavía", () => {
    const nuevaConfig = { ...base, dailyLimitMin: 60 }; // subir el límite: relaja
    const resultado = applyConfigUpdate(base, nuevaConfig, DIA1, {
      hasBlockedApp: true,
      ...sinBloqueoHorario,
    });

    expect(resultado.applied).toBe(true);
    expect(resultado.effectiveConfig.dailyLimitMin).toBe(30); // sigue el límite viejo, más estricto
    expect(resultado.pending?.config.dailyLimitMin).toBe(60);
  });

  it("sin ninguna app bloqueada, el mismo cambio se aplica al instante", () => {
    const nuevaConfig = { ...base, dailyLimitMin: 60 };
    const resultado = applyConfigUpdate(base, nuevaConfig, DIA1, {
      hasBlockedApp: false,
      ...sinBloqueoHorario,
    });

    expect(resultado.applied).toBe(true);
    expect(resultado.effectiveConfig.dailyLimitMin).toBe(60);
    expect(resultado.pending).toBeNull();
  });

  it("endurecer con una app bloqueada se aplica al instante (no hace falta esperar)", () => {
    const nuevaConfig = { ...base, dailyLimitMin: 15 }; // bajar el límite: endurece
    const resultado = applyConfigUpdate(base, nuevaConfig, DIA1, {
      hasBlockedApp: true,
      ...sinBloqueoHorario,
    });

    expect(resultado.effectiveConfig.dailyLimitMin).toBe(15);
    expect(resultado.pending).toBeNull();
  });

  it("un cambio neutral (áreas) se aplica al instante aunque haya una app bloqueada", () => {
    const nuevaConfig = { ...base, areas: ["technology" as const] };
    const resultado = applyConfigUpdate(base, nuevaConfig, DIA1, {
      hasBlockedApp: true,
      ...sinBloqueoHorario,
    });

    expect(resultado.effectiveConfig.areas).toEqual(["technology"]);
    expect(resultado.pending).toBeNull();
  });

  it("un cambio mixto (endurece y relaja a la vez) aplica la parte dura ya y deja pendiente la parte floja", () => {
    // Se quita spotify (relaja) y se añade instagram (endurece), a la vez.
    const nuevaConfig = { ...base, restrictedPackages: ["com.instagram.android"] };
    const resultado = applyConfigUpdate(base, nuevaConfig, DIA1, {
      hasBlockedApp: true,
      ...sinBloqueoHorario,
    });

    // Ahora mismo: instagram ya está restringida, pero spotify TODAVÍA lo sigue estando.
    expect(resultado.effectiveConfig.restrictedPackages).toEqual(
      expect.arrayContaining(["com.instagram.android", "com.spotify.music"])
    );
    expect(resultado.pending?.config.restrictedPackages).toEqual(["com.instagram.android"]);
  });

  // RF-19: durante el bloqueo horario, no se permite editar nada.
  it("durante un bloqueo horario activo, se rechaza cualquier cambio", () => {
    const nuevaConfig = { ...base, dailyLimitMin: 15 }; // incluso uno que solo endurece
    const resultado = applyConfigUpdate(base, nuevaConfig, DIA1, {
      hasBlockedApp: false,
      isRestBlockActive: true,
    });

    expect(resultado.applied).toBe(false);
    expect(resultado.effectiveConfig).toEqual(base);
    expect(resultado.pending).toBeNull();
  });
});

// RF-29: lo que quedó pendiente se aplica al cruzar las 04:00.
describe("resolvePendingConfig", () => {
  it("no aplica el pendiente si sigue siendo el mismo día de uso", () => {
    const diferido = applyConfigUpdate(base, { ...base, dailyLimitMin: 60 }, DIA1, {
      hasBlockedApp: true,
      ...sinBloqueoHorario,
    });

    const resultado = resolvePendingConfig(diferido.effectiveConfig, diferido.pending, DIA1_MAS_TARDE);
    expect(resultado.effectiveConfig.dailyLimitMin).toBe(30); // todavía no
    expect(resultado.pending).not.toBeNull();
  });

  it("aplica el pendiente al cruzar las 04:00", () => {
    const diferido = applyConfigUpdate(base, { ...base, dailyLimitMin: 60 }, DIA1, {
      hasBlockedApp: true,
      ...sinBloqueoHorario,
    });

    const resultado = resolvePendingConfig(diferido.effectiveConfig, diferido.pending, DIA2);
    expect(resultado.effectiveConfig.dailyLimitMin).toBe(60);
    expect(resultado.pending).toBeNull();
  });

  it("si no hay nada pendiente, no hace nada", () => {
    const resultado = resolvePendingConfig(base, null, DIA2);
    expect(resultado.effectiveConfig).toEqual(base);
    expect(resultado.pending).toBeNull();
  });
});
