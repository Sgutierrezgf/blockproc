# Spec 001 — Bloqueo consciente de apps con bloqueos múltiples y reto

> **Rediseño de fondo (2026-10-01):** a partir de un reporte de uso real se detectó que el
> modelo de "límite diario global + bloqueo horario único" nunca fue lo que el usuario pidió.
> Esta versión reemplaza ese modelo por un sistema único de **bloqueos** (varios, independientes,
> tipo alarma), cada uno con su propio grupo de apps, su propia duración y su propia categoría
> de preguntas — y con una regla nueva y no negociable: **todo bloqueo, sin excepción, tiene
> salida por preguntas**. Ver "Decisiones de clarificación" (C15 en adelante) para el detalle
> de qué RF quedan retirados y cuáles se mantienen igual.

> **Ampliación (2026-10-03):** a partir de feedback de uso real se agregan 3 funcionalidades
> aditivas sobre el modelo de bloqueos ya terminado: (1) un **bloqueo extremo**, opt-in por
> bloqueo, que introduce la **única excepción explícita** a "todo bloqueo tiene salida por
> preguntas" (principio 3 de la constitución, amendado); (2) **idioma de la app**, español
> (por defecto) o inglés, elegible en una pantalla nueva "Ajustes"; (3) una sección **"Acerca
> de"** en esa misma pantalla, con nombre y versión. Ver RF-73 en adelante y "Decisiones de
> clarificación" (C35 en adelante).

> **Mejoras de uso real (2026-11-12, Fase 12):** cuatro ajustes de interfaz sobre el asistente
> de creación y la lista de Bloqueos: la categoría se elige como opción única (radio), el
> bloqueo extremo se separa visualmente de las categorías, el resumen nombra las apps, y tocar
> un bloqueo abre su detalle de solo lectura. Ver RF-80 a RF-82 y C44 a C47.

## Contexto y objetivo
El uso compulsivo de ciertas apps del móvil roba tiempo que la persona preferiría dedicar a
otras cosas. Esta app introduce **fricción consciente**: el usuario crea **bloqueos** sobre
los grupos de apps que elige, cada uno con su propia duración (por tiempo, desde ahora, o
programado para una franja horaria futura) y su propia categoría de preguntas. Mientras un
bloqueo está activo, abrir cualquiera de sus apps exige pasar por un reto de preguntas para
ganar un rato de acceso — nunca hay un bloqueo sin esa salida, pero tampoco hay forma de
cancelar un bloqueo ya activo por otro medio. Es una herramienta de autocontrol por elección:
no impide al usuario forzar el cierre, quitar permisos ni desinstalarla, y prioriza el ahorro
de batería sobre la persistencia del bloqueo.

## Usuarios / actores
- **Usuario:** persona que instala la app en su móvil Android y crea los bloqueos que quiere.
- **Sistema:** la app, con su servicio en segundo plano y su pantalla superpuesta.

## Historias de usuario
- H1: Como usuario quiero ver una lista de los bloqueos que fui creando, con su estado (programado o activo), para tener todo a la vista como una lista de alarmas.
- H2: Como usuario quiero crear un bloqueo eligiendo qué apps incluir, para limitar solo las que me distraen.
- H3: Como usuario quiero elegir si un bloqueo dura un tiempo fijo desde ahora o una franja horaria futura, según lo que necesite en el momento.
- H4: Como usuario quiero elegir la categoría de preguntas de cada bloqueo por separado, para variar el tipo de reto según el bloqueo.
- H5: Como usuario quiero un mensaje de enfoque y de bloqueo propios para cada bloqueo (con un valor por defecto que puedo configurar una vez), para recordarme mis prioridades.
- H6: Como usuario quiero que, al intentar entrar a una app bloqueada, primero me frene a pensar para qué la quiero usar, antes de ofrecerme el reto.
- H7: Como usuario quiero que el reto sea siempre de 3 preguntas y que fallar 2 me haga esperar, para que la salida exista pero cueste un esfuerzo real.
- H8: Como usuario quiero poder editar o borrar un bloqueo que todavía no empezó, pero no poder cancelar uno que ya está activo, para no poder arrepentirme a mitad de camino.
- H9: Como usuario quiero que dos bloqueos nunca se superpongan sobre la misma app, para no terminar con reglas contradictorias al mismo tiempo.
- H10: Como usuario quiero que la app me proteja de errores irreversibles (apps esenciales, duraciones absurdas, bloqueos solapados) para no quedarme sin poder usar el móvil por error.
- H11: Como usuario quiero que la app gaste poca batería para no quedarme sin ella en una emergencia.
- H12: Como usuario quiero poder marcar un bloqueo como "extremo" para los momentos en que sé que ni siquiera el reto me va a detener, y necesito que literalmente no haya ninguna salida hasta que termine.
- H13: Como usuario quiero elegir el idioma de la app, español o inglés, para usarla en el que prefiera.
- H14: Como usuario quiero ver el nombre y la versión de la app en algún lado, para saber qué versión tengo instalada.
- H15: Como usuario quiero ver qué apps exactas va a bloquear un bloqueo antes de crearlo, y poder consultar el detalle de un bloqueo ya creado (aunque esté activo y no se pueda editar), para no tener dudas sobre qué está bloqueado.

> Los identificadores RF no se renumeran: los requisitos nuevos de este rediseño usan números
> consecutivos desde RF-55. Los RF retirados (ver nota de migración) no se reutilizan ni se
> borran de los documentos históricos (`plan.md`, `tasks.md`), solo dejan de aplicar.

## Nota de migración de numeración de RF

**Se retiran** (reemplazados por el modelo de bloqueos, dejan de aplicar): RF-2, RF-3, RF-4,
RF-5 (ver RF-57: ahora es una sola categoría por bloqueo, no varias), RF-7, RF-8, RF-9, RF-10,
RF-11 (ver RF-65: ahora siempre 3 preguntas fijas), RF-12, RF-13 (ver RF-66: ahora 5 min, corta
en la 2ª falla), RF-14, RF-15, RF-16, RF-17 a RF-22, RF-29, RF-30, RF-31, RF-32, RF-33 (ver
RF-68, generalizado a cualquier bloqueo programado), RF-34 (ver RF-68), RF-35 (ver RF-58),
RF-36 (contaba tiempo de uso para el límite diario; ni el reto ni la ventana de 2 min de RF-67
necesitan acumulación de uso real, solo un cronómetro desde que se concede — descubierto en la
Fase 4 al diseñar el modelo de datos, ver C33), RF-38 (ver RF-66), RF-39 (ver RF-67, caso límite
resuelto en la Fase 3), RF-40, RF-42 (ver nota en "Casos límite", generalizado), RF-47 (ver
RF-67), RF-50, RF-52, RF-53, RF-54.

**Se mantienen sin cambios** (siguen aplicando tal cual): RF-1, RF-23, RF-24, RF-25, RF-26,
RF-27, RF-28, RF-37, RF-43, RF-44, RF-46, RF-48, RF-49.

**RF-6 se divide en dos** (su texto original se reparte entre un RF nuevo y otro ya existente):
la parte de "mensaje personalizado" pasa a ser por bloqueo (RF-58), y la parte de "mensaje por
defecto" pasa a vivir en Personalización (RF-70) — el texto de fábrica ("Vuelve a lo que estabas
haciendo...") no cambia.

**Se amendan** (mismo número, texto generalizado): RF-41 (ver texto nuevo abajo, cubre también
datos del modelo anterior), RF-45 (ver texto nuevo abajo, generalizado a "cada bloqueo" en vez
de "ventanas, esperas y bloqueo horario").

## Requisitos funcionales (criterios de aceptación en EARS)

### Selección de apps (reutilizado tal cual, sin cambios)
- RF-1: CUANDO el usuario abre el paso de selección de apps del asistente de creación de un bloqueo, EL SISTEMA muestra la lista de apps instaladas con icono en el lanzador, excluyendo las esenciales (RF-28), y permite marcar cuáles incluir.
- RF-28: EL SISTEMA nunca ofrece para incluir en un bloqueo las siguientes apps: teléfono/marcador, Ajustes del sistema, lanzador de pantalla de inicio, la aplicación de cámara predeterminada del sistema y la propia app; la identificación de estas apps es de mejor esfuerzo, según lo que declare el sistema.
- RF-46: CUANDO el usuario escribe texto en el buscador de ese paso, EL SISTEMA filtra la lista para mostrar solo las apps cuyo nombre contiene ese texto, sin distinguir mayúsculas ni tildes, actualizando el resultado con cada carácter escrito; SI ningún nombre coincide, ENTONCES EL SISTEMA muestra un mensaje indicando que no hay resultados, sin ocultar el buscador.
- RF-48: CUANDO se abre ese paso, EL SISTEMA muestra junto al nombre de cada app su ícono tal como aparece en el lanzador de Android, y un indicador de carga mientras los íconos se están resolviendo; SI el sistema no puede obtener el ícono de alguna app, ENTONCES la muestra solo con su nombre, sin excluirla de la lista.
- RF-49: EL SISTEMA agrupa las apps de ese paso por categoría (la que declara el sistema operativo, traducida a una etiqueta en español, o "Otras" si no declara ninguna) y permite filtrar tocando una categoría, de forma combinable con el buscador de texto (RF-46).

### Bloqueos
- RF-55: CUANDO el usuario abre la pestaña Bloqueos, EL SISTEMA muestra la lista de bloqueos "programados" o "activos", cada uno con su grupo de apps, tipo y franja de tiempo (inicio y fin, calculados); CUANDO un bloqueo termina (pasa su hora de fin), EL SISTEMA lo quita de la lista de inmediato, sin dejar constancia.
- RF-56: EL SISTEMA permite elegir, al crear un bloqueo, entre dos tipos: "por tiempo" (duración en horas y en minutos, elegidas por separado, que empieza en el instante en que se confirma la creación) o "programado" (una hora de inicio y una de fin, pudiendo ser en el futuro); en ambos casos la duración resultante debe ser mayor a 0 minutos y no más de 12 horas, rechazando cualquier combinación fuera de ese rango.
- RF-57: EL SISTEMA permite elegir, al crear un bloqueo, exactamente una categoría de preguntas entre: conocimiento general, tecnología, salud y bienestar, ciencia y naturaleza, y matemática y lógica.
- RF-58: EL SISTEMA permite personalizar, para cada bloqueo, un mensaje de enfoque y un mensaje de bloqueo (hasta 120 caracteres cada uno), prellenados con los mensajes por defecto definidos en Personalización (RF-70); el usuario puede dejarlos tal cual o cambiarlos solo para ese bloqueo.
- RF-59: ANTES de crear un bloqueo, SI alguna app elegida ya pertenece a otro bloqueo (programado o activo) cuya franja de tiempo se superpone con la del nuevo, ENTONCES EL SISTEMA rechaza la creación completa (ninguna app del bloqueo nuevo se crea, ni siquiera las que no tienen conflicto) e indica qué app y con qué bloqueo existente se superpone, para que el usuario la quite o cambie el horario antes de reintentar.
- RF-60: ANTES de crear un bloqueo, EL SISTEMA muestra un resumen (apps por su nombre — ver RF-81 —, tipo, franja o duración, categoría) junto con un aviso de advertencia, y solo lo crea cuando el usuario confirma explícitamente; SI el bloqueo se marca "extremo" (RF-73), ENTONCES EL SISTEMA muestra además una advertencia reforzada específica, aclarando que ese bloqueo no va a tener ninguna salida hasta terminar, ni siquiera por preguntas.
- RF-61: MIENTRAS un bloqueo todavía no empezó (estado "programado"), EL SISTEMA permite editarlo (cualquier campo elegido al crearlo, incluida la marca "extremo") o borrarlo libremente, sin pedir el reto — el modo extremo (RF-73, RF-74) solo aplica una vez que el bloqueo pasa a estar activo.
- RF-62: MIENTRAS un bloqueo está activo, EL SISTEMA no permite cancelarlo ni editar ninguno de sus campos (apps, horario, categoría, mensajes); la única forma de acceder a una app incluida es completar el flujo de acceso (RF-63 a RF-67) — salvo que el bloqueo esté marcado "extremo" (RF-73), caso en el que no existe ninguna forma de acceder mientras esté activo (RF-74).
- RF-72: EL SISTEMA aplica cada bloqueo únicamente a las apps que incluye; el resto del móvil (alarma, llamadas, apps no incluidas en ningún bloqueo) sigue funcionando con normalidad.
- RF-73: EL SISTEMA permite marcar un bloqueo como "extremo" al crearlo (opción adicional en el asistente, junto al tipo, la categoría y los mensajes), desactivada por defecto.
- RF-74: MIENTRAS un bloqueo marcado "extremo" está activo, CUANDO el usuario abre una app incluida, EL SISTEMA muestra únicamente el mensaje de bloqueo de ese bloqueo, sin ningún botón ni la posibilidad de iniciar el flujo de acceso (RF-63 a RF-67); la única salida de esa pantalla es ir a otra app o a Inicio, sin que eso conceda acceso.
- RF-75: EL SISTEMA muestra, en la lista de Bloqueos, una etiqueta distintiva ("Extremo") en los bloqueos marcados así, siempre visible junto a su estado ("programado"/"activo").
- RF-80: MIENTRAS el usuario marca un bloqueo como "extremo" en el asistente (RF-73), EL SISTEMA deshabilita la elección de categoría de preguntas indicando que ese bloqueo no tiene preguntas, y omite la categoría en el resumen (RF-60); SI el usuario desmarca "extremo" antes de confirmar, ENTONCES EL SISTEMA vuelve a habilitar la categoría con la que estaba elegida.
- RF-81: EL SISTEMA muestra las apps de un bloqueo por su nombre visible (el del lanzador), en el resumen (RF-60) y en el detalle (RF-82); SI son más de 5, ENTONCES muestra las primeras 5 y "+N más", con la opción de ver la lista completa; SI una app ya no está instalada, ENTONCES muestra su nombre de paquete.
- RF-82: CUANDO el usuario toca un bloqueo de la lista (programado o activo), EL SISTEMA muestra su detalle de solo lectura: apps (RF-81), tipo, inicio y fin, tiempo restante si está activo, categoría (o "Extremo" si está marcado así) y sus mensajes de enfoque y de bloqueo; el detalle no ofrece ninguna acción que modifique, pause o cancele el bloqueo (RF-62, RF-74).

### Flujo de acceso durante un bloqueo activo
- RF-63: CUANDO el usuario abre una app incluida en un bloqueo activo, EL SISTEMA muestra primero una pantalla con el mensaje de enfoque de ese bloqueo y un único botón "Continuar", sin pedir ninguna respuesta todavía.
- RF-64: CUANDO el usuario presiona "Continuar", EL SISTEMA pregunta "¿Estás seguro?" con las opciones Sí/No; SI elige No, ENTONCES EL SISTEMA no inicia el reto (vuelve atrás / a segundo plano, sin penalización).
- RF-65: SI el usuario confirma que sí, ENTONCES EL SISTEMA presenta hasta 3 preguntas de la categoría de ese bloqueo, una por vez, mezcladas sin repetir una pregunta dentro del mismo intento, y corta el intento sin mostrar más preguntas en cuanto el usuario acumula 2 respuestas incorrectas (sin importar en qué posición cayeron).
- RF-66: SI el intento se corta por dos respuestas incorrectas, ENTONCES EL SISTEMA bloquea nuevos intentos en esa app, dentro de ese bloqueo, durante exactamente 5 minutos, mostrando mientras tanto una pantalla de espera con cuenta regresiva y el mensaje de enfoque de ese bloqueo.
- RF-67: SI el usuario responde correctamente al menos 2 de las 3 preguntas, ENTONCES EL SISTEMA concede acceso libre a esa app durante exactamente 2 minutos; al vencer esa ventana, SI el bloqueo sigue activo y la app sigue en primer plano o se vuelve a abrir, ENTONCES EL SISTEMA exige de nuevo el flujo completo desde RF-63.
- RF-37: CUANDO se muestra una pregunta, EL SISTEMA baraja el orden de sus opciones (sin cambios).
- RF-69: La cantidad de preguntas (3), el tiempo de espera tras fallar (5 minutos) y la ventana de acceso tras acertar (2 minutos) son los mismos para todos los bloqueos y no se pueden configurar.
- RF-68: CUANDO faltan 2 minutos para que empiece un bloqueo de tipo "programado", EL SISTEMA muestra una notificación informativa, sin botón de cancelar; SI el bloqueo se confirma con menos de 2 minutos para el inicio, o con la hora de inicio ya pasada, ENTONCES EL SISTEMA no muestra el aviso previo y lo activa de inmediato.

### Configuración (Personalización)
- RF-70: EL SISTEMA permite guardar, en Personalización, un mensaje de enfoque por defecto y un mensaje de bloqueo por defecto (hasta 120 caracteres cada uno), usados para prellenar el paso de mensajes al crear un bloqueo nuevo (RF-58); SI no se personalizan, ENTONCES EL SISTEMA usa los mensajes de fábrica: "Vuelve a lo que estabas haciendo. Tú decides en qué inviertes tu tiempo." y "Bloqueo activo hasta las {hora de fin}. Este tiempo es para ti." (mismos textos que el RF-6 original).
- RF-44: EL SISTEMA muestra en Personalización una nota fija: "Si el sistema cierra la app para ahorrar batería, el bloqueo puede dejar de funcionar." (sin cambios).
- RF-41: SI la configuración guardada está corrupta, corresponde al modelo anterior (previo a este rediseño), o es la primera ejecución, ENTONCES EL SISTEMA descarta esos datos, arranca con la lista de bloqueos vacía y los mensajes por defecto de fábrica, y pide al usuario revisar la configuración si corresponde.

### Ajustes (idioma y Acerca de)
- RF-76: EL SISTEMA permite elegir, en una pantalla nueva "Ajustes" (distinta de Personalización), el idioma de la app entre español e inglés, español por defecto; el cambio se aplica de inmediato a toda la interfaz, sin necesidad de reiniciar la app.
- RF-77: EL SISTEMA traduce al inglés todo el texto de fábrica de la interfaz y el banco completo de preguntas (RF-23), manteniendo la misma estructura e `id`s en un archivo por idioma; los mensajes que el propio usuario escribió (de enfoque/bloqueo, por defecto en Personalización o propios de un bloqueo) nunca se traducen automáticamente y se muestran tal cual se escribieron, sin importar el idioma elegido.
- RF-78: EL SISTEMA guarda el idioma elegido junto con el resto de la configuración (RF-70), persistente entre reinicios.
- RF-79: EL SISTEMA muestra, en Ajustes, una sección "Acerca de" con el nombre de la app y su número de versión.

### Preguntas y datos
- RF-23: EL SISTEMA obtiene las preguntas de un banco local incluido en la app, disponible en español e inglés (RF-77), sin necesitar conexión a internet.
- RF-24: EL SISTEMA obtiene las preguntas de matemática y lógica de un generador local de secuencias numéricas y problemas aritméticos simples.
- RF-25: EL SISTEMA guarda toda la configuración y los registros de uso únicamente en el dispositivo.

### Permisos y ejecución
- RF-26: CUANDO falta el permiso de estadísticas de uso, el de superposición o el de notificaciones, EL SISTEMA lo indica al usuario y le guía a concederlo (sin cambios).
- RF-27: EL SISTEMA monitorea la app en primer plano mediante un servicio en segundo plano con una notificación visible (sin cambios).
- RF-43: MIENTRAS la pantalla está apagada, EL SISTEMA no consulta la app en primer plano (sin cambios).
- RF-45: CUANDO el móvil se reinicia, EL SISTEMA reanuda el servicio y retoma cada bloqueo guardado (programado, activo, con la ventana o la espera en curso de cada app) según su hora de inicio y fin calculadas.

## Requisitos no funcionales
- **Plataforma:** Android 8.0+ (`minSdkVersion 26`), React Native + TypeScript.
- **Rendimiento:** el mensaje reflexivo (RF-63) o la pantalla de espera (RF-66) son visibles en menos de 1 segundo desde que una app incluida en un bloqueo activo aparece en primer plano, con el servicio ya activo; se verifica en un móvil real.
- **Consumo:** la app en primer plano solo se consulta con la pantalla encendida y nunca con la pantalla apagada; se prioriza el ahorro de batería sobre la persistencia del bloqueo.
- **Privacidad:** ningún dato sale del dispositivo; sin analítica.
- **Idioma:** interfaz y preguntas en español por defecto, con inglés como idioma alternativo elegible (RF-76 a RF-79); ambos 100% locales, sin traducción automática ni conexión a internet.
- **Permisos:** como permisos especiales, solo uso de estadísticas y superposición, más los permisos normales imprescindibles para el servicio en primer plano, las notificaciones y el arranque tras reinicio; sin Servicio de Accesibilidad.

## Casos límite
- El usuario revoca un permiso, fuerza el cierre o desinstala la app: la app respeta su decisión y no lo impide.
- El sistema mata el servicio por ahorro de batería: se respeta; solo se informa en Personalización (RF-44).
- El usuario cambia la hora del sistema para saltarse un bloqueo o una espera: limitación conocida; EL SISTEMA calcula las franjas de cada bloqueo con la hora local del dispositivo y confía en ella (RF-42 generalizado); si el reloj cambia con un bloqueo en marcha, el bloqueo termina a la hora de fin marcada en el reloj.
- Un bloqueo tipo "programado" cruza la medianoche o se confirma con la hora de inicio ya pasada (RF-68).
- Una app incluida en un bloqueo se desinstala mientras tiene ventana o espera activa para esa app.
- El móvil se reinicia con uno o varios bloqueos en cualquier estado (RF-45).
- Dos apps de un mismo bloqueo están en estados distintos a la vez (una con ventana de 2 min, otra en espera de 5 min): cada app lleva su propio estado de ventana/espera, independiente de las demás apps del mismo bloqueo.
- El usuario intenta crear un bloqueo con una app que ya está en otro bloqueo cuya franja se superpone (RF-59): se rechaza, sin excepción, incluida la combinación duración+programado.
- Un bloqueo "programado" pasa a estado activo mientras una app incluida ya está en primer plano (el usuario no la volvió a abrir, ya estaba usándola): el sondeo periódico (Tick, RF-27) lo detecta en el ciclo siguiente y aplica el flujo de acceso (RF-63) de inmediato, sin esperar a que el usuario cambie de app.
- Un bloqueo termina (pasa su hora de fin) mientras el usuario está respondiendo el reto (RF-65), en la espera de 5 minutos (RF-66) o dentro de la ventana de 2 minutos (RF-67): EL SISTEMA libera la app de inmediato, sin exigir terminar el reto en curso ni la espera.
- El usuario abandona el flujo de acceso (RF-63 a RF-65) sin terminarlo (Atrás, Inicio, llamada, pantalla apagada) antes de responder las 3 preguntas: EL SISTEMA conserva el mismo intento, con las mismas preguntas y el progreso ya hecho, hasta que lo resuelva, falle, o el bloqueo termine (adapta el RF-39 original, ya no hay reseteo a las 04:00 porque no hay más día de uso).
- Un bloqueo marcado "extremo" todavía no empezó (estado "programado"): se edita o se borra igual que cualquier otro (RF-61); el modo extremo recién impide todo acceso una vez que el bloqueo pasa a estar activo (RF-74).
- Un bloqueo marcado "extremo" termina (pasa su hora de fin): se libera igual que cualquier otro bloqueo (RF-55, RF-72); "extremo" solo afecta mientras el bloqueo está activo, nunca después.
- Un reto ya en curso (preguntas ya elegidas, RF-65) sigue mostrándose en el idioma en que se armó, aunque el usuario cambie el idioma de la app mientras tanto; solo los retos que arrancan después de cambiar el idioma usan el nuevo.
- Una app no tiene categoría declarada por el sistema: se agrupa en "Otras" (RF-49).
- El sistema no puede generar el ícono de alguna app: se muestra sin ícono, sin excluirla de la lista (RF-48).
- El buscador no encuentra ninguna coincidencia, sola o combinada con una categoría: se muestra un mensaje de "sin resultados", sin ocultar el buscador (RF-46, RF-49).
- Una app de un bloqueo se desinstaló antes de ver el resumen o el detalle: se muestra su nombre de paquete (RF-81).
- El bloqueo termina con su detalle abierto (RF-82): al volver a la lista ya no aparece (RF-55).

## Fuera de alcance
- iOS.
- Preguntas desde una API externa (Open Trivia) y su traducción.
- Servicio de Accesibilidad y bloqueo de los Ajustes del sistema.
- Bloqueos recurrentes (que se repitan todos los días o ciertos días de la semana): cada bloqueo es puntual, hay que crearlo cada vez.
- Varias categorías de preguntas combinadas dentro de un mismo bloqueo (RF-57: una sola por bloqueo).
- Preguntas editables por el usuario y banco descargable.
- Estadísticas, sincronización en la nube y cuentas de usuario.
- Publicación en Google Play.
- Tope de cantidad de bloqueos simultáneos (posible mejora futura).
- Perfil de trabajo y apps clonadas: cada app se trata por su nombre de paquete.
- Revertir, pausar o cancelar un bloqueo "extremo" una vez activo, por cualquier medio (RF-74: es exactamente la garantía que ofrece este modo).
- Más idiomas que español e inglés, y traducción automática de texto libre escrito por el usuario (RF-77).
- Detectar o avisar cuando el sistema mata el servicio, y pedir la exclusión del ahorro de batería.
- Reloj a prueba de manipulación de la hora del sistema.
- Migración real de los datos del modelo anterior a bloqueos equivalentes (RF-41: se descartan sin más).

## Criterios de finalización
- Todos los RF verificables sin dispositivo (lógica en TypeScript pura, con reloj inyectable) con test en verde.
- Verificados por demo manual en un móvil real: RF-26, RF-27, RF-43, RF-45, RF-55, RF-59, RF-60, RF-61, RF-62, RF-63, RF-64, RF-65, RF-66, RF-67, RF-68, RF-73, RF-74, RF-75, RF-76, RF-79, RF-80, RF-81, RF-82; la lógica de decisión detrás de cada uno también se prueba con tests en TypeScript.
- Un test valida el formato de cada banco local, español e inglés (4 opciones, `correctIndex` válido, área conocida, sin duplicados, mismos `id` en ambos archivos).
- Cada banco local (español e inglés) tiene al menos 60 preguntas por cada área de texto (general, tecnología, salud, ciencia).
- Demo manual en un móvil Android real, incluido el modo avión: crear un bloqueo "por tiempo" y uno "programado", intentar solaparlos (se rechaza), activar uno, flujo completo de acceso (reflexión → confirmación → 3 preguntas → fallo con espera de 5 min → acierto con ventana de 2 min), editar/borrar uno programado, reinicio del móvil con un bloqueo activo.
- Demo manual: crear un bloqueo "extremo", activarlo, confirmar que abrir una app incluida muestra solo el mensaje de bloqueo sin ningún botón ni reto; cambiar el idioma a inglés y confirmar que la interfaz y un reto nuevo cambian, mientras un mensaje propio ya escrito no se traduce; revisar la sección "Acerca de".

## Decisiones de clarificación
- C1 a C14: ver historial completo de este documento antes del rediseño (commit previo); siguen documentando decisiones de las Fases 0 a 9, retiradas donde correspondía según la nota de migración de arriba.
- C15: se amendó el principio 3 de la Constitución: "la fricción es la norma" ya no tiene ninguna excepción firme — todo bloqueo, sin excepción, ofrece salida por preguntas. Disparado por un reporte de uso real que reveló que esa excepción nunca fue pedida por el usuario.
- C16: el modelo pasa de una única configuración global (límite diario + bloqueo horario) a una lista de bloqueos independientes, cada uno con su propio grupo de apps, duración y categoría — como una lista de alarmas (RF-55 a RF-62).
- C17: una misma app puede estar en más de un bloqueo, pero nunca en dos cuyas franjas de tiempo se superpongan; esto aplica por igual a bloqueos "por tiempo" y "programado", calculando para ambos un inicio y un fin concretos (RF-59).
- C18: un bloqueo programado (no iniciado) se puede editar o borrar libremente; uno activo no se puede cancelar ni editar por ningún medio, solo acceder por el reto (RF-61, RF-62).
- C19: el reto deja de ser configurable (1 a 3 preguntas, ventana 5-10 min, espera 3 min) y pasa a tener valores fijos para todos los bloqueos: siempre 3 preguntas, corta en la 2ª falla, espera de 5 minutos, ventana de acceso de 2 minutos (RF-65 a RF-67, RF-69).
- C20: se agrega un paso reflexivo nuevo antes del reto ("¿para qué la querés usar?" + confirmación Sí/No), a propósito, como fricción adicional antes de llegar a las preguntas (RF-63, RF-64).
- C21: desaparece el límite diario recurrente (minutos de uso que se gastaban y reseteaban a las 04:00) sin reemplazo — todo pasa a ser por bloqueos creados explícitamente por el usuario.
- C22: la pestaña Personalización (antes "Ajustes") queda reducida a los mensajes por defecto (que prellenan cada bloqueo nuevo) y la nota de batería; ya no tiene campos de límite/preguntas/ventana (RF-70, RF-44).
- C34 (2026-10-03, feedback de uso real): se renombra la pestaña "Ajustes" a "Personalización" — el nombre anterior confundía con los ajustes del sistema (idioma, tema); sin cambio de contenido ni de RF, solo de nombre visible.
- C23: al actualizar desde una instalación con el modelo anterior, los datos guardados se descartan sin intentar convertirlos — se trata igual que una configuración corrupta o una primera ejecución (RF-41 amendado).
- C24: la categoría de preguntas pasa de "una o varias por configuración global" a "exactamente una por bloqueo" (RF-57).
- C25: el paso de selección de apps del asistente de creación reutiliza tal cual la pantalla existente (buscador, categorías, esenciales excluidas — RF-1, RF-28, RF-46, RF-48, RF-49), sin el orden "restringidas primero" de RF-52 (ya no aplica: no hay una lista global de apps restringidas contra la cual ordenar).
- C26: no se recrea la pantalla `/dev` de herramientas de desarrollo para este rediseño; la verificación en dispositivo sigue siendo manual.
- C27 (Fase 3, QA de la spec): un bloqueo terminado se quita de la lista de inmediato, sin dejar constancia (RF-55) — no hay historial en esta versión.
- C28 (Fase 3): se precisó RF-65: el reto corta en cuanto se acumulan 2 respuestas incorrectas (en cualquier posición), no específicamente "en la segunda pregunta" — evita la lectura ambigua de qué pasa si la primera falla y la segunda acierta.
- C29 (Fase 3): se precisó RF-59: el rechazo por solapamiento es de la creación completa, nunca un bloqueo parcial con solo las apps sin conflicto.
- C30 (Fase 3): se agregó el caso límite de un bloqueo "programado" que arranca con la app ya en primer plano — lo cubre el sondeo periódico existente (Tick, RF-27), sin necesitar un RF nuevo.
- C31 (Fase 3): se agregó el caso límite de un bloqueo que termina en medio del reto/espera/ventana de una app — se libera de inmediato, sin exigir terminarlo.
- C32 (Fase 3): se resolvió la duda sobre abandonar el flujo de acceso a medio camino, adaptando el RF-39 original: se conserva el mismo intento hasta resolverlo, fallarlo, o que el bloqueo termine (ya no hay reseteo a las 04:00).
- C33 (Fase 4, descubrimiento del plan): se retiró RF-36 — contaba tiempo real de uso para el límite diario, que ya no existe; ni el reto (RF-65-67) ni la ventana de acceso (ahora un cronómetro fijo de 2 min desde que se concede, no una acumulación de uso) lo necesitan. Se borra `core/usage.ts` por completo.
- C35 (2026-10-03, feedback de uso real): se amendó el principio 3 de la Constitución para agregar la única excepción explícita a "todo bloqueo tiene salida": el bloqueo "extremo" (RF-73, RF-74), opt-in y consciente, elegido por el usuario sabiendo que no va a poder arrepentirse mientras esté activo.
- C36: la pantalla sin salida de un bloqueo extremo (RF-74) muestra solo el mensaje de bloqueo, sin ningún botón — mismo patrón ya probado en el viejo `restblock.tsx` (retirado en la Fase 10): la única salida es Atrás/Inicio del sistema, que no concede acceso.
- C37: un bloqueo extremo se distingue siempre con una etiqueta propia en la lista de Bloqueos (RF-75), para que nunca sea indistinguible de uno normal.
- C38: se amendó el principio 12 de la Constitución para permitir inglés como idioma alternativo de la interfaz (además de español por defecto) — contradecía la regla previa ("textos al usuario en español") de forma directa.
- C39: se decidió traducir el banco completo de preguntas (245, RF-77) como parte de esta misma spec, no como un trabajo aparte — decisión consciente del usuario pese a ser la parte más grande de esta ronda.
- C40: los mensajes que el propio usuario escribió (de enfoque/bloqueo) nunca se traducen automáticamente al cambiar el idioma — la app es 100% local y sin red (principio 9), no hay cómo traducir texto libre sin un servicio externo.
- C41: el cambio de idioma se aplica al instante en toda la interfaz, sin pedir reiniciar la app.
- C42: la pantalla nueva "Ajustes" (RF-76 a RF-79) es distinta de "Personalización" (RF-70, RF-44) — esta última no cambia; con esta ronda la app pasa a tener 3 pestañas (Personalización, Ajustes, Bloqueos).
- C43: "Acerca de" (RF-79) muestra solo nombre y versión, sin changelog ni links — alcance mínimo, sin mantenimiento adicional.
- C44 (2026-11-12, feedback de uso real): la categoría de preguntas se sigue eligiendo de a una (RF-57, C24 se mantienen); el problema era visual — se dibujaba con casillas de verificación, que sugieren elección múltiple. Toda elección de opción única (categoría, idioma de Ajustes) se dibuja como radio button.
- C45: "extremo" no es una categoría sino una marca aparte (RF-73); se dibuja en su propia sección con un interruptor, no como una fila más de la lista de categorías. No se vuelven excluyentes en los datos: el bloqueo siempre guarda una categoría, que con "extremo" simplemente no se usa (RF-74) y se recupera si se desmarca (RF-80).
- C46: el resumen y el detalle muestran como mucho 5 nombres de apps antes de "+N más" (RF-81), para que la pantalla no crezca sin límite con bloqueos de muchas apps.
- C47: el detalle de un bloqueo (RF-82) es solo de lectura también para los programados; editar y borrar siguen en la tarjeta de la lista (RF-61), sin duplicar acciones en el detalle.

## Dudas abiertas
Ninguna.
