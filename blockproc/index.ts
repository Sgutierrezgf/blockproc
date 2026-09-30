import "./global.css"; // T52: estilos de Tailwind/NativeWind, cargados una sola vez aquí.
import "expo-router/entry";

import { registerSupervisorHeadlessTask } from "./src/supervisor/headlessTask";

// RF-27 (T51): se registra aquí, no en una pantalla, porque tiene que
// existir incluso cuando Android arranca un motor de JS solo para correr
// esta tarea (la app estaba cerrada de verdad, sin ninguna pantalla que
// montar).
registerSupervisorHeadlessTask();
