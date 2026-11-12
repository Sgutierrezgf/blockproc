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

// Pantalla de pruebas, fuera del flujo real de la app (que empieza en `/`,
// con la pantalla de permisos). Fase 10 (rediseño): se recortaron las
// pruebas atadas al modelo anterior (límite diario, bloqueo horario único);
// no se reconstruyen ayudas nuevas para el sistema de bloqueos (D26) — la
// verificación de ese flujo es manual, en el dispositivo real.

function readPermissions() {
  return {
    usageAccess: BlockprocNative.hasUsageAccessPermission(),
    overlay: BlockprocNative.hasOverlayPermission(),
  };
}

// RF-27: sin este permiso (diálogo estándar, Android 13+) la notificación
// del servicio en primer plano queda oculta, aunque el servicio en sí siga
// funcionando.
async function hasNotificationPermission() {
  if (Platform.OS !== "android" || Platform.Version < 33) return true;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
}

export default function Dev() {
  // Estado local solo para la vista previa de los componentes compartidos
  // (src/components/); no hay nada de esto en el resto de la pantalla.
  const [previewChecked, setPreviewChecked] = useState(true);
  const [previewNumber, setPreviewNumber] = useState("30");
  const [previewMessage, setPreviewMessage] = useState("Mensaje de ejemplo.");
  const [previewShowError, setPreviewShowError] = useState(false);

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

  // Prueba manual: 1) abre otra app, 2) espera unos segundos, 3) vuelve a
  // blockproc, 4) toca este botón. Debe verse esa otra app en la lista.
  const readRecentEvents = () => {
    setEvents(BlockprocNative.getRecentForegroundEvents());
  };

  // Lista de apps con icono de lanzador y cuáles se identificaron como
  // esenciales (RF-1, RF-28).
  const [apps, setApps] = useState<
    { packageName: string; label: string; iconUri: string | null; category: number | null }[]
  >([]);
  const [essentialPackages, setEssentialPackages] = useState<string[]>([]);

  const listInstalledApps = async () => {
    setApps(await BlockprocNative.getInstalledLauncherApps());
    setEssentialPackages(BlockprocNative.getEssentialPackages());
  };

  // Enlaces profundos: cada acción abre su ruta sobre esta pantalla (o, en
  // goHome, manda al inicio de Android). "com.android.settings" es solo un
  // paquete de prueba cualquiera, para tener algo que mostrar.
  const TEST_PACKAGE = "com.android.settings";
  const testShowChallenge = () => BlockprocNative.showChallenge(TEST_PACKAGE);
  const testShowWait = () => BlockprocNative.showWait(TEST_PACKAGE);
  const testGoHome = () => BlockprocNative.goHome();
  const testMoveToBackground = () => BlockprocNative.moveToBackground();

  // Registro en vivo de lo que emite el servicio, mientras está activo.
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
  // (blockproc://dev), aunque el enlace de Personalización ya esté oculto.
  if (!__DEV__) {
    return <Redirect href="/settings" />;
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <BackButton />
        <View className="items-center gap-2 rounded-lg bg-blue-600 p-4">
          <Text className="text-lg font-bold text-white">NativeWind</Text>
          <Text className="text-white">Si se ve azul con texto blanco, Tailwind funciona.</Text>
        </View>

        <View className="items-center gap-1 rounded-lg border border-gray-300 bg-white p-4">
          <Text className="font-headline-lg text-headline-lg text-on-surface">Plus Jakarta Sans</Text>
          <Text className="font-body-md text-body-md text-on-surface-variant">
            Si el titular se ve con una tipografía distinta a la de abajo, la fuente cargó.
          </Text>
        </View>

        <View className="gap-3">
          <Text style={styles.title}>Componentes compartidos</Text>

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

          <Field label="Campo de mensaje" value={previewMessage} onChangeText={setPreviewMessage} multiline />

          <Banner tone="locked" title="Bloqueo activo" description="Ejemplo de banner de bloqueo." />
          <Banner tone="pending" title="Bloqueo programado" description="Ejemplo de banner pendiente." />
          <Banner
            tone="battery"
            title="Optimización de batería"
            description="Si el sistema cierra la app para ahorrar batería, el bloqueo puede dejar de funcionar."
          />

          <PrimaryButton title="Botón de ejemplo" onPress={() => setPreviewChecked((prev) => !prev)} />
          <PrimaryButton title="Botón deshabilitado" onPress={() => {}} disabled />
        </View>

        <Text style={styles.title}>Permisos</Text>

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
          <Text style={styles.title}>App en primer plano</Text>
          <Button title="Leer eventos recientes" onPress={readRecentEvents} />
          {events.map((e, i) => (
            <Text key={i}>
              {e.packageName}: hace {Math.round(e.msAgo)} ms
            </Text>
          ))}
        </View>

        <View style={styles.row}>
          <Text style={styles.title}>Apps instaladas</Text>
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
          <Text style={styles.title}>Acciones por enlace profundo</Text>
          <View style={styles.buttonRow}>
            <Button title="showChallenge" onPress={testShowChallenge} />
            <Button title="showWait" onPress={testShowWait} />
          </View>
          <View style={styles.buttonRow}>
            <Button title="goHome" onPress={testGoHome} />
            <Button title="moveToBackground" onPress={testMoveToBackground} />
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.title}>Servicio de monitoreo</Text>
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
