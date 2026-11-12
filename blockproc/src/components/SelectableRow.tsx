import { Image, Pressable, Text, View } from "react-native";

// T67 (Fase 7, sistema "Mindful Calm"): reemplaza los `AreaRow`/`AppRow`
// casi idénticos que había en personalization.tsx y apps.tsx. Sin lógica de
// negocio: solo recibe el estado y avisa del toque.
// T85 (Fase 8): `iconUri` es opcional a propósito — `apps.tsx` siempre lo
// pasa (string o null, RF-48), así que todas sus filas reservan el mismo
// espacio para el ícono (o su reemplazo) y quedan alineadas entre sí;
// `personalization.tsx` (áreas de preguntas) nunca lo pasa, y sigue exactamente
// igual que antes, sin espacio de ícono.
// C44 (Fase 12): `variant="radio"` para las elecciones de opción única
// (categoría de preguntas, idioma); la casilla queda para selección múltiple.
export interface SelectableRowProps {
  label: string;
  checked: boolean;
  onPress: () => void;
  disabled?: boolean;
  iconUri?: string | null;
  variant?: "checkbox" | "radio";
}

export function SelectableRow({ label, checked, onPress, disabled, iconUri, variant = "checkbox" }: SelectableRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={variant}
      accessibilityState={{ checked, disabled }}
      className={`flex-row items-center justify-between gap-3 rounded-xl bg-surface-container p-4 shadow-sm dark:bg-surface-container-dark ${disabled ? "opacity-50" : ""}`}
    >
      {iconUri !== undefined && (
        <View className="h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-surface-container-high dark:bg-surface-container-high-dark">
          {iconUri && <Image source={{ uri: iconUri }} className="h-8 w-8" resizeMode="cover" />}
        </View>
      )}
      <Text className="flex-1 font-body-lg text-body-lg text-on-surface dark:text-on-surface-dark">
        {label}
      </Text>
      {variant === "radio" ? (
        <View
          className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
            checked ? "border-primary dark:border-primary-dark" : "border-outline dark:border-outline-dark"
          }`}
        >
          {checked && <View className="h-3 w-3 rounded-full bg-primary dark:bg-primary-dark" />}
        </View>
      ) : (
        <View
          className={`h-7 w-7 items-center justify-center rounded-lg ${
            checked
              ? "bg-primary-container dark:bg-primary-container-dark"
              : "bg-surface-container-high dark:bg-surface-container-high-dark"
          }`}
        >
          {checked && (
            <Text className="font-label-md text-label-md font-bold text-on-primary-container dark:text-on-primary-container-dark">
              ✓
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}
