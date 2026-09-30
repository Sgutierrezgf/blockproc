import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { AppState, Button, PermissionsAndroid, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BlockprocNative from "../../modules/blockproc-native/src/BlockprocNativeModule";
import { BackButton } from "../components/BackButton";
import { Banner } from "../components/Banner";
import { Field } from "../components/Field";
import { PrimaryButton } from "../components/PrimaryButton";
import { SelectableRow } from "../components/SelectableRow";
import { getUsageDayKey } from "../core/clock";
import { createPolicyState } from "../core/policy";
import type { PolicyState } from "../core/policy";
import { loadConfig, saveConfig } from "../storage/appRepository";
import { defaultStore } from "../storage/defaultStore";
import { loadPolicyState, savePolicyState } from "../supervisor/policyRepository";

// Pantalla de pruebas (fases 1 a 4, T07 a T51). No es parte del flujo real
// de la app (que empieza en `/`, con la pantalla de permisos de la T53):
// vive en `/dev` para seguir comprobando a mano, en un dispositivo real,
// cada capacidad nativa a medida que se construyen las fases siguientes.

function readPermissions() {
  return {
    usageAccess: BlockprocNative.hasUsageAccessPermission(),
    overlay: BlockprocNative.hasOverlayPermission(),
  };
}

// RF-27: sin este permiso (diálogo estándar, Android 13+) la notificación
// del servicio en primer plano queda oculta, aunque el servicio en sí siga
// funcionando. Se descubrió al comprobar la T11: nadie lo había pedido.
async function hasNotificationPermission() {
  if (Platform.OS !== "android" || Platform.Version < 33) return true;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
}

// RF-25 (T49): sube dailyLimitMin un escalón (y da la vuelta al llegar al
// máximo), para tener algo que cambie con cada toque y así notarse si
// persistió tras cerrar y reabrir la app.
function nextDailyLimitMin(current: number): number {
  const next = current + 5;
  return next > 240 ? 5 : next;
}

export default function Dev() {
  // T67: estado local solo para tener algo interactivo que mostrar en la
  // vista previa de los componentes compartidos (src/components/); no hay
  // nada de esto en el resto de la pantalla, es puramente de muestra.
  const [previewChecked, setPreviewChecked] = useState(true);
  const [previewNumber, setPreviewNumber] = useState("30");
  const [previewMessage, setPreviewMessage] = useState("Mensaje de ejemplo.");
  const [previewShowError, setPreviewShowError] = useState(false);

  // Se lee una vez, durante el render inicial (no en un efecto): igual que
  // con los permisos, es el propio disco (MMKV) el que ya tiene el dato.
  const [dailyLimitMin, setDailyLimitMin] = useState(() => loadConfig(defaultStore).dailyLimitMin);

  const bumpDailyLimitMin = () => {
    const config = loadConfig(defaultStore);
    const updated = { ...config, dailyLimitMin: nextDailyLimitMin(config.dailyLimitMin) };
    saveConfig(defaultStore, updated);
    setDailyLimitMin(updated.dailyLimitMin);
  };

  // Se lee una vez, durante el render inicial (no en un efecto).
  const [permissions, setPermissions] = useState(readPermissions);
  const [events, setEvents] = useState<{ packageName: string; msAgo: number }[]>([]);
  const [hasNotifications, setHasNotifications] = useState(false);

  useEffect(() => {
    hasNotificationPermission().then(setHasNotifications);
  }, []);

  useEffect(() => {
    // Al volver de Ajustes, la app pasa a "active": es el momento de
    // comprobar de nuevo, porque no hay un evento que avise del cambio.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setPermissions(readPermissions());
        hasNotificationPermission().then(setHasNotifications);
      }
    });
    return () => subscription.remove();
  }, []);

  const requestNotifications = async () => {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    setHasNotifications(await hasNotificationPermission());
  };

  // Prueba manual (T08): 1) abre otra app, 2) espera unos segundos,
  // 3) vuelve a blockproc, 4) toca este botón. Debe verse esa otra app en la
  // lista, con su antigüedad en milisegundos. Se lee de una vez al tocar el
  // botón (no programado a futuro): los temporizadores de JS se frenan con
  // la app en segundo plano, así que un setTimeout no es fiable aquí; el
  // servicio real (T09) no tiene este problema porque corre en Kotlin.
  const readRecentEvents = () => {
    setEvents(BlockprocNative.getRecentForegroundEvents());
  };

  // T46: lista de apps con icono de lanzador y cuáles se identificaron como
  // esenciales (RF-1, RF-28). Se lee de una vez al tocar el botón, igual que
  // los eventos recientes: no hay que reaccionar a cambios en vivo aquí.
  const [apps, setApps] = useState<
    { packageName: string; label: string; iconUri: string | null; category: number | null }[]
  >([]);
  const [essentialPackages, setEssentialPackages] = useState<string[]>([]);

  // T82: ahora asíncrona (decodificar el ícono de cada app es trabajo real
  // de CPU, D17 del plan) — sigue leyéndose de una vez al tocar el botón.
  const listInstalledApps = async () => {
    setApps(await BlockprocNative.getInstalledLauncherApps());
    setEssentialPackages(BlockprocNative.getEssentialPackages());
  };

  // T47: dispara las tres notificaciones de aviso de un botón cada una,
  // para comprobar en el móvil que las tres se ven (RF-15, RF-30, RF-33).
  const notifyLimit = () => BlockprocNative.showNotification("limit", "Te queda 1 minuto de uso hoy.");
  const notifyWindow = () => BlockprocNative.showNotification("window", "Tu acceso termina en 1 minuto.");
  const notifyRestBlock = () => BlockprocNative.showNotification("restBlock", "El bloqueo horario empieza en 2 minutos.");

  // T51: deja "Ajustes" restringida y ya con el límite agotado hoy, sin
  // esperar minutos reales — así se puede probar de verdad que, con la app
  // cerrada desde recientes, abrirla dispara el reto vía Headless JS
  // (RF-9, RF-27). El dayKey de hoy evita que se confunda con un día nuevo
  // y se reinicien los contadores nada más abrir la app restringida.
  // Chrome, no Ajustes: Ajustes es esencial (getEssentialPackages) y nunca
  // se puede restringir de verdad, así que no sirve para probar este flujo.
  const TEST_RESTRICTED_PACKAGE = "com.android.chrome";
  const setupHeadlessTaskTest = () => {
    saveConfig(defaultStore, {
      ...loadConfig(defaultStore),
      restrictedPackages: [TEST_RESTRICTED_PACKAGE],
      dailyLimitMin: 5,
    });
    const seeded: PolicyState = {
      ...createPolicyState(),
      usage: {
        ...createPolicyState().usage,
        usedMs: { [TEST_RESTRICTED_PACKAGE]: 999_999_999 },
        dayKey: getUsageDayKey(Date.now()),
      },
    };
    savePolicyState(defaultStore, seeded);
  };

  // T57: bloqueo horario activo ahora mismo, para probar que Ajustes y Apps
  // se bloquean por completo mientras dura (RF-19).
  const setupActiveRestBlockTest = () => {
    const now = Date.now();
    savePolicyState(defaultStore, {
      ...createPolicyState(),
      restBlock: { startAt: now - 60_000, endAt: now + 10 * 60_000, cancelled: false, warned2min: false },
    });
  };

  const clearRestBlockTest = () => {
    savePolicyState(defaultStore, { ...createPolicyState() });
  };

  // T48: cada acción abre su ruta por enlace profundo encima de esta pantalla
  // (o, en goHome, manda al inicio de Android). "com.android.settings" es
  // solo un paquete de prueba cualquiera, para tener algo que mostrar.
  const TEST_PACKAGE = "com.android.settings";
  const testShowChallenge = () => BlockprocNative.showChallenge(TEST_PACKAGE);
  const testShowWait = () => BlockprocNative.showWait(TEST_PACKAGE);
  const testShowRestBlock = () => BlockprocNative.showRestBlock();
  const testGoHome = () => BlockprocNative.goHome();
  const testMoveToBackground = () => BlockprocNative.moveToBackground();

  // T60: deja a TEST_PACKAGE con 3 min de espera activa (RF-13), para poder
  // abrir /wait con algo real que contar hacia atrás.
  const setupCooldownTest = () => {
    const policy = loadPolicyState(defaultStore);
    savePolicyState(defaultStore, {
      ...policy,
      apps: {
        ...policy.apps,
        [TEST_PACKAGE]: {
          windowEndsAt: null,
          cooldownUntil: Date.now() + 3 * 60_000,
          warnedLimit: false,
          warnedWindow: false,
        },
      },
    });
  };

  // T09: registro en vivo de lo que emite el servicio, mientras está activo.
  const [serviceLog, setServiceLog] = useState<string[]>([]);

  useEffect(() => {
    const log = (line: string) =>
      setServiceLog((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 20));

    const subs = [
      BlockprocNative.addListener("ForegroundChanged", (e) => log(`ForegroundChanged: ${e.packageName}`)),
      BlockprocNative.addListener("ScreenOn", () => log("ScreenOn")),
      BlockprocNative.addListener("ScreenOff", () => log("ScreenOff")),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  // Defensa en profundidad: en una build release, __DEV__ es false y esta
  // pantalla no debe quedar alcanzable ni por enlace profundo directo
  // (blockproc://dev), aunque el enlace de Ajustes ya esté oculto.
  if (!__DEV__) {
    return <Redirect href="/settings" />;
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <BackButton />
        <View className="items-center gap-2 rounded-lg bg-blue-600 p-4">
        <Text className="text-lg font-bold text-white">NativeWind (T52)</Text>
        <Text className="text-white">Si se ve azul con texto blanco, Tailwind funciona.</Text>
      </View>

      <View className="items-center gap-1 rounded-lg border border-gray-300 bg-white p-4">
        <Text className="font-headline-lg text-headline-lg text-on-surface">
          Plus Jakarta Sans (T66)
        </Text>
        <Text className="font-body-md text-body-md text-on-surface-variant">
          Si el titular se ve con una tipografía distinta a la de abajo, la fuente cargó.
        </Text>
      </View>

      <View className="gap-3">
        <Text style={styles.title}>Componentes compartidos (T67)</Text>

        <SelectableRow
          label="Área de ejemplo"
          checked={previewChecked}
          onPress={() => setPreviewChecked((prev) => !prev)}
        />

        <Field
          label="Campo numérico"
          hint="5 - 240 min"
          value={previewNumber}
          onChangeText={setPreviewNumber}
          step={5}
          error={previewShowError ? "Debe ser múltiplo de 5, entre 5 y 240." : undefined}
        />
        <Button
          title={previewShowError ? "Ocultar error de ejemplo" : "Mostrar error de ejemplo"}
          onPress={() => setPreviewShowError((prev) => !prev)}
        />

        <Field
          label="Campo de mensaje"
          value={previewMessage}
          onChangeText={setPreviewMessage}
          multiline
        />

        <Banner
          tone="locked"
          title="Bloqueo horario activo"
          description="No se puede editar la configuración hasta que termine."
        />
        <Banner
          tone="pending"
          title="Cambios pendientes hasta las 04:00"
          description="Límite diario a 60 min."
        />
        <Banner
          tone="battery"
          title="Optimización de batería"
          description="Si el sistema cierra la app para ahorrar batería, el bloqueo puede dejar de funcionar."
        />

        <PrimaryButton title="Botón de ejemplo" onPress={() => setPreviewChecked((prev) => !prev)} />
        <PrimaryButton title="Botón deshabilitado" onPress={() => {}} disabled />
      </View>

      <Text style={styles.title}>Permisos (T07)</Text>

      <PermissionRow
        label="Estadísticas de uso"
        granted={permissions.usageAccess}
        onPressSettings={() => BlockprocNative.openUsageAccessSettings()}
      />
      <PermissionRow
        label="Mostrar sobre otras apps"
        granted={permissions.overlay}
        onPressSettings={() => BlockprocNative.openOverlaySettings()}
      />
      <PermissionRow
        label="Notificaciones"
        granted={hasNotifications}
        onPressSettings={requestNotifications}
        actionLabel="Pedir permiso"
      />

      <View style={styles.row}>
        <Text style={styles.title}>App en primer plano (T08)</Text>
        <Button title="Leer eventos recientes" onPress={readRecentEvents} />
        {events.map((e, i) => (
          <Text key={i}>
            {e.packageName}: hace {Math.round(e.msAgo)} ms
          </Text>
        ))}
      </View>

      <View style={styles.row}>
        <Text style={styles.title}>Almacenamiento con MMKV (T49)</Text>
        <Text>dailyLimitMin guardado: {dailyLimitMin}</Text>
        <Button title="Subir dailyLimitMin y guardar" onPress={bumpDailyLimitMin} />
        <Text>Cierra la app (recientes) y vuelve a abrirla: debe seguir en el mismo número.</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.title}>Apps instaladas (T46)</Text>
        <Button title="Listar apps" onPress={listInstalledApps} />
        {apps.map((app) => (
          <Text key={app.packageName}>
            {essentialPackages.includes(app.packageName) ? "⭐ esencial — " : ""}
            {app.label} ({app.packageName}) — ícono: {app.iconUri ? "sí" : "no"}, categoría:{" "}
            {app.category ?? "sin categoría"}
          </Text>
        ))}
      </View>

      <View style={styles.row}>
        <Text style={styles.title}>Notificaciones de aviso (T47)</Text>
        <View style={styles.buttonRow}>
          <Button title="Límite" onPress={notifyLimit} />
          <Button title="Ventana" onPress={notifyWindow} />
          <Button title="Bloqueo horario" onPress={notifyRestBlock} />
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.title}>Acciones por enlace profundo (T48)</Text>
        <View style={styles.buttonRow}>
          <Button title="showChallenge" onPress={testShowChallenge} />
          <Button title="showWait" onPress={testShowWait} />
        </View>
        <View style={styles.buttonRow}>
          <Button title="showRestBlock" onPress={testShowRestBlock} />
          <Button title="goHome" onPress={testGoHome} />
          <Button title="moveToBackground" onPress={testMoveToBackground} />
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.title}>Pantalla de espera (T60)</Text>
        <Button title="Poner 3 min de espera a TEST_PACKAGE" onPress={setupCooldownTest} />
        <Text>Luego tocá &ldquo;showWait&rdquo; de arriba: debe verse la cuenta atrás bajando.</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.title}>Supervisor Headless JS (T51)</Text>
        <Button title="Dejar Chrome restringida y bloqueada" onPress={setupHeadlessTaskTest} />
        <Text>
          Tras tocarlo: cierra blockproc desde recientes y abre Chrome. Debe aparecer /challenge
          encima, aunque blockproc estuviera cerrada de verdad.
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.title}>Cambios pendientes y bloqueo de edición (T57)</Text>
        <Button title="Dejar Chrome bloqueada (ya agotó el límite)" onPress={setupHeadlessTaskTest} />
        <Text>Luego ve a Ajustes y sube el límite diario: debe quedar &ldquo;pendiente hasta las 04:00&rdquo;.</Text>
        <Button title="Activar bloqueo horario ahora" onPress={setupActiveRestBlockTest} />
        <Text>Luego ve a Ajustes o Apps: los controles deben verse desactivados.</Text>
        <Button title="Limpiar simulación" onPress={clearRestBlockTest} />
      </View>

      <View style={styles.row}>
        <Text style={styles.title}>Servicio de monitoreo (T09)</Text>
        <View style={styles.buttonRow}>
          <Button title="Iniciar servicio" onPress={() => BlockprocNative.startMonitorService()} />
          <Button title="Detener servicio" onPress={() => BlockprocNative.stopMonitorService()} />
        </View>
        {serviceLog.map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PermissionRow({
  label,
  granted,
  onPressSettings,
  actionLabel = "Abrir ajustes",
}: {
  label: string;
  granted: boolean;
  onPressSettings: () => void;
  actionLabel?: string;
}) {
  return (
    <View style={styles.row}>
      <Text>
        {label}: {granted ? "concedido" : "no concedido"}
      </Text>
      {!granted && <Button title={actionLabel} onPress={onPressSettings} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    gap: 24,
    padding: 16,
    paddingTop: 48,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  row: {
    alignItems: "center",
    gap: 8,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
});
