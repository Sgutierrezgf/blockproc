import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { BackHandler, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BlockprocNative from "../../modules/blockproc-native/src/BlockprocNativeModule";
import { findActiveBlockForPackage } from "../core/blocks";
import { createSystemClock } from "../core/clock";
import { defaultStore } from "../storage/defaultStore";
import { loadPolicyState } from "../supervisor/policyRepository";

const clock = createSystemClock();

function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function readState(packageName: string) {
  const policyState = loadPolicyState(defaultStore);
  const block = findActiveBlockForPackage(policyState.blocks, packageName, clock.now());
  return {
    cooldownUntil: policyState.apps[packageName]?.cooldownUntil ?? null,
    focusMessage: block?.focusMessage ?? "",
  };
}

// RF-66 (Fase 10): la pantalla que Kotlin abre por enlace profundo
// (`blockproc://wait?pkg=…`) mientras dura la espera de 5 min tras fallar
// el reto (2 respuestas incorrectas). El fin de la espera (`cooldownUntil`)
// vive en el PolicyState, no en la URL: el enlace solo trae el paquete.
// Sin BackButton a propósito (RF-66: sin ninguna salida durante la espera).
export default function Wait() {
  const { pkg, t } = useLocalSearchParams<{ pkg?: string; t?: string }>();
  const packageName = pkg ?? "";

  const [{ cooldownUntil, focusMessage }, setState] = useState(() => readState(packageName));
  const [now, setNow] = useState(() => clock.now());

  // Ajuste de estado durante el render (no en un efecto) al cambiar "t": un
  // segundo aviso de espera para la misma app (tras un segundo fallo) no
  // debe quedarse con el `cooldownUntil` ya vencido del primero.
  const [loadedTrigger, setLoadedTrigger] = useState(t);
  if (t !== loadedTrigger) {
    setLoadedTrigger(t);
    setState(readState(packageName));
  }

  useEffect(() => {
    const id = setInterval(() => setNow(clock.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // RF-66: Atrás durante la espera tampoco vuelve a la app bloqueada; manda
  // al inicio de Android.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      BlockprocNative.goHome();
      return true;
    });
    return () => subscription.remove();
  }, []);

  const remainingMs = cooldownUntil !== null ? cooldownUntil - now : 0;

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface dark:bg-surface-dark">
      <ScrollView
        contentContainerClassName="flex-1 items-center justify-center gap-8 bg-surface p-6 dark:bg-surface-dark"
        className="bg-surface dark:bg-surface-dark"
      >
        <View className="items-center justify-center">
          <View className="absolute h-80 w-80 rounded-full bg-primary-container/20 dark:bg-primary-container-dark/10" />
          <View className="h-64 w-64 items-center justify-center gap-1 rounded-full border-8 border-surface-container-high bg-surface-container dark:border-surface-container-high-dark dark:bg-surface-container-dark">
            <Text className="font-label-sm text-label-sm font-semibold text-on-surface-variant dark:text-on-surface-variant-dark">
              Tiempo restante
            </Text>
            <Text className="font-headline-xl text-headline-xl font-bold text-on-surface dark:text-on-surface-dark">
              {formatCountdown(remainingMs)}
            </Text>
          </View>
        </View>
        <Text className="text-center font-body-lg text-body-lg text-on-surface-variant dark:text-on-surface-variant-dark">
          {focusMessage}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
