import { AppRegistry } from "react-native";

import BlockprocNative from "../../modules/blockproc-native/src/BlockprocNativeModule";
import { createSystemClock } from "../core/clock";
import { defaultStore } from "../storage/defaultStore";
import { dispatchSupervisorEvent } from "./dispatchSupervisorEvent";
import type { SupervisorTaskData } from "./dispatchSupervisorEvent";
import type { NativeAdapter } from "./nativeAdapter";
import { createSupervisor } from "./supervisor";

// El nombre de la tarea tiene que coincidir exactamente con el que usa
// SupervisorTaskService.kt (RF-27, T51): es el único enlace entre ambos.
export const SUPERVISOR_TASK_NAME = "BlockprocSupervisor";

const realNativeAdapter: NativeAdapter = {
  showChallenge: (packageName) => BlockprocNative.showChallenge(packageName),
  showWait: (packageName) => BlockprocNative.showWait(packageName),
  goHome: () => BlockprocNative.goHome(),
  showNotification: (type, title, text) => BlockprocNative.showNotification(type, title, text),
  setMonitorMode: (mode) => BlockprocNative.setMonitorMode(mode),
};

// Una instancia nueva por invocación: cuando la app estaba cerrada de
// verdad, no hay ninguna instancia previa en memoria que reutilizar, así que
// siempre parte del estado guardado en MMKV (nunca de uno en blanco).
function createRealSupervisor() {
  return createSupervisor({
    native: realNativeAdapter,
    store: defaultStore,
    clock: createSystemClock(),
  });
}

async function supervisorTask(data: SupervisorTaskData): Promise<void> {
  dispatchSupervisorEvent(createRealSupervisor(), data);
}

/**
 * RF-27, RF-9 (T51): registra el supervisor como tarea Headless JS, para que
 * corra aunque la app esté cerrada de verdad (proceso completo, no solo sin
 * pantalla visible). Se llama una sola vez, desde el punto de entrada de la
 * app (`index.ts`), no desde ninguna pantalla: tiene que existir incluso en
 * el contexto de JS que arranca solo para ejecutar esta tarea.
 */
export function registerSupervisorHeadlessTask(): void {
  AppRegistry.registerHeadlessTask(SUPERVISOR_TASK_NAME, () => supervisorTask);
}
