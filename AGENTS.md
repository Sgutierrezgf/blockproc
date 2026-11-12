# AGENTS.md — blockproc

## Proyecto
App movil que permite bloquear otras apps del movil, enfocada en la friccion consciente, utlizando React Native, La app ayuda a reducir el tiempo de distracción en el dispositivo móvil permitiendo al usuario configurar límites de tiempo en aplicaciones seleccionadas e interponiendo un reto de preguntas/lógica como barrera para conceder uso temporal adicional. El Nucleo esta (blockproc), alli estara el proyecto principal

## Comandos
Todos se ejecutan desde `blockproc/`.
- Ejecutar: `npx expo run:android` (compila e instala la dev build en el móvil; requiere el entorno Android de la tarea T05). Para solo el servidor de JavaScript: `npx expo start`.
- Tests: `npm test` (Jest con el preset `jest-expo`; los tests viven en `tests/` de la raíz del repo, no dentro de `blockproc/`).
- Lint/formato: `npm run lint` (ESLint de Expo) y `npm run typecheck` (`tsc --noEmit`).
- Diagnóstico de dependencias y configuración: `npx expo-doctor`.
- Añadir dependencias: `npx expo install <paquete>`, nunca `npm install <paquete>`.

## Estilo y convenciones
- React native(Typescript)
- Estilos con Tailwind como principal, segunda opcion CSS
- Identificadores en inglés; mensajes de usuario en español por defecto, con inglés como idioma alternativo configurable por el usuario.

## Reglas
- Lee `docs/constitution.md` y la spec activa en `specs/` antes de tocar código.
- No añadas dependencias ni cambies el formato del JSON sin actualizar antes la spec.
- No modifiques archivos dentro de `specs/` salvo petición explícita.
- Si aparece un problema de configuración o arranque, documéntalo en `blockproc/README.md` (síntoma, causa, solución).

## Al terminar cualquier tarea
- Ejecuta los test y confirma en tu respuesta que todo pasa.