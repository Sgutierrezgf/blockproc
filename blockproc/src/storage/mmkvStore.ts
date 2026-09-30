import { createMMKV } from "react-native-mmkv";
import type { KeyValueStore } from "./keyValueStore";

// RF-25 (T49): adaptador real sobre MMKV (plan.md, D5) — lectura y escritura
// síncronas, para que el reto y las decisiones no esperen un acceso async.
// Vive en su propio archivo, fuera de keyValueStore.ts: MMKV es nativo (no
// corre bajo Jest), así que los tests solo importan el doble en memoria.
export function createMmkvStore(): KeyValueStore {
  const mmkv = createMMKV();
  return {
    getString: (key) => mmkv.getString(key) ?? null,
    setString: (key, value) => {
      mmkv.set(key, value);
    },
    delete: (key) => {
      mmkv.remove(key);
    },
    clearAll: () => {
      mmkv.clearAll();
    },
  };
}
