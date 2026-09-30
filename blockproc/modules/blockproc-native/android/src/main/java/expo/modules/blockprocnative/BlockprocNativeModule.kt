package expo.modules.blockprocnative

import android.app.AppOpsManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.provider.Settings
import android.telecom.TelecomManager
import android.util.Base64
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.ByteArrayOutputStream

// RF-26: comprobar y guiar a conceder los dos permisos especiales del proyecto
// (constitución, principio 3): estadísticas de uso y superposición. Ninguno
// de los dos se concede con el diálogo estándar de permisos; el usuario debe
// activarlos a mano desde Ajustes, así que solo podemos comprobarlos y abrir
// la pantalla correspondiente.
class BlockprocNativeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BlockprocNative")

    Function("hasUsageAccessPermission") {
      hasUsageAccessPermission()
    }

    Function("hasOverlayPermission") {
      Settings.canDrawOverlays(context)
    }

    Function("openUsageAccessSettings") {
      // No hay forma fiable, en todos los fabricantes, de abrir directamente
      // la fila de esta app: esta acción siempre lleva a la lista general.
      startActivityFromOutsideAnActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
    }

    Function("openOverlaySettings") {
      // Esta acción sí admite un URI "package:" para ir directo a esta app.
      startActivityFromOutsideAnActivity(
        Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:${context.packageName}")
        )
      )
    }

    // RF-9 (base): paquete de la app que estuvo en primer plano más
    // recientemente, según el sistema de estadísticas de uso. Es la pieza
    // que en la T09 pasará a consultarse desde el servicio en primer plano.
    Function("getForegroundPackageName") {
      getForegroundPackageName()
    }

    // Solo para depuración/pruebas (T08): el historial reciente de cambios
    // de primer plano, con cuánto hace que ocurrió cada uno. A diferencia de
    // getForegroundPackageName(), no se ve afectado por que la propia app
    // vuelva a primer plano justo al leerlo, porque muestra toda la lista.
    Function("getRecentForegroundEvents") {
      getRecentForegroundEvents()
    }

    // RF-27, RF-43 (T09): servicio en primer plano con sondeo.
    Events("ForegroundChanged", "ScreenOn", "ScreenOff")

    OnCreate {
      MonitorService.Callbacks.onForegroundChanged = { packageName ->
        sendEvent("ForegroundChanged", mapOf("packageName" to packageName))
      }
      MonitorService.Callbacks.onScreenOn = { sendEvent("ScreenOn", mapOf()) }
      MonitorService.Callbacks.onScreenOff = { sendEvent("ScreenOff", mapOf()) }
    }

    OnDestroy {
      MonitorService.Callbacks.onForegroundChanged = null
      MonitorService.Callbacks.onScreenOn = null
      MonitorService.Callbacks.onScreenOff = null
    }

    Function("startMonitorService") {
      ContextCompat.startForegroundService(context, Intent(context, MonitorService::class.java))
    }

    Function("stopMonitorService") {
      context.stopService(Intent(context, MonitorService::class.java))
    }

    // RF-1, RF-48, RF-49 (T82): todas las apps con icono de lanzador, para
    // ofrecerlas en la pantalla de configuración, con su ícono y categoría.
    // Async (D17 del plan): decodificar el ícono de cientos de apps es
    // trabajo real de CPU y no puede bloquear el hilo de JS.
    AsyncFunction("getInstalledLauncherApps") {
      getInstalledLauncherApps()
    }

    // RF-28: identificación de mejor esfuerzo de las apps que nunca se
    // ofrecen para restringir (marcador, Ajustes, lanzador, cámara y la
    // propia app). El core (exclusions.ts) solo aplica este filtro; aquí se
    // decide qué paquete corresponde a cada rol.
    Function("getEssentialPackages") {
      getEssentialPackages()
    }

    // RF-15, RF-30, RF-33 (T47): notificación de aviso con un texto y un
    // tipo dados. El tipo solo decide el título y el id (para que un aviso
    // nuevo del mismo tipo reemplace al anterior en vez de apilarse); el
    // texto siempre lo da quien llama (T50 lo tomará de la configuración).
    Function("showNotification") { type: String, text: String ->
      showNotification(type, text)
    }

    // RF-9, RF-38 (T48): abre la pantalla correspondiente encima de la app
    // restringida, con un enlace profundo (D3 del plan: sin actividad propia
    // que registrar). El paquete solo viaja como dato para la pantalla.
    //
    // "t" (T63): MainActivity es singleTask y, con la app restringida
    // tapándola por encima (no con el usuario en el inicio de Android), la
    // actividad sigue viva y la ruta de Expo Router nunca cambió de
    // "/challenge" — un segundo aviso con el mismo "pkg" es, para el
    // enrutador, la misma navegación de antes, y no vuelve a montar la
    // pantalla ni a pedirle el reto nuevo (encontrado en la demo manual: tras
    // resolver un reto y agotar la ventana, el segundo reto se veía repetir
    // el resultado ya resuelto del primero). El instante de cada aviso, que
    // siempre cambia, fuerza a Expo Router a tratarlo como una navegación
    // distinta.
    Function("showChallenge") { packageName: String ->
      launchDeepLink("blockproc://challenge?pkg=$packageName&t=${System.currentTimeMillis()}")
    }

    Function("showWait") { packageName: String ->
      launchDeepLink("blockproc://wait?pkg=$packageName&t=${System.currentTimeMillis()}")
    }

    // RF-18: sin reto, así que no necesita saber qué app lo disparó.
    Function("showRestBlock") {
      launchDeepLink("blockproc://restblock?t=${System.currentTimeMillis()}")
    }

    // RF-13, RF-39 (D13 del plan): al fallar el reto o pulsar Atrás, se
    // envía al usuario al inicio de Android, no a la propia app, para que la
    // app restringida no quede visible debajo.
    Function("goHome") {
      goHome()
    }

    // RF-47 (T87, D19 del plan): al acertar el reto, envía blockproc a
    // segundo plano (como si se hubiera presionado Inicio, pero sin navegar
    // ahí) para revelar lo que haya debajo en la pila de tareas del sistema
    // — a diferencia de goHome(), no promete a dónde va. Sin lanzar si no
    // hay actividad actual (de mejor esfuerzo, igual que el resto del
    // módulo).
    Function("moveToBackground") {
      appContext.currentActivity?.moveTaskToBack(true)
    }
  }

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "El contexto de React Native no está disponible" }

  private fun hasUsageAccessPermission(): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = appOps.checkOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      android.os.Process.myUid(),
      context.packageName
    )
    return mode == AppOpsManager.MODE_ALLOWED
  }

  private fun startActivityFromOutsideAnActivity(intent: Intent) {
    // El contexto de la app (no una Activity) exige esta bandera para poder
    // lanzar una pantalla del sistema.
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }

  // RF-9, RF-13, RF-18, RF-38, RF-39 (T48): mismo mecanismo que los enlaces
  // a Ajustes, pero hacia una ruta de la propia app (D3 del plan) o hacia el
  // inicio de Android (D13 del plan).
  private fun launchDeepLink(uri: String) {
    startActivityFromOutsideAnActivity(Intent(Intent.ACTION_VIEW, Uri.parse(uri)))
  }

  private fun goHome() {
    startActivityFromOutsideAnActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME))
  }

  private fun getForegroundPackageName(): String? {
    val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val end = System.currentTimeMillis()
    // Ventana amplia a propósito: esta llamada es puntual (pruebas y, más
    // adelante, cada consulta del servicio). No es un vaciado continuo de
    // eventos, así que el costo de mirar 60 s atrás es insignificante.
    val begin = end - FOREGROUND_QUERY_WINDOW_MS
    val events = usageStatsManager.queryEvents(begin, end)
    val event = UsageEvents.Event()

    var lastForegroundPackage: String? = null
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      if (event.eventType == ForegroundEventType.current) {
        lastForegroundPackage = event.packageName
      }
    }
    return lastForegroundPackage
  }

  private fun getRecentForegroundEvents(): List<ForegroundEventRecord> {
    val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val now = System.currentTimeMillis()
    val begin = now - FOREGROUND_QUERY_WINDOW_MS
    val events = usageStatsManager.queryEvents(begin, now)
    val event = UsageEvents.Event()

    val result = mutableListOf<ForegroundEventRecord>()
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      if (event.eventType == ForegroundEventType.current) {
        result.add(
          ForegroundEventRecord().apply {
            packageName = event.packageName
            msAgo = (now - event.timeStamp).toDouble()
          }
        )
      }
    }
    // Más reciente primero: más cómodo de leer en la pantalla de prueba.
    return result.asReversed()
  }

  // RF-1: apps con icono de lanzador (intent-filter MAIN/LAUNCHER), tal como
  // las vería el usuario en el cajón de aplicaciones. El <queries> que hace
  // posible esta consulta en Android 11+, sin el permiso QUERY_ALL_PACKAGES,
  // está en el plugin de configuración (D10 del plan).
  private fun getInstalledLauncherApps(): List<InstalledAppRecord> {
    val pm = context.packageManager
    val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
    @Suppress("DEPRECATION") // La sobrecarga con flags (API 33+) no es necesaria: minSdk 26.
    return pm.queryIntentActivities(intent, 0)
      .distinctBy { it.activityInfo.packageName }
      .map { resolveInfo ->
        InstalledAppRecord().apply {
          packageName = resolveInfo.activityInfo.packageName
          label = resolveInfo.loadLabel(pm).toString()
          iconUri = tryLoadIconDataUri(resolveInfo, pm)
          // RF-49: CATEGORY_UNDEFINED (API 26+) significa "sin categoría
          // declarada" — se pasa como null, D18 del plan lo agrupa en "Otras"
          // del lado de TS, sin decidir la etiqueta acá.
          category = resolveInfo.activityInfo.applicationInfo.category
            .takeIf { it != ApplicationInfo.CATEGORY_UNDEFINED }
        }
      }
      .sortedBy { it.label.lowercase() }
  }

  // RF-48: de mejor esfuerzo — si el ícono de una app no se puede generar,
  // se devuelve null (la app igual aparece, solo con su nombre) en vez de
  // hacer fallar toda la lista. D17 del plan: Drawable -> Bitmap -> PNG ->
  // data URI en base64, sin ninguna dependencia nueva (todo ya está en el
  // SDK de Android), consumible directo por <Image source={{ uri }}> en RN.
  private fun tryLoadIconDataUri(resolveInfo: ResolveInfo, pm: PackageManager): String? {
    return try {
      val drawable = resolveInfo.loadIcon(pm)
      val bitmap = Bitmap.createBitmap(ICON_SIZE_PX, ICON_SIZE_PX, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(bitmap)
      drawable.setBounds(0, 0, ICON_SIZE_PX, ICON_SIZE_PX)
      drawable.draw(canvas)
      val stream = ByteArrayOutputStream()
      bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
      "data:image/png;base64," + Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
    } catch (e: Exception) {
      null
    }
  }

  // RF-28: cada rol esencial se resuelve con el intent implícito que el
  // propio sistema usa para encontrar a su manejador por defecto. Es "de
  // mejor esfuerzo": si el sistema no declara un manejador para alguno (p.
  // ej. un dispositivo sin cámara), simplemente no aparece en la lista.
  private fun getEssentialPackages(): List<String> {
    val pm = context.packageManager
    return listOfNotNull(
      resolveDialerPackage(), // marcador
      resolveDefaultPackage(pm, Intent(Settings.ACTION_SETTINGS)), // Ajustes
      resolveDefaultPackage(pm, Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)), // lanzador
      resolveDefaultPackage(pm, Intent(MediaStore.ACTION_IMAGE_CAPTURE)), // cámara
      context.packageName // la propia app
    ).distinct()
  }

  // El marcador es un caso especial: apps como Truecaller también declaran
  // un manejador para ACTION_DIAL (a veces con más prioridad que el propio
  // marcador del sistema), así que resolveActivity() puede devolver la app
  // equivocada (comprobado en un dispositivo real con Truecaller instalado,
  // T46). TelecomManager sí pregunta, sin ambigüedad, cuál es el marcador
  // por defecto realmente asignado (RoleManager.getRoleHolders() haría lo
  // mismo, pero es una API oculta, no pública, para apps normales).
  private fun resolveDialerPackage(): String? {
    val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
    return telecomManager.defaultDialerPackage
  }

  @Suppress("DEPRECATION") // La sobrecarga con flags (API 33+) no es necesaria: minSdk 26.
  private fun resolveDefaultPackage(pm: PackageManager, intent: Intent): String? {
    return pm.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)?.activityInfo?.packageName
  }

  // RF-15, RF-30, RF-33: tres avisos, cada uno con su propio id para que se
  // reemplace a sí mismo (no se acumulan) y no pisen a los otros dos.
  private fun titleForNotificationType(type: String): String = when (type) {
    "limit" -> "Límite de uso"
    "window" -> "Ventana de acceso"
    "restBlock" -> "Bloqueo horario"
    else -> "blockproc"
  }

  private fun idForNotificationType(type: String): Int = when (type) {
    "limit" -> ALERT_NOTIFICATION_ID_LIMIT
    "window" -> ALERT_NOTIFICATION_ID_WINDOW
    "restBlock" -> ALERT_NOTIFICATION_ID_REST_BLOCK
    else -> ALERT_NOTIFICATION_ID_LIMIT
  }

  private fun showNotification(type: String, text: String) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(ALERT_CHANNEL_ID, "Avisos", NotificationManager.IMPORTANCE_DEFAULT)
      )
    }

    val notification = Notification.Builder(context, ALERT_CHANNEL_ID)
      .setContentTitle(titleForNotificationType(type))
      .setContentText(text)
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setAutoCancel(true)
      .build()

    manager.notify(idForNotificationType(type), notification)
  }

  companion object {
    private const val FOREGROUND_QUERY_WINDOW_MS = 60_000L
    private const val ALERT_CHANNEL_ID = "alerts"
    private const val ALERT_NOTIFICATION_ID_LIMIT = 10
    private const val ALERT_NOTIFICATION_ID_WINDOW = 11
    private const val ALERT_NOTIFICATION_ID_REST_BLOCK = 12
    private const val ICON_SIZE_PX = 96
  }
}

class ForegroundEventRecord : Record {
  @Field
  var packageName: String = ""

  @Field
  var msAgo: Double = 0.0
}

class InstalledAppRecord : Record {
  @Field
  var packageName: String = ""

  @Field
  var label: String = ""

  @Field
  var iconUri: String? = null

  @Field
  var category: Int? = null
}
