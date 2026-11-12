import { Tabs } from "expo-router";
import { Text, useColorScheme } from "react-native";

import { useStrings } from "../../i18n/LanguageProvider";

// Mismos valores que "primary"/"on-surface-variant" en tailwind.config.js:
// tabBarActiveTintColor/tabBarInactiveTintColor son props de estilo puro
// (React Navigation), no admiten className de NativeWind, así que el claro/
// oscuro se resuelve a mano aquí con useColorScheme.
const TINT = {
  active: { light: "#208aef", dark: "#8fc4f6" },
  inactive: { light: "#404753", dark: "#c4c9d4" },
};
const TAB_BAR_BG = { light: "#ebeef6", dark: "#181c22" };
const TAB_BAR_BORDER = { light: "#c0c7d5", dark: "#3f4550" };

// Fase 10 (rediseño, T138): "Apps" y "Bloqueo horario" desaparecen como
// pestañas propias (D32): la selección de apps pasa a ser el paso 1 del
// asistente de creación de un bloqueo, y el "Bloqueo horario" único deja de
// existir, reemplazado por la lista de bloqueos. Quedan Personalización
// (antes "Ajustes") y Bloqueos.
// Fase 11 (RF-76, RF-79, C42): se suma una 3ra pestaña "Ajustes" (idioma +
// Acerca de), distinta de Personalización — el ícono de engranaje pasa a
// esta pestaña nueva, más intuitivo acá que en Personalización.
export default function TabsLayout() {
  const strings = useStrings();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";

  return (
    <Tabs
      backBehavior="firstRoute"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: TINT.active[scheme],
        tabBarInactiveTintColor: TINT.inactive[scheme],
        tabBarStyle: {
          backgroundColor: TAB_BAR_BG[scheme],
          borderTopColor: TAB_BAR_BORDER[scheme],
        },
      }}
    >
      <Tabs.Screen
        name="settings"
        options={{
          title: strings.personalization.title,
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>✎</Text>,
        }}
      />
      <Tabs.Screen
        name="blocks"
        options={{
          title: strings.blocks.title,
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>◷</Text>,
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: strings.appSettings.title,
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⚙</Text>,
        }}
      />
    </Tabs>
  );
}
