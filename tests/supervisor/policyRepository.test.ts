import { createPolicyState } from "../../blockproc/src/core/policy";
import { loadPolicyState, savePolicyState } from "../../blockproc/src/supervisor/policyRepository";
import { createInMemoryStore } from "../../blockproc/src/storage/keyValueStore";

// RF-41, C23 (Fase 10): un estado guardado con la forma del modelo anterior
// se descarta igual que uno corrupto, sin intentar convertirlo.
describe("loadPolicyState", () => {
  it("sin nada guardado, da un PolicyState vacío", () => {
    const store = createInMemoryStore();
    expect(loadPolicyState(store)).toEqual(createPolicyState());
  });

  it("guarda y vuelve a cargar el mismo estado", () => {
    const store = createInMemoryStore();
    const block = {
      id: "b1",
      packages: ["com.example.app"],
      type: "duration" as const,
      startAt: 0,
      endAt: 1000,
      category: "general" as const,
      focusMessage: "foco",
      blockMessage: "bloqueado",
      warnedStart: false,
    };
    savePolicyState(store, { ...createPolicyState(), blocks: [block] });
    expect(loadPolicyState(store).blocks).toEqual([block]);
  });

  it("un JSON corrupto se descarta, arranca vacío", () => {
    const store = createInMemoryStore();
    store.setString("policyState", "esto no es json{");
    expect(loadPolicyState(store)).toEqual(createPolicyState());
  });

  it("un JSON con la forma del modelo anterior (restBlock/usage, sin blocks) se descarta", () => {
    const store = createInMemoryStore();
    const estadoViejo = { usage: { foregroundPackage: null }, apps: {}, restBlock: null, nextRestBlock: null };
    store.setString("policyState", JSON.stringify(estadoViejo));
    expect(loadPolicyState(store)).toEqual(createPolicyState());
  });
});
