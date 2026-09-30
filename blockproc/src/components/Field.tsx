import { Pressable, Text, TextInput, View } from "react-native";

// T67 (Fase 7, sistema "Mindful Calm"): reemplaza `NumberField`/`MessageField`
// de settings.tsx. Sin lógica de negocio: la validación y el rango siguen en
// quien lo usa (core/config.ts); acá solo hay presentación y, si se pasa
// `step`, la aritmética simple de sumar/restar sobre el texto actual (nunca
// valida ni recorta al rango — eso lo decide, y lo muestra como error, quien
// llama, igual que ya pasaba con el TextInput simple).
export interface FieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  disabled?: boolean;
  /** Texto corto de ayuda (ej. "5 - 240 min"), al lado de la etiqueta. */
  hint?: string;
  /** Campo de varias líneas (mensajes), en vez del de una sola línea. */
  multiline?: boolean;
  /** Si se pasa, muestra los botones -/+ que suman/restan este valor. */
  step?: number;
}

export function Field({
  label,
  value,
  onChangeText,
  error,
  disabled,
  hint,
  multiline,
  step,
}: FieldProps) {
  const adjust = (delta: number) => {
    const next = (Number(value) || 0) + delta;
    onChangeText(String(next));
  };

  return (
    <View className="gap-3 rounded-3xl bg-surface-container p-4 shadow-sm dark:bg-surface-container-dark">
      <View className="flex-row items-center justify-between">
        <Text className="font-headline-sm text-headline-sm text-on-surface dark:text-on-surface-dark">
          {label}
        </Text>
        {hint && (
          <Text className="rounded-full bg-surface-container-high px-2.5 py-1 font-label-sm text-label-sm text-on-surface-variant dark:bg-surface-container-high-dark dark:text-on-surface-variant-dark">
            {hint}
          </Text>
        )}
      </View>

      {step ? (
        <View className="flex-row items-center justify-between rounded-2xl bg-surface-container-low p-2 dark:bg-surface-container-low-dark">
          <Pressable
            onPress={() => adjust(-step)}
            disabled={disabled}
            className="h-12 w-12 items-center justify-center rounded-xl bg-surface-container-lowest dark:bg-surface-container-lowest-dark"
          >
            <Text className="text-xl text-on-surface dark:text-on-surface-dark">−</Text>
          </Pressable>
          <TextInput
            className="flex-1 text-center font-headline-md text-headline-md text-on-surface dark:text-on-surface-dark"
            keyboardType="number-pad"
            value={value}
            onChangeText={onChangeText}
            editable={!disabled}
          />
          <Pressable
            onPress={() => adjust(step)}
            disabled={disabled}
            className="h-12 w-12 items-center justify-center rounded-xl bg-surface-container-lowest dark:bg-surface-container-lowest-dark"
          >
            <Text className="text-xl text-on-surface dark:text-on-surface-dark">+</Text>
          </Pressable>
        </View>
      ) : (
        <TextInput
          className={`rounded-xl bg-surface-container-low p-3 font-body-md text-body-md text-on-surface dark:bg-surface-container-low-dark dark:text-on-surface-dark ${disabled ? "opacity-50" : ""}`}
          value={value}
          onChangeText={onChangeText}
          editable={!disabled}
          multiline={multiline}
        />
      )}

      {error && (
        <View className="gap-1 rounded-2xl bg-error-container/40 p-3 dark:bg-error-container-dark/40">
          <Text className="font-label-sm text-label-sm font-medium text-error dark:text-error-dark">
            {error}
          </Text>
        </View>
      )}
    </View>
  );
}
