import type { MonitorMode } from "../core/monitorMode";

// El supervisor (T50) no importa BlockprocNative directamente: recibe esta
// interfaz de mejor esfuerzo, para poder probarlo con un adaptador falso sin
// depender de nada nativo. La implementación real vive en su propio archivo
// (sin tests, igual que mmkvStore.ts).
export interface NativeAdapter {
  showChallenge(packageName: string): void;
  showWait(packageName: string): void;
  goHome(): void;
  showNotification(type: string, title: string, text: string): void;
  setMonitorMode(mode: MonitorMode): void;
}
