# Spec 001 — Bloqueo consciente de apps con bloqueos múltiples y reto

> **Rediseño de fondo (2026-10-01):** a partir de un reporte de uso real se detectó que el
> modelo de "límite diario global + bloqueo horario único" nunca fue lo que el usuario pidió.
> Esta versión reemplaza ese modelo por un sistema único de **bloqueos** (varios, independientes,
> tipo alarma), cada uno con su propio grupo de apps, su propia duración y su propia categoría
> de preguntas — y con una regla nueva y no negociable: **todo bloqueo, sin excepción, tiene
> salida por preguntas**. Ver "Decisiones de clarificación" (C15 en adelante) para el detalle
> de qué RF quedan retirados y cuáles se mantienen igual.

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
defecto" pasa a vivir en Ajustes (RF-70) — el texto de fábrica ("Vuelve a lo que estabas
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
- RF-58: EL SISTEMA permite personalizar, para cada bloqueo, un mensaje de enfoque y un mensaje de bloqueo (hasta 120 caracteres cada uno), prellenados con los mensajes por defecto definidos en Ajustes (RF-70); el usuario puede dejarlos tal cual o cambiarlos solo para ese bloqueo.
- RF-59: ANTES de crear un bloqueo, SI alguna app elegida ya pertenece a otro bloqueo (programado o activo) cuya franja de tiempo se superpone con la del nuevo, ENTONCES EL SISTEMA rechaza la creación completa (ninguna app del bloqueo nuevo se crea, ni siquiera las que no tienen conflicto) e indica qué app y con qué bloqueo existente se superpone, para que el usuario la quite o cambie el horario antes de reintentar.
- RF-60: ANTES de crear un bloqueo, EL SISTEMA muestra un resumen (apps, tipo, franja o duración, categoría) junto con un aviso de advertencia, y solo lo crea cuando el usuario confirma explícitamente.
- RF-61: MIENTRAS un bloqueo todavía no empezó (estado "programado"), EL SISTEMA permite editarlo (cualquier campo elegido al crearlo) o borrarlo libremente, sin pedir el reto.
- RF-62: MIENTRAS un bloqueo está activo, EL SISTEMA no permite cancelarlo ni editar ninguno de sus campos (apps, horario, categoría, mensajes); la única forma de acceder a una app incluida es completar el flujo de acceso (RF-63 a RF-67).
- RF-72: EL SISTEMA aplica cada bloqueo únicamente a las apps que incluye; el resto del móvil (alarma, llamadas, apps no incluidas en ningún bloqueo) sigue funcionando con normalidad.

### Flujo de acceso durante un bloqueo activo
- RF-63: CUANDO el usuario abre una app incluida en un bloqueo activo, EL SISTEMA muestra primero una pantalla con el mensaje de enfoque de ese bloqueo y un único botón "Continuar", sin pedir ninguna respuesta todavía.
- RF-64: CUANDO el usuario presiona "Continuar", EL SISTEMA pregunta "¿Estás seguro?" con las opciones Sí/No; SI elige No, ENTONCES EL SISTEMA no inicia el reto (vuelve atrás / a segundo plano, sin penalización).
- RF-65: SI el usuario confirma que sí, ENTONCES EL SISTEMA presenta hasta 3 preguntas de la categoría de ese bloqueo, una por vez, mezcladas sin repetir una pregunta dentro del mismo intento, y corta el intento sin mostrar más preguntas en cuanto el usuario acumula 2 respuestas incorrectas (sin importar en qué posición cayeron).
- RF-66: SI el intento se corta por dos respuestas incorrectas, ENTONCES EL SISTEMA bloquea nuevos intentos en esa app, dentro de ese bloqueo, durante exactamente 5 minutos, mostrando mientras tanto una pantalla de espera con cuenta regresiva y el mensaje de enfoque de ese bloqueo.
- RF-67: SI el usuario responde correctamente al menos 2 de las 3 preguntas, ENTONCES EL SISTEMA concede acceso libre a esa app durante exactamente 2 minutos; al vencer esa ventana, SI el bloqueo sigue activo y la app sigue en primer plano o se vuelve a abrir, ENTONCES EL SISTEMA exige de nuevo el flujo completo desde RF-63.
- RF-37: CUANDO se muestra una pregunta, EL SISTEMA baraja el orden de sus opciones (sin cambios).
- RF-69: La cantidad de preguntas (3), el tiempo de espera tras fallar (5 minutos) y la ventana de acceso tras acertar (2 minutos) son los mismos para todos los bloqueos y no se pueden configurar.
- RF-68: CUANDO faltan 2 minutos para que empiece un bloqueo de tipo "programado", EL SISTEMA muestra una notificación informativa, sin botón de cancelar; SI el bloqueo se confirma con menos de 2 minutos para el inicio, o con la hora de inicio ya pasada, ENTONCES EL SISTEMA no muestra el aviso previo y lo activa de inmediato.

### Configuración (Ajustes)
- RF-70: EL SISTEMA permite guardar, en Ajustes, un mensaje de enfoque por defecto y un mensaje de bloqueo por defecto (hasta 120 caracteres cada uno), usados para prellenar el paso de mensajes al crear un bloqueo nuevo (RF-58); SI no se personalizan, ENTONCES EL SISTEMA usa los mensajes de fábrica: "Vuelve a lo que estabas haciendo. Tú decides en qué inviertes tu tiempo." y "Bloqueo activo hasta las {hora de fin}. Este tiempo es para ti." (mismos textos que el RF-6 original).
- RF-44: EL SISTEMA muestra en Ajustes una nota fija: "Si el sistema cierra la app para ahorrar batería, el bloqueo puede dejar de funcionar." (sin cambios).
- RF-41: SI la configuración guardada está corrupta, corresponde al modelo anterior (previo a este rediseño), o es la primera ejecución, ENTONCES EL SISTEMA descarta esos datos, arranca con la lista de bloqueos vacía y los mensajes por defecto de fábrica, y pide al usuario revisar la configuración si corresponde.

### Preguntas y datos (sin cambios)
- RF-23: EL SISTEMA obtiene las preguntas de un banco local en español incluido en la app, sin necesitar conexión a internet.
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
- **Idioma:** interfaz y preguntas en español.
- **Permisos:** como permisos especiales, solo uso de estadísticas y superposición, más los permisos normales imprescindibles para el servicio en primer plano, las notificaciones y el arranque tras reinicio; sin Servicio de Accesibilidad.

## Casos límite
- El usuario revoca un permiso, fuerza el cierre o desinstala la app: la app respeta su decisión y no lo impide.
- El sistema mata el servicio por ahorro de batería: se respeta; solo se informa en Ajustes (RF-44).
- El usuario cambia la hora del sistema para saltarse un bloqueo o una espera: limitación conocida; EL SISTEMA calcula las franjas de cada bloqueo con la hora local del dispositivo y confía en ella (RF-42 generalizado); si el reloj cambia con un bloqueo en marcha, el bloqueo termina a la hora de fin marcada en el reloj.
- Un bloqueo tipo "programado" cruza la medianoche o se confirma con la hora de inicio ya pasada (RF-68).
- Una app incluida en un bloqueo se desinstala mientras tiene ventana o espera activa para esa app.
- El móvil se reinicia con uno o varios bloqueos en cualquier estado (RF-45).
- Dos apps de un mismo bloqueo están en estados distintos a la vez (una con ventana de 2 min, otra en espera de 5 min): cada app lleva su propio estado de ventana/espera, independiente de las demás apps del mismo bloqueo.
- El usuario intenta crear un bloqueo con una app que ya está en otro bloqueo cuya franja se superpone (RF-59): se rechaza, sin excepción, incluida la combinación duración+programado.
- Un bloqueo "programado" pasa a estado activo mientras una app incluida ya está en primer plano (el usuario no la volvió a abrir, ya estaba usándola): el sondeo periódico (Tick, RF-27) lo detecta en el ciclo siguiente y aplica el flujo de acceso (RF-63) de inmediato, sin esperar a que el usuario cambie de app.
- Un bloqueo termina (pasa su hora de fin) mientras el usuario está respondiendo el reto (RF-65), en la espera de 5 minutos (RF-66) o dentro de la ventana de 2 minutos (RF-67): EL SISTEMA libera la app de inmediato, sin exigir terminar el reto en curso ni la espera.
- El usuario abandona el flujo de acceso (RF-63 a RF-65) sin terminarlo (Atrás, Inicio, llamada, pantalla apagada) antes de responder las 3 preguntas: EL SISTEMA conserva el mismo intento, con las mismas preguntas y el progreso ya hecho, hasta que lo resuelva, falle, o el bloqueo termine (adapta el RF-39 original, ya no hay reseteo a las 04:00 porque no hay más día de uso).
- Una app no tiene categoría declarada por el sistema: se agrupa en "Otras" (RF-49).
- El sistema no puede generar el ícono de alguna app: se muestra sin ícono, sin excluirla de la lista (RF-48).
- El buscador no encuentra ninguna coincidencia, sola o combinada con una categoría: se muestra un mensaje de "sin resultados", sin ocultar el buscador (RF-46, RF-49).

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
- Detectar o avisar cuando el sistema mata el servicio, y pedir la exclusión del ahorro de batería.
- Reloj a prueba de manipulación de la hora del sistema.
- Migración real de los datos del modelo anterior a bloqueos equivalentes (RF-41: se descartan sin más).

## Criterios de finalización
- Todos los RF verificables sin dispositivo (lógica en TypeScript pura, con reloj inyectable) con test en verde.
- Verificados por demo manual en un móvil real: RF-26, RF-27, RF-43, RF-45, RF-55, RF-59, RF-60, RF-61, RF-62, RF-63, RF-64, RF-65, RF-66, RF-67, RF-68; la lógica de decisión detrás de cada uno también se prueba con tests en TypeScript.
- Un test valida el formato del banco local (4 opciones, `correctIndex` válido, área conocida, sin duplicados).
- El banco local tiene al menos 60 preguntas por cada área de texto (general, tecnología, salud, ciencia).
- Demo manual en un móvil Android real, incluido el modo avión: crear un bloqueo "por tiempo" y uno "programado", intentar solaparlos (se rechaza), activar uno, flujo completo de acceso (reflexión → confirmación → 3 preguntas → fallo con espera de 5 min → acierto con ventana de 2 min), editar/borrar uno programado, reinicio del móvil con un bloqueo activo.

## Decisiones de clarificación
- C1 a C14: ver historial completo de este documento antes del rediseño (commit previo); siguen documentando decisiones de las Fases 0 a 9, retiradas donde correspondía según la nota de migración de arriba.
- C15: se amendó el principio 3 de la Constitución: "la fricción es la norma" ya no tiene ninguna excepción firme — todo bloqueo, sin excepción, ofrece salida por preguntas. Disparado por un reporte de uso real que reveló que esa excepción nunca fue pedida por el usuario.
- C16: el modelo pasa de una única configuración global (límite diario + bloqueo horario) a una lista de bloqueos independientes, cada uno con su propio grupo de apps, duración y categoría — como una lista de alarmas (RF-55 a RF-62).
- C17: una misma app puede estar en más de un bloqueo, pero nunca en dos cuyas franjas de tiempo se superpongan; esto aplica por igual a bloqueos "por tiempo" y "programado", calculando para ambos un inicio y un fin concretos (RF-59).
- C18: un bloqueo programado (no iniciado) se puede editar o borrar libremente; uno activo no se puede cancelar ni editar por ningún medio, solo acceder por el reto (RF-61, RF-62).
- C19: el reto deja de ser configurable (1 a 3 preguntas, ventana 5-10 min, espera 3 min) y pasa a tener valores fijos para todos los bloqueos: siempre 3 preguntas, corta en la 2ª falla, espera de 5 minutos, ventana de acceso de 2 minutos (RF-65 a RF-67, RF-69).
- C20: se agrega un paso reflexivo nuevo antes del reto ("¿para qué la querés usar?" + confirmación Sí/No), a propósito, como fricción adicional antes de llegar a las preguntas (RF-63, RF-64).
- C21: desaparece el límite diario recurrente (minutos de uso que se gastaban y reseteaban a las 04:00) sin reemplazo — todo pasa a ser por bloqueos creados explícitamente por el usuario.
- C22: la pestaña Ajustes queda reducida a los mensajes por defecto (que prellenan cada bloqueo nuevo) y la nota de batería; ya no tiene campos de límite/preguntas/ventana (RF-70, RF-44).
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

## Dudas abiertas
Ninguna.
