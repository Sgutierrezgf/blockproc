/** @type {import('tailwindcss').Config} */
// Sistema de diseño "Mindful Calm" (T65, Fase 7): tokens generados con Stitch
// (stitch.withgoogle.com), con el azul de marca ya existente (#208AEF) como
// `primary` en vez del que generó la herramienta, y una paleta oscura derivada
// a mano de la misma (ver plan.md, decisión D15). `darkMode: "media"` sigue el
// tema del sistema operativo, coherente con `userInterfaceStyle: "automatic"`
// en app.json — sin interruptor manual en la app.
//
// Los roles "-fixed"/"-fixed-dim"/"on-*-fixed"/"on-*-fixed-variant" son, por
// diseño, los mismos en claro y en oscuro (por eso no tienen versión ` dark`
// aparte): se usan donde un color necesita quedar igual sin importar el tema.
module.exports = {
  darkMode: "media",
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Superficies y neutros.
        surface: { DEFAULT: "#f8f9ff", dark: "#101317" },
        "surface-bright": { DEFAULT: "#f8f9ff", dark: "#383d46" },
        "surface-dim": { DEFAULT: "#d7dae2", dark: "#101317" },
        "surface-variant": { DEFAULT: "#e0e2eb", dark: "#40474f" },
        "surface-container-lowest": { DEFAULT: "#ffffff", dark: "#0b0e12" },
        "surface-container-low": { DEFAULT: "#f1f3fc", dark: "#14171c" },
        "surface-container": { DEFAULT: "#ebeef6", dark: "#181c22" },
        "surface-container-high": { DEFAULT: "#e5e8f1", dark: "#1e222a" },
        "surface-container-highest": { DEFAULT: "#e0e2eb", dark: "#262b33" },
        "on-surface": { DEFAULT: "#181c22", dark: "#e2e5ec" },
        "on-surface-variant": { DEFAULT: "#404753", dark: "#c4c9d4" },
        outline: { DEFAULT: "#717784", dark: "#8d93a0" },
        "outline-variant": { DEFAULT: "#c0c7d5", dark: "#3f4550" },
        background: { DEFAULT: "#f8f9ff", dark: "#101317" },
        "on-background": { DEFAULT: "#181c22", dark: "#e2e5ec" },
        "inverse-surface": { DEFAULT: "#2d3137", dark: "#f8f9ff" },
        "inverse-on-surface": { DEFAULT: "#eef0f9", dark: "#181c22" },

        // Primario: azul de marca #208AEF (no el que generó Stitch).
        primary: { DEFAULT: "#208aef", dark: "#8fc4f6" },
        "on-primary": { DEFAULT: "#ffffff", dark: "#052a47" },
        "primary-container": { DEFAULT: "#d6eafb", dark: "#0f5a96" },
        "on-primary-container": { DEFAULT: "#0b3b63", dark: "#d6eafb" },
        "inverse-primary": { DEFAULT: "#8fc4f6", dark: "#208aef" },
        "surface-tint": { DEFAULT: "#208aef", dark: "#8fc4f6" },
        // Roles "fixed": iguales en claro y oscuro por diseño (T65).
        "primary-fixed": "#d6eafb",
        "primary-fixed-dim": "#8fc4f6",
        "on-primary-fixed": "#052a47",
        "on-primary-fixed-variant": "#0f5a96",

        // Secundario y terciario: paleta de Stitch tal cual (no dependen del
        // primario), con su propio par oscuro ya pensado por Material You.
        secondary: { DEFAULT: "#006c49", dark: "#4edea3" },
        "on-secondary": { DEFAULT: "#ffffff", dark: "#002113" },
        "secondary-container": { DEFAULT: "#6cf8bb", dark: "#005236" },
        "on-secondary-container": { DEFAULT: "#00714d", dark: "#6ffbbe" },
        "secondary-fixed": "#6ffbbe",
        "secondary-fixed-dim": "#4edea3",
        "on-secondary-fixed": "#002113",
        "on-secondary-fixed-variant": "#005236",

        tertiary: { DEFAULT: "#825100", dark: "#ffb95f" },
        "on-tertiary": { DEFAULT: "#ffffff", dark: "#2a1700" },
        "tertiary-container": { DEFAULT: "#a36700", dark: "#653e00" },
        "on-tertiary-container": { DEFAULT: "#fffbff", dark: "#ffddb8" },
        "tertiary-fixed": "#ffddb8",
        "tertiary-fixed-dim": "#ffb95f",
        "on-tertiary-fixed": "#2a1700",
        "on-tertiary-fixed-variant": "#653e00",

        // Error: valores base de Material 3 para el tema oscuro.
        error: { DEFAULT: "#ba1a1a", dark: "#ffb4ab" },
        "on-error": { DEFAULT: "#ffffff", dark: "#690005" },
        "error-container": { DEFAULT: "#ffdad6", dark: "#93000a" },
        "on-error-container": { DEFAULT: "#93000a", dark: "#ffdad6" },
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },
      spacing: {
        gutter: "1rem",
        margin: "1.25rem",
        "space-xs": "0.25rem",
        "space-sm": "0.5rem",
        "space-md": "1rem",
        "space-lg": "1.5rem",
        "space-xl": "2rem",
      },
      // T66: React Native no sintetiza el grosor a partir de una sola familia
      // ("Plus Jakarta Sans" + fontWeight), sobre todo en Android — cada
      // grosor es un archivo de fuente propio (`useFonts` en _layout.tsx), y
      // hay que referenciarlo por su nombre exacto.
      fontFamily: {
        "headline-xl": ["PlusJakartaSans_700Bold"],
        "headline-lg": ["PlusJakartaSans_700Bold"],
        "headline-md": ["PlusJakartaSans_600SemiBold"],
        "headline-sm": ["PlusJakartaSans_600SemiBold"],
        "body-lg": ["PlusJakartaSans_400Regular"],
        "body-md": ["PlusJakartaSans_400Regular"],
        "body-sm": ["PlusJakartaSans_400Regular"],
        "label-lg": ["PlusJakartaSans_600SemiBold"],
        "label-md": ["PlusJakartaSans_600SemiBold"],
        "label-sm": ["PlusJakartaSans_500Medium"],
      },
      fontSize: {
        // letterSpacing en puntos (no "em"): React Native no admite unidades
        // relativas, así que se precalcula em * tamaño de fuente.
        "headline-xl": ["32px", { lineHeight: "40px", letterSpacing: -0.64, fontWeight: "700" }],
        "headline-lg": ["26px", { lineHeight: "34px", letterSpacing: -0.39, fontWeight: "700" }],
        "headline-md": ["20px", { lineHeight: "28px", letterSpacing: -0.2, fontWeight: "600" }],
        "headline-sm": ["18px", { lineHeight: "24px", letterSpacing: -0.09, fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "24px", letterSpacing: 0, fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "22px", letterSpacing: 0.14, fontWeight: "400" }],
        "body-sm": ["13px", { lineHeight: "18px", letterSpacing: 0.13, fontWeight: "400" }],
        "label-lg": ["14px", { lineHeight: "20px", letterSpacing: 0.14, fontWeight: "600" }],
        "label-md": ["12px", { lineHeight: "16px", letterSpacing: 0.24, fontWeight: "600" }],
        "label-sm": ["11px", { lineHeight: "14px", letterSpacing: 0.33, fontWeight: "500" }],
      },
    },
  },
  plugins: [],
};
