const { withAndroidManifest, withAppBuildGradle, AndroidConfig } = require('expo/config-plugins');

// Permisos especiales (usuario los concede desde Ajustes, no con un diálogo):
// PACKAGE_USAGE_STATS y SYSTEM_ALERT_WINDOW. El resto son permisos normales
// que Android concede solo por estar declarados (o con el diálogo estándar
// de notificaciones en POST_NOTIFICATIONS). Ninguno es de Servicio de
// Accesibilidad (constitución, principio 3).
// Fuentes: RF-9, RF-15, RF-26, RF-27, RF-28, RF-30, RF-33, RF-45; plan.md D1, D10.
const PERMISSIONS = [
  'android.permission.PACKAGE_USAGE_STATS',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.FOREGROUND_SERVICE',
  // Tipo de servicio en primer plano que usará el servicio de monitoreo (T09):
  // "specialUse" es el que corresponde a detectar la app en primer plano,
  // porque ninguno de los tipos específicos de Android encaja.
  'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  // RF-27, RF-9 (T51): HeadlessJsTaskService adquiere un wake lock breve y
  // propio (se libera solo al terminar la tarea) para no dormirse a mitad
  // de la tarea Headless JS; sin este permiso normal, ni siquiera arranca
  // (SecurityException que tumba todo el proceso, no solo la tarea).
  'android.permission.WAKE_LOCK',
];

/**
 * Plugin de configuración de blockproc para Android.
 *
 * Declara los permisos del proyecto, los <queries> necesarios para listar las
 * apps con icono de lanzador y para identificar, de mejor esfuerzo, las apps
 * esenciales (RF-1, RF-28; decisión D10 del plan: evita el permiso
 * QUERY_ALL_PACKAGES) y el servicio de monitoreo en primer plano (T09).
 */
const withBlockprocAndroid = (config) => {
  config = AndroidConfig.Permissions.withPermissions(config, PERMISSIONS);
  config = withQueries(config);
  config = withMonitorService(config);
  config = withSupervisorTaskService(config);
  config = withBootReceiver(config);
  config = withReleaseSigning(config);
  return config;
};

// RF-1: todas las apps con icono de lanzador (para ofrecerlas a restringir).
// RF-28: para identificar, de mejor esfuerzo, cuál es el marcador, Ajustes,
// el lanzador de inicio y la cámara predeterminada — cada uno necesita su
// propia entrada porque su intent no coincide con el de arriba (T46).
const QUERY_INTENTS = [
  {
    action: 'android.intent.action.MAIN',
    category: 'android.intent.category.LAUNCHER',
  },
  { action: 'android.intent.action.DIAL' },
  { action: 'android.settings.SETTINGS' },
  {
    action: 'android.intent.action.MAIN',
    category: 'android.intent.category.HOME',
  },
  { action: 'android.media.action.IMAGE_CAPTURE' },
];

const withQueries = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest.queries) {
      manifest.queries = [{}];
    }
    const queries = manifest.queries[0];
    if (!queries.intent) {
      queries.intent = [];
    }

    for (const { action, category } of QUERY_INTENTS) {
      const alreadyPresent = queries.intent.some(
        (intent) =>
          intent.action?.[0]?.$?.['android:name'] === action &&
          (category === undefined) === (intent.category === undefined) &&
          (category === undefined || intent.category?.[0]?.$?.['android:name'] === category)
      );

      if (!alreadyPresent) {
        queries.intent.push({
          action: [{ $: { 'android:name': action } }],
          ...(category ? { category: [{ $: { 'android:name': category } }] } : {}),
        });
      }
    }

    return config;
  });
};

const MONITOR_SERVICE_NAME = 'expo.modules.blockprocnative.MonitorService';

// RF-27, RF-43: el servicio que detecta la app en primer plano. El tipo
// "specialUse" (Android 14+) exige, además del permiso ya declarado, esta
// etiqueta <property> que explica el motivo del servicio ante una eventual
// revisión de Google Play.
const withMonitorService = (config) => {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0];
    if (!app.service) {
      app.service = [];
    }

    const alreadyPresent = app.service.some(
      (service) => service.$['android:name'] === MONITOR_SERVICE_NAME
    );

    if (!alreadyPresent) {
      app.service.push({
        $: {
          'android:name': MONITOR_SERVICE_NAME,
          'android:exported': 'false',
          'android:foregroundServiceType': 'specialUse',
        },
        property: [
          {
            $: {
              'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
              'android:value':
                'Detecta qué app está en primer plano para aplicar los límites de uso que el propio usuario configuró',
            },
          },
        ],
      });
    }

    return config;
  });
};

const SUPERVISOR_TASK_SERVICE_NAME = 'expo.modules.blockprocnative.SupervisorTaskService';

// RF-9, RF-27 (T51): el servicio de la tarea Headless JS. No es un servicio
// en primer plano (lo arranca MonitorService, que ya lo es, con un
// startService normal), así que no necesita foregroundServiceType.
const withSupervisorTaskService = (config) => {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0];
    if (!app.service) {
      app.service = [];
    }

    const alreadyPresent = app.service.some(
      (service) => service.$['android:name'] === SUPERVISOR_TASK_SERVICE_NAME
    );

    if (!alreadyPresent) {
      app.service.push({
        $: {
          'android:name': SUPERVISOR_TASK_SERVICE_NAME,
          'android:exported': 'false',
        },
      });
    }

    return config;
  });
};

const BOOT_RECEIVER_NAME = 'expo.modules.blockprocnative.BootReceiver';

// RF-45: reanuda el servicio de monitoreo tras reiniciar el móvil.
// BOOT_COMPLETED es una difusión protegida (solo el sistema puede emitirla),
// así que exported="true" es seguro: ninguna otra app puede suplantarla.
const withBootReceiver = (config) => {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0];
    if (!app.receiver) {
      app.receiver = [];
    }

    const alreadyPresent = app.receiver.some(
      (receiver) => receiver.$['android:name'] === BOOT_RECEIVER_NAME
    );

    if (!alreadyPresent) {
      app.receiver.push({
        $: {
          'android:name': BOOT_RECEIVER_NAME,
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } }],
          },
        ],
      });
    }

    return config;
  });
};

// Publicación en Play Store: `android/` se regenera con cada `expo
// prebuild` (no se versiona), así que el keystore de producción y sus
// contraseñas no pueden vivir ahí adentro ni en este plugin (que sí se
// versiona). Viven en `release.keystore.properties` + el `.jks`, ambos en
// la raíz del proyecto Expo (hermanos de `android/`, `app.json`), ignorados
// por git. Si ese archivo no existe todavía (nadie generó el keystore real,
// o es un checkout nuevo), el build de release sigue firmando con el
// keystore de debug, exactamente como hasta ahora — no rompe nada.
const RELEASE_KEYSTORE_PROPERTIES_LOADER = `
def releaseKeystorePropertiesFile = new File(rootProject.projectDir.parentFile, 'release.keystore.properties')
def releaseKeystoreProperties = new Properties()
if (releaseKeystorePropertiesFile.exists()) {
    releaseKeystoreProperties.load(new FileInputStream(releaseKeystorePropertiesFile))
}
`;

const DEBUG_SIGNING_CONFIG_BLOCK = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;

const SIGNING_CONFIG_WITH_RELEASE = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (releaseKeystorePropertiesFile.exists()) {
                storeFile new File(rootProject.projectDir.parentFile, releaseKeystoreProperties['storeFile'])
                storePassword releaseKeystoreProperties['storePassword']
                keyAlias releaseKeystoreProperties['keyAlias']
                keyPassword releaseKeystoreProperties['keyPassword']
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
    }`;

const RELEASE_BUILD_TYPE_DEBUG_SIGNING = `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;

const RELEASE_BUILD_TYPE_RELEASE_SIGNING = `        release {
            // Publicación en Play Store: firma con release.keystore.properties
            // si existe (ver withBlockprocAndroid.js); si no, con el keystore
            // de debug, igual que antes.
            signingConfig signingConfigs.release`;

const withReleaseSigning = (config) => {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error(
        'withReleaseSigning solo sabe editar build.gradle en Groovy (se encontró ' +
          config.modResults.language +
          '); revisar el plugin si el proyecto pasó a Kotlin DSL.'
      );
    }

    let contents = config.modResults.contents;

    if (!contents.includes('releaseKeystorePropertiesFile')) {
      const androidBlockMarker = '\nandroid {';
      if (!contents.includes(androidBlockMarker)) {
        throw new Error("withReleaseSigning: no se encontró 'android {' en build.gradle generado.");
      }
      contents = contents.replace(androidBlockMarker, `\n${RELEASE_KEYSTORE_PROPERTIES_LOADER}${androidBlockMarker}`);
    }

    if (contents.includes(DEBUG_SIGNING_CONFIG_BLOCK)) {
      contents = contents.replace(DEBUG_SIGNING_CONFIG_BLOCK, SIGNING_CONFIG_WITH_RELEASE);
    } else if (!contents.includes('signingConfigs.release')) {
      throw new Error('withReleaseSigning: no se encontró el bloque signingConfigs.debug esperado en build.gradle.');
    }

    if (contents.includes(RELEASE_BUILD_TYPE_DEBUG_SIGNING)) {
      contents = contents.replace(RELEASE_BUILD_TYPE_DEBUG_SIGNING, RELEASE_BUILD_TYPE_RELEASE_SIGNING);
    } else if (!contents.includes('signingConfig signingConfigs.release')) {
      throw new Error('withReleaseSigning: no se encontró el buildType "release" esperado en build.gradle.');
    }

    config.modResults.contents = contents;
    return config;
  });
};

module.exports = withBlockprocAndroid;
