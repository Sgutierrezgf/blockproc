// T52: única razón para que este archivo exista (antes no hacía falta uno
// explícito, Expo usaba su configuración por defecto sin más).
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
