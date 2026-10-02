import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";

import BlockprocNative from "../../modules/blockproc-native/src/BlockprocNativeModule";
import { categoryLabel, groupAppsByCategory } from "../core/appCategories";
import { filterAppsByQuery } from "../core/appSearch";
import { filterEssentialApps } from "../core/exclusions";
import type { InstalledApp } from "../core/exclusions";
import { SelectableRow } from "./SelectableRow";

// RF-1, RF-28, RF-48, RF-49: paso 1 del asistente de creación de un
// bloqueo (D32) — la misma pantalla de selección de apps de siempre
// (buscador, categorías, esenciales excluidas), ahora reusable y con la
// selección controlada por quien la usa (sin ningún concepto de
// "restrictedPackages" global, que ya no existe).
async function readSelectableApps(): Promise<InstalledApp[]> {
  const apps = await BlockprocNative.getInstalledLauncherApps();
  const essentialPackages = BlockprocNative.getEssentialPackages();
  return filterEssentialApps(apps, essentialPackages);
}

export interface AppPickerProps {
  selected: string[];
  onToggle: (packageName: string) => void;
  headerTitle?: string;
  headerDescription?: string;
}

export function AppPicker({
  selected,
  onToggle,
  headerTitle = "Elegí las apps",
  headerDescription = "Seleccioná las apps que querés incluir en este bloqueo.",
}: AppPickerProps) {
  const [apps, setApps] = useState<InstalledApp[] | null>(null);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    readSelectableApps().then((result) => {
      if (!cancelled) setApps(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = apps ? groupAppsByCategory(apps).map((group) => group.label) : [];
  const categoryFiltered =
    apps && selectedCategory ? apps.filter((app) => categoryLabel(app.category) === selectedCategory) : apps;
  const visibleApps = categoryFiltered ? filterAppsByQuery(categoryFiltered, query) : [];

  if (apps === null) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      className="bg-surface dark:bg-surface-dark"
      contentContainerClassName="gap-3 bg-surface p-6 dark:bg-surface-dark"
      data={visibleApps}
      keyExtractor={(app) => app.packageName}
      ListHeaderComponent={
        <View className="mb-2 gap-3">
          <View className="gap-2">
            <Text className="font-headline-lg text-headline-lg font-bold text-on-surface dark:text-on-surface-dark">
              {headerTitle}
            </Text>
            <Text className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant-dark">
              {headerDescription}
            </Text>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar app…"
            className="rounded-2xl bg-surface-container p-3 font-body-md text-body-md text-on-surface dark:bg-surface-container-dark dark:text-on-surface-dark"
          />
          {categories.length > 0 && (
            <View className="flex-row flex-wrap gap-2">
              {categories.map((label) => {
                const isSelected = label === selectedCategory;
                return (
                  <Pressable
                    key={label}
                    onPress={() => setSelectedCategory(isSelected ? null : label)}
                    className={`rounded-full px-3 py-1.5 ${
                      isSelected
                        ? "bg-primary-container dark:bg-primary-container-dark"
                        : "bg-surface-container dark:bg-surface-container-dark"
                    }`}
                  >
                    <Text
                      className={`font-label-md text-label-md font-semibold ${
                        isSelected
                          ? "text-on-primary-container dark:text-on-primary-container-dark"
                          : "text-on-surface-variant dark:text-on-surface-variant-dark"
                      }`}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      }
      ListEmptyComponent={
        <Text className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant-dark">
          {query ? `Ninguna app coincide con "${query}".` : "Ninguna app coincide con esta categoría."}
        </Text>
      }
      renderItem={({ item }) => (
        <SelectableRow
          label={item.label}
          checked={selected.includes(item.packageName)}
          onPress={() => onToggle(item.packageName)}
          iconUri={item.iconUri}
        />
      )}
    />
  );
}
