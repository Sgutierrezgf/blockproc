import { useEffect, useState } from "react";
import { router } from "expo-router";
import { AppState, PermissionsAndroid, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BlockprocNative from "../../modules/blockproc-native/src/BlockprocNativeModule";
import { useStrings } from "../i18n/LanguageProvider";
import { PrimaryButton } from "../components/PrimaryButton";

// RF-26: mientras falte el permiso de estadísticas de uso, el de
// superposición o el de notificaciones, se explica cada uno que falta y se
// guía a concederlo. Con los tres concedidos, se pasa de largo a los
// ajustes de la app.
function readSyncPermissions() {
  return {
    usageAccess: BlockprocNative.hasUsageAccessPermission(),
    overlay: BlockprocNative.hasOverlayPermission(),
  };
}

// RF-15, RF-30, RF-33: en Android 13+ (API 33), sin este permiso las
// notificaciones de aviso (incluido el de "2 minutos antes" del bloqueo
// horario) se descartan en silencio — hasta ahora solo se pedía desde
// `/dev` (T09), nunca en el flujo real, así que ningún usuario real llegaba
// a verlas. En versiones anteriores no existe el permiso: se trata como ya
// concedido.
async function hasNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== "android" || Platform.Version < 33) return true;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
}

// T68 (Fase 7, sistema "Mindful Calm"): mismo comportamiento de siempre,
// solo cambia la presentación (tarjetas y colores del sistema de diseño en
// vez de colores sueltos de Tailwind).
export default function Permissions() {
  const strings = useStrings().permissions;
  const [permissions, setPermissions] = useState(() => ({ ...readSyncPermissions(), notifications: false }));

  // Los dos primeros se leen de forma síncrona (ya en el estado inicial);
  // el de notificaciones solo se sabe de forma asíncrona (PermissionsAndroid
  // siempre devuelve una Promise), así que llega un instante después.
  useEffect(() => {
    hasNotificationPermission().then((notifications) => setPermissions((prev) => ({ ...prev, notifications })));
  }, []);

  const refreshPermissions = () => {
    setPermissions((prev) => ({ ...prev, ...readSyncPermissions() }));
    hasNotificationPermission().then((notifications) => setPermissions((prev) => ({ ...prev, notifications })));
  };

  useEffect(() => {
    if (permissions.usageAccess && permissions.overlay && permissions.notifications) {
      // RF-27: con los tres permisos concedidos, arranca el servicio de
      // vigilancia. Antes de esto, nada en la app real lo arrancaba nunca
      // (solo `/dev` a mano, o BootReceiver tras un reinicio real): un
      // usuario que instalara la app, concediera los permisos y configurara
      // apps restringidas sin reiniciar el teléfono no tenía ninguna
      // vigilancia corriendo. Arrancarlo aquí es seguro de repetir (Android
      // no reinicia un servicio que ya está en marcha).
      BlockprocNative.startMonitorService();
      router.replace("/blocks");
    }
  }, [permissions]);

  useEffect(() => {
    // Al volver de Ajustes del sistema, la app pasa a "active": es el
    // momento de comprobar de nuevo, porque no hay ningún evento que avise
    // del cambio (patrón ya usado en /dev, T07).
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refreshPermissions();
      }
    });
    return () => subscription.remove();
  }, []);

  // A diferencia de los otros dos, este sí tiene diálogo estándar de
  // Android: se pide directo, sin pasar por Ajustes del sistema.
  const requestNotifications = async () => {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    const notifications = await hasNotificationPermission();
    setPermissions((prev) => ({ ...prev, notifications }));
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface dark:bg-surface-dark">
      <ScrollView
        contentContainerClassName="flex-grow gap-6 bg-surface p-6 dark:bg-surface-dark"
        className="bg-surface dark:bg-surface-dark"
      >
        <View className="gap-2">
          <Text className="font-headline-lg text-headline-lg font-bold text-on-surface dark:text-on-surface-dark">
            {strings.title}
          </Text>
          <Text className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant-dark">
            {strings.subtitle}
          </Text>
        </View>

        <PermissionCard
          title={strings.usageAccessTitle}
          description={strings.usageAccessDescription}
          granted={permissions.usageAccess}
          grantedLabel={strings.granted}
          pendingLabel={strings.pending}
          grantButtonLabel={strings.grantButton}
          onPress={() => BlockprocNative.openUsageAccessSettings()}
        />
        <PermissionCard
          title={strings.overlayTitle}
          description={strings.overlayDescription}
          granted={permissions.overlay}
          grantedLabel={strings.granted}
          pendingLabel={strings.pending}
          grantButtonLabel={strings.grantButton}
          onPress={() => BlockprocNative.openOverlaySettings()}
        />
        <PermissionCard
          title={strings.notificationsTitle}
          description={strings.notificationsDescription}
          granted={permissions.notifications}
          grantedLabel={strings.granted}
          pendingLabel={strings.pending}
          grantButtonLabel={strings.grantButton}
          onPress={requestNotifications}
        />

        <View className="gap-1 rounded-2xl bg-surface-container-low p-4 dark:bg-surface-container-low-dark">
          <Text className="font-label-md text-label-md font-semibold text-on-surface dark:text-on-surface-dark">
            {strings.privacyTitle}
          </Text>
          <Text className="font-body-sm text-body-sm text-on-surface-variant dark:text-on-surface-variant-dark">
            {strings.privacyDescription}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PermissionCard({
  title,
  description,
  granted,
  grantedLabel,
  pendingLabel,
  grantButtonLabel,
  onPress,
}: {
  title: string;
  description: string;
  granted: boolean;
  grantedLabel: string;
  pendingLabel: string;
  grantButtonLabel: string;
  onPress: () => void;
}) {
  return (
    <View
      className={`gap-3 rounded-2xl p-4 shadow-sm ${
        granted
          ? "bg-secondary-container/20 dark:bg-secondary-container-dark/20"
          : "bg-surface-container dark:bg-surface-container-dark"
      }`}
    >
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 font-headline-sm text-headline-sm font-semibold text-on-surface dark:text-on-surface-dark">
          {title}
        </Text>
        <View
          className={`rounded-full px-3 py-1 ${
            granted
              ? "bg-secondary/15 dark:bg-secondary-dark/15"
              : "bg-surface-container-high dark:bg-surface-container-high-dark"
          }`}
        >
          <Text
            className={`font-label-md text-label-md font-semibold ${
              granted
                ? "text-secondary dark:text-secondary-dark"
                : "text-on-surface-variant dark:text-on-surface-variant-dark"
            }`}
          >
            {granted ? grantedLabel : pendingLabel}
          </Text>
        </View>
      </View>
      <Text className="font-body-sm text-body-sm text-on-surface-variant dark:text-on-surface-variant-dark">
        {description}
      </Text>
      {!granted && <PrimaryButton title={grantButtonLabel} onPress={onPress} />}
    </View>
  );
}
