import { useCallback, useState } from "react";
import { Link, useFocusEffect } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  ACCESS_WINDOW_MAX,
  ACCESS_WINDOW_MIN,
  AREAS,
  DAILY_LIMIT_MAX,
  DAILY_LIMIT_MIN,
  DAILY_LIMIT_STEP,
  DEFAULT_FOCUS_MESSAGE,
  DEFAULT_REST_BLOCK_MESSAGE,
  FOCUS_MESSAGE_MAX_LENGTH,
  REST_BLOCK_MESSAGE_MAX_LENGTH,
  isValidAccessWindowMin,
  isValidDailyLimitMin,
  isValidMessage,
  isValidQuestionCount,
  toggleArea,
  QUESTION_COUNT_MAX,
  QUESTION_COUNT_MIN,
} from "../../core/config";
import { createSystemClock } from "../../core/clock";
import type { Config } from "../../core/config";
import type { PendingConfig } from "../../core/configUpdate";
import type { Area } from "../../core/types";
import { applyAndSaveConfig, readCurrentConfigState } from "../../settings/applyAndSaveConfig";
import { defaultStore } from "../../storage/defaultStore";
import { Banner } from "../../components/Banner";
import { Field } from "../../components/Field";
import { PrimaryButton } from "../../components/PrimaryButton";
import { SelectableRow } from "../../components/SelectableRow";

interface FieldErrors {
  dailyLimitMin?: string;
  questionCount?: string;
  accessWindowMin?: string;
  focusMessage?: string;
  restBlockMessage?: string;
}

// RF-5: etiquetas en español de las áreas conocidas por el core (config.ts).
const AREA_LABELS: Record<Area, string> = {
  general: "Conocimiento general",
  technology: "Tecnología",
  health: "Salud y bienestar",
  science: "Ciencia y naturaleza",
  math: "Matemática y lógica",
};

// RF-29: describe, en español, qué campos quedaron pendientes hasta las
// 04:00 siguientes (comparando contra la configuración vigente ahora mismo).
function describePendingChanges(config: Config, pending: PendingConfig): string {
  const partes: string[] = [];
  if (pending.config.dailyLimitMin !== config.dailyLimitMin) {
    partes.push(`límite diario a ${pending.config.dailyLimitMin} min`);
  }
  if (pending.config.questionCount !== config.questionCount) {
    partes.push(`preguntas por reto a ${pending.config.questionCount}`);
  }
  if (pending.config.accessWindowMin !== config.accessWindowMin) {
    partes.push(`ventana de acceso a ${pending.config.accessWindowMin} min`);
  }
  const cambioDeApps =
    pending.config.restrictedPackages.length !== config.restrictedPackages.length ||
    pending.config.restrictedPackages.some((pkg) => !config.restrictedPackages.includes(pkg));
  if (cambioDeApps) {
    partes.push("apps restringidas");
  }
  return partes.length > 0 ? partes.join(", ") : "cambios pendientes";
}

// RF-2 a RF-6, RF-19, RF-29, RF-35, RF-44 (T55-T57): toda la configuración
// global, validada por el core antes de guardar (fase 2) y aplicada según
// haya o no una app bloqueada por límite diario y un bloqueo horario activo
// (applyAndSaveConfig, T57): lo que endurece o es neutral (áreas, mensajes)
// se aplica ya; lo que relaja queda pendiente hasta las 04:00; con el
// bloqueo horario activo no se permite editar nada.
// Principio 7 de la constitución: nunca Date.now() directo, siempre un
// Clock inyectable (aquí, el real: no hay reloj falso que inyectar en una
// pantalla real).
const clock = createSystemClock();

// T69 (Fase 7, sistema "Mindful Calm"): mismo comportamiento de siempre
// (RF-2 a RF-6, RF-19, RF-29, RF-35, RF-44), solo cambia la presentación:
// `Field`/`SelectableRow`/`Banner`/`PrimaryButton` en vez de los campos y
// cajas de color sueltas de antes.
export default function Settings() {
  const [state, setState] = useState(() => readCurrentConfigState(defaultStore, clock.now()));
  const { config, pending, isEditingLocked } = state;

  // T91 (Fase 8, Plan D20): con pestañas, esta pantalla ya no se desmonta al
  // cambiar de pestaña (a diferencia del push/pop de antes), así que un
  // bloqueo horario activado desde la pestaña "Bloqueo horario" no se nota
  // solo. Vuelve a leer config/pending/bloqueo cada vez que esta pestaña
  // recibe el foco. No toca los campos de texto en edición (dailyLimitText,
  // etc.): ninguna otra pestaña modifica esos campos, solo restrictedPackages
  // (Apps) o el bloqueo horario (Bloqueo horario), ambos fuera de este
  // formulario.
  useFocusEffect(
    useCallback(() => {
      setState(readCurrentConfigState(defaultStore, clock.now()));
    }, [])
  );

  const [dailyLimitText, setDailyLimitText] = useState(() => String(config.dailyLimitMin));
  const [questionCountText, setQuestionCountText] = useState(() => String(config.questionCount));
  const [accessWindowText, setAccessWindowText] = useState(() => String(config.accessWindowMin));
  const [focusMessageText, setFocusMessageText] = useState(() => config.focusMessage);
  const [restBlockMessageText, setRestBlockMessageText] = useState(() => config.restBlockMessage);
  const [errors, setErrors] = useState<FieldErrors>({});

  const save = () => {
    const dailyLimitMin = Number(dailyLimitText);
    const questionCount = Number(questionCountText);
    const accessWindowMin = Number(accessWindowText);
    const nextErrors: FieldErrors = {};
    const updated: Config = { ...config };

    if (isValidDailyLimitMin(dailyLimitMin)) {
      updated.dailyLimitMin = dailyLimitMin;
    } else {
      nextErrors.dailyLimitMin = `Debe ser múltiplo de ${DAILY_LIMIT_STEP}, entre ${DAILY_LIMIT_MIN} y ${DAILY_LIMIT_MAX}.`;
    }

    if (isValidQuestionCount(questionCount)) {
      updated.questionCount = questionCount;
    } else {
      nextErrors.questionCount = `Debe ser un número entero entre ${QUESTION_COUNT_MIN} y ${QUESTION_COUNT_MAX}.`;
    }

    if (isValidAccessWindowMin(accessWindowMin)) {
      updated.accessWindowMin = accessWindowMin;
    } else {
      nextErrors.accessWindowMin = `Debe ser un número entero entre ${ACCESS_WINDOW_MIN} y ${ACCESS_WINDOW_MAX}.`;
    }

    if (isValidMessage(focusMessageText, FOCUS_MESSAGE_MAX_LENGTH)) {
      updated.focusMessage = focusMessageText.trim() === "" ? DEFAULT_FOCUS_MESSAGE : focusMessageText;
    } else {
      nextErrors.focusMessage = `Máximo ${FOCUS_MESSAGE_MAX_LENGTH} caracteres.`;
      // se deja el texto escrito tal cual, para que se pueda corregir (igual que los campos numéricos)
    }

    if (isValidMessage(restBlockMessageText, REST_BLOCK_MESSAGE_MAX_LENGTH)) {
      updated.restBlockMessage =
        restBlockMessageText.trim() === "" ? DEFAULT_REST_BLOCK_MESSAGE : restBlockMessageText;
    } else {
      nextErrors.restBlockMessage = `Máximo ${REST_BLOCK_MESSAGE_MAX_LENGTH} caracteres.`;
    }

    setErrors(nextErrors);
    const result = applyAndSaveConfig(defaultStore, config, updated, clock.now());
    setState(result);
    // Los mensajes solo se normalizan (vacío → por defecto) si eran válidos;
    // si no, el texto escrito se conserva en pantalla para poder corregirlo.
    if (!nextErrors.focusMessage) setFocusMessageText(result.config.focusMessage);
    if (!nextErrors.restBlockMessage) setRestBlockMessageText(result.config.restBlockMessage);
  };

  const onToggleArea = (area: Area) => {
    const updated = { ...config, areas: toggleArea(config.areas, area) };
    const result = applyAndSaveConfig(defaultStore, config, updated, clock.now());
    setState(result);
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface dark:bg-surface-dark">
      <ScrollView
        contentContainerClassName="gap-4 bg-surface p-6 dark:bg-surface-dark"
        className="bg-surface dark:bg-surface-dark"
      >
        <View className="gap-2">
          <Text className="font-headline-lg text-headline-lg font-bold text-on-surface dark:text-on-surface-dark">
            Ajustes
          </Text>
          <Text className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant-dark">
            Personaliza los límites con calma: los cambios se protegen de decisiones impulsivas.
          </Text>
        </View>

        {/* T79: reubicado desde el final de la pantalla — antes había que bajar
            todo el formulario para encontrarlo. */}
        <View className="gap-1 rounded-3xl bg-surface-container p-2 shadow-sm dark:bg-surface-container-dark">
          <NavLink href="/apps" label="Apps a restringir" />
          <NavLink href="/schedule" label="Bloqueo horario" />
          {/* Nunca en una build release: __DEV__ es false ahí (ver dev.tsx). */}
          {__DEV__ && <NavLink href="/dev" label="Herramientas de desarrollo" />}
        </View>

        {/* RF-19: mientras el bloqueo horario está activo, no se puede editar nada. */}
        {isEditingLocked && (
          <Banner
            tone="locked"
            title="Bloqueo horario activo"
            description="Hay un bloqueo horario activo: no se puede editar la configuración hasta que termine."
          />
        )}

        {/* RF-29: lo que quedó pendiente hasta las 04:00, mientras haya una app bloqueada. */}
        {pending && (
          <Banner
            tone="pending"
            title="Cambios pendientes hasta las 04:00"
            description={`${describePendingChanges(config, pending)}.`}
          />
        )}

        <Field
          label={`Límite diario, en minutos (de ${DAILY_LIMIT_MIN} a ${DAILY_LIMIT_MAX}, en pasos de ${DAILY_LIMIT_STEP})`}
          value={dailyLimitText}
          onChangeText={setDailyLimitText}
          error={errors.dailyLimitMin}
          disabled={isEditingLocked}
          step={DAILY_LIMIT_STEP}
        />
        <Field
          label={`Preguntas por reto (de ${QUESTION_COUNT_MIN} a ${QUESTION_COUNT_MAX})`}
          value={questionCountText}
          onChangeText={setQuestionCountText}
          error={errors.questionCount}
          disabled={isEditingLocked}
          step={1}
        />
        <Field
          label={`Ventana de acceso, en minutos (de ${ACCESS_WINDOW_MIN} a ${ACCESS_WINDOW_MAX})`}
          value={accessWindowText}
          onChangeText={setAccessWindowText}
          error={errors.accessWindowMin}
          disabled={isEditingLocked}
          step={1}
        />

        <View className="gap-2">
          <Text className="font-headline-sm text-headline-sm font-semibold text-on-surface dark:text-on-surface-dark">
            Áreas de las preguntas
          </Text>
          <View className="gap-2">
            {AREAS.map((area) => (
              <SelectableRow
                key={area}
                label={AREA_LABELS[area]}
                checked={config.areas.includes(area)}
                onPress={() => onToggleArea(area)}
                disabled={isEditingLocked}
              />
            ))}
          </View>
        </View>

        <Field
          label={`Mensaje de enfoque (hasta ${FOCUS_MESSAGE_MAX_LENGTH} caracteres; vacío usa el mensaje por defecto)`}
          value={focusMessageText}
          onChangeText={setFocusMessageText}
          error={errors.focusMessage}
          disabled={isEditingLocked}
          multiline
        />
        <Field
          label={`Mensaje del bloqueo horario (hasta ${REST_BLOCK_MESSAGE_MAX_LENGTH} caracteres; vacío usa el mensaje por defecto)`}
          value={restBlockMessageText}
          onChangeText={setRestBlockMessageText}
          error={errors.restBlockMessage}
          disabled={isEditingLocked}
          multiline
        />

        <PrimaryButton title="Guardar" onPress={save} disabled={isEditingLocked} />

        {/* RF-44: nota fija, siempre visible en los ajustes. */}
        <Banner
          tone="battery"
          title="Optimización de batería"
          description="Si el sistema cierra la app para ahorrar batería, el bloqueo puede dejar de funcionar."
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function NavLink({ href, label }: { href: "/apps" | "/schedule" | "/dev"; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable className="flex-row items-center justify-between rounded-2xl p-3 active:bg-surface-container-high dark:active:bg-surface-container-high-dark">
        <Text className="font-body-lg text-body-lg text-on-surface dark:text-on-surface-dark">{label}</Text>
        <Text className="font-body-lg text-body-lg text-on-surface-variant dark:text-on-surface-variant-dark">
          ›
        </Text>
      </Pressable>
    </Link>
  );
}
