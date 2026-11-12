import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import BlockprocNative from "../../modules/blockproc-native/src/BlockprocNativeModule";
import { summarizeAppLabels } from "../core/appLabels";
import type { InstalledApp } from "../core/exclusions";
import { useStrings } from "../i18n/LanguageProvider";

// C46: cuántos nombres se muestran antes de "+N más".
const VISIBLE_APPS = 5;

// RF-81, D44: nombres visibles de las apps de un bloqueo, usado en el resumen
// del asistente (RF-60) y en el detalle de un bloqueo (RF-82). Mientras la
// lista de apps instaladas carga, muestra los nombres de paquete.
export function AppNameList({ packages }: { packages: string[] }) {
  const strings = useStrings().appNameList;
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    BlockprocNative.getInstalledLauncherApps()
      .then((result) => {
        if (!cancelled) setApps(result);
      })
      .catch(() => {
        // Sin la lista se quedan los nombres de paquete (RF-81).
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { labels, remaining } = summarizeAppLabels(packages, apps, expanded ? Infinity : VISIBLE_APPS);
  const canToggle = packages.length > VISIBLE_APPS;

  return (
    <View className="gap-1">
      {labels.map((label, index) => (
        <Text key={packages[index]} className="font-body-md text-body-md text-on-surface dark:text-on-surface-dark">
          • {label}
        </Text>
      ))}
      {remaining > 0 && (
        <Text className="font-body-md text-body-md text-on-surface-variant dark:text-on-surface-variant-dark">
          {strings.moreApps(remaining)}
        </Text>
      )}
      {canToggle && (
        <Pressable onPress={() => setExpanded((prev) => !prev)} className="self-start py-1">
          <Text className="font-label-lg text-label-lg text-primary dark:text-primary-dark">
            {expanded ? strings.showFewer : strings.showAll}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
