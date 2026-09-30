import { createMmkvStore } from "./mmkvStore";

// Una sola instancia de MMKV para toda la app (T49). No es una ruta (por eso
// vive fuera de src/app/, según AGENTS.md), así que puede importarse desde
// cualquier pantalla sin crear una instancia nueva cada vez.
export const defaultStore = createMmkvStore();
