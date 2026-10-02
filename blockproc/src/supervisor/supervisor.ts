import type { Clock } from "../core/clock";
import { handleForegroundChanged, handleScreenOff, handleScreenOn, handleTick } from "../core/policy";
import type { PolicyAction, PolicyResult } from "../core/policy";
import type { KeyValueStore } from "../storage/keyValueStore";
import type { NativeAdapter } from "./nativeAdapter";
import { loadPolicyState, savePolicyState } from "./policyRepository";

// RF-68: texto fijo del aviso de bloqueo programado. A diferencia de
// focusMessage/blockMessage (RF-58), no es configurable.
const BLOCK_STARTING_NOTIFICATION_TEXT = "El bloqueo horario empieza en 2 minutos.";

export interface SupervisorDeps {
  native: NativeAdapter;
  store: KeyValueStore;
  clock: Clock;
}

export interface Supervisor {
  onForegroundChanged(packageName: string | null): void;
  onTick(): void;
  onScreenOn(): void;
  onScreenOff(): void;
}

// RF-63, RF-66, RF-68: cada acción del reductor se traduce en una sola
// llamada a lo nativo.
function runActions(native: NativeAdapter, actions: PolicyAction[]): void {
  for (const action of actions) {
    switch (action.type) {
      case "ShowAccess":
        native.showChallenge(action.packageName);
        break;
      case "ShowWait":
        native.showWait(action.packageName);
        break;
      case "NotifyBlockStarting":
        native.showNotification("blockStarting", BLOCK_STARTING_NOTIFICATION_TEXT);
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
      apply(handleForegroundChanged(state, packageName, deps.clock.now()));
    },
    onTick() {
      apply(handleTick(state, deps.clock.now()));
    },
    onScreenOn() {
      apply(handleScreenOn(state, deps.clock.now()));
    },
    onScreenOff() {
      apply(handleScreenOff(state));
    },
  };
}
