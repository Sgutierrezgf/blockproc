import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";

import { createSystemClock } from "../../core/clock";
import {
  cancelRestBlock,
  confirmRestBlock,
  getRestBlockDurationMin,
  getRestBlockStatus,
  isValidRestBlockRange,
} from "../../core/restBlock";
import type { TimeOfDay } from "../../core/restBlock";
import { defaultStore } from "../../storage/defaultStore";
import { loadPolicyState, savePolicyState } from "../../supervisor/policyRepository";
import { Banner } from "../../components/Banner";
import { PrimaryButton } from "../../components/PrimaryButton";

// Principio 7 de la constitución: nunca Date.now() directo, siempre un
// Clock inyectable (aquí, el real: no hay reloj falso que inyectar en una
// pantalla real).
const clock = createSystemClock();

function formatTime(time: TimeOfDay): string {
  return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return formatTime({ hour: date.getHours(), minute: date.getMinutes() });
}

function formatDuration(durationMin: number): string {
  const hours = Math.floor(durationMin / 60);
  const minutes = durationMin % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

function pickTime(current: TimeOfDay, onPicked: (time: TimeOfDay) => void): void {
  const value = new Date();
  value.setHours(current.hour, current.minute, 0, 0);
  DateTimePickerAndroid.open({
    value,
    mode: "time",
    is24Hour: true,
    // onChange está obsoleto (comprobado en pantalla, T58): la librería
    // recomienda onValueChange en su lugar.
    onValueChange: (_event, date) => {
      onPicked({ hour: date.getHours(), minute: date.getMinutes() });
    },
  });
}

// T71 (Fase 7, sistema "Mindful Calm"): mismo comportamiento de siempre
// (RF-17, RF-20, RF-32), solo cambia la presentación. Sin los chips de
// ajuste fino (±15/30 min) ni la barra de progreso decorativa del mock de
// Stitch: no hay funcionalidad real detrás, y el paso ya lo decide el
// selector nativo de hora.
export default function Schedule() {
  const [restBlock, setRestBlock] = useState(() => loadPolicyState(defaultStore).restBlock);
  const [start, setStart] = useState<TimeOfDay>({ hour: 21, minute: 0 });
  const [end, setEnd] = useState<TimeOfDay>({ hour: 6, minute: 0 });

  // T93 (Fase 8, Plan D20): igual que T91/T92 — esta pestaña ya no se
  // desmonta al cambiar de pestaña, así que la vuelve a leer de storage por
  // foco (por si el bloqueo terminó o se canceló mientras se estaba en otra
  // pestaña).
  useFocusEffect(
    useCallback(() => {
      setRestBlock(loadPolicyState(defaultStore).restBlock);
    }, [])
  );

  const status = restBlock ? getRestBlockStatus(restBlock, clock.now()) : null;

  if (restBlock && (status === "scheduled" || status === "active")) {
    const durationMin = Math.round((restBlock.endAt - restBlock.startAt) / 60_000);
    return (
      <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface dark:bg-surface-dark">
        <ScrollView
          contentContainerClassName="gap-6 bg-surface p-6 dark:bg-surface-dark"
          className="bg-surface dark:bg-surface-dark"
        >
          <View className="gap-2">
            <Text className="font-headline-lg text-headline-lg font-bold text-on-surface dark:text-on-surface-dark">
              Bloqueo horario
            </Text>
          </View>
          <Banner
            tone={status === "active" ? "locked" : "pending"}
            title={status === "active" ? "Bloqueo horario activo" : "Bloqueo horario programado"}
            description={
              status === "active"
                ? `Activo ahora mismo, hasta las ${formatTimestamp(restBlock.endAt)}.`
                : `Programado de ${formatTimestamp(restBlock.startAt)} a ${formatTimestamp(restBlock.endAt)}.`
            }
          />
          <View className="gap-1 rounded-3xl bg-surface-container p-6 shadow-sm dark:bg-surface-container-dark">
            <Text className="font-headline-sm text-headline-sm font-semibold text-on-surface dark:text-on-surface-dark">
              Resumen
            </Text>
            <Text className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant-dark">
              De {formatTimestamp(restBlock.startAt)} a {formatTimestamp(restBlock.endAt)}
            </Text>
            <Text className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant-dark">
              Duración: {formatDuration(durationMin)}
            </Text>
          </View>
          {status === "scheduled" && (
            <Pressable
              onPress={() => {
                const updated = cancelRestBlock(restBlock, clock.now());
                savePolicyState(defaultStore, { ...loadPolicyState(defaultStore), restBlock: updated });
                setRestBlock(updated);
              }}
              className="h-[52px] items-center justify-center rounded-2xl bg-surface-container-high active:opacity-80 dark:bg-surface-container-high-dark"
            >
              <Text className="font-label-lg text-label-lg text-on-surface dark:text-on-surface-dark">
                Cancelar
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const durationMin = getRestBlockDurationMin(start, end);
  const isValid = isValidRestBlockRange(start, end);

  const confirm = () => {
    const created = confirmRestBlock(start, end, clock.now());
    savePolicyState(defaultStore, { ...loadPolicyState(defaultStore), restBlock: created });
    setRestBlock(created);
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface dark:bg-surface-dark">
      <ScrollView
        contentContainerClassName="gap-6 bg-surface p-6 dark:bg-surface-dark"
        className="bg-surface dark:bg-surface-dark"
      >
        <View className="gap-2">
          <Text className="font-headline-lg text-headline-lg font-bold text-on-surface dark:text-on-surface-dark">
            Bloqueo horario
          </Text>
          <Text className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant-dark">
            Elige una franja del día en la que las apps restringidas quedan bloqueadas sin reto,
            hasta 12 horas seguidas.
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
            <Text className="font-label-md text-label-md font-bold text-error dark:text-error-dark">
              Una vez que empiece, no hay marcha atrás.
            </Text>
          </View>
        ) : (
          <View className="gap-1 rounded-2xl bg-error-container/40 p-3 dark:bg-error-container-dark/40">
            <Text className="font-label-sm text-label-sm font-medium text-error dark:text-error-dark">
              El rango debe durar más de 0 minutos y no más de 12 horas.
            </Text>
          </View>
        )}

        <PrimaryButton title="Confirmar" onPress={confirm} disabled={!isValid} />
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
