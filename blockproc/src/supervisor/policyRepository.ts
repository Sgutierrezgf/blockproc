import { createPolicyState } from "../core/policy";
import type { PolicyState } from "../core/policy";
import type { KeyValueStore } from "../storage/keyValueStore";

// RF-27, RF-45: el supervisor guarda el PolicyState completo (bloqueos y
// estado de acceso por app) para poder retomarlo tal cual tras un reinicio.
const POLICY_STATE_KEY = "policyState";

/**
 * RF-41, C23 (Fase 10): un estado guardado con la forma del modelo anterior
 * (tenía `restBlock`/`nextRestBlock`/`usage`, nunca `blocks`) se trata igual
 * que uno corrupto — se descarta por completo, sin intentar convertirlo
 * (decisión ya tomada con el usuario: no vale la pena migrar un único caso
 * de uso que no se repetirá).
 */
function looksLikeCurrentShape(value: unknown): value is Partial<PolicyState> {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.blocks) && !("restBlock" in candidate) && !("usage" in candidate);
}

export function loadPolicyState(store: KeyValueStore): PolicyState {
  const raw = store.getString(POLICY_STATE_KEY);
  if (!raw) {
    return createPolicyState();
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!looksLikeCurrentShape(parsed)) {
      return createPolicyState();
    }
    return { ...createPolicyState(), ...parsed };
  } catch {
    return createPolicyState();
  }
}

export function savePolicyState(store: KeyValueStore, state: PolicyState): void {
  store.setString(POLICY_STATE_KEY, JSON.stringify(state));
}
