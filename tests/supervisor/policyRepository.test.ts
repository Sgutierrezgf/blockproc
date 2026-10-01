import { createPolicyState } from "../../blockproc/src/core/policy";
import { loadPolicyState, savePolicyState } from "../../blockproc/src/supervisor/policyRepository";
import { createInMemoryStore } from "../../blockproc/src/storage/keyValueStore";

// RF-53 (Fase 9): un estado guardado antes de que existiera "nextRestBlock"
// no debe romper nada al cargarlo — se completa con null, igual que un
// primer arranque sin nada guardado todavía.
describe("loadPolicyState — compatibilidad con estados guardados antes de nextRestBlock", () => {
  it("sin nada guardado, createPolicyState ya trae nextRestBlock: null", () => {
    const store = createInMemoryStore();
    expect(loadPolicyState(store)).toEqual(createPolicyState());
  });

  it("un JSON guardado sin el campo nextRestBlock se completa con null al cargar", () => {
    const store = createInMemoryStore();
    const estadoViejo = { usage: createPolicyState().usage, apps: {}, restBlock: null };
    store.setString("policyState", JSON.stringify(estadoViejo));

    const loaded = loadPolicyState(store);
    expect(loaded.nextRestBlock).toBeNull();
  });

  it("guardar y volver a cargar conserva un nextRestBlock presente", () => {
    const store = createInMemoryStore();
    const nextRestBlock = { startAt: 100, endAt: 200, cancelled: false, warned2min: false };
    savePolicyState(store, { ...createPolicyState(), nextRestBlock });

    expect(loadPolicyState(store).nextRestBlock).toEqual(nextRestBlock);
  });
});
