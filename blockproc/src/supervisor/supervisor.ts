import type { Clock } from "../core/clock";
import type { Config } from "../core/config";
import {
  handleForegroundChanged,
  handleScreenOff,
  handleScreenOn,
  handleTick,
} from "../core/policy";
import type { PolicyAction, PolicyResult } from "../core/policy";
import type { KeyValueStore } from "../storage/keyValueStore";
import type { NativeAdapter } from "./nativeAdapter";
import { loadPolicyState, savePolicyState } from "./policyRepository";

// RF-15, RF-30, RF-33: textos fijos de las notificaciones de aviso. A
// diferencia de focusMessage/restBlockMessage (RF-19, RF-20), la spec no
// pide que estos sean configurables.
const NOTIFICATION_TEXT: Record<string, string> = {
  limit: "Te queda 1 minuto de uso hoy.",
  window: "Tu acceso termina en 1 minuto.",
  restBlock: "El bloqueo horario empieza en 2 minutos.",
};

export interface SupervisorDeps {
  native: NativeAdapter;
  store: KeyValueStore;
  clock: Clock;
  /** Se consulta en cada evento (no una sola vez), para reflejar cambios de configuración sin un evento aparte. */
  getConfig: () => Config;
}

export interface Supervisor {
  onForegroundChanged(packageName: string | null): void;
  onTick(): void;
  onScreenOn(): void;
  onScreenOff(): void;
}

// RF-9, RF-13, RF-15, RF-18, RF-30, RF-33: cada acción del reductor se
// traduce en una sola llamada a lo nativo.
function runActions(native: NativeAdapter, actions: PolicyAction[]): void {
  for (const action of actions) {
    switch (action.type) {
      case "ShowChallenge":
        native.showChallenge(action.packageName);
        break;
      case "ShowWait":
        native.showWait(action.packageName);
        break;
      case "ShowRestBlock":
        native.showRestBlock();
        break;
      case "NotifyLimitWarning":
        native.showNotification("limit", NOTIFICATION_TEXT.limit);
        break;
      case "NotifyWindowEnding":
        native.showNotification("window", NOTIFICATION_TEXT.window);
        break;
      case "NotifyRestBlockStarting":
        native.showNotification("restBlock", NOTIFICATION_TEXT.restBlock);
        break;
    }
  }
}

/**
 * RF-27: conecta los eventos nativos con el reductor puro (policy.ts) y con
 * las acciones nativas, guardando el estado después de cada evento (RF-45:
 * así una nueva instancia, como tras un reinicio, retoma justo donde quedó).
 */
export function createSupervisor(deps: SupervisorDeps): Supervisor {
  let state = loadPolicyState(deps.store);

  function apply(result: PolicyResult): void {
    state = result.state;
    savePolicyState(deps.store, state);
    runActions(deps.native, result.actions);
  }

  return {
    onForegroundChanged(packageName) {
      apply(handleForegroundChanged(state, packageName, deps.getConfig(), deps.clock.now()));
    },
    onTick() {
      apply(handleTick(state, deps.getConfig(), deps.clock.now()));
    },
    onScreenOn() {
      apply(handleScreenOn(state, deps.getConfig(), deps.clock.now()));
    },
    onScreenOff() {
      apply(handleScreenOff(state, deps.clock.now()));
    },
  };
}
