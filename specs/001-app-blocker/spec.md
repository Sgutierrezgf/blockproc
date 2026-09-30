# Spec 001 — Bloqueo consciente de apps con reto y bloqueo horario

## Contexto y objetivo
El uso compulsivo de ciertas apps del móvil roba tiempo que la persona preferiría dedicar a otras cosas. Esta app introduce **fricción consciente**: cuando el usuario supera el tiempo que él mismo se fijó en una app, debe superar un pequeño reto de preguntas para seguir usándola un rato más. Además ofrece un **bloqueo horario** (para dormir, trabajar, estudiar), sin reto y sin marcha atrás, que impide usar las apps elegidas durante el rango que el usuario fija. Es una herramienta de autocontrol por elección: no impide al usuario forzar el cierre, quitar permisos ni desinstalarla, y prioriza el ahorro de batería sobre la persistencia del bloqueo.

## Usuarios / actores
- **Usuario:** persona que instala la app en su móvil Android y decide qué apps restringir.
- **Sistema:** la app, con su servicio en segundo plano y su pantalla superpuesta.

## Historias de usuario
- H1: Como usuario quiero elegir qué apps del móvil restringir para limitar solo las que me distraen.
- H2: Como usuario quiero un límite diario de uso para no pasarme de tiempo sin darme cuenta.
- H3: Como usuario quiero que al superar el límite me pidan un reto corto para que usar más sea una decisión consciente.
- H4: Como usuario quiero elegir las áreas y la cantidad de preguntas del reto para que sea llevadero y útil.
- H5: Como usuario quiero ver la respuesta correcta cuando fallo para aprender algo nuevo.
- H6: Como usuario quiero un bloqueo horario que bloquee mis apps sin reto durante un rango que yo fije para poder dormir o concentrarme.
- H7: Como usuario quiero un mensaje de enfoque propio cuando se vuelve a bloquear una app para recordarme mis prioridades.
- H8: Como usuario quiero que la app me proteja de errores irreversibles (apps esenciales, horarios mal puestos) para no quedarme sin poder usar el móvil.
- H9: Como usuario quiero que la app gaste poca batería para no quedarme sin ella en una emergencia.

> Los identificadores RF no se renumeran: los requisitos nuevos usan números consecutivos desde RF-28.

## Requisitos funcionales (criterios de aceptación en EARS)

### Configuración
- RF-1: CUANDO el usuario abre la pantalla de configuración, EL SISTEMA muestra la lista de apps instaladas con icono en el lanzador, excluyendo las esenciales (RF-28), y permite marcar cuáles restringir.
- RF-46: CUANDO el usuario escribe texto en el buscador de la pantalla de selección de apps, EL SISTEMA filtra la lista para mostrar solo las apps cuyo nombre contiene ese texto, sin distinguir mayúsculas ni tildes, actualizando el resultado con cada carácter escrito; SI ningún nombre coincide, ENTONCES EL SISTEMA muestra un mensaje indicando que no hay resultados, sin ocultar el buscador.
- RF-48: CUANDO el usuario abre la pantalla de selección de apps, EL SISTEMA muestra junto al nombre de cada app su ícono tal como aparece en el lanzador de Android, y un indicador de carga mientras los íconos se están resolviendo; SI el sistema no puede obtener el ícono de alguna app, ENTONCES la muestra solo con su nombre, sin excluirla de la lista.
- RF-49: EL SISTEMA agrupa las apps de la pantalla de selección por categoría (la que declara el sistema operativo, traducida a una etiqueta en español, o "Otras" si no declara ninguna) y permite filtrar tocando una categoría, de forma combinable con el buscador de texto (RF-46): ambos criterios se aplican a la vez.
- RF-2: EL SISTEMA aplica una única configuración global a todas las apps restringidas: límite diario, áreas de preguntas, cantidad de preguntas, ventana de acceso y mensaje de enfoque.
- RF-3: SI el usuario no define un límite diario, ENTONCES EL SISTEMA usa 30 minutos por defecto.
- RF-4: EL SISTEMA permite elegir un límite diario de 5 a 240 minutos en pasos de 5, de 1 a 3 preguntas por reto y una ventana de acceso de 5 a 10 minutos, y rechaza valores fuera de esos rangos.
- RF-5: EL SISTEMA permite marcar una o varias áreas de preguntas (mínimo una) entre: conocimiento general, tecnología, salud y bienestar, ciencia y naturaleza, y matemática y lógica.
- RF-6: EL SISTEMA permite guardar un mensaje de enfoque personalizado de hasta 120 caracteres; SI no hay ninguno, ENTONCES muestra el mensaje por defecto: "Vuelve a lo que estabas haciendo. Tú decides en qué inviertes tu tiempo."
- RF-28: EL SISTEMA nunca ofrece para restringir las siguientes apps: teléfono/marcador, Ajustes del sistema, lanzador de pantalla de inicio, la aplicación de cámara predeterminada del sistema y la propia app; la identificación de estas apps es de mejor esfuerzo, según lo que declare el sistema.
- RF-29: MIENTRAS al menos una app restringida esté bloqueada por límite diario y no haya un bloqueo horario activo, EL SISTEMA aplica de inmediato los cambios de configuración que aumentan la restricción (bajar el límite, añadir apps, subir la cantidad de preguntas, acortar la ventana) y aplica desde las 04:00 siguientes los que la reducen (subir el límite, quitar apps, bajar la cantidad de preguntas, alargar la ventana); los cambios de áreas de preguntas y de mensajes se aplican siempre al instante.
- RF-41: SI la configuración guardada está corrupta o es la primera ejecución, ENTONCES EL SISTEMA restaura los valores por defecto (límite 30 min, 2 preguntas, ventana de 5 min, área de conocimiento general), reinicia a cero los contadores dañados y pide al usuario revisar la configuración.
- RF-44: EL SISTEMA muestra en los ajustes una nota fija: "Si el sistema cierra la app para ahorrar batería, el bloqueo puede dejar de funcionar."

### Límite de uso y bloqueo
- RF-36: EL SISTEMA cuenta como tiempo de uso de una app únicamente el tiempo en que está en primer plano con la pantalla encendida, e ignora los intervalos de menos de 1 segundo.
- RF-7: EL SISTEMA contabiliza el tiempo de uso de cada app restringida por separado y reinicia todos los contadores a las 04:00 hora local (el día de uso va de 04:00 a 04:00).
- RF-8: CUANDO el uso diario de una app restringida alcanza el límite, EL SISTEMA la marca como bloqueada.
- RF-9: CUANDO el usuario abre una app restringida y bloqueada, EL SISTEMA muestra una pantalla superpuesta con el reto en menos de 1 segundo.
- RF-10: MIENTRAS una app restringida no haya alcanzado su límite, EL SISTEMA permite usarla sin interrupciones.
- RF-30: CUANDO faltan 1 minuto para que el uso diario de una app restringida en primer plano alcance el límite, EL SISTEMA muestra una notificación de aviso.
- RF-31: CUANDO el uso diario de una app restringida alcanza el límite mientras está en primer plano, EL SISTEMA muestra de inmediato el reto encima de la app.

### Reto y desbloqueo
- RF-11: CUANDO se muestra el reto, EL SISTEMA presenta exactamente la cantidad de preguntas configurada, mezcladas de las áreas marcadas, sin repetir una pregunta hasta haber usado todas las de esas áreas; SI quedan menos preguntas sin usar que las pedidas, ENTONCES reinicia el ciclo, completa el reto y no repite ninguna pregunta dentro del mismo reto.
- RF-37: CUANDO se muestra una pregunta, EL SISTEMA baraja el orden de sus opciones.
- RF-12: CUANDO el usuario responde correctamente todas las preguntas, EL SISTEMA concede a esa app la ventana de acceso configurada y no desbloquea ninguna otra app.
- RF-47: CUANDO el usuario responde correctamente todas las preguntas, EL SISTEMA ofrece, en la misma pantalla, un botón para continuar a la app; CUANDO el usuario presiona ese botón o el botón/gesto atrás en esa pantalla, EL SISTEMA envía blockproc a segundo plano, sin garantizar qué queda visible (depende del sistema operativo).
- RF-13: SI el usuario responde una pregunta incorrectamente, ENTONCES EL SISTEMA corta el reto, muestra la respuesta correcta con su explicación y bloquea nuevos intentos en esa app durante exactamente 3 minutos.
- RF-38: MIENTRAS dura la espera de 3 minutos de una app, CUANDO el usuario la abre, EL SISTEMA muestra una pantalla de espera con la cuenta atrás y el mensaje de enfoque.
- RF-14: CUANDO comienza un nuevo intento tras la espera, EL SISTEMA presenta preguntas nuevas.
- RF-39: SI el usuario abandona un reto sin resolverlo (Atrás, Inicio, llamada, pantalla apagada), ENTONCES EL SISTEMA conserva el mismo reto, con las mismas preguntas y el progreso, hasta que lo resuelva o falle, o hasta las 04:00, sin penalización.
- RF-15: CUANDO faltan 1 minuto para que termine la ventana de acceso de una app que sigue en primer plano, EL SISTEMA muestra una notificación de aviso; SI el usuario ya salió de la app, ENTONCES no se muestra ningún aviso.
- RF-16: CUANDO termina la ventana de acceso de una app, EL SISTEMA vuelve a bloquearla y exige un nuevo reto para seguir usándola; SI está en primer plano, ENTONCES muestra de inmediato el reto con el mensaje de enfoque; SI no lo está, ENTONCES el reto aparece la próxima vez que se abra.

### Bloqueo horario
- RF-17: EL SISTEMA permite al usuario definir una hora de inicio y una de fin para el bloqueo horario, incluso si el rango cruza la medianoche (por ejemplo, 21:00 a 06:00 o 8:00 a 12:00), con una duración máxima de 12 horas; SI el rango supera 12 horas, ENTONCES EL SISTEMA lo rechaza.
- RF-18: MIENTRAS el bloqueo horario está activo, EL SISTEMA muestra en las apps restringidas un bloqueo con el mensaje del bloqueo horario y **sin** reto.
- RF-19: MIENTRAS el bloqueo horario está activo, EL SISTEMA no ofrece ninguna forma de salir de él antes de la hora de fin y no permite editar ninguna parte de la configuración.
- RF-20: SI el usuario cancela el bloqueo horario antes de la hora de inicio, ENTONCES EL SISTEMA no lo activa.
- RF-21: SI el bloqueo horario y el límite diario coinciden, ENTONCES EL SISTEMA aplica el bloqueo horario (sin reto).
- RF-40: CUANDO empieza un bloqueo horario mientras una app tiene una ventana de acceso activa, EL SISTEMA corta la ventana y bloquea la app sin reto.
- RF-22: EL SISTEMA aplica el bloqueo horario únicamente a las apps restringidas; el resto del móvil (alarma, llamadas) sigue funcionando.
- RF-32: ANTES de activar un bloqueo horario, EL SISTEMA muestra un resumen con el rango elegido, la duración y el aviso "sin marcha atrás", y solo lo activa cuando el usuario confirma.
- RF-33: CUANDO faltan 2 minutos para que empiece un bloqueo horario, EL SISTEMA muestra una notificación informativa, sin botón de cancelar.
- RF-34: SI el bloqueo horario se confirma con menos de 2 minutos para el inicio, o con la hora de inicio ya pasada, ENTONCES EL SISTEMA no muestra el aviso previo y lo activa de inmediato.
- RF-35: EL SISTEMA permite personalizar el mensaje del bloqueo horario, de hasta 120 caracteres; SI no hay ninguno, ENTONCES muestra el mensaje por defecto: "Bloqueo activo hasta las {hora de fin}. Este tiempo es para ti."
- RF-42: EL SISTEMA calcula los rangos con la hora local del dispositivo y confía en la hora del sistema; SI el reloj cambia con el bloqueo en marcha (horario de verano, zona horaria), ENTONCES el bloqueo termina a la hora de fin marcada en el reloj.

### Preguntas y datos
- RF-23: EL SISTEMA obtiene las preguntas de un banco local en español incluido en la app, sin necesitar conexión a internet.
- RF-24: EL SISTEMA obtiene las preguntas de matemática y lógica de un generador local de secuencias numéricas y problemas aritméticos simples.
- RF-25: EL SISTEMA guarda toda la configuración y los registros de uso únicamente en el dispositivo.

### Permisos y ejecución
- RF-26: CUANDO falta el permiso de estadísticas de uso o el de superposición, EL SISTEMA lo indica al usuario y le guía a concederlo.
- RF-27: EL SISTEMA monitorea la app en primer plano mediante un servicio en segundo plano con una notificación visible.
- RF-43: MIENTRAS la pantalla está apagada, EL SISTEMA no consulta la app en primer plano.
- RF-45: CUANDO el móvil se reinicia, EL SISTEMA reanuda el servicio y retoma las ventanas, esperas y bloqueo horario guardados con su hora de fin.

## Requisitos no funcionales
- **Plataforma:** Android 8.0+ (`minSdkVersion 26`), React Native + TypeScript.
- **Rendimiento:** el reto o bloqueo es visible en menos de 1 segundo desde que la app restringida aparece en primer plano, con el servicio ya activo (no se exige en arranque en frío); se verifica en un móvil real.
- **Consumo:** la app en primer plano solo se consulta con la pantalla encendida y nunca con la pantalla apagada; se prioriza el ahorro de batería sobre la persistencia del servicio.
- **Privacidad:** ningún dato sale del dispositivo; sin analítica.
- **Idioma:** interfaz y preguntas en español.
- **Permisos:** como permisos especiales, solo uso de estadísticas y superposición, más los permisos normales imprescindibles para el servicio en primer plano, las notificaciones y el arranque tras reinicio; sin Servicio de Accesibilidad.

## Casos límite
- El usuario revoca un permiso, fuerza el cierre o desinstala la app: la app respeta su decisión y no lo impide.
- El sistema mata el servicio por ahorro de batería: se respeta; solo se informa en los ajustes (RF-44).
- El usuario cambia la hora del sistema para saltarse un bloqueo o una espera: limitación conocida, se confía en la hora del sistema (RF-42).
- Un bloqueo horario cruza la medianoche o se activa con la hora de inicio ya pasada (RF-34).
- Una app restringida se desinstala mientras tiene ventana o espera activa.
- El límite diario configurado es menor que la ventana de acceso (el mínimo de 5 minutos coincide con la ventana mínima).
- El móvil se reinicia con una ventana, espera o bloqueo horario activo (RF-45).
- Dos apps restringidas están en estados distintos a la vez (una con ventana, otra bloqueada).
- El usuario intenta relajar la configuración mientras hay una app bloqueada: se aplica desde las 04:00 (RF-29).
- Una ventana de acceso está activa al llegar las 04:00: no se corta, sigue hasta agotarse.
- Las áreas marcadas tienen menos preguntas sin usar que las pedidas (RF-11).
- El usuario presiona "Continuar a la app" (o el botón/gesto atrás en la pantalla de éxito) sin que haya ninguna otra app real debajo en la pila de tareas: igual se envía blockproc a segundo plano; lo que quede visible depende del sistema, sin garantía (RF-47).
- Una app no tiene categoría declarada por el sistema: se agrupa en "Otras" (RF-49).
- El sistema no puede generar el ícono de alguna app: se muestra sin ícono, sin excluirla de la lista (RF-48).
- El buscador no encuentra ninguna coincidencia, sola o combinada con una categoría: se muestra un mensaje de "sin resultados", sin ocultar el buscador (RF-46, RF-49).

## Fuera de alcance
- iOS.
- Preguntas desde una API externa (Open Trivia) y su traducción.
- Servicio de Accesibilidad y bloqueo de los Ajustes del sistema.
- Límites o configuración distintos por app.
- Bloqueo horario recurrente o con varios rangos por día.
- Preguntas editables por el usuario y banco descargable.
- Estadísticas, sincronización en la nube y cuentas de usuario.
- Publicación en Google Play.
- Tope diario de desbloqueos por app (posible mejora futura).
- Perfil de trabajo y apps clonadas: cada app se trata por su nombre de paquete.
- Detectar o avisar cuando el sistema mata el servicio, y pedir la exclusión del ahorro de batería.
- Reloj a prueba de manipulación de la hora del sistema.

## Criterios de finalización
- Todos los RF verificables sin dispositivo (lógica en TypeScript pura, con reloj inyectable) con test en verde.
- Verificados por demo manual en un móvil real: RF-9, RF-15, RF-18, RF-22, RF-26, RF-27, RF-30, RF-31, RF-33, RF-43 y RF-45; la lógica de decisión detrás de cada uno también se prueba con tests en TypeScript.
- Un test valida el formato del banco local (4 opciones, `correctIndex` válido, área conocida, sin duplicados).
- El banco local tiene al menos 60 preguntas por cada área de texto (general, tecnología, salud, ciencia).
- Demo manual en un móvil Android real, incluido el modo avión: límite alcanzado con la app abierta, reto, ventana, aviso, nuevo bloqueo, fallo con espera de 3 min, bloqueo horario con confirmación y reinicio del móvil durante un bloqueo.

## Decisiones de clarificación
- C1: el límite se aplica también con la app abierta, con aviso 1 minuto antes (RF-30, RF-31).
- C2: la configuración se congela durante el bloqueo horario y, fuera de él, endurecer aplica al instante y relajar desde las 04:00 (RF-19, RF-29).
- C3: el bloqueo horario exige confirmación, tiene tope de 12 h y avisa 2 minutos antes (RF-17, RF-32, RF-33, RF-34).
- C4: lista fija de apps esenciales no restringibles (RF-28).
- C5: se ajustó el principio 3 de la constitución; el bloqueo horario es la excepción firme.
- I1: tiempo de uso = primer plano con pantalla encendida (RF-36).
- I2: un reto abandonado se conserva (RF-39).
- I3: pantalla de espera con cuenta atrás y mensaje motivador; espera por app (RF-38, RF-6).
- I4: el bloqueo horario corta las ventanas activas (RF-40).
- I5: el aviso de fin de ventana solo si la app sigue en primer plano; la ventana cuenta por reloj (RF-15, RF-16).
- I6: el día de uso empieza a las 04:00 (RF-7, RF-29).
- I7: varias áreas de preguntas, mínimo una (RF-5, RF-11).
- I8: sin tope de desbloqueos diarios (fuera de alcance).
- E1, E2, E3, E5, V1 a V4: RF-37, RF-41, fuera de alcance, RF-42, criterios de finalización, rendimiento, RF-24 y principio 8 de la constitución.
- E4: se prioriza la batería; el sistema puede matar el servicio y solo se informa en los ajustes (RF-43, RF-44).
- Reinicio: el servicio se reanuda solo y el estado sobrevive (RF-45).
- Hora del sistema: se confía en ella (RF-42).
- Áreas con pocas preguntas: el ciclo se reinicia (RF-11).
- Detalles menores: límite de 5 a 240 min, mensajes de 120 caracteres con textos por defecto, reto abandonado hasta las 04:00, cambios neutrales inmediatos (RF-4, RF-6, RF-35, RF-39, RF-29).
- Plan (S1 a S3): se ajustaron RF-1, RF-28 y el requisito de consumo para reflejar las decisiones técnicas del plan.
- C6: se amplió el principio 1 de la constitución para reconocer que el código nativo ya cubre, además de permisos y Foreground Service, funciones puntuales de integración con el sistema operativo (listar apps con ícono/categoría, navegación del sistema); sigue sin cubrir lógica de negocio ni Servicio de Accesibilidad.
- C7: en la pantalla de éxito del reto, el botón/gesto atrás pasa a enviar blockproc a segundo plano (igual que el nuevo botón "Continuar a la app"), en vez de ir a Inicio como en el resto de pantallas de bloqueo/reto (RF-47); D13 del plan queda acotado a fallo del reto, espera y bloqueo horario.
- C8: el buscador y los chips de categoría de la pantalla de selección de apps son combinables (RF-46, RF-49), no excluyentes.
- C9: mientras se resuelven los íconos de las apps (ahora un proceso asíncrono), se muestra un indicador de carga en vez de la lista vacía (RF-48).
- C10: con la navegación por pestañas (Ajustes/Apps/Bloqueo horario), el botón/gesto atrás desde Apps o Bloqueo horario vuelve primero a la pestaña Ajustes, y solo desde ahí un segundo atrás sale de la app — convención estándar de Android para evitar salidas accidentales (sin RF nuevo: no cambia ningún comportamiento de bloqueo, solo la navegación).

## Dudas abiertas
Ninguna.
