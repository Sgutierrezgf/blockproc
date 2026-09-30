import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BlockprocNative from "../../../modules/blockproc-native/src/BlockprocNativeModule";
import { categoryLabel, groupAppsByCategory } from "../../core/appCategories";
import { filterAppsByQuery } from "../../core/appSearch";
import { createSystemClock } from "../../core/clock";
import { filterEssentialApps, toggleRestrictedPackage } from "../../core/exclusions";
import type { InstalledApp } from "../../core/exclusions";
import { applyAndSaveConfig, readCurrentConfigState } from "../../settings/applyAndSaveConfig";
import { defaultStore } from "../../storage/defaultStore";
import { Banner } from "../../components/Banner";
import { SelectableRow } from "../../components/SelectableRow";

// Principio 7 de la constitución: nunca Date.now() directo, siempre un
// Clock inyectable (aquí, el real: no hay reloj falso que inyectar en una
// pantalla real).
const clock = createSystemClock();

// RF-1, RF-28, RF-48, RF-49 (T54, T82, T83): lista de apps con icono de
// lanzador, sin las esenciales (marcador, Ajustes, lanzador, cámara, la
// propia app, identificadas de mejor esfuerzo por lo nativo, T46), con su
// ícono y categoría. RF-19, RF-29 (T57): añadir una app endurece (se aplica
// ya); quitarla relaja (queda pendiente hasta las 04:00 si hay alguna app
// bloqueada); con un bloqueo horario activo no se puede editar nada.
async function readSelectableApps(): Promise<InstalledApp[]> {
  const apps = await BlockprocNative.getInstalledLauncherApps();
  const essentialPackages = BlockprocNative.getEssentialPackages();
  return filterEssentialApps(apps, essentialPackages);
}

// T70 (Fase 7, sistema "Mindful Calm"): mismo comportamiento de siempre
// (RF-1, RF-19, RF-28, RF-29), solo cambia la presentación: `SelectableRow`
// y `Banner` en vez de `AppRow` y las cajas de color sueltas de antes.
// T81-T83 (Fase 8): buscador (RF-46) e ícono/categoría por app (RF-48,
// RF-49). Obtener el ícono de cada app es trabajo real de CPU (D17 del
// plan), así que la carga es asíncrona con un indicador mientras dura (C9).
export default function Apps() {
  const [apps, setApps] = useState<InstalledApp[] | null>(null);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [state, setState] = useState(() => readCurrentConfigState(defaultStore, clock.now()));
  const { config, pending, isEditingLocked } = state;
  // RF-49: el buscador y la categoría son combinables (C8), ambos criterios
  // se aplican a la vez. Las categorías disponibles se calculan sobre la
  // lista completa, no sobre lo ya filtrado por texto, para que un chip no
  // desaparezca solo porque el buscador momentáneamente no muestra ninguna
  // de sus apps.
  const categories = apps ? groupAppsByCategory(apps).map((group) => group.label) : [];
  const categoryFiltered =
    apps && selectedCategory
      ? apps.filter((app) => categoryLabel(app.category) === selectedCategory)
      : apps;
  const visibleApps = categoryFiltered ? filterAppsByQuery(categoryFiltered, query) : [];

  useEffect(() => {
    let cancelled = false;
    readSelectableApps().then((result) => {
      if (!cancelled) {
        setApps(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // T92 (Fase 8, Plan D20): igual que T91 en Ajustes — esta pestaña ya no se
  // desmonta al cambiar de pestaña, así que un cambio hecho en Ajustes o
  // Bloqueo horario no se nota solo. Refresca config/pending/bloqueo por
  // foco; a propósito NO repite `readSelectableApps()` aquí: decodificar el
  // ícono de cientos de apps (D17) es trabajo real de CPU que no hace falta
  // rehacer solo por volver a esta pestaña, y ninguna otra pestaña cambia la
  // lista de apps instaladas.
  useFocusEffect(
    useCallback(() => {
      setState(readCurrentConfigState(defaultStore, clock.now()));
    }, [])
  );
  // El pendiente es de toda la configuración, no solo de apps (T57): el
  // aviso de aquí solo tiene sentido si lo que quedó pendiente afecta a la
  // lista de restringidas, no a otro campo cualquiera.
  const pendingAffectsApps =
    pending !== null &&
    (pending.config.restrictedPackages.length !== config.restrictedPackages.length ||
      pending.config.restrictedPackages.some((pkg) => !config.restrictedPackages.includes(pkg)));

  const toggle = (packageName: string) => {
    const updated = {
      ...config,
      restrictedPackages: toggleRestrictedPackage(config.restrictedPackages, packageName),
    };
    const result = applyAndSaveConfig(defaultStore, config, updated, clock.now());
    setState(result);
  };

  // RF-48, C9: mientras se resuelven los íconos, un indicador en vez de la
  // lista vacía (evita que la pantalla se vea rota con muchas apps instaladas).
  if (apps === null) {
    return (
      <SafeAreaView
        edges={["top", "bottom"]}
        className="flex-1 items-center justify-center bg-surface dark:bg-surface-dark"
      >
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface dark:bg-surface-dark">
      <FlatList
        className="bg-surface dark:bg-surface-dark"
        contentContainerClassName="gap-3 bg-surface p-6 dark:bg-surface-dark"
        data={visibleApps}
        keyExtractor={(app) => app.packageName}
        ListHeaderComponent={
          <View className="mb-2 gap-3">
            <View className="gap-2">
              <Text className="font-headline-lg text-headline-lg font-bold text-on-surface dark:text-on-surface-dark">
                Apps a restringir
              </Text>
              <Text className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant-dark">
                Elige qué apps quieres limitar. Las apps esenciales del sistema no aparecen aquí.
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
                  const selected = label === selectedCategory;
                  return (
                    <Pressable
                      key={label}
                      onPress={() => setSelectedCategory(selected ? null : label)}
                      className={`rounded-full px-3 py-1.5 ${
                        selected
                          ? "bg-primary-container dark:bg-primary-container-dark"
                          : "bg-surface-container dark:bg-surface-container-dark"
                      }`}
                    >
                      <Text
                        className={`font-label-md text-label-md font-semibold ${
                          selected
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
            {isEditingLocked && (
              <Banner
                tone="locked"
                title="Bloqueo horario activo"
                description="Hay un bloqueo horario activo: no se puede editar la configuración hasta que termine."
              />
            )}
            {pendingAffectsApps && (
              <Banner
                tone="pending"
                title="Cambios pendientes hasta las 04:00"
                description="Hay apps que dejan de estar restringidas recién a las 04:00."
              />
            )}
          </View>
        }
        ListEmptyComponent={
          <Text className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant-dark">
            {query
              ? `Ninguna app coincide con "${query}".`
              : "Ninguna app coincide con esta categoría."}
          </Text>
        }
        renderItem={({ item }) => (
          <SelectableRow
            label={item.label}
            checked={config.restrictedPackages.includes(item.packageName)}
            onPress={() => toggle(item.packageName)}
            disabled={isEditingLocked}
            iconUri={item.iconUri}
          />
        )}
      />
    </SafeAreaView>
  );
}
