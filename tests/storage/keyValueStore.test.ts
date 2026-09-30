import { createInMemoryStore } from "../../blockproc/src/storage/keyValueStore";

// El "doble en memoria" (T35): la misma interfaz que tendrá el adaptador real
// de MMKV (T49, fuera del alcance aquí), pero sin nada nativo de por medio,
// para poder probar el repositorio con Jest.
describe("createInMemoryStore", () => {
  it("una clave nunca guardada da null", () => {
    const store = createInMemoryStore();
    expect(store.getString("config")).toBeNull();
  });

  it("guarda y devuelve el mismo texto", () => {
    const store = createInMemoryStore();
    store.setString("config", '{"a":1}');
    expect(store.getString("config")).toBe('{"a":1}');
  });

  it("sobrescribe un valor ya guardado", () => {
    const store = createInMemoryStore();
    store.setString("config", "uno");
    store.setString("config", "dos");
    expect(store.getString("config")).toBe("dos");
  });

  it("delete quita la clave (vuelve a dar null)", () => {
    const store = createInMemoryStore();
    store.setString("config", "algo");
    store.delete("config");
    expect(store.getString("config")).toBeNull();
  });

  it("claves distintas no se pisan entre sí", () => {
    const store = createInMemoryStore();
    store.setString("config", "config-valor");
    store.setString("usage", "usage-valor");
    expect(store.getString("config")).toBe("config-valor");
    expect(store.getString("usage")).toBe("usage-valor");
  });

  it("clearAll deja el almacén como recién creado", () => {
    const store = createInMemoryStore();
    store.setString("config", "algo");
    store.setString("usage", "otra cosa");
    store.clearAll();
    expect(store.getString("config")).toBeNull();
    expect(store.getString("usage")).toBeNull();
  });
});
