import { getUsageDayKey } from "./clock";
import type { Config } from "./config";
import { classifyConfigChanges } from "./configChange";
import type { Timestamp } from "./types";

export interface PendingConfig {
  config: Config;
  /** Día de uso (RF-7) en que quedó pendiente; se aplica al cruzar al siguiente. */
  dayKey: string;
}

export interface ConfigUpdateResult {
  /** false solo cuando se rechaza todo por haber un bloqueo horario activo (RF-19). */
  applied: boolean;
  /** La configuración a usar ahora mismo. */
  effectiveConfig: Config;
  /** Lo que se aplicará al cruzar al día de uso siguiente, o null si no quedó nada pendiente. */
  pending: PendingConfig | null;
}

/**
 * RF-19, RF-29: decide qué parte de un cambio de configuración se aplica ya
 * y cuál queda pendiente hasta las 04:00. Durante un bloqueo horario activo
 * se rechaza el cambio entero, sin excepción.
 */
export function applyConfigUpdate(
  oldConfig: Config,
  newConfig: Config,
  now: Timestamp,
  context: { hasBlockedApp: boolean; isRestBlockActive: boolean }
): ConfigUpdateResult {
  if (context.isRestBlockActive) {
    return { applied: false, effectiveConfig: oldConfig, pending: null };
  }

  const changes = classifyConfigChanges(oldConfig, newConfig);
  const hasRelaxChange = changes.some((change) => change.classification === "relax");

  if (!hasRelaxChange || !context.hasBlockedApp) {
    // No hay nada que relaje la restricción, o no hay ninguna app bloqueada
    // que proteger: todo el cambio se aplica de inmediato.
    return { applied: true, effectiveConfig: newConfig, pending: null };
  }

  // Se aplican ya los campos que endurecen o son neutrales; los que
  // relajan mantienen su valor anterior hasta las 04:00.
  const effectiveConfig: Config = { ...oldConfig };
  for (const change of changes) {
    if (change.classification === "relax" || change.field === "restrictedPackages") {
      continue; // restrictedPackages se resuelve aparte, es una lista
    }
    switch (change.field) {
      case "dailyLimitMin":
        effectiveConfig.dailyLimitMin = newConfig.dailyLimitMin;
        break;
      case "questionCount":
        effectiveConfig.questionCount = newConfig.questionCount;
        break;
      case "accessWindowMin":
        effectiveConfig.accessWindowMin = newConfig.accessWindowMin;
        break;
      case "areas":
        effectiveConfig.areas = newConfig.areas;
        break;
      case "focusMessage":
        effectiveConfig.focusMessage = newConfig.focusMessage;
        break;
      case "restBlockMessage":
        effectiveConfig.restBlockMessage = newConfig.restBlockMessage;
        break;
    }
  }

  // restrictedPackages: las apps que se añaden se restringen ya (endurece);
  // las que se quitan siguen restringidas hasta las 04:00 (relaja).
  const addedPackages = newConfig.restrictedPackages.filter(
    (pkg) => !oldConfig.restrictedPackages.includes(pkg)
  );
  effectiveConfig.restrictedPackages = [...new Set([...oldConfig.restrictedPackages, ...addedPackages])];

  return {
    applied: true,
    effectiveConfig,
    pending: { config: newConfig, dayKey: getUsageDayKey(now) },
  };
}

/** RF-29: aplica lo pendiente si el día de uso ya cambió desde que quedó en espera. */
export function resolvePendingConfig(
  effectiveConfig: Config,
  pending: PendingConfig | null,
  now: Timestamp
): { effectiveConfig: Config; pending: PendingConfig | null } {
  if (pending === null) {
    return { effectiveConfig, pending: null };
  }
  if (getUsageDayKey(now) === pending.dayKey) {
    return { effectiveConfig, pending };
  }
  return { effectiveConfig: pending.config, pending: null };
}
