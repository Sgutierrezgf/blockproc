import { Text, View } from "react-native";

// T67 (Fase 7, sistema "Mindful Calm"): unifica los avisos de bloqueo
// horario activo (rojo), cambios pendientes (azul) y la nota de batería
// (ámbar) que antes eran cajas de color sueltas en personalization.tsx/apps.tsx.
// Los tonos "pending" y "battery" usan roles "-fixed" de Material You
// (iguales en claro y oscuro por diseño, ver tailwind.config.js); "locked"
// sí varía entre temas, así que lleva `dark:`.
export type BannerTone = "locked" | "pending" | "battery";

export interface BannerProps {
  tone: BannerTone;
  title: string;
  description: string;
}

const CONTAINER_BY_TONE: Record<BannerTone, string> = {
  locked: "bg-error-container/70 dark:bg-error-container-dark/70 rounded-2xl",
  pending: "bg-primary-fixed/40 rounded-2xl",
  battery: "bg-tertiary-fixed rounded-3xl",
};

const TITLE_BY_TONE: Record<BannerTone, string> = {
  locked: "text-on-error-container dark:text-on-error-container-dark font-headline-sm text-headline-sm",
  pending: "text-on-primary-fixed font-headline-sm text-headline-sm",
  battery: "text-on-tertiary-fixed font-label-lg text-label-lg font-bold",
};

const DESCRIPTION_BY_TONE: Record<BannerTone, string> = {
  locked: "text-on-error-container/90 dark:text-on-error-container-dark/90 font-body-sm text-body-sm",
  pending: "text-on-surface-variant dark:text-on-surface-variant-dark font-body-sm text-body-sm",
  battery: "text-on-tertiary-fixed font-body-sm text-body-sm",
};

export function Banner({ tone, title, description }: BannerProps) {
  return (
    <View className={`gap-1 p-4 ${CONTAINER_BY_TONE[tone]}`}>
      <Text className={TITLE_BY_TONE[tone]}>{title}</Text>
      <Text className={DESCRIPTION_BY_TONE[tone]}>{description}</Text>
    </View>
  );
}
