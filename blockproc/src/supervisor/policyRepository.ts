import { createPolicyState } from "../core/policy";
import type { PolicyState } from "../core/policy";
import type { KeyValueStore } from "../storage/keyValueStore";

// RF-27, RF-45: el supervisor guarda el PolicyState completo (uso, ventanas,
// esperas y bloqueo horario) para poder retomarlo tal cual tras un reinicio.
// Distinto del repositorio de la T35 (que solo cubre config y contadores):
// aquí no hace falta reparar campo a campo, basta con no reventar ante un
// JSON corrupto y volver a empezar de cero en ese caso.
const POLICY_STATE_KEY = "policyState";

export function loadPolicyState(store: KeyValueStore): PolicyState {
  const raw = store.getString(POLICY_STATE_KEY);
  if (!raw) {
    return createPolicyState();
  }
  try {
    return JSON.parse(raw) as PolicyState;
  } catch {
    return createPolicyState();
  }
}

export function savePolicyState(store: KeyValueStore, state: PolicyState): void {
  store.setString(POLICY_STATE_KEY, JSON.stringify(state));
}
