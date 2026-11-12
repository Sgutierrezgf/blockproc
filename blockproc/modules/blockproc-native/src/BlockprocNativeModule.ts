import { NativeModule, requireNativeModule } from 'expo';

// RF-27, RF-43 (T09): eventos que emite el servicio de monitoreo.
type BlockprocNativeEvents = {
  ForegroundChanged: (event: { packageName: string }) => void;
  ScreenOn: () => void;
  ScreenOff: () => void;
};

declare class BlockprocNativeModule extends NativeModule<BlockprocNativeEvents> {
  // RF-26: comprobación y acceso a los dos permisos especiales del proyecto.
  hasUsageAccessPermission(): boolean;
  hasOverlayPermission(): boolean;
  openUsageAccessSettings(): void;
  openOverlaySettings(): void;
  // RF-9 (base): paquete de la app en primer plano en los últimos 60 s
  // según UsageStatsManager, o null si no hay ningún evento en esa ventana.
  getForegroundPackageName(): string | null;
  // Solo para depuración/pruebas (T08): historial de cambios de primer
  // plano en los últimos 60 s, más reciente primero.
  getRecentForegroundEvents(): { packageName: string; msAgo: number }[];
  // RF-27 (T09): arranca/detiene el servicio en primer plano.
  startMonitorService(): void;
  stopMonitorService(): void;
  // RF-1, RF-48, RF-49 (T46, T82): apps con icono de lanzador, para la
  // pantalla de configuración, con su ícono (data URI PNG, o null si no se
  // pudo generar) y su categoría (entero de ApplicationInfo.category, o
  // null si es CATEGORY_UNDEFINED). Async: decodificar el ícono de cientos
  // de apps es trabajo real de CPU (D17 del plan).
  getInstalledLauncherApps(): Promise<
    { packageName: string; label: string; iconUri: string | null; category: number | null }[]
  >;
  // RF-28 (T46): paquetes esenciales identificados de mejor esfuerzo
  // (marcador, Ajustes, lanzador, cámara y la propia app).
  getEssentialPackages(): string[];
  // RF-68 (T47): notificación de aviso. "type" (hoy solo "blockStarting")
  // decide el id, para que un aviso nuevo reemplace al anterior; título y
  // texto llegan ya traducidos (RF-76/77).
  showNotification(type: string, title: string, text: string): void;
  // RF-76, RF-77: textos de Android en el idioma elegido (nombres de canal y
  // notificación fija del servicio); se guardan del lado nativo.
  setNotificationTexts(
    alertsChannelName: string,
    monitorChannelName: string,
    monitorTitle: string,
    monitorText: string
  ): void;
  // RF-9, RF-13, RF-18, RF-38, RF-39 (T48): acciones por enlace profundo,
  // cada una abre su ruta encima de la app restringida (o, en el caso de
  // goHome, envía al usuario al inicio de Android).
  showChallenge(packageName: string): void;
  showWait(packageName: string): void;
  goHome(): void;
  // RF-47 (T87, D19 del plan): envía blockproc a segundo plano (como si se
  // hubiera presionado Inicio, pero sin navegar ahí) para revelar lo que
  // haya debajo, sin garantizar qué es.
  moveToBackground(): void;
}

export default requireNativeModule<BlockprocNativeModule>('BlockprocNative');
