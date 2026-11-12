# Plan 001 — Bloqueo consciente de apps con bloqueos múltiples y reto

Cubre la spec `specs/001-app-blocker/spec.md` (RF-1 a RF-79, tras el rediseño de 2026-10-01 y
la ampliación de 2026-10-03: bloqueo extremo, idioma, Acerca de).
Respeta `docs/constitution.md`. Sin código: solo módulos, datos, decisiones y estrategia de
pruebas.

> **Nota de versión:** las secciones 1 a 6 describen la arquitectura **vigente tras el
> rediseño** (sistema de bloqueos múltiples). Las decisiones D1 a D24 y las secciones
> narrativas de abajo documentan el historial completo hasta la Fase 9 (modelo anterior,
> límite diario + bloqueo horario único) y se conservan tal cual por trazabilidad, aunque
> varias ya no describan el comportamiento actual — ver la nota de migración de `spec.md`
> para saber exactamente qué RF sigue vigente.

## 1. Enfoque general

La app se divide en **tres capas** con una frontera estricta (constitución, principios 1 y 6):

| Capa | Lenguaje | Responsabilidad | ¿Se prueba sin dispositivo? |
|---|---|---|---|
| **Core** | TypeScript puro | Todas las reglas de negocio: límites, ventanas, esperas, reto, bloqueo horario, banco de preguntas | Sí (Jest + reloj inyectable) |
| **Nativa** | Kotlin | Sensores y actuadores del sistema: detectar app en primer plano, estado de pantalla, permisos, servicio, notificaciones, lanzar el reto, arranque tras reinicio | No (demo manual) |
| **UI** | React Native (Expo) + NativeWind | Pantallas de configuración, bloqueo horario, reto y espera | No (demo manual) |

**Idea central: el cerebro es una función pura.** El core expone un único reductor:

```
reduce(state, event, now) → { state, actions }
```

- **Eventos** (llegan de lo nativo o de la UI): `ForegroundChanged(pkg)`, `Tick`, `ScreenOn`, `ScreenOff`, `BootCompleted`, `AnswerSubmitted`, `BlockCreated`, `BlockEdited`, `BlockDeleted`.
- **Acciones** (las ejecuta lo nativo o la UI): `ShowAccess(pkg)` (el paso reflexivo, RF-63), `ShowWait(pkg, hasta)`, `NotifyBlockStarting(blockId)`, `GoHome`.
- `config` deja de pasarse al reductor: ya no hay configuración global que afecte la decisión (límite, preguntas, ventana eran por `Config`; ahora cada `Block` ya trae su propia categoría y mensajes incluidos en el estado).
- `ShowRestBlock` desaparece: ningún bloqueo es "sin salida", todos usan `ShowAccess`.
- Como no toca el reloj ni el sistema, cada criterio de aceptación se reproduce con eventos y un reloj falso.

## 2. Estructura del proyecto

El proyecto Expo vive en `blockproc/`. Se usa **Continuous Native Generation**: la carpeta `android/` se genera con `expo prebuild` y no se versiona; el Kotlin propio vive en un módulo local y el manifest se modifica con un plugin de configuración.

```
blockproc/
├── src/
│   ├── app/
│   │   ├── (tabs)/
│   │   │   ├── settings.tsx    # Personalización: mensajes por defecto (RF-70), nota de batería (RF-44) — sin cambios
│   │   │   ├── ajustes.tsx     # NUEVO (RF-76 a RF-79): selector de idioma + sección "Acerca de"
│   │   │   └── blocks.tsx      # Bloqueos: lista tipo alarma (RF-55), botón "+"; suma etiqueta "Extremo" (RF-75)
│   │   ├── create-block.tsx    # asistente de creación (RF-56 a RF-60), paso a paso con estado local; suma el toggle "extremo" (RF-73)
│   │   ├── challenge.tsx        # extendido: si `block.extreme`, salta directo a la pantalla sin salida (RF-74, D41), nunca a reflexión/confirmación/reto
│   │   ├── wait.tsx             # espera de 5 min tras fallar (RF-66), sin cambios
│   │   └── index.tsx            # permisos (sin cambios)
│   ├── core/            # TS puro, sin imports de react-native
│   │   ├── clock.ts         # Clock (real y falso)
│   │   ├── config.ts        # mensajes por defecto (RF-70) + idioma (RF-78), validación
│   │   ├── exclusions.ts    # apps no restringibles
│   │   ├── blocks.ts        # Block (suma campo `extreme: boolean`, RF-73), estado, solapamiento, filtrar terminados
│   │   ├── challengeState.ts    # adaptado: wrongCount, blockId en vez de dayKey
│   │   ├── challengeQuestions.ts / challengeSession.ts / questionSelector.ts  # reusados, una sola categoría
│   │   ├── questions.ts     # banco local (ahora por idioma, RF-77), ciclo sin repetición, generador
│   │   ├── policy.ts        # reductor: estado por app + bloqueos → acciones (sin cambios para RF-73/74, D41)
│   │   └── types.ts
│   │   # usage.ts se borra (RF-36 retirado, C33)
│   ├── i18n/            # NUEVO (RF-76, RF-77): diccionario es/en + contexto de idioma, ver sección 3 y D38
│   │   ├── strings.ts       # { es: {...}, en: {...} } de todos los textos de fábrica de la UI
│   │   └── LanguageProvider.tsx  # Context + hook `useStrings()`, se monta una vez en `_layout.tsx` raíz
│   ├── data/questions.es.json
│   ├── data/questions.en.json   # NUEVO (RF-77): mismos `id`, estructura y cantidad que el español
│   ├── storage/         # repositorio sobre MMKV (única puerta de persistencia)
│   ├── supervisor/      # conecta eventos nativos con el core (sin cambios de forma)
│   └── components/      # AppPicker (extraído de apps.tsx, reusado por create-block.tsx), Banner, etc. — cada uno con texto fijo pasa a leerlo de `useStrings()`
├── modules/blockproc-native/   # módulo local de Expo (Kotlin): servicio, permisos, apps, notificaciones, lanzar reto/espera (showRestBlock se retira)
└── plugins/withBlockprocAndroid   # plugin de configuración: permisos, servicio, receptor de arranque (sin cambios)
tests/                   # pruebas del core (carpeta de la raíz del repo)
```

## 3. Modelo de datos

Todo se guarda en el dispositivo (RF-25) mediante el repositorio de `storage/`.

**Bloqueos** (`blocks: Block[]`, RF-55 a RF-62, RF-73 a RF-75)
- `Block`: `{ id, packages: string[], type: "duration" | "scheduled", startAt, endAt, category: Area (una sola, RF-57), focusMessage, blockMessage, warnedStart, extreme: boolean }` — ambos tipos terminan con `startAt`/`endAt` concretos (D25): "por tiempo" calcula `endAt` al confirmarse (`startAt = ahora`), "programado" usa los elegidos por el usuario. `extreme` (RF-73) es `false` por defecto; una vez el bloqueo está activo, `challenge.tsx` lo lee para decidir si ofrece el flujo de acceso o la pantalla sin salida (D41) — no afecta a `policy.ts` ni a ningún otro módulo.
- La lista nunca contiene bloqueos ya terminados: se filtran al leer (RF-55, D33), igual que `promoteNextRestBlockIfNeeded` de la Fase 9 pero removiendo en vez de ascender.
- Duración válida para ambos tipos: > 0 min y ≤ 12 h (RF-56, igual que el viejo `isValidRestBlockRange`).

**Estado de acceso por app** (`apps: Record<string, AppAccessState>`)
- `AppAccessState`: `{ windowEndsAt, cooldownUntil }` — más simple que antes: sin `warnedLimit`/`warnedWindow` (esos avisos desaparecieron) ni `dayKey`/`usedMs` (RF-36 retirado, C33 de la spec).
- `windowEndsAt`: cronómetro fijo de 2 min desde que se acierta el reto (RF-67), no acumulación de uso.
- `cooldownUntil`: cronómetro fijo de 5 min desde que se acumulan 2 fallos (RF-66).

**Reto en curso** (`challenge?: ChallengeState`, por app)
- `ChallengeState`: `{ questions (≤3), currentIndex, wrongCount, failedQuestions: Question[], outcome, blockId }` (D27, D28).
- `blockId` reemplaza `dayKey`: el reto se conserva (preguntas, progreso) hasta resolverse, fallar, o que ese bloqueo deje de estar activo (RF-39 adaptado, C32) — ya no hay corte a las 04:00.

**Personalización y Ajustes** (`Config`, RF-70, RF-78)
- `defaultFocusMessage`, `defaultBlockMessage` (máx. 120 caracteres cada uno) — prellenan el paso de mensajes de `create-block.tsx`; todo lo demás de la config vieja (`dailyLimitMin`, `questionCount`, `accessWindowMin`, `areas`, `restrictedPackages`) desaparece.
- `language: "es" | "en"` (RF-78), `"es"` por defecto — mismo objeto `Config`, mismo repositorio (`storage/appRepository.ts`), sin storage nuevo.

**Foreground tracking**
- `foregroundPackage: string | null`, simple: ya no hace falta registrar segmentos ni acumular tiempo (RF-36 retirado) — solo para que `Tick` sepa qué app reevaluar.

**Ciclo de preguntas**
- `usedIds` por categoría, para no repetir hasta agotar (sin cambios de mecanismo, ahora se consulta con una sola categoría a la vez en vez de varias combinadas).

**Banco de preguntas** (`data/questions.es.json` + `data/questions.en.json`, RF-77)
- `{ id, area, question, options[4], correctIndex, explanation? }`, idéntica estructura y mismos `id` en los dos archivos — solo cambia el idioma del texto.
- Las áreas de texto: `general`, `technology`, `health`, `science`. La matemática y lógica no está en el JSON: la produce el generador (RF-24), que no depende del idioma (son números).
- `core/questions.ts` recibe el idioma activo y elige el archivo correspondiente al armar el banco; un reto ya en curso conserva las preguntas tal como se eligieron (mismo `ChallengeState` persistido), así que cambiar el idioma a mitad de un intento no lo afecta (C41 de la spec).

**Idioma de la interfaz** (`i18n/strings.ts`, RF-76, RF-77 — D38)
- Diccionario estático `{ es: Record<string, string>, en: Record<string, string> }` con las mismas claves en ambos idiomas; no se persiste acá (vive en `Config.language`).
- `LanguageProvider` (Context de React) se monta una sola vez en `_layout.tsx` raíz, lee `Config.language` al iniciar y expone `{ language, setLanguage, t }`; cualquier pantalla que necesite texto de fábrica usa `useStrings()` en vez de un string hardcodeado.

Todos los tiempos se guardan como **marcas absolutas**, por eso sobreviven al reinicio (RF-45) sin lógica extra.

## 4. Decisiones justificadas

| # | Decisión | Alternativa descartada | Por qué | RF |
|---|---|---|---|---|
| D1 | **Expo con dev build** (SDK 57 y React Native 0.86 al crear el proyecto) y generación nativa (`prebuild`) | React Native CLI (bare) | Decisión del usuario. El Kotlin va en un módulo local de Expo y los permisos, el servicio y el receptor de arranque se declaran en un plugin de configuración; no hay que mantener `android/` a mano. Coste: un plugin y un módulo que escribir | RF-27, 43, 45 |
| D2 | El **cerebro en TS** y lo nativo como sensor/actuador | Duplicar la lógica en Kotlin | Constitución 6; una sola implementación, probada sin dispositivo | todos |
| D3 | El reto es la **pantalla `/challenge` de la propia app**, abierta desde Kotlin con un enlace profundo sobre la app bloqueada | Actividad dedicada de React Native; vista RN dentro de `WindowManager` | Con Expo Router basta un enlace `blockproc://challenge?pkg=…`, sin segunda actividad que registrar en el manifest. Se lanza con `startActivity` directo y se apoya en la exención de `SYSTEM_ALERT_WINDOW` | RF-9, 31, 38, 39 |
| D4 | **Sondeo adaptativo** con `UsageStatsManager` con la pantalla encendida | Servicio de Accesibilidad | Prohibido por la constitución 3. Dos niveles: *vigilancia* (~500 ms, nadie restringido en primer plano, para "menos de 1 s") y *seguimiento* (1 s, app restringida abierta, para contar). Con la pantalla apagada no se sondea | RF-9, 36, 43 |
| D5 | **MMKV** para persistir | AsyncStorage | Lectura síncrona: el reto y las decisiones no esperan a un acceso asíncrono. Funciona en dev build de Expo. Dependencia nueva (constitución 11) | RF-25, 41 |
| D6 | **NativeWind** para estilos | Solo `StyleSheet` | Lo pide AGENTS.md y la constitución 12. Si da problemas con la versión de Expo, se cae a `StyleSheet` (la segunda opción ya prevista) | — |
| D7 | Notificaciones con **`NotificationManager` en Kotlin** | `expo-notifications` o `notifee` | Ya escribimos el módulo nativo; evita una librería pensada para push remoto | RF-15, 30, 33 |
| D8 | Avisos por **tick**, no por alarmas | `AlarmManager` exacto | Las alarmas exactas piden un permiso especial extra (choca con la constitución 3). El servicio ya corre con la pantalla encendida; al encender la pantalla se reevalúa | RF-33 |
| D9 | Tests en la **carpeta `tests/` de la raíz** | `blockproc/tests/` | Decisión del usuario. Jest se configura con `roots` apuntando a esa carpeta y el core se importa desde `blockproc/src/core`. Hay que comprobar en la primera tarea que Babel transforma esos archivos; plan B: `ts-jest` | — |
| D10 | Lista de apps con `<queries>` de lanzador | Permiso `QUERY_ALL_PACKAGES` | Se ven las apps con icono de lanzador, que es lo que se quiere restringir, sin un permiso más | RF-1 |
| D11 | **Expo Router** | React Navigation a mano | Es la plantilla por defecto de Expo, se apoya en React Navigation y además da los enlaces profundos que usa D3 | RF-1, 32 |
| D12 | **`@react-native-community/datetimepicker`** para elegir la hora | Selector de hora propio | El consumo de batería es igual: solo se usa en una pantalla y un instante. La diferencia es de esfuerzo: la librería trae el selector nativo de Android y accesibilidad, y es compatible con Expo. La validación de rango (máx. 12 h) sigue en el core | RF-17 |
| D13 | Al fallar el reto, durante la espera o el bloqueo horario, o al pulsar Atrás en esas pantallas, se **envía al usuario al inicio** | Dejarle en la app bloqueada | Si no, la app restringida quedaría visible tras cerrar el reto. **Acotado por D19/C7:** en la pantalla de éxito del reto, Atrás ya no aplica esta decisión — envía la app a segundo plano en su lugar | RF-13, 18, 19, 38, 39 |
| D14 | `minSdkVersion 26` con **`expo-build-properties`** | Dejar el valor por defecto de Expo | La constitución exige Android 8.0+ y el valor por defecto del SDK puede ser otro | — |
| D15 | Rediseño visual con **Stitch** (Google Labs): tokens de diseño (`theme.extend` de NativeWind) + componentes compartidos en `src/components/`, sobre las mismas 7 pantallas y los mismos RF ya cumplidos (T64) | Diseñar a mano sin herramienta, o dejar el estilo ad hoc actual | Sin sistema de diseño, cada pantalla repetía patrones (`AreaRow`/`AppRow` casi idénticos) con colores sueltos de Tailwind. Stitch generó un sistema completo ("Mindful Calm") consistente entre las 7 pantallas + ícono + splash, con `code.html` real (no solo imágenes) fácil de traducir a `theme.extend`. Se mantiene `#208AEF` (azul de marca ya existente) como `primary` en vez del que generó Stitch, y se suma la fuente `Plus Jakarta Sans` (`@expo-google-fonts/plus-jakarta-sans` + `expo-font`, dependencia nueva justificada acá) para igualar el diseño. El splash generado tenía frases animadas en JS que el splash nativo de Expo no puede mostrar (se ve antes de que cargue el JS); se usa solo la parte estática. **Modo oscuro:** Stitch no lo generó (no se pidió en los prompts); se deriva a mano de la misma paleta clara (misma convención de nombres, luminosidad invertida siguiendo Material You) con `darkMode: "media"` en `tailwind.config.js`, sin interruptor manual (sigue `userInterfaceStyle: "automatic"` ya configurado) — se construye junto con cada tarea, no aparte | — (sin RF nuevos: cambio de presentación, no de comportamiento) |
| D16 | Buscador en "Apps a restringir": filtro **100% en TypeScript puro** (`core/appSearch.ts`) sobre la lista ya cargada en memoria, normalizando mayúsculas y tildes, sin tocar nada nativo | Pedir la lista filtrada al sistema; una librería de búsqueda difusa (Fuse.js, etc.) | La lista ya está completa en memoria (`InstalledApp[]`); es lógica de negocio simple y se prueba sin dispositivo (constitución 6). Una dependencia nueva no se justifica para un `includes()` normalizado (constitución 11) | RF-46 |
| D17 | Ícono nativo: en Kotlin, `Drawable → Bitmap` (redimensionado a un tamaño fijo pequeño) `→ PNG → Base64` → data URI, devuelto como campo `iconUri: String?` en el mismo registro que ya usa `getInstalledLauncherApps()`; consumido en RN con `<Image source={{ uri }}>`. La función pasa de `Function` a **`AsyncFunction`** (soportada nativamente por Expo Modules), y sus dos llamadores actuales (`apps.tsx`, `dev.tsx`) se adaptan a la firma asíncrona, con un indicador de carga mientras se resuelve (C9) | Una librería de terceros para íconos nativos (dependencia nueva sin justificación previa, constitución 11); una vista nativa dedicada (`requireNativeComponent`) | Sin dependencia nueva: usa solo `android.graphics`/`android.util.Base64`, ya en el SDK de Android. El data URI viaja por el mismo bridge de siempre, y `<Image>` de React Native decodifica URIs `data:` de fábrica. `AsyncFunction` evita bloquear el hilo de JS mientras se decodifican decenas o cientos de íconos (hoy la función es síncrona) | RF-48 |
| D18 | Categoría: Kotlin solo pasa el **entero crudo** de `ApplicationInfo.category` (disponible desde API 26, coincide con `minSdkVersion 26`, ya presente en la misma consulta `queryIntentActivities()` que usa D10, sin consultas adicionales), o `null` si es `CATEGORY_UNDEFINED`; el mapeo a una etiqueta en español y el agrupamiento viven en **TS puro** (`core/appCategories.ts`), con tests. El buscador (D16) y las categorías se combinan (C8): ambos criterios se aplican a la vez | Mapear a texto en español directamente en Kotlin | Es una decisión de categorización/presentación testeable sin dispositivo (constitución 6); mantiene lo nativo "tonto" (solo reporta el dato del sistema), igual que ya hace `exclusions.ts` con los paquetes esenciales que reporta lo nativo | RF-49 |
| D19 | Nueva función nativa **`moveToBackground()`**: `appContext.currentActivity?.moveTaskToBack(true)`, sin lanzar si no hay actividad actual. Se usa tanto para el botón "Continuar a la app" como para el botón/gesto Atrás en la pantalla de éxito del reto (C7) | Reutilizar `goHome()` (D13) para el botón de éxito; usar `Activity.finish()` | `goHome()` navega explícitamente al lanzador (Intent `ACTION_MAIN`/`CATEGORY_HOME`) — no revela lo que había debajo, contradice el objetivo del botón. `finish()` destruye la única actividad de una app `singleTask`, obligando a reconstruirla en el próximo enlace profundo. `moveTaskToBack(true)` es el mecanismo estándar de Android para "actuar como si se hubiera presionado Inicio" dejando la tarea viva en segundo plano, revelando lo que sea que esté inmediatamente debajo en la pila de tareas del sistema, sin prometer qué es (RF-47) | RF-47 |
| D20 | Ajustes/Apps/Bloqueo horario pasan a un grupo `app/(tabs)/` de Expo Router (`Tabs`, `headerShown:false`, comportamiento de Atrás: vuelve primero a la pestaña Ajustes antes de salir de la app, C10), **sin renombrar** `settings.tsx`/`apps.tsx`/`schedule.tsx` (solo se mueven de carpeta). `/dev` queda fuera del grupo, alcanzable por `push` desde dentro de Ajustes, igual que hoy. Cada una de las 3 pantallas agrega un refresco de su estado de configuración por foco (`useFocusEffect`, ya disponible vía `@react-navigation/native`, dependencia transitiva de Expo Router — no es una dependencia nueva) | Mantener `Stack` (statu quo); un `Drawer`; renombrar las rutas a `/(tabs)/settings` etc.; salir de la app directo desde cualquier pestaña | Un grupo `(tabs)` de Expo Router **no aparece en la URL** — `app/(tabs)/settings.tsx` sigue resolviendo a la ruta `/settings`, así que `router.replace("/settings")` en `index.tsx` no necesita cambiar. Lo que sí cambia: por defecto cada pestaña queda montada una vez y no se desmonta al cambiar de pestaña (a diferencia de hoy, que con `push`/`pop` cada pantalla se remonta) — así que si el usuario activa un bloqueo horario en una pestaña y cambia a otra, esa otra no se entera sola, hace falta refrescar por foco. La lista de apps con íconos (D17, cara) solo se carga una vez por sesión al montar `apps.tsx` — el refresco por foco de esa pantalla relee *solo* el estado de configuración (barato, MMKV), no vuelve a pedir la lista de apps con íconos | — (sin RF nuevos: mismo comportamiento ya especificado en RF-19/RF-29, solo cambia la navegación; ver C10) |
| D21 | **Fase 9.** `PolicyState` suma `nextRestBlock: RestBlockState \| null` junto al `restBlock` de siempre (C11): un segundo espacio, nunca una lista. `nextRestBlock` nunca se evalúa con `isRestBlockActive`/`getRestBlockStatus` mientras `restBlock` siga activo; al terminar este (`getRestBlockStatus(restBlock, now) === "ended"`), el reductor lo "asciende" a `restBlock` y limpia `nextRestBlock` | Un array de bloqueos futuros; reemplazar directamente `restBlock` al confirmar uno nuevo | Un array abriría la puerta a lo que "Fuera de alcance" ya excluye (bloqueo recurrente/múltiples franjas). Reemplazar `restBlock` directo sería una forma indirecta de cancelar el bloqueo en curso, justo lo que RF-19 protege | RF-53, 54 |
| D22 | **Fase 9.** La pantalla de bloqueo horario activo (`restblock.tsx`) gana un botón "Programar otro bloqueo horario" que alterna a un **estado local de la misma pantalla** (sin navegar a ninguna ruta nueva), mostrando el mismo formulario que ya tiene `schedule.tsx` (`TimeCard` × 2, resumen, confirmar) pero apuntando a `nextRestBlock`, con el inicio calculado por `computeNextRestBlockStart(start, currentEndAt)` (C14: relativo al fin del bloqueo activo, no a "ahora" — ver D22b) | Una ruta nueva (ej. `/restblock/schedule-next`) con su propio manejo de `hardwareBackPress` | Evita duplicar el manejo de Atrás "sin salida" en una segunda pantalla: al ser el mismo componente, el único `hardwareBackPress` que ya tiene `restblock.tsx` sigue siendo la única fuente de verdad (Atrás desde el sub-formulario cancela y vuelve a la vista de bloqueo, un segundo Atrás va a Inicio como siempre) | RF-53, 54 |
| D22b | **Fase 9, C14 (corrección durante T97).** `computeNextRestBlockStart(start, currentEndAt)` calcula el inicio tomando `currentEndAt` (no "ahora") como referencia de día, y si esa hora cae en o después de `currentEndAt` lo usa; si no, suma 24 h (día siguiente) | Reutilizar `confirmRestBlock(start, end, now)` tal cual (el plan original) | "Ahora" siempre cae *dentro* del bloqueo activo mientras se programa el próximo: una hora de mañana ya "pasada hoy" se interpretaba como "empezar ya" (lógica de RF-34, pensada para confirmar desde un estado libre) y se rechazaba sin motivo. Calcular desde `currentEndAt` elimina el caso por completo: cualquier rango válido (RF-17) siempre encuentra cuándo ocurre, sin rechazos | RF-54 |
| D23 | **Fase 9.** Indicador de "programado" (RF-50): nueva función pura en `core/restBlock.ts`, `getPendingRestBlock(restBlock, nextRestBlock, now)`, que devuelve el bloqueo relevante a mostrar como "programado" — `restBlock` si su estado es `"scheduled"` (caso ya existente, hoy invisible fuera de la pestaña Bloqueo horario — la causa real del bug reportado), si no `nextRestBlock` si existe, si no `null`. `settings.tsx` y `apps.tsx` la consultan junto a `isEditingLocked` | Mirar `restBlock`/`nextRestBlock` por separado en cada pantalla | Lógica de negocio pura, testeable sin dispositivo (constitución 6); evita repetir el mismo `if` en cada pantalla que lo muestre | RF-50 |
| D24 | **Fase 9.** Texto explicativo de RF-51 como contenido estático en `settings.tsx` (un párrafo fijo, sin configuración ni estado) | Tooltips por campo; modal "¿Cómo funciona?" | Cambio mínimo y de bajo riesgo para resolver la confusión reportada; no agrega ningún componente ni estado nuevo | RF-51 |
| D25 | **Rediseño.** Un `Block` guarda `startAt`/`endAt` concretos para **ambos** tipos ("por tiempo" los calcula al confirmarse; "programado" usa los elegidos por el usuario) | Dos modelos de datos separados (`DurationBlock`/`ScheduledBlock`) | Unifica la detección de solapamiento (RF-59) y el cálculo de estado (programado/activo/terminado) en una sola función para los dos tipos; solo difieren en cómo se calculan al crear, nunca en tiempo de evaluación | RF-56, 59 |
| D26 | Solapamiento: función pura `findOverlap(blocks, packages, startAt, endAt, excludeId?)` que compara intervalos cerrados por cada app en común | Dejar que colisionen y resolver en tiempo real cuál manda | RF-59 exige rechazar la creación, no arbitrar un ganador; se llama también al editar un bloqueo programado (RF-61), excluyéndose a sí mismo | RF-59, 61 |
| D27 | `ChallengeState` reemplaza `dayKey` (expiraba a las 04:00) por `blockId` (expira cuando ese bloqueo deja de estar activo) | Mantener `dayKey` y agregar `blockId` aparte | Ya no existe "día de uso" en el modelo nuevo (RF-7 retirado); `isChallengeExpired` pasa a consultar la lista de bloqueos en vez de un calendario | RF-39 (adaptado) |
| D28 | El reto corta al acumular 2 respuestas incorrectas (`wrongCount`), sin importar la posición; llegar a la 3ª pregunta solo es posible con 0 o 1 fallo previo, así que terminarlas las 3 siempre es éxito | Comprobar "¿al menos 2 de 3 correctas?" como un paso aparte al final | Más simple: el reductor no necesita una cuenta final separada, el corte temprano y el criterio de éxito son la misma condición vista desde dos lados (ver C28 de la spec) | RF-65, 67 |
| D29 | Al fallar, se muestran las respuestas correctas de **las dos preguntas falladas**, no solo la última | Mostrar solo la última fallada (como el RF-13 viejo, pensado para un único fallo) | Con dos fallos posibles, ocultar el primero sería menos informativo sin ningún motivo — sigue el espíritu de H5 ("quiero ver la respuesta correcta para aprender") | RF-66 |
| D30 | El paso reflexivo (RF-63) y la confirmación (RF-64) son estados locales dentro de **`challenge.tsx`** (mismo archivo y ruta de siempre, sin renombrar), con `step: "reflect" \| "confirm" \| "questions"` | Rutas separadas para cada paso; renombrar a `access.tsx` | Mismo patrón que D22 (Fase 9): evita duplicar el manejo de `hardwareBackPress` en varias pantallas. Mantener el nombre/ruta evita tocar el módulo nativo: `BlockprocNative.showChallenge(pkg)` ya abre `blockproc://challenge?pkg=…`, sin ningún cambio en Kotlin | RF-63, 64 |
| D31 | `restblock.tsx` se elimina por completo; su reemplazo es `access.tsx`, igual que para cualquier otro bloqueo. La función nativa `showRestBlock()` y su enlace profundo se retiran del módulo nativo | Dejar `showRestBlock()` sin uso "por si acaso" | Ya no existe ningún bloqueo "sin salida" (C15); mantener código nativo muerto no tiene beneficio y confunde a quien lea `MonitorService.kt` después | RF-62 |
| D32 | La selección de apps se extrae a un componente reusable (ya no una pestaña propia), consumido como paso 1 de `create-block.tsx` | Mantener `apps.tsx` como pantalla independiente y navegar hacia ella desde el asistente | El paso 1 del asistente es exactamente esa misma pantalla (buscador, categorías, esenciales — RF-1, 28, 46, 48, 49); separarla en una ruta aparte solo agregaría navegación sin necesidad | RF-56 (C25 de la spec) |
| D33 | `blocks.tsx` filtra, en cada lectura, los bloqueos cuyo `endAt` ya pasó — no se persiste ningún estado "terminado" | Guardar un campo `status` que se actualiza por evento | Más simple y sin riesgo de quedar desactualizado: el estado siempre se deriva de `now` en el momento de leer, igual que ya hacía `getRestBlockStatus` en la Fase 9 | RF-55 |
| D34 | Se borra `core/usage.ts` y sus tests por completo | Dejarlo sin usar "por si hace falta después" | RF-36 retirado (C33 de la spec): ningún módulo restante necesita acumulación de tiempo de uso real; `foregroundPackage` pasa a ser un campo simple de `PolicyState`, sin segmentos | RF-36 (retirado) |
| D35 | Personalización (mensajes por defecto, RF-70) se puede editar **siempre**, sin ningún `isEditingLocked` global — se borran `core/configChange.ts` y la lógica de "pendiente hasta las 04:00" de `applyAndSaveConfig.ts` | Mantener el bloqueo de edición global mientras cualquier bloqueo esté activo (como el viejo RF-19) | Cambiar el default en Personalización nunca afecta a un bloqueo ya activo (RF-62: sus mensajes quedan congelados desde que se creó, son una copia, no una referencia) — no hay ningún motivo real para impedir editarlo | RF-70 |
| D36 | **Corrección durante T112-T116.** Al quitar un bloqueo terminado (`removeEndedBlocksIfNeeded`), también se borra el estado de acceso (`windowEndsAt`/`cooldownUntil`) de cada app de ese bloqueo, no solo el bloqueo | Dejar el estado de acceso tal cual, confiando en el orden de los chequeos de `evaluateForegroundApp` | Un test propio lo encontró: con una espera de 5 min de un bloqueo que ya terminó, un bloqueo *nuevo y distinto* que más tarde cubra la misma app heredaba esa espera vieja, mostrando `ShowWait` en vez del flujo normal — exactamente el caso límite C31 de la spec, pero causado por datos obsoletos, no por el orden de evaluación. Limpiar el estado al quitar el bloqueo lo evita de raíz | RF-62, 66, 67 |
| D37 | **Feedback de uso real (2026-10-03).** Las horas/minutos de "por tiempo" se eligen con un selector de rueda (`DurationWheelPicker`, dos columnas deslizables, horas 0-11 y minutos 0-55 de a 5), en vez de los botones +/- de `Field` | Chips de duración preestablecida + "Personalizado"; un slider 0-12h; mantener +/- con mejoras menores | El usuario probó los botones +/- en vivo y le costó llegar a valores chicos (8 toques para 5 min); eligió explícitamente la rueda entre las alternativas presentadas. Tope de horas en 11 para que el máximo posible (11h55) nunca supere las 12h de RF-56, sin lógica de tope cruzada. Sin dependencias nuevas | RF-56 |
| D38 | **Idioma.** Diccionario propio `i18n/strings.ts` (`{ es, en }`) + un `LanguageProvider` de React Context montado una sola vez en `_layout.tsx` raíz, sin librería externa | `react-i18next`/`i18n-js` | Constitución 11 (dependencias nuevas solo con justificación previa): no hace falta nada de pluralización/interpolación compleja ni de detección automática del idioma del sistema (RF-76 pide elegirlo a mano, español por defecto), así que un diccionario plano alcanza. Mismo patrón que D16 (buscador propio) y D37 (rueda propia): preferir código propio simple a una dependencia cuando el caso de uso es chico | RF-76, 77 |
| D39 | El `LanguageProvider` vive en el `_layout.tsx` **raíz** (no en el de `(tabs)`), para que cualquier pantalla abierta por enlace profundo (challenge, wait, create-block) también lo tenga disponible, no solo las 3 pestañas | Un provider solo dentro de `(tabs)/_layout.tsx` | Ese grupo no envuelve `challenge.tsx`/`wait.tsx`/`create-block.tsx` (son rutas hermanas, no hijas de `(tabs)`); el cambio de idioma tiene que verse ahí también (RF-76: "toda la interfaz") | RF-76 |
| D40 | `core/questions.ts` recibe el idioma activo como parámetro y elige `questions.es.json` o `questions.en.json`; no se tocan `challengeQuestions.ts`/`challengeSession.ts`/`questionSelector.ts`, que ya eran agnósticos al contenido del banco | Un solo archivo con ambos idiomas mezclados por pregunta (`{ id, es: {...}, en: {...} }`) | Dos archivos separados, mismos `id`, es más simple de generar y de revisar en tandas (245 preguntas) que un formato anidado nuevo; mantiene el formato `Question` ya validado y testeado tal cual | RF-77 |
| D41 | `challenge.tsx` revisa `block.extreme` apenas carga el bloqueo activo: si es `true`, renderiza directo la pantalla sin salida (solo `block.blockMessage`, sin botones, `hardwareBackPress` siempre va a Inicio) y nunca entra a los pasos "reflect"/"confirm"/"questions". `policy.ts` **no cambia**: sigue emitiendo `ShowAccess` igual que para cualquier bloqueo | Un `PolicyAction` nuevo (`ShowExtremeBlock`) decidido en `policy.ts`; una ruta nativa nueva (`showExtremeBlock()`) | Mismo razonamiento que D30: un bloqueo extremo nunca llega a tener `windowEndsAt`/`cooldownUntil` seteados (esos solo se escriben al completar o fallar un reto que un bloqueo extremo jamás ofrece), así que `policy.ts` siempre evalúa "sin ventana, sin cooldown" y emite `ShowAccess` de la forma de siempre — la única diferencia real está en qué UI se muestra del otro lado del mismo enlace profundo, igual que el paso reflexivo de D30 no necesitó tocar Kotlin | RF-74 |
| D42 | La etiqueta "Extremo" (RF-75) se calcula leyendo `block.extreme` directamente en `blocks.tsx`, sin ningún estado derivado nuevo | Guardar un campo calculado aparte | `extreme` ya es un campo plano del `Block`; no hace falta derivarlo de nada | RF-75 |
| D43 | **Descubrimiento durante T160.** `core/appCategories.ts` deja de traducir la categoría de Android a una etiqueta en español (`categoryLabel`): ahora devuelve una `CategoryKey` estable (`categoryKey`), y la etiqueta visible por idioma vive en `i18n/strings.ts` (`appPicker.categoryLabels`, `Record<CategoryKey, string>`) | Dejar `categoryLabel` como estaba, sin extraerlo a T160 (quedaba fuera del alcance original de la tarea) | Las categorías del buscador de apps ("Redes sociales", "Productividad", etc.) son texto de UI igual que cualquier otro; dejarlas hardcodeadas en español habría sido un hueco real de RF-77 (la interfaz no se traduce por completo). El tipo `Record<CategoryKey, string>` de TypeScript ya obliga a que ambos idiomas cubran las 10 claves, sin necesitar un test de paridad aparte | RF-49, 77 |

## 5. Módulos y RF que cubre cada uno

> La tabla de abajo describe el reparto **tras el rediseño**. Ver "Módulos y RF" previos a
> esta edición (historial en `git log`) para el reparto del modelo anterior.

| Módulo | Contenido | RF | Verificación |
|---|---|---|---|
| `core/config` | Mensajes por defecto, idioma, validación, datos corruptos/modelo anterior | 41, 70, 78 | Auto |
| `core/exclusions` | Filtra apps esenciales a partir de los paquetes que da lo nativo | 28 | Auto (filtro); Manual (identificación real de paquetes) |
| `core/blocks` | Tipo/estado de bloqueo (programado/activo/terminado), solapamiento, filtrar terminados, validación de duración, marca "extremo" | 55, 56, 59, 61, 62, 68, 72, 73, 75 | Auto |
| `core/challengeState` / `challenge/challengeFlow` | Reto de hasta 3 preguntas, corta al 2º fallo, concede ventana o inicia espera, conserva al abandonar | 37, 65, 66, 67 (vía `policy`) | Auto |
| `core/questions` | Carga y validación del banco por idioma, ciclo sin repetir (una categoría), generador matemático | 23, 24, 77 | Auto |
| `core/policy` | Reductor: estado por app + bloqueos → acciones (`ShowAccess`, `ShowWait`, `NotifyBlockStarting`) — sin cambios para bloqueo extremo (D41) | 62, 63, 64, 65, 66, 67, 68, 72 | Auto (decisiones) |
| `i18n` | Diccionario es/en y `LanguageProvider` (D38, D39) | 76, 77 | Auto (el diccionario tiene las mismas claves en ambos idiomas) |
| `storage` | Repositorio sobre MMKV, descarta datos del modelo anterior | 25, 41 | Auto (con doble en memoria) |
| Nativo: servicio y receptor de arranque | Sin cambios de comportamiento; deja de invocar `showRestBlock` | 27, 43, 45 | Manual |
| Nativo: permisos y lista de apps | Sin cambios | 1, 26, 28 | Manual |
| Nativo: lanzar reto/espera y notificar | `showChallenge`/`showWait` reusados sin cambios (D30, D41); `showRestBlock` retirado (D31); aviso 2 min generalizado a cualquier bloqueo "programado" | 63, 66, 68 | Manual |
| UI | Lista de bloqueos (+ etiqueta "Extremo"), asistente de creación (+ toggle "extremo"), acceso (reflexión+confirmación+reto, o pantalla sin salida si es extremo), espera, Personalización reducida, Ajustes nuevo (idioma + Acerca de) | 1, 46, 48, 49, 55–64, 69, 70, 44, 73–76, 79 | Manual |

## 6. Estrategia de pruebas

1. **Unitarias del core (Jest, primero).** Un archivo por módulo en `tests/`, con reloj falso. Casos límite: bloqueo que cruza medianoche, duración de 0 min y de más de 12 h (rechazados), solapamiento de franjas por app compartida (duración+duración, duración+programado, programado+programado), exactamente 5 min de espera, ventana de 2 min, corte del reto al 2º fallo en cualquier posición, ciclo de preguntas con pocas restantes en una sola categoría.
2. **Escenarios de "un bloqueo de punta a punta".** Secuencias de eventos sobre el reductor que reproducen los criterios de aceptación de la spec: crear un bloqueo, que se active, abrir una app incluida (reflexión → confirmación → reto), fallo con espera, acierto con ventana, bloqueo que termina a mitad del reto/espera/ventana (se libera de inmediato), reinicio con bloqueos guardados en cualquier estado.
3. **Validación del banco.** Un test recorre `questions.es.json` **y** `questions.en.json`: 4 opciones, `correctIndex` válido, área conocida, sin duplicados, al menos 60 por área de texto, y los dos archivos tienen exactamente el mismo conjunto de `id` (ni preguntas de más ni de menos en ninguno de los dos idiomas).
4. **Diccionario de idioma.** Un test recorre `i18n/strings.ts` y confirma que `es` y `en` tienen exactamente las mismas claves (ninguna huérfana en un idioma y faltante en el otro).
5. **Nativo y UI: demo manual** en un móvil real con Android 17, con la lista de RF marcada en la spec, incluido el modo avión, el reinicio durante un bloqueo, un bloqueo extremo activo, y el cambio de idioma. Lo nativo se mantiene fino (sin decisiones) para acotar el riesgo — este round no toca ningún archivo Kotlin (D41).
6. **Calidad:** `tsc --noEmit` y ESLint en cada tarea (constitución 10).

## 7. Riesgos y comprobaciones previas

La primera tarea es un **prototipo mínimo en el móvil real (Android 17)**, antes de construir el resto.

Lo que sí está confirmado en la documentación oficial de Android:
- `SYSTEM_ALERT_WINDOW` figura como exención para iniciar actividades desde segundo plano, sin condiciones de versión añadidas ([guía de BAL](https://developer.android.com/guide/components/activities/background-starts)).
- Con `SYSTEM_ALERT_WINDOW`, iniciar un servicio en primer plano desde segundo plano exige además una **ventana superpuesta visible** si la app apunta a Android 15 o superior ([restricciones de servicios](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start)).
- Android 17 endurece el inicio de actividades desde segundo plano para `IntentSender` y anima a abandonar `MODE_BACKGROUND_ACTIVITY_START_ALLOWED` ([cambios de Android 17](https://developer.android.com/about/versions/17/behavior-changes-17)). Nuestro diseño usa `startActivity` directo desde el servicio, no `PendingIntent`.

No encontré en las páginas revisadas cambios de Android 17 sobre `PACKAGE_USAGE_STATS`, overlays o servicios en primer plano, pero no revisé todas (por ejemplo, "behavior changes for all apps"), así que **lo verifica el prototipo**.

| Riesgo | Qué se comprueba | Plan B |
|---|---|---|
| R1. Abrir `/challenge` desde segundo plano | Que `startActivity` desde el servicio funciona en Android 17 con el permiso de superposición | Vista nativa en `WindowManager` con texto simple |
| R2. "Menos de 1 s" frente a batería | Latencia medida con el sondeo a ~500 ms y su consumo | Subir el intervalo o mover la decisión rápida a Kotlin con un resumen del estado |
| R3. Motor JS vivo en segundo plano | Memoria y batería con el servicio activo (Headless JS) | Lo mismo que R2 |
| R4. Servicio en primer plano y arranque tras reinicio | Tipo de servicio declarable y que arranque desde el reinicio | Reanudar al abrir la app |
| R5. Versiones de MMKV, NativeWind y Jest con Expo | Que instalen, compilen y que Jest lea `tests/` | `StyleSheet` / AsyncStorage / `ts-jest` |
| R6. Módulo local y plugin de configuración | Que el plugin declare servicio, receptor y permisos tras `prebuild` | Editar el manifest a mano tras `prebuild` (dejar de versionar solo lo generado) |

### R1 y R2: medición real (T10, Pixel 6a, Android 17)

Con el servicio de la T09 corriendo y un paquete de prueba fijo (`com.android.settings`, sin relación con las apps restringidas reales, que no existen hasta la T14), se lanzó ese paquete y se abrió `/challenge` mediante `startActivity` con `ACTION_VIEW` sobre `blockproc://challenge` desde el servicio. **R1 confirmado: funciona.** No hizo falta el plan B (vista en `WindowManager`).

Latencia de extremo a extremo (desde el comando que abre la app de prueba hasta que `/challenge` está montado en pantalla), medida con la hora del propio dispositivo en ambos extremos:

| Prueba | Detección (sondeo) | Nativo → JS (abrir actividad + montar) | Total |
|---|---|---|---|
| 1 | 322 ms | 139 ms | 461 ms |
| 2 | 373 ms | 64 ms | 437 ms |

Ambas muestras quedan bien por debajo del segundo de RF-9, con margen. La medición es de una sola vez con la app y el servicio ya activos (no arranque en frío), tal como aclara el requisito no funcional de rendimiento. Queda pendiente para la T12 medir el consumo de batería del sondeo a 500 ms (R2, la parte de batería, y R3).

### R4: confirmado en un reinicio real (T11, Pixel 6a, Android 17)

**Funciona: el receptor de arranque reanuda el servicio sin abrir la app.** Tras varios reinicios de prueba apareció una advertencia real que conviene anotar, no del receptor en sí, sino de dos condiciones necesarias para que se dispare:

1. **"Estado detenido" (`stopped`).** Si la app se fuerza a cerrar (`am force-stop`, o el usuario la "Detiene" desde Ajustes), Android dejará de entregarle `BOOT_COMPLETED` hasta que se vuelva a abrir al menos una vez ([documentación oficial](https://developer.android.com/develop/background-work/background-tasks/broadcasts/broadcast-exceptions)). Durante las pruebas, reinstalar la app muchas veces seguidas (`expo run:android`) dejó el paquete repetidamente en este estado incluso tras abrirla; una desinstalación y reinstalación limpia lo resolvió. Es un efecto del ciclo de desarrollo, no algo que vaya a afectar a un usuario real que instala la app una vez.
2. **La entrega puede tardar más de un minuto.** El sistema encola `BOOT_COMPLETED` en una cola de baja prioridad ("OFFLOAD") cuando hay muchas apps compitiendo al arrancar; en las pruebas tardó entre 1 y 2 minutos en llegar. No es un fallo: solo hay que esperar más de lo que parece razonable antes de dar por sentado que no funcionó.

También se confirmó, aparte del propio receptor, un hueco de la T09: sin pedir el permiso de notificaciones (Android 13+, `POST_NOTIFICATIONS`), el servicio arranca igual pero **la notificación queda oculta**. Se añadió una fila más en la pantalla de prueba para pedirlo, y con el permiso concedido la notificación ("blockproc — Vigilando el uso de las apps restringidas") sí aparece tras el reinicio.

### R2 (batería) y R3: medición real de 20 minutos (T12, Pixel 6a, Android 17)

Con el servicio en segundo plano (la app sin ninguna Activity visible, tras pulsar Inicio) y la pantalla forzada a encendida (`svc power stayon true`, para aislar el costo del sondeo del efecto de que la pantalla se apague), se reinició el contador de batería (`dumpsys batterystats --reset`) y se dejó correr 20 minutos, con una foto de CPU cada 5 minutos.

**CPU** (`dumpsys cpuinfo`, proceso completo, pantalla siempre encendida): estable entre 9% y 12% de un núcleo durante toda la prueba, sin subir con el tiempo. Es más de lo que "solo sondear cada 500 ms" sugiere a simple vista, porque incluye tener el motor de React Native/Hermes residente en memoria sin hacer nada (R3): es el costo base de mantener JS vivo, no crece con el tiempo, y no hay fugas de memoria evidentes en 20 min.

**Batería** (`dumpsys batterystats`, UID de blockproc, estado `FGS` confirmado durante toda la prueba): **1.13 mAh estimados en 20 min 49 s**, todo en CPU y todo en segundo plano; **sin ningún `wake lock` propio** (el sondeo se apoya en que la pantalla ya mantiene despierto al procesador, tal como exige RF-43, en vez de forzarlo con un `WakeLock`). Llevado al peor caso teórico —pantalla encendida las 24 horas, algo que ningún uso real alcanza— equivale a ≈ 1,2 % de un móvil de 4420 mAh al día.

**Decisión escrita: se mantiene el sondeo a 500 ms.** El costo medido es pequeño incluso en el escenario más pesado posible, no hay `wake locks` propios que puedan interferir con el ahorro de energía del sistema (coherente con la decisión E4 de la spec), y el margen de latencia medido en la T10 (bajo 500 ms de punta a punta) se sostiene sobre este intervalo. No hace falta subir el intervalo ni mover la decisión a Kotlin por ahora; se revisita si una medición con uso real (fase 6) muestra otra cosa.

### T63: demo manual completa (Pixel 6a, Android 17, uso real con Chrome)

A diferencia de las pruebas anteriores (paquete de prueba fijo, botones de `/dev` que simulan el estado), esta demo usó una app restringida real (Chrome) con límites cortos (5 min diario, ventana de 5 min, 1 pregunta) y tiempo de reloj real, sin atajos. Precisamente por no pasar por `/dev` entre cada paso, esta demo encontró tres fallos reales que las pruebas anteriores no habían visto:

- **RF-27 (arreglado):** el canal de notificación del servicio usaba `IMPORTANCE_MIN`, que Android colapsa a una barra casi invisible al fondo de la bandeja, sin ícono ni texto legible. Se subió a `IMPORTANCE_LOW` (visible, sin sonido) con un id de canal nuevo (`monitor_v2`, ver el comentario en `MonitorService.kt`: la importancia de un canal ya creado no se puede subir por código, solo a mano por el usuario).
- **RF-14 (arreglado):** con `MainActivity` (singleTask) tapada por la app restringida sin pasar por el inicio de Android, un segundo aviso para la misma app llegaba con la misma ruta y los mismos parámetros que el anterior; Expo Router no volvía a montar la pantalla y esta se quedaba mostrando el resultado ya resuelto del reto previo en vez de pedir uno nuevo. Se agregó un parámetro `t` (el instante de cada aviso, siempre distinto) a los enlaces de `showChallenge`/`showWait`/`showRestBlock`, y las pantallas correspondientes ajustan su estado durante el render cuando ese parámetro cambia (el patrón de React para "reiniciar" una pantalla reutilizada, no un efecto).
- **RF-15, RF-30, RF-33 (arreglado, el más serio):** nada en el lado nativo disparaba jamás el evento `Tick` del supervisor — `MonitorService.kt` solo llamaba a la tarea Headless JS cuando cambiaba la app en primer plano (`ForegroundChanged`), nunca de forma periódica. Con una app restringida quieta en primer plano (el caso normal que estos tres avisos necesitan detectar), el aviso de "falta 1/2 minutos" no podía dispararse nunca, aunque `handleTick` en `policy.ts` ya estaba bien probado con Jest. Se agregó un disparo de `Tick` cada 10 s, reaprovechando el mismo sondeo ya atado a pantalla encendida/apagada (RF-43), en vez de un segundo `Handler`.

Verificado en el móvil, de punta a punta y con tiempo real, tras los tres arreglos:

| RF | Escenario | Resultado |
|---|---|---|
| RF-9, 31 | Chrome alcanza el límite diario (5 min) en primer plano | `/challenge` aparece de inmediato ✅ |
| RF-30 | Falta 1 min para el límite | Aviso "Límite de uso — Te queda 1 minuto de uso hoy" ✅ (tras el arreglo del Tick) |
| RF-12 | Reto acertado | Ventana de acceso concedida (5 min) ✅ |
| RF-15 | Falta 1 min para que termine la ventana | Aviso "Ventana de acceso — Tu acceso termina en…" ✅ (tras el arreglo del Tick) |
| RF-16 | Vence la ventana con Chrome en primer plano | Reto nuevo, con pregunta distinta a la anterior ✅ (tras el arreglo de RF-14) |
| RF-18 | Bloqueo horario activo, se abre Chrome (restringida) | `/restblock` con el mensaje y sin reto, no `/challenge` ✅ |
| RF-22 | Bloqueo horario activo, se abre Calculadora (no restringida) | Abre normal, sin ninguna interferencia ✅ |
| RF-26 | Permisos ya concedidos | Guía de permisos no se muestra (ya verificado a fondo en la T53) ✅ |
| RF-27 | Servicio iniciado | Notificación "blockproc — Vigilando…" visible y legible ✅ (tras el arreglo de importancia) |
| RF-43 | Pantalla apagada 15 s | Sin ninguna actividad del servicio en el registro (`BlockprocMonitor`) ✅ |
| RF-45 | Reinicio del móvil con un bloqueo horario activo | El servicio se reanuda solo (notificación visible sin abrir la app) y `/restblock` retoma la hora de fin exacta de antes del reinicio (15:36) ✅ |
| — | Modo avión activado y desactivado | La app, al ser 100% local (principio 8), sigue funcionando sin ningún cambio ✅ |

**Sin fallos pendientes tras los tres arreglos.** El dispositivo usado es el propio del usuario (no uno de pruebas): la configuración de prueba (Chrome restringida, límites de 5 min) se deshizo al terminar, dejando `restrictedPackages` vacío y los valores por defecto (30 min, 2 preguntas, ventana de 5 min) para no interferir con su uso real.

### T64: validación final, RF por RF

La T63 dejó sin confirmar en vivo el aviso de 2 minutos antes de un bloqueo horario (RF-33): en su propia demo, el margen resultó siempre menor a 2 min y el bloqueo se activó de inmediato (RF-34) en vez de mostrar el aviso. Se hizo una comprobación aparte, con un margen amplio (~5 min) para no repetir el mismo problema de sincronización: se programó un bloqueo de 16:20 a 16:25 confirmando a las 16:15, y a las 16:19 apareció la notificación **"Bloqueo horario — El bloqueo horario empieza en 2 minutos"**, separada de la notificación fija del servicio y sin ningún botón de acción. **RF-33 confirmado.**

Con esto, cada uno de los 45 RF de la spec tiene al menos una verificación (automática, manual, o ambas) y un resultado:

| RF | Qué exige | Verificación | Resultado |
|---|---|---|---|
| 1 | Lista de apps con icono, excluye esenciales | Auto: `exclusions.test.ts`. Manual: T54 (`/apps`), T46 | ✅ |
| 2 | Una sola configuración global para todas las restringidas | Auto: tipo `Config` único; `dailyScenario.test.ts` (mismo config, dos apps). Manual: `/settings` (un solo formulario) | ✅ |
| 3 | Límite diario por defecto: 30 min | Auto: `config.test.ts` | ✅ |
| 4 | Rangos válidos (5-240/5, 1-3, 5-10) y rechazo fuera de rango | Auto: `config.test.ts`. Manual: T55 | ✅ |
| 5 | Áreas de preguntas, mínimo una | Auto: `config.test.ts` (`isValidAreas`, `toggleArea`). Manual: T56 | ✅ |
| 6 | Mensaje de enfoque, 120 car., por defecto | Auto: `config.test.ts` (`isValidMessage`). Manual: T56 | ✅ |
| 7 | Contador por app, corte a las 04:00 | Auto: `usage.test.ts`, `clock.test.ts` | ✅ |
| 8 | Se marca bloqueada al alcanzar el límite | Auto: `usage.test.ts`, `policyLimit.test.ts` | ✅ |
| 9 | Reto en menos de 1 s | Auto: `policyLimit.test.ts`. Manual: T10 (461/437 ms medidos), T63 (Chrome real) | ✅ |
| 10 | Uso libre bajo el límite | Auto: `policyLimit.test.ts` | ✅ |
| 11 | Cantidad exacta, mezcladas, sin repetir hasta agotar | Auto: `questionSelector.test.ts`, `challengeQuestions.test.ts`, `dailyScenario.test.ts` | ✅ |
| 12 | Acierto concede ventana solo a esa app | Auto: `policyWindow.test.ts`, `challengeState.test.ts`, `challengeFlow.test.ts`. Manual: T59, T63 | ✅ |
| 13 | Fallo corta el reto, muestra respuesta y explicación, 3 min | Auto: `challengeState.test.ts`, `policyCooldown.test.ts`. Manual: T59 | ✅ |
| 14 | Nuevo intento trae preguntas nuevas | Auto: `policyCooldown.test.ts`, `dailyScenario.test.ts`. Manual: T63 (bug real encontrado y arreglado) | ✅ |
| 15 | Aviso a 1 min de que termine la ventana | Auto: `policyWindow.test.ts`. Manual: T63 (tras arreglar el Tick) | ✅ |
| 16 | Fin de ventana bloquea de nuevo y exige reto | Auto: `policyWindow.test.ts`. Manual: T63 | ✅ |
| 17 | Rango horario, cruza medianoche, máx. 12 h | Auto: `restBlockRange.test.ts`. Manual: T58 | ✅ |
| 18 | Bloqueo sin reto, con su mensaje | Auto: `policyRestBlock.test.ts`. Manual: T61, T63 | ✅ |
| 19 | Sin salida durante el bloqueo, sin editar configuración | Auto: `restBlockLifecycle.test.ts`, `applyAndSaveConfig.test.ts`. Manual: T57, T62, T63 | ✅ |
| 20 | Cancelar antes del inicio no lo activa | Auto: `restBlockLifecycle.test.ts`. Manual: T58 | ✅ |
| 21 | Coincide con el límite diario → gana el bloqueo horario | Auto: `policyRestBlock.test.ts`, `dailyScenario.test.ts` | ✅ |
| 22 | Solo afecta a las apps restringidas | Auto: `policyRestBlock.test.ts`. Manual: T63 (Calculadora sigue funcionando) | ✅ |
| 23 | Banco local en español, sin internet | Auto: `questions.test.ts`, `data/questions.test.ts` (245 preguntas) | ✅ |
| 24 | Matemática/lógica de un generador local | Auto: `mathQuestions.test.ts` | ✅ |
| 25 | Todo se guarda solo en el dispositivo | Auto: `appRepository.test.ts`, `challengeRepository.test.ts`, `keyValueStore.test.ts` (MMKV). Diseño: ninguna llamada de red en el código | ✅ |
| 26 | Guía si falta un permiso | Manual: T53 (ciclo completo revocar/conceder) | ✅ |
| 27 | Servicio en 2º plano con notificación visible | Manual: T09. T63 encontró y arregló `IMPORTANCE_MIN` → `IMPORTANCE_LOW` | ✅ |
| 28 | Nunca ofrece las apps esenciales | Auto: `exclusions.test.ts`. Manual: T46 | ✅ |
| 29 | Endurecer al instante, relajar a las 04:00 | Auto: `configChange.test.ts`, `configUpdate.test.ts`, `applyAndSaveConfig.test.ts`. Manual: T57 | ✅ |
| 30 | Aviso a 1 min del límite | Auto: `policyLimit.test.ts`. Manual: T63 (tras arreglar el Tick) | ✅ |
| 31 | Reto inmediato al alcanzar el límite en primer plano | Auto: `policyLimit.test.ts`. Manual: T63 | ✅ |
| 32 | Resumen y confirmación antes de activar | Auto: `restBlockLifecycle.test.ts`. Manual: T58 | ✅ |
| 33 | Aviso a 2 min del inicio, sin botón de cancelar | Auto: `restBlockWarning.test.ts`. Manual: T64 (demo dedicada, arriba) | ✅ |
| 34 | Menos de 2 min o ya pasada → activación inmediata | Auto: `restBlockWarning.test.ts`. Manual: T58, T63, T64 (se dio varias veces sin buscarlo) | ✅ |
| 35 | Mensaje del bloqueo horario, por defecto | Auto: `config.test.ts`, `restBlockMessage.test.ts`. Manual: T61 | ✅ |
| 36 | Solo primer plano con pantalla encendida, ignora <1 s | Auto: `usage.test.ts` | ✅ |
| 37 | Opciones barajadas | Auto: `challengeSession.test.ts`. Manual: T59 | ✅ |
| 38 | Pantalla de espera con cuenta atrás y mensaje | Auto: `policyCooldown.test.ts`. Manual: T60 | ✅ |
| 39 | Reto abandonado se conserva hasta las 04:00 | Auto: `challengeState.test.ts`, `challengeFlow.test.ts`. Manual: T59, T62 | ✅ |
| 40 | Bloqueo horario corta una ventana activa | Auto: `policyRestBlock.test.ts`, `dailyScenario.test.ts` | ✅ |
| 41 | Configuración corrupta o primera vez → valores por defecto | Auto: `normalizeConfig.test.ts`, `normalizeUsage.test.ts`, `challengeRepository.test.ts` | ✅ |
| 42 | Robusto a cambios de reloj (horario de verano, viajes) | Auto: `restBlockWarning.test.ts` | ✅ |
| 43 | Sin pantalla encendida, no consulta primer plano | Auto: `policyScreenAndReboot.test.ts`. Manual: T63 (15 s sin ninguna actividad en el registro) | ✅ |
| 44 | Nota fija sobre el ahorro de batería | Manual: T56 (`/settings`) | ✅ |
| 45 | Reinicio retoma servicio y estado con su hora de fin | Auto: `policyScreenAndReboot.test.ts`. Manual: T11, T63 (reinicio real con un bloqueo horario activo) | ✅ |

**Veredicto final: spec cumplida.** Los 45 RF de `spec.md` tienen verificación automática, manual, o ambas, y los tres fallos reales que aparecieron durante las demos (T63: notificación invisible, pantalla de reto repetida, Tick nunca disparado) quedaron corregidos y reconfirmados en la misma sesión. No queda ningún RF pendiente.

### T77: verificación final de la Fase 7 (rediseño "Mindful Calm")

A diferencia de T63/T64 (verificación de comportamiento, RF por RF), esta pasada verifica **presentación**: que el sistema de diseño de Stitch, traducido en T65-T76, se vea correcto en el dispositivo real y que ningún comportamiento se haya alterado en el camino. Reinstalación limpia (`adb uninstall` + `expo run:android`), permisos re-concedidos, y recorrido de las 7 pantallas + ícono + splash, en modo claro y oscuro, comparando contra los mocks de `stitch_blockproc_ui_design/` (modo claro) y la paleta oscura derivada a mano en T65 (modo oscuro):

| Pantalla | Modo oscuro | Modo claro | Notas |
|---|---|---|---|
| Ícono de la app | — (no depende del tema) | ✅ | Visible en la pantalla de recientes: símbolo del anillo de enfoque en degradado derivado de `#208AEF` |
| Splash (arranque en frío) | ✅ | ✅ | Idéntico en ambos modos (correcto: se muestra antes de que cargue JS/tema); símbolo + wordmark "blockproc" sobre `#208AEF` |
| `index.tsx` (Permisos) | ✅ (T68) | ✅ (T68) | Ya verificado a fondo en T68, incluida la guía real de permisos (RF-26) |
| `settings.tsx` (Ajustes) | ✅ | ✅ | Campos, stepper, checkboxes de áreas y botón Guardar correctos en ambos modos |
| `apps.tsx` | ✅ | ✅ | Lista de apps y `SelectableRow` correctos en ambos modos |
| `schedule.tsx` | ✅ | ✅ | Tarjetas de hora, resumen y botón Confirmar correctos en ambos modos |
| `challenge.tsx` (pregunta) | ✅ | ✅ | Insignias de letra (A/B/C/D) correctas en ambos modos |
| `challenge.tsx` (correcto) | ✅ (T72) | ✅ | Mensaje de éxito correcto |
| `challenge.tsx` (incorrecto) | ✅ | ✅ | Banner "Espacio de descanso activado" (tono `locked`) correcto en ambos modos |
| `wait.tsx` | ✅ | ✅ | Anillo de cuenta atrás y mensaje de enfoque correctos, cuenta atrás en vivo confirmada en ambos modos |
| `restblock.tsx` | ✅ | ✅ | Insignia "Bloqueo horario activo" y mensaje correctos en ambos modos |

**Sin regresiones de comportamiento.** `tsc --noEmit`, `expo lint` y los 265 tests de Jest quedaron en verde tras cada tarea de la Fase 7 (T65-T77) y en esta pasada final. El dispositivo (propio del usuario) quedó restaurado: modo oscuro, permisos concedidos, sin apps restringidas ni bloqueo horario programado, valores de ajustes en los de fábrica (30 min, 2 preguntas, ventana de 5 min, solo "Conocimiento general").

**Veredicto: Fase 7 completa.** Las 7 pantallas, el ícono y el splash usan el sistema de diseño "Mindful Calm" derivado de Stitch (con `#208AEF` como color de marca, no el azul que generó la herramienta), con modo oscuro propio en todas partes, sin alterar ningún RF de `spec.md` ya validado en T63/T64.

### T78: corrección post-diagnóstico de UX/UI (header, espacios vacíos, contraste)

Al revisar las capturas de T77, el usuario señaló que el resultado se sentía "tosco y poco intuitivo", puntualizando la barra blanca del título de cada sección. El diagnóstico encontró tres problemas concretos, uno de ellos con una implicación funcional real:

1. **Header nativo sin diseñar.** `_layout.tsx` usaba `<Stack />` sin `screenOptions`: cada pantalla mostraba el header por defecto de React Navigation (fondo blanco, título = nombre de archivo de la ruta en inglés/minúscula), duplicando el título que cada pantalla ya muestra con estilo propio, y chocando fuerte contra el fondo oscuro en modo noche.

   **Hallazgo de seguridad confirmado, no solo cosmético:** `MainActivity` es `singleTask` y los enlaces profundos a `challenge`/`wait`/`restblock` (`BlockprocNativeModule.kt`) reutilizan esa misma instancia sin resetear el stack de navegación. Si el usuario ya había navegado dentro de la app (p. ej. `settings` → `apps`) antes de que una app restringida disparara el enlace profundo, el header (sin ninguna opción) podía mostrar una flecha "atrás" tocable en esas tres pantallas de bloqueo. Esa flecha llama a `navigation.goBack()` directamente, sin pasar por el listener de `hardwareBackPress` que esas pantallas usan para forzar `goHome()` — es decir, existía una forma de sortear la regla de "sin ninguna salida" (RF-13/18/19) tocando esa flecha, un bypass distinto y no cubierto por `predictiveBackGestureEnabled: false` (ya deshabilitado para el gesto de Android 13+).

   **Corrección:** `headerShown: false` global en `_layout.tsx` (elimina la clase de bug de raíz, no solo en las pantallas actuales), un componente nuevo `BackButton` para las pantallas que sí navegan hacia atrás (`apps.tsx`, `schedule.tsx`, `dev.tsx`) y `SafeAreaView` (`react-native-safe-area-context`, ya usada internamente por Expo Router) en las 7 pantallas + `dev.tsx` para reemplazar el área segura que el header proveía automáticamente. `challenge.tsx`/`wait.tsx`/`restblock.tsx` deliberadamente sin `BackButton`.

2. **Espacios vacíos grandes** en `schedule.tsx`, `challenge.tsx` (pregunta), `wait.tsx` y `restblock.tsx`. Corregido sin agregar lógica nueva: tarjetas y tipografía más grandes (`TimeCard` a `headline-xl`), una tarjeta "Resumen" también en la rama programado/activo de `schedule.tsx` (reutilizando `restBlock.startAt`/`endAt`), una barra de progreso segmentada en `challenge.tsx` (mismo dato que "Pregunta X de Y"), un círculo decorativo de fondo detrás del anillo de `wait.tsx` reutilizado en `restblock.tsx`, y en `restblock.tsx` una tarjeta "Hasta las" (reutilizando `restBlock.endAt`) más la reutilización del componente `Banner` (tono `locked`) en vez de la mezcla de `View`s sueltos de antes.

3. **Bajo contraste tarjeta/fondo:** `surface-container-lowest` (casi idéntico a `surface`, e incluso más oscuro que el fondo en modo oscuro, invirtiendo la elevación de Material You) reemplazado por `surface-container` en `SelectableRow`, `Field` (solo el contenedor exterior), las opciones y tarjeta de fallo de `challenge.tsx`, la tarjeta de permiso pendiente de `index.tsx`, la tarjeta de navegación de `settings.tsx` (con su estado de presión subido a `surface-container-high` para no perder la retroalimentación táctil), y las tarjetas de `schedule.tsx`.

Verificado en el dispositivo (Pixel 6a), en modo claro y oscuro: sin header blanco en ninguna pantalla; `BackButton` navega correctamente en `apps`/`schedule`/`dev`; confirmado que el botón/gesto físico de Android sigue yendo a inicio en `challenge`/`wait`/`restblock` y que ya no existe ningún elemento táctil de "volver" en esas tres pantallas; las 7 pantallas recorridas de punta a punta (incluido responder mal y bien en el reto, confirmar y cancelar un bloqueo horario) sin ninguna regresión de comportamiento. `tsc --noEmit`, `expo lint` y los 265 tests de Jest en verde. Dispositivo restaurado: modo oscuro, sin apps restringidas ni bloqueo horario programado, ajustes de fábrica.

**Veredicto: corregido.** El diagnóstico de UX/UI del usuario resultó certero y reveló, de paso, un bypass real de la regla "sin salida" que las pruebas manuales anteriores (T63, T77) no habían encontrado por no navegar entre pantallas antes de disparar los enlaces profundos de bloqueo.

### T79: segunda corrección post-diagnóstico (splash recortado, navegación mal ubicada)

Tras T78, el usuario señaló dos cosas más al revisar capturas reales: el texto "blockproc" del splash (agregado en T76) se veía cortado por una forma circular, y el menú para ir a Apps/Bloqueo horario "no convencía por dónde estaba". De paso pidió revisar si las imágenes de Stitch eran consistentes entre sí.

- **Splash recortado — causa confirmada en el código de `expo-splash-screen`:** `node_modules/expo-splash-screen/plugin/build/withAndroidSplashStyles.js` configura la imagen del splash como `windowSplashScreenAnimatedIcon`, el mecanismo nativo de la API de splash de Android 12+. Esa API muestra el drawable dentro de una **zona de ícono con máscara fija** (igual que un ícono adaptativo, no una imagen libre centrada), y esta versión de `expo-splash-screen` no expone un slot separado de "branding image" para texto — cualquier contenido fuera de la zona segura circular se recorta. El wordmark agregado en T76 nunca iba a poder mostrarse completo con esta configuración. **Corrección:** `splash-icon.png` vuelve a ser solo el símbolo (mismo arte que `android-icon-foreground.png` de T75, sin texto), `imageWidth` baja de 220 a 100 (el valor por defecto de la librería, pensado para un ícono).
- **Navegación mal ubicada — confirmado en el código:** en `settings.tsx`, la tarjeta con los enlaces a `/apps`, `/schedule` y `/dev` era lo último del `ScrollView`, después de todo el formulario de ajustes (banners, 3 campos, áreas, 2 mensajes, botón Guardar, banner de batería). **Corrección:** se reubicó la misma tarjeta (sin cambiarla) justo después del título "Ajustes", antes de cualquier campo — es lo primero visible al abrir la pantalla.
- **Consistencia de los mocks de Stitch — investigado y documentado, sin cambio de código:** se compararon los `code.html` de varias carpetas en `stitch_blockproc_ui_design/`. Los tokens de color/tipografía son idénticos en los 13 archivos (mismo `tailwind.config` reutilizado por Stitch), pero la **navegación que cada mock propone es distinta entre sí**: `permisos/` y `apps_a_restringir/` usan un header "Detalle De Límite" con indicador de pasos ("PASO 1 DE 2"), mientras que `ajustes/` usa un header "blockproc / Dashboard" con una barra inferior de 4 pestañas (Hoy/Límites/Pausa/Progreso) que no existen en la app real. Conclusión: los mocks nunca fueron una referencia de navegación coherente entre sí (cada uno se generó de forma independiente); las decisiones de navegación de blockproc son y deben seguir siendo nuestras, no una copia de un mock puntual.

Se evaluó una alternativa mayor para la navegación (convertir Ajustes/Apps/Bloqueo horario en pestañas persistentes, inspirado en el dashboard de Stitch) y se descartó por el usuario: implica cambiar la arquitectura de navegación (grupo `(tabs)` de Expo Router, perder el botón atrás en Apps/Bloqueo horario, decidir dónde queda Herramientas de desarrollo) en vez de un ajuste de presentación.

Verificado en el dispositivo (Pixel 6a), modo claro y oscuro: el splash en frío muestra el símbolo completo sin ningún recorte; la tarjeta de navegación es lo primero visible en Ajustes sin necesidad de scroll, y los tres enlaces siguen funcionando igual. `tsc --noEmit`, `expo lint` y los 265 tests de Jest en verde.

**Veredicto: corregido.** Los tres señalamientos eran válidos; el del splash tenía una causa técnica concreta (restricción de la API nativa de Android, no un error de diseño del PNG), y el de las imágenes de Stitch confirmó que la navegación de blockproc nunca debió copiarse de un mock — la decisión correcta sigue siendo la nuestra.

### T95: verificación final de la Fase 8 (buscador, botón "Continuar a la app", íconos/categorías, pestañas)

T79 había descartado la navegación por pestañas por ser un cambio de arquitectura, no de presentación. Al revisar de nuevo los mocks de Stitch, el usuario preguntó por qué no replicar también las partes que se habían dejado fuera por "decorativas"; al repasarlas una por una, la mayoría resultaron implicar datos o comportamiento real que la app no tenía (RF-46 a RF-49, C6-C10 de `spec.md`), así que esta vez sí se abordaron con el ciclo SDD completo en vez de descartarlas.

Verificación en el Pixel 6a, modo claro y oscuro, de punta a punta:

| Feature | Verificado | Notas |
|---|---|---|
| Buscador (RF-46) | ✅ | Filtra con cada carácter, sin distinguir mayúsculas/tildes; mensaje "sin resultados" sin ocultar el campo |
| Íconos y categorías (RF-48, RF-49) | ✅ | Indicador de carga mientras se decodifican (C9); chips de categoría combinables con el buscador (C8); apps sin categoría bajo "Otras" |
| Botón "Continuar a la app" (RF-47) | ✅ (T89) | Verificado de punta a punta con una app real restringida (Chrome): reto real, botón y Atrás físico revelan Chrome, no solo el lanzador |
| Pestañas (D20) | ✅ | Ajustes/Apps/Bloqueo horario como pestañas reales; cambiar de pestaña no reconsulta la lista de apps con íconos (T92); `useFocusEffect` refresca banners de bloqueo horario/pendientes al volver a una pestaña sin reabrir la app (T91/T93) |
| Atrás con pestañas (T94) | ✅ | Desde Apps/Bloqueo horario, Atrás vuelve primero a Ajustes (`backBehavior="firstRoute"`); un segundo Atrás desde Ajustes sí cierra la app; `/dev` sigue fuera del grupo de pestañas, con su propio `BackButton` de vuelta a Ajustes |

**Sin regresiones de comportamiento.** `tsc --noEmit`, `expo lint` y los 279 tests de Jest (265 de la Fase 7 + 14 nuevos de `appSearch`/`appCategories`) quedaron en verde tras cada tarea de la Fase 8 (T80-T94) y en esta pasada final. Dos incidentes de entorno durante la verificación, sin relación con el código: la build de depuración se desinstaló sola del teléfono dos veces por inactividad prolongada de la sesión (reinstalada con `expo run:android`, permisos vueltos a conceder), y el estado de prueba de T89 (Chrome restringido con uso simulado altísimo) quedó atascado en "pendiente hasta las 04:00" (RF-29 funcionando correctamente sobre datos de uso reales) hasta detener el servicio de monitoreo antes de limpiar la simulación. El dispositivo (propio del usuario) quedó restaurado: modo oscuro, permisos concedidos, sin apps restringidas ni bloqueo horario programado, ajustes de fábrica (30 min, 2 preguntas, ventana de 5 min).

**Veredicto: Fase 8 completa.** Las 4 features aprobadas por el usuario están implementadas con SDD completo (RF-46 a RF-49, C6-C10, D16-D20), verificadas en el dispositivo real en ambos modos de color, sin alterar ningún RF ya validado en T63/T64/T77-T79.

### Auditoría post-Fase 8 (2026-09-30): dos bugs reales encontrados y corregidos

Con todo el trabajo planeado ya cerrado, se pidió una auditoría completa del proyecto (spec/plan/tasks, `tsc`/`lint`/`jest`/`expo-doctor`, revisión de código nativo y TS, y un recorrido real en el Pixel 6a). Todo lo ya documentado se confirmó en verde, pero la revisión de `MonitorService.kt` y del arranque real de la app encontró dos bugs genuinos que ninguna de las verificaciones anteriores (T63/T64/T77-T95) había detectado, porque todas partían de un estado en el que el servicio ya estaba corriendo (arrancado a mano desde `/dev` en algún momento de cada sesión de pruebas, o sobrevivido a un reinicio real del teléfono).

1. **Reto falso al abrir los Ajustes reales de Android.** `MonitorService.kt` todavía tenía el gancho del prototipo de la T10 (`TEST_TARGET_PACKAGE = "com.android.settings"`): si la app en primer plano era Ajustes, disparaba un reto directamente, sin pasar por `config.restrictedPackages` (el único filtro real, en `policy.ts`). Como Ajustes es siempre esencial (nunca se puede restringir), **cualquier usuario real vería un reto de trivia cada vez que abriera los Ajustes de su teléfono**, sin haber configurado nada — confirmado en vivo antes y después de la corrección. Además, el enlace profundo que disparaba (`blockproc://challenge?triggeredAt=...`) no llevaba `pkg`, así que ese reto quedaba guardado con `packageName=""`. **Corrección:** se borró el gancho completo (`TEST_TARGET_PACKAGE`, el `if`, `launchChallenge()`) — la ruta real (`triggerSupervisorTask` → Headless JS → `policy.ts`) ya cubre todo.
2. **El servicio de vigilancia nunca arrancaba solo.** `BlockprocNative.startMonitorService()` solo se llamaba desde el botón de `/dev` ("Iniciar servicio") y desde `BootReceiver` (tras un reinicio real). **Ningún camino de la app real lo arrancaba nunca** — ni `index.tsx` al conceder los permisos, ni `settings.tsx`. Un usuario que instalara la app, concediera los permisos, configurara apps restringidas y nunca reiniciara el teléfono ni encontrara la pantalla de desarrollo oculta **no tenía ninguna vigilancia corriendo**: la fricción del RF-27 nunca se activaba. Confirmado con `dumpsys activity services` (sin el servicio) tras una instalación limpia. **Corrección:** `index.tsx` ahora llama `BlockprocNative.startMonitorService()` en el mismo efecto que redirige a `/settings`, justo al confirmar que ambos permisos están concedidos (repetir la llamada en cada arranque no tiene costo: Android no reinicia un servicio ya activo).

Verificado en el dispositivo tras cada corrección: abrir Ajustes reales ya no dispara nada; una instalación limpia con `force-stop` + relanzamiento arranca el servicio solo (`isForeground=true` sin tocar `/dev`); una app real restringida sigue disparando el reto correctamente al agotar el límite diario (comportamiento sin cambios: el reto siempre fue por límite de tiempo alcanzado, no por cada apertura — RF-9/RF-31). `tsc --noEmit`, `expo lint` y los 279 tests de Jest en verde después de ambas correcciones. Dispositivo restaurado a los valores de fábrica.

Hallazgos menores, reportados sin corregir (a pedido del usuario): 5 paquetes de Expo un patch detrás de lo que pide el SDK 57 (`expo-doctor`), el repositorio nunca tuvo un commit y `blockproc/modules/blockproc-native/android/build/` no está cubierto por ningún `.gitignore`.

**Veredicto: dos bugs de severidad real (uno de ellos crítico — anulaba la protección para cualquier instalación nueva) encontrados por una auditoría independiente y corregidos el mismo día.** Ninguno de los dos era detectable por los tests unitarios existentes (ambos viven en código nativo/de arranque, fuera de lo que cubre Jest); solo una revisión de código deliberada, combinada con probar un camino que ninguna sesión anterior había probado (una instalación realmente limpia, sin pasar nunca por `/dev`), los sacó a la luz.

### Rama `main` preparada para build de producción (2026-09-30)

Con el proyecto ya auditado y corregido, se hizo el primer commit del repositorio (nunca
había tenido ninguno) y se creó `feature/desarrollo` como snapshot completo de ese mismo
commit (specs/, docs/, tests/, `/dev`, todo tal cual). `main` sigue con el mismo
contenido salvo un cambio: la pantalla de Herramientas de desarrollo (`/dev`) ahora se
oculta con `__DEV__` (tanto el enlace desde Ajustes como la propia pantalla, que
redirige a `/settings` si `__DEV__` es `false`) — así nunca queda alcanzable en la build
`release` que ya trae `build.gradle` (minificada, sin depender de Metro). No es un
cambio de RF: es una decisión de build, no de comportamiento funcional para el usuario
final (la fricción/reto sigue exactamente igual). La firma de esa build `release` sigue
siendo la de debug por decisión explícita — no apta para publicar, documentado en
`README.md`.

### Bug real en producción: notificaciones nunca se pedían (2026-10-01)

Tras un día de uso real con la build de producción, el usuario reportó que WhatsApp se
bloqueó solo a las 21:00 sin ningún aviso. Causa confirmada en el código, mismo patrón
que el bug de `MonitorService` de la auditoría anterior: `PermissionsAndroid.request
(POST_NOTIFICATIONS)` solo existía en `src/app/dev.tsx` (T09) — oculto en producción
desde el fix de `__DEV__` del día anterior. El flujo real de permisos (`index.tsx`)
nunca lo pedía. En Android 13+, sin este permiso, Android descarta en silencio **todas**
las notificaciones de aviso (RF-15, RF-30, y el aviso de "2 minutos antes" de RF-33) —
de ahí que el bloqueo horario empezara "sin avisar en el camino" (más la naturaleza
puntual, no recurrente, de `core/restBlock.ts`, que tampoco es un bug: un bloqueo
confirmado antes se activa solo cuando llega su hora, sin repetirse cada día).

**Corrección**: `POST_NOTIFICATIONS` pasa a ser un tercer permiso obligatorio en
`index.tsx`, igual que estadísticas de uso y superposición — a diferencia de esos dos,
tiene diálogo estándar de Android (se pide directo, sin pasar por Ajustes del sistema).
En Android <13 se trata como ya concedido (el permiso no existe ahí). No es un RF nuevo:
restaura RF-15/30/33, que ya existían, a que funcionen de verdad.

Verificado en el dispositivo con una instalación limpia (los tres permisos en
"Pendiente"): se piden los tres en orden, con los tres concedidos arranca el servicio y
pasa a Ajustes, y una notificación de aviso real ("Bloqueo horario — El bloqueo horario
empieza en 2 minutos") aparece en la bandeja — antes de este fix, nunca lo hacía.
`tsc`/`lint`/`jest` en verde.

### T104: verificación final de la Fase 9 (bloqueo horario programable, textos, orden de apps)

Verificación en el Pixel 6a, de punta a punta, de las 4 features de la Fase 9 (RF-50 a RF-54):

| Feature | Verificado | Notas |
|---|---|---|
| Texto "Cómo funciona" (RF-51) | ✅ | Visible en Ajustes, modo claro y oscuro, sin romper el formulario (T101) |
| Orden de apps restringidas primero (RF-52) | ✅ | Aplicado después del buscador y la categoría; combinable con ambos (T100) |
| Banner "programado" en Ajustes/Apps (RF-50) | ✅ | Independiente de `isEditingLocked`: visible sin bloquear la edición (T102) |
| Programar un bloqueo nuevo durante uno activo (RF-53) | ✅ | Sub-formulario en `restblock.tsx` sin ruta nueva (D22); con una hora que ya "pasó" respecto al `endAt` actual, el resumen ofrece correctamente el día siguiente, sin rechazo (RF-54, corrección C14/D22b) |
| Ascenso automático (`resolveRestBlocks`, RF-53) | ✅ | Confirmado en vivo, no solo por unit tests: con un bloqueo activo real y uno programado para justo después, un sondeo del dispositivo cada ~15 s (forzando refresco real vía `useFocusEffect` al alternar pestañas) capturó la secuencia completa — banner "programado" presente mientras el primero seguía activo; al llegar la hora del segundo, el banner "programado" desaparece y "activo" se mantiene sin interrupción (el ascenso fue transparente); al llegar el fin del bloqueo *recién ascendido* (no del original), "activo" también desaparece — la única explicación posible es que el ascenso ocurrió y el bloqueo promovido se trató como real |

**Hallazgo de proceso, no de producto:** el primer intento de observar el ascenso en vivo usó un sondeo que reabría la misma pantalla con el mismo enlace profundo (`blockproc://settings`) repetidamente; Android entrega ese intent a la instancia ya corriendo sin disparar un nuevo evento de foco, así que `useFocusEffect` nunca releía el estado y la pantalla quedó con una captura congelada 16 minutos seguidos. Se corrigió alternando entre dos pestañas reales (Apps ⇄ Ajustes) en cada sondeo, lo que sí fuerza el refresco, y permitió capturar la secuencia real documentada arriba.

**Sin regresiones de comportamiento.** `tsc --noEmit`, `expo lint` y los 311 tests de Jest (incluyendo los nuevos de `restBlockNext`/`restBlockNextRange`/`restBlockPending`/`restBlockNextPromotion`/`policyRepository`/`appCategoriesRestrictedFirst` y la extensión de `applyAndSaveConfig` de la Fase 9) quedaron en verde. Ningún RF validado en T63/T64/T77-T79/T95 se vio afectado. El dispositivo quedó restaurado a su estado de fábrica (sin bloqueo horario activo ni programado, servicio de monitoreo corriendo).

**Veredicto: Fase 9 completa.** Las 4 features aprobadas por el usuario están implementadas con SDD completo (RF-50 a RF-54, C11-C14, D21-D24), verificadas en el dispositivo real incluyendo el ascenso automático observado en vivo, sin alterar ningún comportamiento previo.

### Rediseño de fondo: sistema de bloqueos múltiples (2026-10-01)

Tras un día de uso real sobre la Fase 9 recién terminada, el usuario reportó un bloqueo sin
preguntas; al diagnosticarlo (ver `spec.md`, nota de rediseño) se descubrió que el modelo
entero de "límite diario global + bloqueo horario único sin salida" nunca fue lo que el
usuario pidió — la excepción "sin salida" del bloqueo horario (constitución, principio 3,
vigente desde la Fase 0) fue una suposición incorrecta arrastrada todo el proyecto, nunca
confirmada con el usuario. Se corrió el proceso completo de nuevo: constitución (principio 3
amendado), spec (RF-55 a RF-72, Fases 2 y 3 con QA propio), y este plan (secciones 1 a 6
reemplazadas para describir la arquitectura nueva; D1-D24 se conservan como historial). Las
Fases 0 a 9 (RF-1 a RF-54, retirados en su mayoría) quedaron documentadas como el modelo
anterior, nunca borradas, por trazabilidad.

### T140: verificación final de la Fase 10 (sistema de bloqueos múltiples)

Verificación de punta a punta en el Pixel 6a de las 36 tareas de implementación (T105-T139,
RF-55 a RF-72) más el recorrido completo en vivo exigido por T140:

| Feature | Verificado | Notas |
|---|---|---|
| Lista de bloqueos, estado programado/activo (RF-55) | ✅ | "No tenés ningún bloqueo..." cuando está vacía; un bloqueo terminado desaparece de la lista sin dejar constancia (confirmado dos veces, con un bloqueo de 5 min y uno de 45 min) |
| Tipos "por tiempo" y "programado" (RF-56) | ✅ | Wizard completo recorrido para ambos tipos; duración por defecto 45 min ajustable con +/- por separado en horas y minutos |
| Categoría única por bloqueo (RF-57) | ✅ | "Conocimiento general" preseleccionado, un solo checkbox activable a la vez |
| Mensajes de enfoque/bloqueo por bloqueo, prellenados (RF-58, RF-70) | ✅ | Prellenados con los valores de fábrica en el paso "Mensajes" del wizard |
| Rechazo completo por solapamiento (RF-59) | ✅ | Con el bloqueo de Chrome activo (16:48-17:33), se intentó crear uno nuevo para Chrome a las 16:55: "No se puede crear — Ya hay un bloqueo en esa franja para 'com.android.chrome' (de 16:48 a 17:33)"; la lista quedó con un solo bloqueo (el original), confirmando que el rechazo es completo y no deja restos |
| Resumen + confirmación con advertencia (RF-60) | ✅ | Pantalla "Resumen" con todos los campos y el aviso "Una vez creado, no se puede cancelar" antes de "Crear bloqueo" |
| Editar/borrar un bloqueo programado (RF-61) | ✅ | Un bloqueo "programado" (sin empezar) permitió reabrir el wizard precargado y, por separado, un borrado con confirmación nativa (`Alert.alert`); ambos devolvieron la lista a su estado previo |
| Bloqueo activo sin edición ni cancelación (RF-62) | ✅ | Mientras "Activo", la tarjeta no ofrece Editar/Borrar; la única salida es el flujo de acceso |
| Flujo de acceso completo: reflexión → confirmación → 3 preguntas (RF-63 a RF-65) | ✅ | Recorrido en vivo dos veces completas (una con fallo intencional en una prueba anterior de esta misma fase, otra con acierto) |
| Fallo a las 2 incorrectas + espera de 5 min (RF-66) | ✅ | Verificado en una verificación previa de esta misma tarea (antes de este tramo de la sesión) |
| Acierto (≥2/3) + ventana de acceso de 2 min (RF-67) | ✅ | "¡Correcto! Ya podés usar la app durante 2 min." + "Continuar a la app" abrió Chrome libremente; confirmado con `dumpsys window` que Chrome quedó en foco |
| Vencimiento de la ventana con el bloqueo aún activo exige el flujo de nuevo (RF-67, caso límite) | ✅ | Con un bloqueo de 45 min, se concedió la ventana de 2 min a las 16:49:57; al reabrir Chrome a las 16:52 (ventana vencida, bloqueo todavía activo hasta las 17:33) reapareció la pantalla de reflexión desde cero, sin acceso libre |
| Valores fijos no configurables (RF-69) | ✅ | Sin ningún campo de configuración de cantidad/tiempos en Ajustes ni en el wizard; los textos están hardcodeados ("3 preguntas", "5 min", "2 min") |
| Aviso 2 min antes de un bloqueo programado (RF-68) | — | No observado en vivo en esta sesión (la ventana de tiempo real se perdió por los mismos cortes de sesión ya documentados en T104); cubierto por 2 tests unitarios en `policy.test.ts`, estructuralmente idéntico al mecanismo de T104 ya verificado en vivo en la Fase 9 |
| Reinicio del móvil con un bloqueo activo (RF-45 amendado) | — | Se decidió no repetirlo: el mecanismo nativo subyacente (persistencia del servicio tras reinicio) ya se verificó en vivo en las Fases 0, 7 y 9 sobre el mismo `BootReceiver`, sin cambios en esta fase |
| Ajustes siempre editable (RF-70, sin `isEditingLocked`) | ✅ | Confirmado en una verificación previa de esta misma tarea |

**Hallazgo de proceso:** la pantalla del flujo de acceso (`challenge.tsx`) no tiene salida propia
(por diseño, RF-62/66) y su stack de navegación no se limpia al pasar a otra app — reabrir
`blockproc` con `am start` después de "Continuar a la app" vuelve a mostrar la última pantalla
del flujo (p. ej. "¡Correcto!") en vez de la pestaña Bloqueos. La forma confiable de navegar a
una pestaña concreta durante las pruebas fue un deep link explícito
(`adb shell am start -a android.intent.action.VIEW -d "blockproc://blocks"`), no el ícono del
lanzador ni `KEYCODE_BACK` (que, en el wizard de creación, retrocede un paso completo del
asistente en vez de solo cerrar el teclado — hay que distinguir "tocar fuera del campo para
cerrar el teclado" de "`BACK` para salir del paso", y repetir el tap sobre el elemento real una
vez cerrado el teclado).

**Sin regresiones.** `tsc --noEmit`, `expo lint` y los 188 tests de Jest (23 suites) quedaron en
verde. El dispositivo terminó la sesión con un único bloqueo real de Chrome activo hasta las
17:33 (creado para estas pruebas) que se extingue solo, sin intervención — por diseño (RF-62) no
hay forma de cancelarlo antes de tiempo.

**Veredicto: Fase 10 completa.** El sistema de bloqueos múltiples (RF-55 a RF-72, C15-C33,
D25-D36) está implementado con SDD completo y verificado en el dispositivo real, incluyendo los
tres mecanismos más sensibles al tiempo (fallo, acierto con ventana, y vencimiento de ventana con
bloqueo aún activo) y el rechazo por solapamiento. El único punto no observado en vivo (aviso de
2 min antes de un "programado") queda cubierto por tests unitarios ya existentes y un mecanismo
gemelo verificado en vivo en la Fase 9.

### Feedback de uso real (2026-10-03): renombre, bug de UI y selector de rueda

Tras probar el sistema de bloqueos múltiples ya terminado, el usuario trajo 3 mejoras chicas:

1. **Renombre de pestaña:** "Ajustes" → "Personalización" (D-level, sin RF nuevo). El nombre
   anterior confundía con los ajustes del sistema (idioma, tema); el contenido no cambió
   (mensajes por defecto, nota de batería). Se actualizó en código (`_layout.tsx`,
   `settings.tsx`, comentarios relacionados) y en la spec/plan donde el nombre se refería a
   *esta* pantalla, sin tocar las menciones de "Ajustes del sistema" (RF-28, caso límite de
   accesibilidad), que es algo distinto (ver C34 de la spec).
2. **Bug real encontrado por el usuario:** en el paso "por tiempo" del asistente, el botón "−"
   de horas/minutos (`Field.tsx`, función `adjust`) no tenía piso y dejaba bajar de 0. Nunca
   llegaba a crear un bloqueo inválido (`isValidBlockDuration` ya lo rechazaba al confirmar),
   pero el campo en sí mostraba un número negativo, que es confuso y no debería ser posible.
   Corregido con `Math.max(0, next)`.
3. **D37 (ver sección 4):** reemplazo de los botones +/- por un selector de rueda
   (`DurationWheelPicker`) para horas/minutos, elegido por el usuario entre varias alternativas
   presentadas (chips de preset, slider, rueda, +/- mejorado). Al ser una rueda, el bug del
   punto 2 queda estructuralmente resuelto para este caso de uso (no se puede deslizar a un
   valor negativo); el fix en `Field.tsx` queda igual como red de seguridad para el otro uso
   que le queda (`dev.tsx`, herramienta de desarrollo).

El usuario también propuso un "modo extremo" (un bloqueo sin ninguna salida, ni con preguntas)
y evaluó agregar selector de idioma/tema a una nueva pestaña "Ajustes" separada. Ambas cosas
quedaron **fuera de esta ronda**, explícitamente: el modo extremo por ser un cambio de
constitución (principio 3) que amerita su propio proceso de `sdd-kickoff` antes de tocar
código; idioma por contradecir `AGENTS.md` ("mensajes de usuario en español", implicaría
traducir también las 245 preguntas del banco); tema manual por no hacer falta (ya sigue el
tema del sistema automáticamente, `userInterfaceStyle: "automatic"`).

`tsc --noEmit`, `expo lint` y los 188 tests de Jest siguen en verde tras estos cambios.

### Fase 11: bloqueo extremo, idioma y Acerca de (kickoff 2026-10-03)

Los dos temas que habían quedado explícitamente fuera de la ronda anterior ("bloqueo extremo"
por requerir un cambio de constitución; idioma por contradecir `AGENTS.md`) se retoman ahora a
pedido del usuario, junto con una sección "Acerca de" nueva. Se corrió `sdd-kickoff` de nuevo:
constitución (principios 3 y 12 amendados, con aprobación expresa del texto), spec (RF-73 a
RF-79, entrevista de 7 preguntas en 2 rondas, todas con decisión tomada), y este plan (D38 a
D42 agregados; secciones 2, 3, 5 y 6 actualizadas con los módulos nuevos).

Decisión más importante de la entrevista: traducir el banco completo de 245 preguntas ahora
(no diferirlo), pese a ser la parte más grande del trabajo — elegido a propósito por el
usuario. La segunda decisión más importante, a nivel de diseño técnico (no le tocó elegir al
usuario, es una decisión de plan): el bloqueo extremo **no toca `policy.ts` ni Kotlin** (D41) —
reutiliza exactamente el mismo mecanismo que ya tiene cualquier bloqueo, y la diferencia vive
enteramente en una rama nueva dentro de `challenge.tsx`, mismo patrón que D30 en la Fase 10.

Siguiente paso: `tasks.md`, dividiendo en tareas de menos de 30 min — el bloque de traducción
del banco de preguntas (245 × 2 idiomas) se divide en tandas revisables, no en una sola tarea.

### T163: verificación final de la Fase 11 (bloqueo extremo, idioma, Acerca de)

Verificación en el Pixel 6a, de punta a punta:

| Feature | Verificado | Notas |
|---|---|---|
| Toggle "extremo" al crear + advertencia reforzada (RF-73, RF-60) | ✅ | Visible en el paso de categoría; el resumen muestra "Modo: Extremo" y el banner reforzado solo cuando corresponde |
| Pantalla sin salida (RF-74) | ✅ | Solo el mensaje de bloqueo, sin ningún botón; probado dos veces (abrir la app, Atrás a Inicio, reabrir) — nunca concede acceso, siempre reaparece igual |
| Etiqueta "Extremo" en la lista (RF-75) | ✅ | Badge propio, distinto del pill Activo/Programado |
| Cambio de idioma instantáneo (RF-76) | ✅ | Probado en Ajustes, Bloqueos, Personalización y en las 5 pantallas del asistente de creación (incluidas las categorías del buscador de apps, confirma D43) — todo cambia sin reiniciar la app |
| Traducción completa de la UI + banco de preguntas (RF-77) | ✅ | Confirmado visualmente en todas las pantallas recorridas; el cableado de `selectQuestionBank` para un reto nuevo se confirmó por código y por el test de T145, no se llegó a ver una pregunta en inglés en pantalla en esta sesión (se cortó la prueba para pasar a otra consulta) |
| Idioma persistido (RF-78) | ✅ | El cambio se mantiene al navegar entre pestañas y pantallas |
| Mensajes propios no se traducen (RF-77, C40) | ✅ | Confirmado dos veces: el mensaje de un bloqueo extremo activo, y los mensajes prellenados del paso "Messages" — ambos quedaron en español mientras el resto de la UI pasó a inglés |
| "Acerca de" (RF-79) | ✅ | Nombre ("blockproc") y versión ("1.0.0" / "Version 1.0.0") correctos en ambos idiomas |

**Sin regresiones.** `tsc --noEmit`, `expo lint` y los 199 tests de Jest (24 suites) en verde
después de toda la Fase 11.

**Veredicto: Fase 11 completa.** Bloqueo extremo, idioma (es/en) y Acerca de (RF-73 a RF-79,
C34-C43, D37-D43) implementados con SDD completo y verificados en el dispositivo real.

## 8. Cambios a la spec (aplicados)

Con tu aprobación se aplicaron:
- **S1.** El requisito de consumo dice ahora que la app en primer plano solo se consulta con la pantalla encendida y nunca con la pantalla apagada.
- **S2.** RF-1: la lista muestra las apps con icono en el lanzador.
- **S3.** RF-28: la cámara es la aplicación predeterminada del sistema, con identificación de mejor esfuerzo.
- **S4 (rediseño, 2026-10-01).** Se retiró RF-36 (contaba tiempo de uso real para el límite diario): descubierto al diseñar el modelo de datos del rediseño que ningún mecanismo nuevo (reto, ventana de 2 min) necesita acumulación de uso, solo cronómetros fijos desde que se conceden — ver C33 de `spec.md` y D34 de este plan.

## 9. Después del plan

- Rellenar los `<comando>` y `<proyecto>` de AGENTS.md cuando exista el proyecto: ejecutar (`npx expo run:android`), tests (`npm test`), lint (`npm run lint` y `npm run typecheck`).
- Siguiente paso: Fase 5, `tasks.md` — dividir el rediseño en tareas de menos de 30 minutos, con RF y "Hecho cuando", núcleo primero (tests), después integración nativa y pantallas, cerrando con la verificación RF por RF en el dispositivo real.
