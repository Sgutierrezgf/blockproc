import { useState } from "react";
import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BLOCK_MESSAGE_MAX_LENGTH, FOCUS_MESSAGE_MAX_LENGTH, isValidMessage } from "../../core/config";
import { loadConfig, saveConfig } from "../../storage/appRepository";
import { defaultStore } from "../../storage/defaultStore";
import { Banner } from "../../components/Banner";
import { Field } from "../../components/Field";
import { PrimaryButton } from "../../components/PrimaryButton";

interface FieldErrors {
  defaultFocusMessage?: string;
  defaultBlockMessage?: string;
}

// Fase 10 (rediseño): Ajustes queda reducido a los mensajes por defecto que
// prellenan cada bloqueo nuevo (RF-70) y la nota de batería (RF-44). Se
// puede editar siempre, sin ningún bloqueo de edición global (D35): cambiar
// el default acá nunca afecta a un bloqueo ya creado (sus mensajes quedan
// congelados desde que se creó, RF-62).
export default function Settings() {
  const [config, setConfig] = useState(() => loadConfig(defaultStore));
  const [focusMessageText, setFocusMessageText] = useState(config.defaultFocusMessage);
  const [blockMessageText, setBlockMessageText] = useState(config.defaultBlockMessage);
  const [errors, setErrors] = useState<FieldErrors>({});

  const save = () => {
    const nextErrors: FieldErrors = {};
    const updated = { ...config };

    if (isValidMessage(focusMessageText, FOCUS_MESSAGE_MAX_LENGTH)) {
      updated.defaultFocusMessage = focusMessageText;
    } else {
      nextErrors.defaultFocusMessage = `Máximo ${FOCUS_MESSAGE_MAX_LENGTH} caracteres.`;
    }

    if (isValidMessage(blockMessageText, BLOCK_MESSAGE_MAX_LENGTH)) {
      updated.defaultBlockMessage = blockMessageText;
    } else {
      nextErrors.defaultBlockMessage = `Máximo ${BLOCK_MESSAGE_MAX_LENGTH} caracteres.`;
    }

    setErrors(nextErrors);
    saveConfig(defaultStore, updated);
    setConfig(updated);
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
            Estos mensajes se usan como punto de partida al crear un bloqueo nuevo — cada bloqueo puede tener los
            suyos propios.
          </Text>
        </View>

        <Field
          label={`Mensaje de enfoque por defecto (hasta ${FOCUS_MESSAGE_MAX_LENGTH} caracteres)`}
          value={focusMessageText}
          onChangeText={setFocusMessageText}
          error={errors.defaultFocusMessage}
          multiline
        />
        <Field
          label={`Mensaje de bloqueo por defecto (hasta ${BLOCK_MESSAGE_MAX_LENGTH} caracteres)`}
          value={blockMessageText}
          onChangeText={setBlockMessageText}
          error={errors.defaultBlockMessage}
          multiline
        />

        <PrimaryButton title="Guardar" onPress={save} />

        {/* Nunca en una build release: __DEV__ es false ahí (ver dev.tsx). */}
        {__DEV__ && (
          <Link href="/dev" asChild>
            <Pressable className="flex-row items-center justify-between rounded-2xl bg-surface-container p-3 active:bg-surface-container-high dark:bg-surface-container-dark dark:active:bg-surface-container-high-dark">
              <Text className="font-body-lg text-body-lg text-on-surface dark:text-on-surface-dark">
                Herramientas de desarrollo
              </Text>
              <Text className="font-body-lg text-body-lg text-on-surface-variant dark:text-on-surface-variant-dark">
                ›
              </Text>
            </Pressable>
          </Link>
        )}

        {/* RF-44: nota fija, siempre visible. */}
        <Banner
          tone="battery"
          title="Optimización de batería"
          description="Si el sistema cierra la app para ahorrar batería, el bloqueo puede dejar de funcionar."
        />
      </ScrollView>
    </SafeAreaView>
  );
}
