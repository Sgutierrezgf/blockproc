import { useEffect, useState } from "react";
import { router } from "expo-router";
import { AppState, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BlockprocNative from "../../modules/blockproc-native/src/BlockprocNativeModule";
import { PrimaryButton } from "../components/PrimaryButton";

// RF-26: mientras falte el permiso de estadísticas de uso o el de
// superposición, se explica cada uno que falta y se guía a concederlo desde
// Ajustes del sistema (no hay diálogo estándar para ninguno de los dos).
// Con ambos concedidos, se pasa de largo a los ajustes de la app.
function readPermissions() {
  return {
    usageAccess: BlockprocNative.hasUsageAccessPermission(),
    overlay: BlockprocNative.hasOverlayPermission(),
  };
}

// T68 (Fase 7, sistema "Mindful Calm"): mismo comportamiento de siempre,
// solo cambia la presentación (tarjetas y colores del sistema de diseño en
// vez de colores sueltos de Tailwind).
export default function Permissions() {
  const [permissions, setPermissions] = useState(readPermissions);

  useEffect(() => {
    if (permissions.usageAccess && permissions.overlay) {
      // RF-27: con los dos permisos concedidos, arranca el servicio de
      // vigilancia. Antes de esto, nada en la app real lo arrancaba nunca
      // (solo `/dev` a mano, o BootReceiver tras un reinicio real): un
      // usuario que instalara la app, concediera los permisos y configurara
      // apps restringidas sin reiniciar el teléfono no tenía ninguna
      // vigilancia corriendo. Arrancarlo aquí es seguro de repetir (Android
      // no reinicia un servicio que ya está en marcha).
      BlockprocNative.startMonitorService();
      router.replace("/settings");
    }
  }, [permissions]);

  useEffect(() => {
    // Al volver de Ajustes del sistema, la app pasa a "active": es el
    // momento de comprobar de nuevo, porque no hay ningún evento que avise
    // del cambio (patrón ya usado en /dev, T07).
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setPermissions(readPermissions());
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface dark:bg-surface-dark">
      <ScrollView
        contentContainerClassName="flex-grow gap-6 bg-surface p-6 dark:bg-surface-dark"
        className="bg-surface dark:bg-surface-dark"
      >
        <View className="gap-2">
          <Text className="font-headline-lg text-headline-lg font-bold text-on-surface dark:text-on-surface-dark">
            Permisos necesarios
          </Text>
          <Text className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant-dark">
            blockproc necesita estos dos permisos para poder aplicar los límites que configures.
          </Text>
        </View>

        <PermissionCard
          title="Estadísticas de uso"
          description="Para saber qué app está abierta y aplicar el límite diario."
          granted={permissions.usageAccess}
          onPress={() => BlockprocNative.openUsageAccessSettings()}
        />
        <PermissionCard
          title="Mostrar sobre otras apps"
          description="Para mostrar el reto encima de la app restringida cuando toca."
          granted={permissions.overlay}
          onPress={() => BlockprocNative.openOverlaySettings()}
        />

        <View className="gap-1 rounded-2xl bg-surface-container-low p-4 dark:bg-surface-container-low-dark">
          <Text className="font-label-md text-label-md font-semibold text-on-surface dark:text-on-surface-dark">
            Compromiso de privacidad
          </Text>
          <Text className="font-body-sm text-body-sm text-on-surface-variant dark:text-on-surface-variant-dark">
            Tus datos se procesan siempre en tu dispositivo: nada se envía a ningún servidor.
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
  onPress,
}: {
  title: string;
  description: string;
  granted: boolean;
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
            {granted ? "Concedido" : "Pendiente"}
          </Text>
        </View>
      </View>
      <Text className="font-body-sm text-body-sm text-on-surface-variant dark:text-on-surface-variant-dark">
        {description}
      </Text>
      {!granted && <PrimaryButton title="Conceder permiso" onPress={onPress} />}
    </View>
  );
}
