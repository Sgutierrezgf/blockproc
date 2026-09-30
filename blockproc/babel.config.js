// T52: única razón para que este archivo exista (antes no hacía falta uno
// explícito). babel-preset-expo se sigue encargando, sin nada más, del
// plugin de Reanimated/Worklets (ya instalados) y del compilador de React.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
  };
};
