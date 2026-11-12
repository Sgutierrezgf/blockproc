import { useEffect, useRef } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { ScrollView, Text, View } from "react-native";

import { useStrings } from "../i18n/LanguageProvider";

// D37 (feedback de uso real, 2026-10-03): reemplaza los botones +/- de
// `Field` para elegir horas/minutos de un bloqueo "por tiempo" — el usuario
// probó los botones en vivo y le costó llegar a valores chicos. Horas va de
// 0 a 11 y minutos de 0 a 55 (de a 5): la combinación máxima (11h55) nunca
// supera las 12h de RF-56, así que no hace falta ningún tope cruzado.
const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 3;
const HOURS = Array.from({ length: 12 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

export interface DurationWheelPickerProps {
  hours: string;
  minutes: string;
  onChangeHours: (value: string) => void;
  onChangeMinutes: (value: string) => void;
}

export function DurationWheelPicker({ hours, minutes, onChangeHours, onChangeMinutes }: DurationWheelPickerProps) {
  const strings = useStrings().createBlock;
  return (
    <View className="flex-row gap-3 rounded-3xl bg-surface-container p-4 dark:bg-surface-container-dark">
      <WheelColumn
        label={strings.hoursLabel}
        values={HOURS}
        value={Number(hours) || 0}
        onChange={(v) => onChangeHours(String(v))}
      />
      <WheelColumn
        label={strings.minutesLabel}
        values={MINUTES}
        value={Number(minutes) || 0}
        onChange={(v) => onChangeMinutes(String(v))}
      />
    </View>
  );
}

interface WheelColumnProps {
  label: string;
  values: number[];
  value: number;
  onChange: (value: number) => void;
}

function closestIndex(values: number[], value: number): number {
  let bestIndex = 0;
  let bestDiff = Math.abs(values[0] - value);
  for (let i = 1; i < values.length; i++) {
    const diff = Math.abs(values[i] - value);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function WheelColumn({ label, values, value, onChange }: WheelColumnProps) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Solo al montar: el estado externo (horas/minutos) después de esto solo
    // cambia por el propio gesto del usuario en esta rueda, nunca desde
    // afuera (no hay presets ni botón de reset que lo pise).
    scrollRef.current?.scrollTo({ y: closestIndex(values, value) * ITEM_HEIGHT, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.max(0, Math.min(values.length - 1, Math.round(offsetY / ITEM_HEIGHT)));
    onChange(values[index]);
  };

  return (
    <View className="flex-1 items-center">
      <Text className="mb-2 font-label-md text-label-md font-semibold text-on-surface-variant dark:text-on-surface-variant-dark">
        {label}
      </Text>
      <View style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }} className="w-full overflow-hidden">
        <View
          pointerEvents="none"
          style={{ top: ITEM_HEIGHT, height: ITEM_HEIGHT }}
          className="absolute left-0 right-0 rounded-xl bg-surface-container-low dark:bg-surface-container-low-dark"
        />
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
          contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
        >
          {values.map((v) => (
            <View key={v} style={{ height: ITEM_HEIGHT }} className="items-center justify-center">
              <Text className="font-headline-md text-headline-md text-on-surface dark:text-on-surface-dark">
                {String(v).padStart(2, "0")}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
