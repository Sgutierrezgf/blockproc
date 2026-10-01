import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { BackHandler, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";

import BlockprocNative from "../../modules/blockproc-native/src/BlockprocNativeModule";
import {
  confirmNextRestBlock,
  formatRestBlockMessage,
  getRestBlockDurationMin,
  isValidRestBlockRange,
} from "../core/restBlock";
import type { TimeOfDay } from "../core/restBlock";
import { loadConfig } from "../storage/appRepository";
import { defaultStore } from "../storage/defaultStore";
import { loadPolicyState, savePolicyState } from "../supervisor/policyRepository";
import { Banner } from "../components/Banner";
import { PrimaryButton } from "../components/PrimaryButton";

function formatEndTime(endAt: number): string {
  const date = new Date(endAt);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatTime(time: TimeOfDay): string {
  return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
}

function formatDuration(durationMin: number): string {
  const hours = Math.floor(durationMin / 60);
  const minutes = durationMin % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

function isSameDay(a: number, b: number): boolean {
  const dateA = new Date(a);
  const dateB = new Date(b);
  return dateA.getFullYear() === dateB.getFullYear() && dateA.getMonth() === dateB.getMonth() && dateA.getDate() === dateB.getDate();
}

function pickTime(current: TimeOfDay, onPicked: (time: TimeOfDay) => void): void {
  const value = new Date();
  value.setHours(current.hour, current.minute, 0, 0);
  DateTimePickerAndroid.open({
    value,
    mode: "time",
    is24Hour: true,
    onValueChange: (_event, date) => {
      onPicked({ hour: date.getHours(), minute: date.getMinutes() });
    },
  });
}

// RF-18, RF-35 (T61): la pantalla que Kotlin abre por enlace profundo
// (`blockproc://restblock`, T48) mientras el bloqueo horario está activo.
// Sin reto y sin ninguna forma de salir (RF-19: una vez empezado, no hay
// marcha atrás) — salvo, desde la Fase 9, programar un bloqueo horario
// nuevo para después (RF-53), que no toca el que está en curso.
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
  const [nextRestBlock, setNextRestBlock] = useState(() => loadPolicyState(defaultStore).nextRestBlock);
  // D22 (Fase 9): sub-formulario dentro de la misma pantalla, sin ruta
  // nueva — evita duplicar el manejo de "sin salida" en una segunda pantalla.
  const [mode, setMode] = useState<"blocked" | "scheduleNext">("blocked");
  const [start, setStart] = useState<TimeOfDay>({ hour: 21, minute: 0 });
  const [end, setEnd] = useState<TimeOfDay>({ hour: 6, minute: 0 });

  // Ajuste de estado durante el render (no en un efecto) al cambiar "t":
  // ver la misma nota en challenge.tsx.
  const [loadedTrigger, setLoadedTrigger] = useState(t);
  if (t !== loadedTrigger) {
    setLoadedTrigger(t);
    setConfig(loadConfig(defaultStore));
    const policyState = loadPolicyState(defaultStore);
    setRestBlock(policyState.restBlock);
    setNextRestBlock(policyState.nextRestBlock);
    setMode("blocked");
  }

  const message = restBlock
    ? formatRestBlockMessage(config.restBlockMessage, restBlock.endAt)
    : config.restBlockMessage;

  // RF-18, RF-19 (T62, Plan D13): sin ninguna forma de salir del bloqueo en
  // sí; Atrás manda al inicio de Android, igual que el resto de pantallas de
  // bloqueo. RF-53 (D22): la única excepción es el sub-formulario de abajo
  // — ahí Atrás solo cancela y vuelve a esta vista, sin ir a Inicio. El
  // efecto se vuelve a registrar cuando cambia "mode" para que el listener
  // siempre vea el actual.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (mode === "scheduleNext") {
        setMode("blocked");
      } else {
        BlockprocNative.goHome();
      }
      return true;
    });
    return () => subscription.remove();
  }, [mode]);

  const durationMin = getRestBlockDurationMin(start, end);
  const isValid = isValidRestBlockRange(start, end);
  const computedStart = restBlock ? confirmNextRestBlock(start, end, restBlock.endAt).startAt : null;
  const startsNextDay = restBlock && computedStart ? !isSameDay(computedStart, restBlock.endAt) : false;

  const confirmNext = () => {
    if (!restBlock) return;
    const created = confirmNextRestBlock(start, end, restBlock.endAt);
    savePolicyState(defaultStore, { ...loadPolicyState(defaultStore), nextRestBlock: created });
    setNextRestBlock(created);
    setMode("blocked");
  };

  if (mode === "scheduleNext" && restBlock) {
    return (
      <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface dark:bg-surface-dark">
        <ScrollView
          contentContainerClassName="gap-6 bg-surface p-6 dark:bg-surface-dark"
          className="bg-surface dark:bg-surface-dark"
        >
          <View className="gap-2">
            <Text className="font-headline-lg text-headline-lg font-bold text-on-surface dark:text-on-surface-dark">
              Programar otro bloqueo horario
            </Text>
            <Text className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant-dark">
              Elegí una franja para después de que termine el actual, a las {formatEndTime(restBlock.endAt)}. No
              afecta al bloqueo que está en curso.
            </Text>
          </View>

          <View className="flex-row gap-3">
            <TimeCard label="Desde" value={formatTime(start)} onPress={() => pickTime(start, setStart)} />
            <TimeCard label="Hasta" value={formatTime(end)} onPress={() => pickTime(end, setEnd)} />
          </View>

          {isValid ? (
            <View className="gap-1 rounded-3xl bg-surface-container p-6 shadow-sm dark:bg-surface-container-dark">
              <Text className="font-headline-sm text-headline-sm font-semibold text-on-surface dark:text-on-surface-dark">
                Resumen
              </Text>
              <Text className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant-dark">
                De {formatTime(start)} a {formatTime(end)}
              </Text>
              <Text className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant-dark">
                Duración: {formatDuration(durationMin)}
              </Text>
              {computedStart && (
                <Text className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant-dark">
                  Empieza a las {formatEndTime(computedStart)}
                  {startsNextDay ? ", al día siguiente de que termine el actual" : ""}.
                </Text>
              )}
            </View>
          ) : (
            <View className="gap-1 rounded-2xl bg-error-container/40 p-3 dark:bg-error-container-dark/40">
              <Text className="font-label-sm text-label-sm font-medium text-error dark:text-error-dark">
                El rango debe durar más de 0 minutos y no más de 12 horas.
              </Text>
            </View>
          )}

          <PrimaryButton title="Confirmar" onPress={confirmNext} disabled={!isValid} />

          <Pressable onPress={() => setMode("blocked")} className="items-center justify-center p-3">
            <Text className="font-label-lg text-label-lg text-on-surface-variant dark:text-on-surface-variant-dark">
              Cancelar
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

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

        {/* RF-50: lo que ya haya programado para después, antes de ofrecer
            programar (o reemplazar) otro. */}
        {nextRestBlock && (
          <Banner
            tone="pending"
            title="Bloqueo horario programado"
            description={`Empieza a las ${formatEndTime(nextRestBlock.startAt)}.`}
          />
        )}

        {restBlock && (
          <Pressable
            onPress={() => setMode("scheduleNext")}
            className="h-[52px] items-center justify-center rounded-2xl bg-surface-container-high active:opacity-80 dark:bg-surface-container-high-dark"
          >
            <Text className="font-label-lg text-label-lg text-on-surface dark:text-on-surface-dark">
              {nextRestBlock ? "Cambiar el bloqueo programado" : "Programar otro bloqueo horario"}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TimeCard({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 gap-2 rounded-3xl bg-surface-container p-6 shadow-sm active:opacity-80 dark:bg-surface-container-dark"
    >
      <Text className="font-label-md text-label-md font-semibold text-on-surface-variant dark:text-on-surface-variant-dark">
        {label}
      </Text>
      <Text className="font-headline-xl text-headline-xl font-bold text-on-surface dark:text-on-surface-dark">
        {value}
      </Text>
    </Pressable>
  );
}
