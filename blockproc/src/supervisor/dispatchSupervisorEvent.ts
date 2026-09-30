import type { Supervisor } from "./supervisor";

// La misma forma que le llega a la tarea Headless JS desde Kotlin (T51): un
// objeto plano, resultado de convertir el Bundle del Intent que arranca
// SupervisorTaskService.
export interface SupervisorTaskData {
  event: "ForegroundChanged" | "Tick" | "ScreenOn" | "ScreenOff";
  packageName?: string | null;
}

/** RF-27: traduce la carga de la tarea Headless JS a la llamada del supervisor que corresponde. */
export function dispatchSupervisorEvent(supervisor: Supervisor, data: SupervisorTaskData): void {
  switch (data.event) {
    case "ForegroundChanged":
      supervisor.onForegroundChanged(data.packageName ?? null);
      break;
    case "Tick":
      supervisor.onTick();
      break;
    case "ScreenOn":
      supervisor.onScreenOn();
      break;
    case "ScreenOff":
      supervisor.onScreenOff();
      break;
  }
}
