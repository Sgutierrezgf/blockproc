import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getBlockStatus } from "../core/blocks";
import { createSystemClock } from "../core/clock";
import { useStrings } from "../i18n/LanguageProvider";
import { defaultStore } from "../storage/defaultStore";
import { loadPolicyState } from "../supervisor/policyRepository";
import { AppNameList } from "../components/AppNameList";
import { BackButton } from "../components/BackButton";

const clock = createSystemClock();

function formatTime(ts: number): string {
  const date = new Date(ts);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDuration(ms: number): string {
  const totalMin = Math.max(1, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

// RF-82, D45: detalle de solo lectura de un bloqueo, abierto al tocar su
// tarjeta en la lista. A propósito no ofrece ninguna acción sobre el bloqueo
// (RF-62, RF-74, C47): editar y borrar uno programado siguen en la lista.
export default function BlockDetail() {
  const strings = useStrings();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [now, setNow] = useState(() => clock.now());

  // El tiempo restante se refresca solo; si el bloqueo termina con el
  // detalle abierto, pasa a "ya terminó" (caso límite de RF-82).
  useEffect(() => {
    const timer = setInterval(() => setNow(clock.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const block = loadPolicyState(defaultStore).blocks.find((b) => b.id === id);
  const status = block ? getBlockStatus(block, now) : "ended";

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface dark:bg-surface-dark">
      <ScrollView contentContainerClassName="gap-4 bg-surface p-6 dark:bg-surface-dark">
        <View className="flex-row items-center gap-2">
          <BackButton />
          <Text className="font-headline-lg text-headline-lg font-bold text-on-surface dark:text-on-surface-dark">
            {strings.blockDetail.title}
          </Text>
        </View>

        {!block || status === "ended" ? (
          <>
            <Text className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant-dark">
              {strings.blockDetail.notFound}
            </Text>
            <Pressable onPress={() => router.back()} className="items-center p-3">
              <Text className="font-label-lg text-label-lg text-on-surface-variant dark:text-on-surface-variant-dark">
                {strings.blockDetail.back}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <View className="flex-row flex-wrap gap-2">
              {block.extreme && (
                <View className="rounded-full bg-error px-3 py-1 dark:bg-error-dark">
                  <Text className="font-label-sm text-label-sm font-semibold text-on-error dark:text-on-error-dark">
                    {strings.blocks.extremeBadge}
                  </Text>
                </View>
              )}
              <View
                className={`rounded-full px-3 py-1 ${status === "active" ? "bg-error-container dark:bg-error-container-dark" : "bg-primary-fixed"}`}
              >
                <Text
                  className={`font-label-sm text-label-sm font-semibold ${status === "active" ? "text-on-error-container dark:text-on-error-container-dark" : "text-on-primary-fixed"}`}
                >
                  {status === "active" ? strings.blocks.activeBadge : strings.blocks.scheduledBadge}
                </Text>
              </View>
            </View>

            <View className="gap-1 rounded-3xl bg-surface-container p-4 dark:bg-surface-container-dark">
              <Text className="font-body-md text-body-md text-on-surface dark:text-on-surface-dark">
                {strings.createBlock.typeLabel(
                  block.type === "duration"
                    ? strings.createBlock.durationTypeLabel
                    : strings.createBlock.scheduledTypeLabel
                )}
              </Text>
              <Text className="font-body-md text-body-md text-on-surface dark:text-on-surface-dark">
                {strings.blockDetail.startLabel(formatTime(block.startAt))}
              </Text>
              <Text className="font-body-md text-body-md text-on-surface dark:text-on-surface-dark">
                {strings.blockDetail.endLabel(formatTime(block.endAt))}
              </Text>
              {status === "active" && (
                <Text className="font-body-md text-body-md font-semibold text-on-surface dark:text-on-surface-dark">
                  {strings.blockDetail.remaining(formatDuration(block.endAt - now))}
                </Text>
              )}
              {block.extreme ? (
                <Text className="font-body-md text-body-md font-bold text-error dark:text-error-dark">
                  {strings.createBlock.extremeModeLabel}
                </Text>
              ) : (
                <Text className="font-body-md text-body-md text-on-surface dark:text-on-surface-dark">
                  {strings.createBlock.categoryLabel(strings.createBlock.areaLabels[block.category])}
                </Text>
              )}
            </View>

            <View className="gap-2 rounded-3xl bg-surface-container p-4 dark:bg-surface-container-dark">
              <Text className="font-label-md text-label-md font-semibold text-on-surface dark:text-on-surface-dark">
                {strings.createBlock.appsSelected(block.packages.length)}
              </Text>
              <AppNameList packages={block.packages} />
            </View>

            <View className="gap-1 rounded-3xl bg-surface-container p-4 dark:bg-surface-container-dark">
              <Text className="font-label-md text-label-md font-semibold text-on-surface dark:text-on-surface-dark">
                {strings.blockDetail.focusMessageTitle}
              </Text>
              <Text className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant-dark">
                {block.focusMessage}
              </Text>
              <Text className="mt-2 font-label-md text-label-md font-semibold text-on-surface dark:text-on-surface-dark">
                {strings.blockDetail.blockMessageTitle}
              </Text>
              <Text className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant-dark">
                {block.blockMessage}
              </Text>
            </View>

            {status === "active" && (
              <Text className="font-body-sm text-body-sm text-on-surface-variant dark:text-on-surface-variant-dark">
                {strings.blockDetail.activeReadOnlyNote}
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
