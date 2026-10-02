import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { BackHandler, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";

import {
  computeDurationRange,
  computeScheduledRange,
  findOverlap,
  isValidBlockDuration,
} from "../core/blocks";
import type { Block, BlockType, TimeOfDay } from "../core/blocks";
import { createDefaultConfig, isValidMessage } from "../core/config";
import { createSystemClock } from "../core/clock";
import type { Area } from "../core/types";
import { loadConfig } from "../storage/appRepository";
import { defaultStore } from "../storage/defaultStore";
import { loadPolicyState, savePolicyState } from "../supervisor/policyRepository";
import { AppPicker } from "../components/AppPicker";
import { Banner } from "../components/Banner";
import { Field } from "../components/Field";
import { PrimaryButton } from "../components/PrimaryButton";
import { SelectableRow } from "../components/SelectableRow";

const clock = createSystemClock();

const AREA_LABELS: Record<Area, string> = {
  general: "Conocimiento general",
  technology: "Tecnología",
  health: "Salud y bienestar",
  science: "Ciencia y naturaleza",
  math: "Matemática y lógica",
};
const AREAS: Area[] = ["general", "technology", "health", "science", "math"];

type Step = "apps" | "type" | "category" | "messages" | "summary";

function formatTime(time: TimeOfDay): string {
  return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function pickTime(current: TimeOfDay, onPicked: (time: TimeOfDay) => void): void {
  const value = new Date();
  value.setHours(current.hour, current.minute, 0, 0);
  DateTimePickerAndroid.open({
    value,
    mode: "time",
    is24Hour: true,
    onValueChange: (_event, date) => {
      if (date) onPicked({ hour: date.getHours(), minute: date.getMinutes() });
    },
  });
}

function makeBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// RF-56 a RF-60 (T125 a T130): asistente de creación de un bloqueo, en 5
// pasos dentro de una sola pantalla (D32, mismo espíritu que D22/D30 — un
// estado local en vez de rutas nuevas por paso). El "editingId" (opcional,
// por query param) permite reusar el mismo asistente para editar un bloqueo
// programado (RF-61): se precarga con sus valores y, al confirmar, reemplaza
// en vez de agregar.
export default function CreateBlock() {
  const { editingId } = useLocalSearchParams<{ editingId?: string }>();
  const existing = editingId ? loadPolicyState(defaultStore).blocks.find((b) => b.id === editingId) : undefined;

  const defaultConfig = loadConfig(defaultStore) ?? createDefaultConfig();

  const [step, setStep] = useState<Step>("apps");
  const [selectedPackages, setSelectedPackages] = useState<string[]>(existing?.packages ?? []);
  const [blockType, setBlockType] = useState<BlockType>(existing?.type ?? "duration");
  const [durationHours, setDurationHours] = useState("0");
  const [durationMinutes, setDurationMinutes] = useState("45");
  const [scheduledStart, setScheduledStart] = useState<TimeOfDay>({ hour: 21, minute: 0 });
  const [scheduledEnd, setScheduledEnd] = useState<TimeOfDay>({ hour: 6, minute: 0 });
  const [category, setCategory] = useState<Area>(existing?.category ?? "general");
  const [focusMessage, setFocusMessage] = useState(existing?.focusMessage ?? defaultConfig.defaultFocusMessage);
  const [blockMessage, setBlockMessage] = useState(existing?.blockMessage ?? defaultConfig.defaultBlockMessage);
  const [durationError, setDurationError] = useState<string | null>(null);
  const [overlapError, setOverlapError] = useState<string | null>(null);

  const togglePackage = (packageName: string) => {
    setSelectedPackages((prev) =>
      prev.includes(packageName) ? prev.filter((p) => p !== packageName) : [...prev, packageName]
    );
  };

  const now = clock.now();
  const range =
    blockType === "duration"
      ? computeDurationRange(Number(durationHours) || 0, Number(durationMinutes) || 0, now)
      : computeScheduledRange(scheduledStart, scheduledEnd, now);

  const goToStep = (target: Step) => setStep(target);

  // El botón físico Atrás retrocede un paso del asistente, igual que el
  // enlace "Atrás" de cada paso; solo en el primer paso deja que la
  // navegación por defecto de Expo Router saque de la pantalla (vuelve a la
  // lista de bloqueos).
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      const previous: Partial<Record<Step, Step>> = {
        type: "apps",
        category: "type",
        messages: "category",
        summary: "messages",
      };
      const target = previous[step];
      if (target) {
        goToStep(target);
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [step]);

  const confirmType = () => {
    if (!isValidBlockDuration(range.startAt, range.endAt)) {
      setDurationError("El bloqueo debe durar más de 0 minutos y no más de 12 horas.");
      return;
    }
    setDurationError(null);
    goToStep("category");
  };

  const confirmCreate = () => {
    const policyState = loadPolicyState(defaultStore);
    const conflict = findOverlap(
      policyState.blocks,
      selectedPackages,
      range.startAt,
      range.endAt,
      now,
      existing?.id
    );
    if (conflict !== null) {
      setOverlapError(
        `Ya hay un bloqueo en esa franja para "${conflict.packageName}" (de ${formatTimestamp(conflict.block.startAt)} a ${formatTimestamp(conflict.block.endAt)}).`
      );
      return;
    }

    const block: Block = {
      id: existing?.id ?? makeBlockId(),
      packages: selectedPackages,
      type: blockType,
      startAt: range.startAt,
      endAt: range.endAt,
      category,
      focusMessage: isValidMessage(focusMessage) ? focusMessage : defaultConfig.defaultFocusMessage,
      blockMessage: isValidMessage(blockMessage) ? blockMessage : defaultConfig.defaultBlockMessage,
      warnedStart: false,
    };
    const otherBlocks = policyState.blocks.filter((b) => b.id !== block.id);
    savePolicyState(defaultStore, { ...policyState, blocks: [...otherBlocks, block] });
    router.replace("/blocks");
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface dark:bg-surface-dark">
      {step === "apps" && (
        <View className="flex-1">
          <AppPicker
            selected={selectedPackages}
            onToggle={togglePackage}
            headerTitle={existing ? "Editar bloqueo — Apps" : "Nuevo bloqueo — Apps"}
            headerDescription="Elegí qué apps querés incluir en este bloqueo."
          />
          <View className="p-6">
            <PrimaryButton title="Siguiente" onPress={() => goToStep("type")} disabled={selectedPackages.length === 0} />
          </View>
        </View>
      )}

      {step === "type" && (
        <ScrollView contentContainerClassName="gap-4 bg-surface p-6 dark:bg-surface-dark">
          <Text className="font-headline-lg text-headline-lg font-bold text-on-surface dark:text-on-surface-dark">
            Tipo de bloqueo
          </Text>

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setBlockType("duration")}
              className={`flex-1 items-center rounded-2xl p-4 ${blockType === "duration" ? "bg-primary-container dark:bg-primary-container-dark" : "bg-surface-container dark:bg-surface-container-dark"}`}
            >
              <Text className="font-label-lg text-label-lg text-on-surface dark:text-on-surface-dark">Por tiempo</Text>
            </Pressable>
            <Pressable
              onPress={() => setBlockType("scheduled")}
              className={`flex-1 items-center rounded-2xl p-4 ${blockType === "scheduled" ? "bg-primary-container dark:bg-primary-container-dark" : "bg-surface-container dark:bg-surface-container-dark"}`}
            >
              <Text className="font-label-lg text-label-lg text-on-surface dark:text-on-surface-dark">Programado</Text>
            </Pressable>
          </View>

          {blockType === "duration" ? (
            <View className="flex-row gap-3">
              <Field label="Horas" value={durationHours} onChangeText={setDurationHours} step={1} />
              <Field label="Minutos" value={durationMinutes} onChangeText={setDurationMinutes} step={5} />
            </View>
          ) : (
            <View className="flex-row gap-3">
              <TimeCard label="Desde" value={formatTime(scheduledStart)} onPress={() => pickTime(scheduledStart, setScheduledStart)} />
              <TimeCard label="Hasta" value={formatTime(scheduledEnd)} onPress={() => pickTime(scheduledEnd, setScheduledEnd)} />
            </View>
          )}

          <View className="gap-1 rounded-3xl bg-surface-container p-4 dark:bg-surface-container-dark">
            <Text className="font-label-md text-label-md font-semibold text-on-surface dark:text-on-surface-dark">
              Duración: {formatDuration(range.endAt - range.startAt)}
            </Text>
            <Text className="font-body-sm text-body-sm text-on-surface-variant dark:text-on-surface-variant-dark">
              Empieza a las {formatTimestamp(range.startAt)}.
            </Text>
          </View>

          {durationError && (
            <Banner tone="locked" title="Duración inválida" description={durationError} />
          )}

          <PrimaryButton title="Siguiente" onPress={confirmType} />
          <Pressable onPress={() => goToStep("apps")} className="items-center p-3">
            <Text className="font-label-lg text-label-lg text-on-surface-variant dark:text-on-surface-variant-dark">Atrás</Text>
          </Pressable>
        </ScrollView>
      )}

      {step === "category" && (
        <ScrollView contentContainerClassName="gap-3 bg-surface p-6 dark:bg-surface-dark">
          <Text className="font-headline-lg text-headline-lg font-bold text-on-surface dark:text-on-surface-dark">
            Categoría de preguntas
          </Text>
          <Text className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant-dark">
            Elegí de qué tema van a ser las preguntas para poder entrar a estas apps durante el bloqueo.
          </Text>
          {AREAS.map((area) => (
            <SelectableRow
              key={area}
              label={AREA_LABELS[area]}
              checked={category === area}
              onPress={() => setCategory(area)}
            />
          ))}
          <PrimaryButton title="Siguiente" onPress={() => goToStep("messages")} />
          <Pressable onPress={() => goToStep("type")} className="items-center p-3">
            <Text className="font-label-lg text-label-lg text-on-surface-variant dark:text-on-surface-variant-dark">Atrás</Text>
          </Pressable>
        </ScrollView>
      )}

      {step === "messages" && (
        <ScrollView contentContainerClassName="gap-4 bg-surface p-6 dark:bg-surface-dark">
          <Text className="font-headline-lg text-headline-lg font-bold text-on-surface dark:text-on-surface-dark">
            Mensajes
          </Text>
          <Field label="Mensaje de enfoque (hasta 120 caracteres)" value={focusMessage} onChangeText={setFocusMessage} multiline />
          <Field label="Mensaje del bloqueo (hasta 120 caracteres)" value={blockMessage} onChangeText={setBlockMessage} multiline />
          <PrimaryButton title="Siguiente" onPress={() => goToStep("summary")} />
          <Pressable onPress={() => goToStep("category")} className="items-center p-3">
            <Text className="font-label-lg text-label-lg text-on-surface-variant dark:text-on-surface-variant-dark">Atrás</Text>
          </Pressable>
        </ScrollView>
      )}

      {step === "summary" && (
        <ScrollView contentContainerClassName="gap-4 bg-surface p-6 dark:bg-surface-dark">
          <Text className="font-headline-lg text-headline-lg font-bold text-on-surface dark:text-on-surface-dark">
            Resumen
          </Text>
          <View className="gap-1 rounded-3xl bg-surface-container p-4 dark:bg-surface-container-dark">
            <Text className="font-body-md text-body-md text-on-surface dark:text-on-surface-dark">
              {selectedPackages.length} app{selectedPackages.length === 1 ? "" : "s"} seleccionada
              {selectedPackages.length === 1 ? "" : "s"}
            </Text>
            <Text className="font-body-md text-body-md text-on-surface dark:text-on-surface-dark">
              Tipo: {blockType === "duration" ? "Por tiempo" : "Programado"}
            </Text>
            <Text className="font-body-md text-body-md text-on-surface dark:text-on-surface-dark">
              Empieza a las {formatTimestamp(range.startAt)}, dura {formatDuration(range.endAt - range.startAt)}
            </Text>
            <Text className="font-body-md text-body-md text-on-surface dark:text-on-surface-dark">
              Categoría: {AREA_LABELS[category]}
            </Text>
          </View>

          <Banner
            tone="locked"
            title="Una vez creado, no se puede cancelar"
            description="Mientras el bloqueo esté activo vas a tener que responder preguntas para poder usar estas apps."
          />

          {overlapError && <Banner tone="locked" title="No se puede crear" description={overlapError} />}

          <PrimaryButton title={existing ? "Guardar cambios" : "Crear bloqueo"} onPress={confirmCreate} />
          <Pressable onPress={() => goToStep("messages")} className="items-center p-3">
            <Text className="font-label-lg text-label-lg text-on-surface-variant dark:text-on-surface-variant-dark">Atrás</Text>
          </Pressable>
        </ScrollView>
      )}
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
