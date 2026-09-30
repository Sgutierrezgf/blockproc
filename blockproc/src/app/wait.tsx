import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { BackHandler, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BlockprocNative from "../../modules/blockproc-native/src/BlockprocNativeModule";
import { createSystemClock } from "../core/clock";
import { loadConfig } from "../storage/appRepository";
import { defaultStore } from "../storage/defaultStore";
import { loadPolicyState } from "../supervisor/policyRepository";

// Principio 7 de la constitución: nunca Date.now() directo, siempre un
// Clock inyectable (aquí, el real: no hay reloj falso que inyectar en una
// pantalla real).
const clock = createSystemClock();

function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// RF-38, RF-6 (T60): la pantalla que Kotlin abre por enlace profundo
// (`blockproc://wait?pkg=…`, T48) mientras dura la espera de 3 min tras
// fallar un reto (RF-13, policy.ts). El fin de la espera (`cooldownUntil`)
// vive en el PolicyState, no en la URL: el enlace solo trae el paquete.
// T73 (Fase 7, sistema "Mindful Calm"): mismo comportamiento de siempre,
// solo cambia la presentación: el círculo es un simple `View` con borde
// redondeado (sin SVG ni animación), sin el texto decorativo "inhala/exhala"
// del mock (no aporta nada sobre el mensaje de enfoque, que ya es
// configurable por RF-6).
// T78: sin BackButton a propósito (RF-38: sin ninguna salida durante la
// espera); ver la misma nota en challenge.tsx.
export default function Wait() {
  // "t" (T63, ver challenge.tsx y BlockprocNativeModule.kt): mismo motivo,
  // para que un segundo aviso de espera para la misma app (una nueva espera,
  // tras un segundo fallo) no se quede con el `cooldownUntil` ya vencido de
  // la primera.
  const { pkg, t } = useLocalSearchParams<{ pkg?: string; t?: string }>();
  const packageName = pkg ?? "";

  const [config, setConfig] = useState(() => loadConfig(defaultStore));
  const [cooldownUntil, setCooldownUntil] = useState(
    () => loadPolicyState(defaultStore).apps[packageName]?.cooldownUntil ?? null
  );
  const [now, setNow] = useState(() => clock.now());

  // Ajuste de estado durante el render (no en un efecto) al cambiar "t":
  // ver la misma nota en challenge.tsx.
  const [loadedTrigger, setLoadedTrigger] = useState(t);
  if (t !== loadedTrigger) {
    setLoadedTrigger(t);
    setConfig(loadConfig(defaultStore));
    setCooldownUntil(loadPolicyState(defaultStore).apps[packageName]?.cooldownUntil ?? null);
  }

  useEffect(() => {
    const id = setInterval(() => setNow(clock.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // RF-38 (T62, Plan D13): Atrás durante la espera tampoco vuelve a la app
  // restringida; manda al inicio de Android.
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
          {config.focusMessage}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
