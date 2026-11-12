import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";

import { LanguageProvider } from "../i18n/LanguageProvider";

// T66 (Fase 7): mantiene visible el splash nativo hasta que la fuente del
// sistema de diseño ("Mindful Calm") esté lista, para no mostrar un parpadeo
// con la tipografía del sistema y después cambiar a Plus Jakarta Sans.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  // T78 (Fase 7, corrección post-diagnóstico): el header nativo por defecto
  // (sin esta opción) mostraba el nombre de archivo de cada ruta como título
  // ("settings", "blocks"...) y, más grave, en las pantallas sin salida
  // (challenge/wait) exponía una flecha "atrás" táctil que llama a
  // navigation.goBack() sin pasar por el listener de hardwareBackPress que
  // esas pantallas usan para forzar goHome() (RF-62/66). Cada pantalla ya
  // trae su propio título y, donde hace falta, su propio BackButton.
  //
  // T151 (Fase 11): LanguageProvider envuelve todo el Stack, no solo el
  // grupo (tabs), para que challenge/wait/create-block (fuera de ese grupo,
  // abiertas por enlace profundo) también reaccionen al idioma elegido.
  return (
    <LanguageProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </LanguageProvider>
  );
}
