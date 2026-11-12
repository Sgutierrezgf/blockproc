import Constants from "expo-constants";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useLanguage, useStrings } from "../../i18n/LanguageProvider";
import { SelectableRow } from "../../components/SelectableRow";

// Fase 11 (RF-76, RF-78, RF-79): pantalla nueva, distinta de Personalización
// (que sigue con los mensajes por defecto + nota de batería, sin cambios).
// Selector de idioma (aplica al instante, D38/D39) y "Acerca de" (nombre +
// versión, leídos de app.json vía expo-constants, sin dependencia nueva).
export default function AppSettings() {
  const strings = useStrings().appSettings;
  const { language, setLanguage } = useLanguage();
  const appName = Constants.expoConfig?.name ?? "blockproc";
  const appVersion = Constants.expoConfig?.version ?? "";

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface dark:bg-surface-dark">
      <ScrollView
        contentContainerClassName="gap-4 bg-surface p-6 dark:bg-surface-dark"
        className="bg-surface dark:bg-surface-dark"
      >
        <Text className="font-headline-lg text-headline-lg font-bold text-on-surface dark:text-on-surface-dark">
          {strings.title}
        </Text>

        <View className="gap-2">
          <Text className="font-label-md text-label-md font-semibold text-on-surface-variant dark:text-on-surface-variant-dark">
            {strings.languageSectionTitle}
          </Text>
          <SelectableRow
            label={strings.languageSpanish}
            checked={language === "es"}
            onPress={() => setLanguage("es")}
          />
          <SelectableRow
            label={strings.languageEnglish}
            checked={language === "en"}
            onPress={() => setLanguage("en")}
          />
        </View>

        <View className="gap-1 rounded-2xl bg-surface-container-low p-4 dark:bg-surface-container-low-dark">
          <Text className="font-label-md text-label-md font-semibold text-on-surface dark:text-on-surface-dark">
            {strings.aboutSectionTitle}
          </Text>
          <Text className="font-body-sm text-body-sm text-on-surface-variant dark:text-on-surface-variant-dark">
            {appName}
          </Text>
          <Text className="font-body-sm text-body-sm text-on-surface-variant dark:text-on-surface-variant-dark">
            {strings.versionLabel(appVersion)}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
