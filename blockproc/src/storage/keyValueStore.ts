// La única puerta de persistencia (plan.md, D5): una interfaz mínima de
// lectura/escritura síncrona de texto, calcada de lo que MMKV ofrece. T49
// (fase 4) implementará esta misma interfaz sobre MMKV real; aquí solo el
// "doble en memoria" para poder probar el repositorio sin dispositivo.
export interface KeyValueStore {
  getString(key: string): string | null;
  setString(key: string, value: string): void;
  delete(key: string): void;
  clearAll(): void;
}

export function createInMemoryStore(): KeyValueStore {
  const values = new Map<string, string>();
  return {
    getString: (key) => values.get(key) ?? null,
    setString: (key, value) => {
      values.set(key, value);
    },
    delete: (key) => {
      values.delete(key);
    },
    clearAll: () => {
      values.clear();
    },
  };
}
