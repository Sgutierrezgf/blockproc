import { Pressable, Text } from "react-native";
import { router } from "expo-router";

// T78 (Fase 7, corrección post-diagnóstico): reemplaza la flecha del header
// nativo (quitado en _layout.tsx) en las pantallas que sí navegan hacia atrás
// (apps, schedule, dev). Las pantallas sin salida (challenge/wait/restblock)
// no usan este componente a propósito.
export interface BackButtonProps {
  onPress?: () => void;
}

export function BackButton({ onPress }: BackButtonProps) {
  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Volver"
      className="-ml-2 h-10 w-10 items-center justify-center rounded-full active:bg-surface-container dark:active:bg-surface-container-dark"
    >
      <Text className="font-headline-md text-headline-md text-on-surface dark:text-on-surface-dark">
        ‹
      </Text>
    </Pressable>
  );
}
