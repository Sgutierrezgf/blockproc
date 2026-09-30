import { Pressable, Text } from "react-native";

// T67 (Fase 7, sistema "Mindful Calm"): reemplaza los botones azules sueltos
// (`bg-blue-600`) y el `<Button>` nativo sin estilo de schedule.tsx.
export interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}

export function PrimaryButton({ title, onPress, disabled }: PrimaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`h-[52px] items-center justify-center rounded-2xl bg-primary shadow-md dark:bg-primary-dark ${
        disabled ? "opacity-50" : "active:opacity-80"
      }`}
    >
      <Text className="font-label-lg text-label-lg text-on-primary dark:text-on-primary-dark">
        {title}
      </Text>
    </Pressable>
  );
}
