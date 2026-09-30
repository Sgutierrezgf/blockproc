import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { BackHandler, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BlockprocNative from "../../modules/blockproc-native/src/BlockprocNativeModule";
import { formatRestBlockMessage } from "../core/restBlock";
import { loadConfig } from "../storage/appRepository";
import { defaultStore } from "../storage/defaultStore";
import { loadPolicyState } from "../supervisor/policyRepository";
import { Banner } from "../components/Banner";

function formatEndTime(endAt: number): string {
  const date = new Date(endAt);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// RF-18, RF-35 (T61): la pantalla que Kotlin abre por enlace profundo
// (`blockproc://restblock`, T48) mientras el bloqueo horario está activo.
// Sin reto y sin ninguna forma de salir (RF-19: una vez empezado, no hay
// marcha atrás).
// T74 (Fase 7, sistema "Mindful Calm"): mismo comportamiento de siempre,
// solo cambia la presentación. Sin el ícono de luna, la insignia "REFUGIO
// NOCTURNO" ni la tarjeta inferior del mock: son decorativos y no describen
// nada que la app haga de verdad (no hay gestión de notificaciones aparte).
// T78: unifica insignia+mensaje en `Banner` (tono `locked`, mismo patrón que
// challenge.tsx) y promueve "Hasta las" a una tarjeta con más presencia,
// sin BackButton a propósito (RF-18/19: sin ninguna salida).
export default function RestBlock() {
  // "t" (T63, ver challenge.tsx): mismo motivo — un segundo bloqueo horario
  // no debe quedarse con el mensaje o la hora de fin del anterior.
  const { t } = useLocalSearchParams<{ t?: string }>();

  const [config, setConfig] = useState(() => loadConfig(defaultStore));
  const [restBlock, setRestBlock] = useState(() => loadPolicyState(defaultStore).restBlock);

  // Ajuste de estado durante el render (no en un efecto) al cambiar "t":
  // ver la misma nota en challenge.tsx.
  const [loadedTrigger, setLoadedTrigger] = useState(t);
  if (t !== loadedTrigger) {
    setLoadedTrigger(t);
    setConfig(loadConfig(defaultStore));
    setRestBlock(loadPolicyState(defaultStore).restBlock);
  }

  const message = restBlock
    ? formatRestBlockMessage(config.restBlockMessage, restBlock.endAt)
    : config.restBlockMessage;

  // RF-18, RF-19 (T62, Plan D13): sin ninguna forma de salir; Atrás manda
  // al inicio de Android, igual que el resto de las pantallas de bloqueo.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      BlockprocNative.goHome();
      return true;
    });
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface dark:bg-surface-dark">
      <ScrollView
        contentContainerClassName="flex-1 justify-center gap-4 bg-surface p-6 dark:bg-surface-dark"
        className="bg-surface dark:bg-surface-dark"
      >
        <Banner tone="locked" title="Bloqueo horario activo" description={message} />
        {restBlock && (
          <View className="items-center gap-1 rounded-3xl bg-surface-container p-6 shadow-sm dark:bg-surface-container-dark">
            <Text className="font-label-md text-label-md font-semibold text-on-surface-variant dark:text-on-surface-variant-dark">
              Hasta las
            </Text>
            <Text className="font-headline-xl text-headline-xl font-bold text-on-surface dark:text-on-surface-dark">
              {formatEndTime(restBlock.endAt)}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
