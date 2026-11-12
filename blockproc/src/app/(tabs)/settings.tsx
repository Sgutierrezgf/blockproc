import { useState } from "react";
import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BLOCK_MESSAGE_MAX_LENGTH, FOCUS_MESSAGE_MAX_LENGTH, isValidMessage } from "../../core/config";
import { useStrings } from "../../i18n/LanguageProvider";
import { loadConfig, saveConfig } from "../../storage/appRepository";
import { defaultStore } from "../../storage/defaultStore";
import { Banner } from "../../components/Banner";
import { Field } from "../../components/Field";
import { PrimaryButton } from "../../components/PrimaryButton";

interface FieldErrors {
  defaultFocusMessage?: string;
  defaultBlockMessage?: string;
}

// Fase 10 (rediseño): Personalización (antes "Ajustes") queda reducida a los
// mensajes por defecto que prellenan cada bloqueo nuevo (RF-70) y la nota de
// batería (RF-44). Se puede editar siempre, sin ningún bloqueo de edición
// global (D35): cambiar el default acá nunca afecta a un bloqueo ya creado
// (sus mensajes quedan congelados desde que se creó, RF-62).
export default function Settings() {
  const strings = useStrings().personalization;
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
      nextErrors.defaultFocusMessage = strings.maxCharactersError(FOCUS_MESSAGE_MAX_LENGTH);
    }

    if (isValidMessage(blockMessageText, BLOCK_MESSAGE_MAX_LENGTH)) {
      updated.defaultBlockMessage = blockMessageText;
    } else {
      nextErrors.defaultBlockMessage = strings.maxCharactersError(BLOCK_MESSAGE_MAX_LENGTH);
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
            {strings.title}
          </Text>
          <Text className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant-dark">
            {strings.subtitle}
          </Text>
        </View>

        <Field
          label={strings.focusMessageLabel(FOCUS_MESSAGE_MAX_LENGTH)}
          value={focusMessageText}
          onChangeText={setFocusMessageText}
          error={errors.defaultFocusMessage}
          multiline
        />
        <Field
          label={strings.blockMessageLabel(BLOCK_MESSAGE_MAX_LENGTH)}
          value={blockMessageText}
          onChangeText={setBlockMessageText}
          error={errors.defaultBlockMessage}
          multiline
        />

        <PrimaryButton title={strings.saveButton} onPress={save} />

        {/* Nunca en una build release: __DEV__ es false ahí (ver dev.tsx). */}
        {__DEV__ && (
          <Link href="/dev" asChild>
            <Pressable className="flex-row items-center justify-between rounded-2xl bg-surface-container p-3 active:bg-surface-container-high dark:bg-surface-container-dark dark:active:bg-surface-container-high-dark">
              <Text className="font-body-lg text-body-lg text-on-surface dark:text-on-surface-dark">
                {strings.devToolsLink}
              </Text>
              <Text className="font-body-lg text-body-lg text-on-surface-variant dark:text-on-surface-variant-dark">
                ›
              </Text>
            </Pressable>
          </Link>
        )}

        {/* RF-44: nota fija, siempre visible. */}
        <Banner tone="battery" title={strings.batteryTitle} description={strings.batteryDescription} />
      </ScrollView>
    </SafeAreaView>
  );
}
