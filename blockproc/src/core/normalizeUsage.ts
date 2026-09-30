// RF-41: si lo guardado del uso diario está dañado o no existe, se ponen los
// contadores a cero (no se inventa un valor a medias). Mismo patrón que
// normalizeConfig.ts, pero para la parte de UsageState que sí tiene sentido
// persistir: usedMs por app y el día al que corresponde. El resto de
// UsageState (foregroundPackage, segmentStartedAt, screenOn) es estado de
// sesión en vivo que el servicio nativo vuelve a establecer solo con volver
// a sondear, y no se guarda.
export interface PersistedUsage {
  usedMs: Record<string, number>;
  dayKey: string | null;
}

function createDefaultPersistedUsage(): PersistedUsage {
  return { usedMs: {}, dayKey: null };
}

function isValidUsedMs(value: unknown): value is Record<string, number> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((ms) => typeof ms === "number" && Number.isFinite(ms));
}

/** Repara campo a campo; ante cualquier duda, ese campo vuelve a su valor por defecto (contador en cero). */
export function normalizePersistedUsage(raw: unknown): PersistedUsage {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return createDefaultPersistedUsage();
  }
  const candidate = raw as Partial<PersistedUsage>;
  const usedMs = isValidUsedMs(candidate.usedMs) ? candidate.usedMs : {};
  const dayKey = typeof candidate.dayKey === "string" ? candidate.dayKey : null;
  return { usedMs, dayKey };
}

/** Ante un JSON inválido (dato corrupto), también se ponen los contadores a cero. */
export function parseStoredUsage(json: string | null | undefined): PersistedUsage {
  if (!json) {
    return createDefaultPersistedUsage();
  }
  try {
    return normalizePersistedUsage(JSON.parse(json));
  } catch {
    return createDefaultPersistedUsage();
  }
}
