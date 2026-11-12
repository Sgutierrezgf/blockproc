import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import BlockprocNative from "../../modules/blockproc-native/src/BlockprocNativeModule";
import type { Language } from "../core/config";
import { loadConfig, saveConfig } from "../storage/appRepository";
import { defaultStore } from "../storage/defaultStore";
import { STRINGS } from "./strings";
import type { Strings } from "./strings";

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

// RF-76, D38, D39: se monta una sola vez en el `_layout.tsx` raíz (no en el
// de (tabs)), para que también llegue a las pantallas fuera de ese grupo
// (challenge, wait, create-block) abiertas por enlace profundo. El idioma
// vive en `Config.language` (RF-78), mismo storage que el resto de
// Personalización — acá solo se cachea en estado de React para que cambiarlo
// se refleje al instante en toda la UI (RF-76), sin tener que releer MMKV.
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => loadConfig(defaultStore).language);

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    const config = loadConfig(defaultStore);
    saveConfig(defaultStore, { ...config, language: next });
  };

  // RF-76, RF-77: Android no ve este Context — la notificación fija del
  // servicio y los nombres de canal se traducen guardando sus textos del
  // lado nativo, al montar y en cada cambio de idioma.
  useEffect(() => {
    const texts = STRINGS[language].notifications;
    BlockprocNative.setNotificationTexts(
      texts.alertsChannelName,
      texts.monitorChannelName,
      texts.monitorTitle,
      texts.monitorText
    );
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage debe usarse dentro de LanguageProvider");
  }
  return context;
}

export function useStrings(): Strings {
  const { language } = useLanguage();
  return STRINGS[language];
}
