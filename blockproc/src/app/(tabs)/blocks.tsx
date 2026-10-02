import { useCallback, useState } from "react";
import { Link, router, useFocusEffect } from "expo-router";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getBlockStatus, removeEndedBlocks } from "../../core/blocks";
import type { Block } from "../../core/blocks";
import { createSystemClock } from "../../core/clock";
import { defaultStore } from "../../storage/defaultStore";
import { loadPolicyState, savePolicyState } from "../../supervisor/policyRepository";

const clock = createSystemClock();

function formatTime(ts: number): string {
  const date = new Date(ts);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// RF-55: lista de bloqueos "programados" o "activos" — los terminados se
// quitan solos, sin dejar constancia (D33). Botón "+" abre el asistente de
// creación (create-block.tsx). Un bloqueo programado se puede editar o
// borrar (RF-61); uno activo no ofrece ninguna de las dos (RF-62).
export default function Blocks() {
  const [blocks, setBlocks] = useState<Block[]>(() => loadPolicyState(defaultStore).blocks);

  const refresh = useCallback(() => {
    const now = clock.now();
    const policyState = loadPolicyState(defaultStore);
    const cleaned = removeEndedBlocks(policyState.blocks, now);
    if (cleaned.length !== policyState.blocks.length) {
      savePolicyState(defaultStore, { ...policyState, blocks: cleaned });
    }
    setBlocks(cleaned);
  }, []);

  useFocusEffect(refresh);

  const deleteBlock = (block: Block) => {
    Alert.alert("Borrar bloqueo", "¿Seguro que querés borrar este bloqueo programado?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: () => {
          const policyState = loadPolicyState(defaultStore);
          savePolicyState(defaultStore, {
            ...policyState,
            blocks: policyState.blocks.filter((b) => b.id !== block.id),
          });
          refresh();
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface dark:bg-surface-dark">
      <FlatList
        className="bg-surface dark:bg-surface-dark"
        contentContainerClassName="gap-3 bg-surface p-6 dark:bg-surface-dark"
        data={blocks}
        keyExtractor={(block) => block.id}
        ListHeaderComponent={
          <View className="mb-2 gap-2">
            <Text className="font-headline-lg text-headline-lg font-bold text-on-surface dark:text-on-surface-dark">
              Bloqueos
            </Text>
            <Text className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant-dark">
              Creá un bloqueo para las apps que querés limitar, por un tiempo o en una franja horaria.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant-dark">
            No tenés ningún bloqueo programado ni activo todavía.
          </Text>
        }
        renderItem={({ item }) => {
          const status = getBlockStatus(item, clock.now());
          const isActive = status === "active";
          return (
            <View className="gap-2 rounded-3xl bg-surface-container p-4 shadow-sm dark:bg-surface-container-dark">
              <View className="flex-row items-center justify-between">
                <Text className="font-headline-sm text-headline-sm font-semibold text-on-surface dark:text-on-surface-dark">
                  {item.packages.length} app{item.packages.length === 1 ? "" : "s"}
                </Text>
                <View
                  className={`rounded-full px-3 py-1 ${isActive ? "bg-error-container dark:bg-error-container-dark" : "bg-primary-fixed"}`}
                >
                  <Text
                    className={`font-label-sm text-label-sm font-semibold ${isActive ? "text-on-error-container dark:text-on-error-container-dark" : "text-on-primary-fixed"}`}
                  >
                    {isActive ? "Activo" : "Programado"}
                  </Text>
                </View>
              </View>
              <Text className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant-dark">
                {isActive ? "Hasta las" : "Empieza a las"} {isActive ? formatTime(item.endAt) : formatTime(item.startAt)}
              </Text>
              {!isActive && (
                <View className="flex-row gap-3">
                  <Pressable
                    onPress={() => router.push({ pathname: "/create-block", params: { editingId: item.id } })}
                    className="flex-1 items-center rounded-2xl bg-surface-container-high p-3 dark:bg-surface-container-high-dark"
                  >
                    <Text className="font-label-md text-label-md text-on-surface dark:text-on-surface-dark">Editar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => deleteBlock(item)}
                    className="flex-1 items-center rounded-2xl bg-surface-container-high p-3 dark:bg-surface-container-high-dark"
                  >
                    <Text className="font-label-md text-label-md text-error dark:text-error-dark">Borrar</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
      />
      <Link href="/create-block" asChild>
        <Pressable className="absolute bottom-6 right-6 h-16 w-16 items-center justify-center rounded-full bg-primary shadow-lg dark:bg-primary-dark">
          <Text className="text-3xl text-on-primary dark:text-on-primary-dark">+</Text>
        </Pressable>
      </Link>
    </SafeAreaView>
  );
}
