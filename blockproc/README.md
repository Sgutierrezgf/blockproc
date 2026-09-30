# blockproc

App Android de **fricción consciente**: ayuda a reducir el tiempo de distracción en el móvil. El usuario elige apps a restringir, fija un límite diario y, al superarlo, debe resolver un pequeño reto de preguntas para seguir usándolas un rato más. También ofrece un bloqueo horario sin reto.

Todo se rige por la documentación del repositorio (un nivel arriba de esta carpeta):

- `docs/constitution.md`: principios del proyecto.
- `specs/001-app-blocker/spec.md`: qué hace la app (requisitos RF-1 a RF-45).
- `specs/001-app-blocker/plan.md`: cómo se construye.
- `specs/001-app-blocker/tasks.md`: tareas y su estado.

Stack: Expo (dev build, generación nativa) con React Native y TypeScript, y Expo Router para las rutas en `src/app/`. Solo Android (8.0 o superior).

## Después de clonar el proyecto

1. Instala las dependencias: `npm install`.
2. Comprueba el tipado: `npm run typecheck` debe terminar sin errores.
3. Ejecuta los tests: `npm test` debe pasar en verde.
4. Comprueba la configuración de Expo: `npx expo-doctor` debe dar todos los chequeos en verde.

## Comandos útiles

| Comando | Para qué |
|---|---|
| `npx expo start` | Arranca el servidor de desarrollo |
| `npx tsc --noEmit` | Comprueba el tipado |
| `npm run lint` | Ejecuta ESLint |
| `npm run typecheck` | Igual que `npx tsc --noEmit`; revisa también `../tests/` |
| `npm test` | Ejecuta los tests una vez (Jest); los tests viven en `tests/` de la raíz del repo |
| `npm run test:watch` | Ejecuta los tests y se queda esperando cambios |
| `npx expo-doctor` | Diagnostica dependencias y configuración |
| `npx expo install <paquete>` | Añade una dependencia con la versión compatible con el SDK (úsalo en lugar de `npm install <paquete>`) |

La carpeta `android/` se genera con `npx expo prebuild` y **no se versiona**; no la edites a mano. La configuración nativa va en `app.json` y en plugins de configuración.

## Build de producción

`android/app/build.gradle` ya trae un `buildType release` (minificado, con `shrinkResources` y ProGuard) que no depende de Metro: el JS queda empaquetado dentro del APK. Se genera con:

```
cd android && ./gradlew assembleRelease
```

La pantalla de Herramientas de desarrollo (`/dev`) está oculta en esa build (`__DEV__` es `false`): ni el enlace de Ajustes ni el enlace profundo `blockproc://dev` la muestran.

**Pendiente antes de publicar de verdad:** esa build release sigue firmada con el keystore de **debug** de la plantilla (`signingConfigs.release` apunta a `signingConfigs.debug` en `build.gradle`) — sirve para probar en un dispositivo, pero no es válida para subir a Play Store. Hace falta generar un keystore de release propio y guardarlo en un lugar seguro (nunca en el repo) antes de publicar.

## Problemas conocidos de configuración

Cada entrada sigue el formato **síntoma → causa → solución**. Si te encuentras un problema de configuración nuevo, añádelo aquí para el siguiente que clone el repo.

### `tsc` falla con TS2307 o TS2882 en archivos `.css` justo después de clonar

> **Estado: ya no ocurre** desde que se eliminó el código de ejemplo de la plantilla (tarea T01b). Se conserva por si reaparece.

- **Síntoma:** `npx tsc --noEmit` muestra `Cannot find module './animated-icon.module.css'` (TS2307) y `Cannot find module or type declarations for side-effect import of '@/global.css'` (TS2882).
- **Causa:** `expo-env.d.ts` declara los tipos de los archivos `.css`, pero Expo lo genera al arrancar el servidor y está en `.gitignore`, así que un clon nuevo no lo tiene.
- **Solución:** ejecuta `npx expo start` una vez y ciérralo con `Ctrl+C`. El archivo se crea y `tsc` pasa.

### ESLint no revisa los archivos de `tests/`

- **Síntoma:** `npx eslint ../tests/<archivo>` responde `File ignored because outside of base path`, y `npm run lint` no avisa de errores de estilo en los tests.
- **Causa:** los tests viven en `tests/` de la raíz del repo, fuera de `blockproc/`, que es la carpeta base de la configuración de ESLint.
- **Solución:** de momento no hay; el tipado de los tests sí se revisa con `npm run typecheck`. Queda como limitación conocida hasta decidir si se amplía la configuración de ESLint.

### `npx expo run:android` no aplica un cambio hecho en `plugins/*.js`

- **Síntoma:** tras editar un plugin de configuración (por ejemplo, para añadir un permiso o un `<service>` nuevo al manifest) y correr `npx expo run:android`, la app compila e instala bien, pero el manifest generado (`android/app/src/main/AndroidManifest.xml`) sigue sin el cambio.
- **Causa:** `expo run:android` no siempre detecta que un plugin cambió y decide no volver a correr `prebuild`, así que reutiliza el `android/` ya generado tal cual estaba.
- **Solución:** fuerza el regenerado con `npx expo prebuild --platform android --clean` y confirma con `grep` sobre el manifest que el cambio ya está, antes de volver a correr `npx expo run:android`.

### Un `HeadlessJsTaskService` se cae con `SecurityException: ... WAKE_LOCK` y tumba toda la app

- **Síntoma:** al disparar una tarea Headless JS (`startService` hacia un `HeadlessJsTaskService`), la app entera se cierra con `FATAL EXCEPTION: main` / `SecurityException: Neither user ... nor current process has android.permission.WAKE_LOCK`, y deja de responder a cualquier evento hasta reabrirla a mano.
- **Causa:** `HeadlessJsTaskService.startTask()` (de React Native) llama a `acquireWakeLockNow()` antes de correr la tarea, para no dormirse a mitad de camino; sin el permiso `WAKE_LOCK` declarado, esa llamada lanza la excepción sin capturar, en el hilo principal.
- **Solución:** declara `android.permission.WAKE_LOCK` en el plugin de configuración (permiso normal, sin diálogo ni riesgo) y vuelve a generar el proyecto nativo (ver el problema anterior: puede hacer falta `--clean`).

### Un cambio en `babel.config.js` o `metro.config.js` no se nota en el móvil

- **Síntoma:** tras crear o editar `babel.config.js`/`metro.config.js` (por ejemplo, al añadir NativeWind en la T52) y volver a correr `npx expo run:android`, la app instala bien pero se ve exactamente igual que antes, sin el nuevo comportamiento.
- **Causa:** si ya había un servidor de Metro corriendo desde una tarea anterior (`npx expo run:android` deja uno abierto, escuchando en el puerto 8081), la siguiente vez que se corre el comando se reutiliza ese mismo proceso en vez de arrancar uno nuevo. Metro solo lee `babel.config.js`/`metro.config.js` al arrancar, así que un proceso viejo nunca se entera del cambio.
- **Solución:** comprueba si el puerto sigue ocupado (`lsof -i :8081`) y, si lo está, mata ese proceso (`kill -9 <pid>`) antes de volver a correr `npx expo run:android`. Con `expo run:android` en segundo plano en distintas rondas de prueba, esto es fácil de pasar por alto porque el build sí compila y sí instala — solo Metro se queda con la configuración vieja.

### La app se abre en negro con "Unable to load script" tras reconectar el móvil o reiniciar `adb`

- **Síntoma:** la app compila e instala bien, pero al abrirla se ve una pantalla negra (o, si ya estaba abierta, un error nativo en `logcat` de "Unable to load script... The device must either be USB connected (with bundler set to "localhost:8081")..."), aunque Metro sigue corriendo en la computadora (`curl localhost:8081/status` responde bien).
- **Causa:** `npx expo run:android` deja el reenvío `adb reverse tcp:8081 tcp:8081` configurado, pero ese reenvío se pierde cada vez que el daemon de `adb` se reinicia (ocurre solo, por ejemplo, tras que el móvil se desconecte y reconecte por USB, o tras `adb kill-server`) o tras reiniciar el propio móvil (`adb reboot`, RF-45). Sin ese túnel, el proceso nativo no puede alcanzar `localhost:8081` en la computadora para pedir el bundle de JS.
- **Solución:** corre `adb reverse tcp:8081 tcp:8081` de nuevo (`adb reverse --list` para confirmar que quedó) y vuelve a abrir la app. No hace falta recompilar ni reinstalar nada.
