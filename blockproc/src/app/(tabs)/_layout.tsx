import { Tabs } from "expo-router";
import { Text, useColorScheme } from "react-native";

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

// T90 (Fase 8, Plan D20): agrupa Ajustes/Apps/Bloqueo horario bajo una barra
// de pestañas real. El grupo "(tabs)" no cambia la URL de sus rutas
// (settings.tsx sigue resolviendo a "/settings"), así que index.tsx no
// necesita tocarse. Sin header propio: cada pantalla ya trae su título.
export default function TabsLayout() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";

  return (
    <Tabs
      // T94 (Plan D20): Atrás desde Apps/Bloqueo horario vuelve primero a
      // Ajustes (la primera pestaña, registrada arriba); "firstRoute" ya es
      // el valor por defecto de React Navigation, se deja explícito para que
      // la decisión no dependa de un default que la librería podría cambiar.
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
          title: "Ajustes",
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⚙</Text>,
        }}
      />
      <Tabs.Screen
        name="apps"
        options={{
          title: "Apps",
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>▦</Text>,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Bloqueo horario",
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>◷</Text>,
        }}
      />
    </Tabs>
  );
}
