# Checklist para publicar blockproc en Google Play

Esto no es parte de la spec (no describe comportamiento de la app, RF-X).
Es una referencia para el trámite de publicación — ver también la auditoría
de seguridad que motivó varios de estos puntos.

## 1. Firma de producción

Ya está cableado (ver `plugins/withBlockprocAndroid.js`, función
`withReleaseSigning`): el build de `release` firma con
`release.keystore.properties` si existe, y si no, cae al keystore de debug
de siempre (no rompe nada mientras no generes el de producción).

**Pasos para vos, en Android Studio:**
1. `Build > Generate Signed App Bundle / APK... > Create new...` — generá un
   `.jks` nuevo. Guardá la contraseña del keystore y la de la clave en un
   gestor de contraseñas: si las perdés, no podés volver a firmar
   actualizaciones de la misma app.
2. Copiá ese `.jks` a `blockproc/` (al lado de `app.json`, **no** dentro de
   `android/` — esa carpeta se borra con cada `expo prebuild`).
3. Copiá `blockproc/release.keystore.properties.example` como
   `blockproc/release.keystore.properties` y completá los 4 valores.
4. Confirmá con `cd android && ./gradlew assembleRelease` que el APK
   resultante ya no es el firmado con el keystore de debug.
5. **Para subir a Play Store necesitás un `.aab`, no un `.apk`** (Play exige
   Android App Bundle para apps nuevas): `cd android && ./gradlew
   bundleRelease` — usa la misma `signingConfig` de arriba, el archivo queda
   en `android/app/build/outputs/bundle/release/app-release.aab`.
6. Inscribite en **Play App Signing** al crear la app en Play Console
   (recomendado): Google vuelve a firmar la distribución final con su propia
   clave, tu keystore queda como "upload key".

## 2. Política de privacidad

Borrador ya escrito, reflejando el comportamiento real de la app (sin
analítica, sin red, todo local — confirmado en la auditoría de seguridad):
**https://claude.ai/artifact/NhdQnz8TRbqfTK9A4AyDue**

Es un artifact privado — para usarlo como URL en Play Console, compartilo
desde el menú Share de esa página, o copiá el contenido a tu propio hosting
(GitHub Pages, Notion público, etc.) y usá esa URL en su lugar. Play Console
pide la URL en **Policy > App content > Privacy policy**.

## 3. Formulario "Data safety"

Play Console > Policy > App content > Data safety. Dado que confirmamos que
la app no hace ninguna llamada de red y no tiene SDKs de analítica/ads:

- "Does your app collect or share any of the required user data types?" → **No**.
- Como no se recopila nada, no hace falta declarar ningún tipo de dato
  (ubicación, identificadores, etc.) ni ninguna finalidad (analítica,
  publicidad, etc.).
- "Is all of the user data collected by your app encrypted in transit?" →
  no aplica (no hay datos que transiten).
- "Do you provide a way for users to request that their data be deleted?" →
  no aplica (nada que borrar remotamente; "Borrar datos" del propio Android
  ya borra todo lo local).

## 4. Permisos sensibles — texto de justificación

Play Console puede pedir que justifiques el uso de permisos especiales. Si
aparece el formulario de declaración de permisos, o si Google pide
aclaración durante la revisión, este texto (adaptalo al campo que corresponda):

> blockproc es una app de bienestar digital / control de hábitos. El
> permiso de **acceso a datos de uso** (`PACKAGE_USAGE_STATS`) es necesario
> para detectar, en el propio dispositivo, cuándo el usuario abre una de las
> apps que él mismo eligió limitar — la app nunca transmite ni almacena esa
> información fuera del dispositivo. El permiso de **mostrar sobre otras
> apps** (`SYSTEM_ALERT_WINDOW`) es necesario para interponer la pantalla de
> reflexión/reto por encima de la app bloqueada en el momento justo. El
> servicio en primer plano (`FOREGROUND_SERVICE_SPECIAL_USE`) mantiene esa
> detección funcionando mientras el usuario usa el teléfono con normalidad;
> el subtipo ya está declarado en el manifest con una descripción legible.

## 5. Ficha de la tienda (Store listing)

**Categoría sugerida:** Salud y bienestar (alternativa: Productividad).

**Descripción corta** (máx. 80 caracteres):
> Bloqueá apps que te distraen con fricción consciente: preguntas, no fuerza.

**Descripción larga** (borrador, editalo a gusto):
> blockproc te ayuda a recuperar el control de tu tiempo en el celular sin
> prohibirte nada a la fuerza.
>
> Elegí qué apps querés limitar, por cuánto tiempo o en qué franja horaria,
> y blockproc interpone un momento de reflexión y un reto de preguntas antes
> de dejarte entrar — la fricción consciente que necesitás para decidir con
> la cabeza fría, no en automático.
>
> • Bloqueos por tiempo o programados, como una lista de alarmas
> • Un reto de 3 preguntas (elegí la categoría) como única salida
> • Mensajes de enfoque personalizables para recordarte tus prioridades
> • Modo extremo opcional, para cuando sabés que ni el reto te va a frenar
> • 100% local: tus datos nunca salen del teléfono, sin cuentas ni anuncios

**Capturas de pantalla:** al menos 2 (Play exige mínimo 2, recomienda 4-8).
Sugeridas: lista de Bloqueos, el asistente de creación, la pantalla de reto,
Ajustes. Podés sacarlas del propio dispositivo de prueba.

**Clasificación de contenido:** completar el cuestionario de IARC en Play
Console — dado que no hay contenido violento/adulto, debería salir "Para
todos" (PEGI 3 / Everyone).

## 6. Compatibilidad técnica

`targetSdkVersion` actual: **36** (Android 16), tomado por defecto del SDK
de Expo instalado (57) — bien por encima de cualquier mínimo que exija Play
hoy. No hace falta ningún cambio acá.

## 7. Antes de production: Internal testing

Subí el primer build a la pista **Internal testing** de Play Console
(no requiere revisión) y probalo instalado desde ahí antes de promoverlo a
producción — permite detectar problemas de firma o de metadata sin esperar
una revisión completa.
