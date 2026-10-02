import { createDefaultConfig } from "../../blockproc/src/core/config";
import { createInMemoryStore } from "../../blockproc/src/storage/keyValueStore";
import { loadConfig, saveConfig } from "../../blockproc/src/storage/appRepository";

// RF-25: guardar y leer los mensajes por defecto en el dispositivo. RF-41:
// ante datos dañados o del modelo anterior, valores por defecto. El "doble
// en memoria" (T35) hace de MMKV para poder probar esto sin dispositivo.
describe("appRepository — config", () => {
  it("sin nada guardado, da la configuración por defecto", () => {
    const store = createInMemoryStore();
    expect(loadConfig(store)).toEqual(createDefaultConfig());
  });

  it("guarda y vuelve a leer la misma configuración", () => {
    const store = createInMemoryStore();
    const config = { ...createDefaultConfig(), defaultFocusMessage: "Mi mensaje" };
    saveConfig(store, config);
    expect(loadConfig(store)).toEqual(config);
  });

  it("ante un dato de config dañado, restaura los valores por defecto (RF-41)", () => {
    const store = createInMemoryStore();
    store.setString("config", "esto no es json{");
    expect(loadConfig(store)).toEqual(createDefaultConfig());
  });

  it("ante datos con la forma del modelo anterior, restaura los valores por defecto (RF-41)", () => {
    const store = createInMemoryStore();
    store.setString("config", JSON.stringify({ dailyLimitMin: 45, restrictedPackages: ["com.instagram.android"] }));
    expect(loadConfig(store)).toEqual(createDefaultConfig());
  });
});
