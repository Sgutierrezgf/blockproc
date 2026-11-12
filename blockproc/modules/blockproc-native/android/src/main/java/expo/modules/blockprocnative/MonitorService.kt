package expo.modules.blockprocnative

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.ServiceCompat

// RF-27: servicio en primer plano con notificación visible que detecta los
// cambios de app en primer plano mediante sondeo y se los pasa al supervisor
// (tarea Headless JS, que es quien decide). RF-43: solo sondea con la
// pantalla encendida (con la pantalla apagada, ni siquiera se programa el
// siguiente sondeo).
class MonitorService : Service() {

  private val handler = Handler(Looper.getMainLooper())
  private var isPolling = false

  // Solo se consulta el hueco desde el sondeo anterior, no una ventana fija:
  // así cada consulta a UsageStatsManager es barata, sin importar cuánto
  // lleve corriendo el servicio.
  private var lastQueryEnd = System.currentTimeMillis()
  private var lastForegroundPackage: String? = null

  // Evento Tick del supervisor (policy.ts, handleTick): sin él, con una app
  // quieta en primer plano nada se re-evaluaría — ni el aviso 2 min antes
  // de un bloqueo programado (RF-68), ni el inicio de un bloqueo sobre la
  // app ya abierta, ni el fin de una ventana de acceso o de una espera
  // (RF-66/67). Se reaprovecha este mismo sondeo (ya atado a pantalla
  // encendida/apagada, RF-43) en vez de programar un segundo Handler.
  private var lastTickDispatchedAt = 0L

  private val screenReceiver = object : BroadcastReceiver() {
    override fun onReceive(receivedContext: Context, intent: Intent) {
      Log.d(TAG, "screenReceiver.onReceive: ${intent.action}")
      when (intent.action) {
        // RF-43: el supervisor recibe ScreenOn/ScreenOff (antes solo
        // llegaban a los callbacks de depuración). ScreenOn re-evalúa de
        // inmediato, así que cuenta como Tick y reinicia su intervalo.
        Intent.ACTION_SCREEN_ON -> {
          Callbacks.onScreenOn?.invoke()
          lastTickDispatchedAt = System.currentTimeMillis()
          triggerSupervisorEvent("ScreenOn")
          startPolling()
        }
        Intent.ACTION_SCREEN_OFF -> {
          stopPolling()
          Callbacks.onScreenOff?.invoke()
          triggerSupervisorEvent("ScreenOff")
        }
      }
    }
  }

  private val pollRunnable = object : Runnable {
    override fun run() {
      poll()
      handler.postDelayed(this, if (idle) IDLE_POLL_INTERVAL_MS else POLL_INTERVAL_MS)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    Log.d(TAG, "onCreate")
    startForegroundWithNotification()
    isRunning = true
    instance = this
    // ACTION_SCREEN_ON/OFF son difusiones protegidas del sistema: solo
    // Android puede emitirlas, así que no hace falta (ni corresponde) pedir
    // RECEIVER_EXPORTED/RECEIVER_NOT_EXPORTED al registrar este receptor.
    registerReceiver(
      screenReceiver,
      IntentFilter().apply {
        addAction(Intent.ACTION_SCREEN_ON)
        addAction(Intent.ACTION_SCREEN_OFF)
      }
    )
    startPolling()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    Log.d(TAG, "onStartCommand")
    return START_STICKY
  }

  override fun onDestroy() {
    Log.d(TAG, "onDestroy")
    isRunning = false
    instance = null
    stopPolling()
    unregisterReceiver(screenReceiver)
    super.onDestroy()
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    Log.d(TAG, "onTaskRemoved")
    super.onTaskRemoved(rootIntent)
  }

  override fun onLowMemory() {
    Log.d(TAG, "onLowMemory")
    super.onLowMemory()
  }

  private fun startPolling() {
    Log.d(TAG, "startPolling (ya activo=$isPolling)")
    if (isPolling) return
    isPolling = true
    lastQueryEnd = System.currentTimeMillis()
    handler.post(pollRunnable)
  }

  private fun stopPolling() {
    Log.d(TAG, "stopPolling")
    isPolling = false
    handler.removeCallbacks(pollRunnable)
  }

  private fun poll() {
    val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val now = System.currentTimeMillis()
    val events = usageStatsManager.queryEvents(lastQueryEnd, now)
    val event = UsageEvents.Event()

    var newest: String? = null
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      if (event.eventType == ForegroundEventType.current) {
        newest = event.packageName
      }
    }
    lastQueryEnd = now
    if (newest != null) {
      Log.d(TAG, "poll: newest=$newest lastForegroundPackage=$lastForegroundPackage")
    }

    if (newest != null && newest != lastForegroundPackage) {
      lastForegroundPackage = newest
      Callbacks.onForegroundChanged?.invoke(newest) // T09: solo para el registro visual de depuración
      triggerSupervisorEvent("ForegroundChanged", newest) // RF-9, RF-27 (T51): la lógica real, corra o no la UI
    }

    if (now - lastTickDispatchedAt >= (if (idle) IDLE_TICK_INTERVAL_MS else TICK_INTERVAL_MS)) {
      lastTickDispatchedAt = now
      triggerSupervisorEvent("Tick")
    }
  }

  // RF-9, RF-27 (T51): arranca la tarea Headless JS con un evento del
  // supervisor (ForegroundChanged, Tick, ScreenOn o ScreenOff). Un
  // startService normal (no startForegroundService) basta: MonitorService,
  // que ya corre en primer plano, exime a la app de las restricciones de
  // arranque en segundo plano para esta llamada.
  private fun triggerSupervisorEvent(event: String, packageName: String? = null) {
    Log.d(TAG, "triggerSupervisorEvent: $event $packageName")
    val intent = Intent(this, SupervisorTaskService::class.java).apply {
      putExtra("event", event)
      if (packageName != null) putExtra("packageName", packageName)
    }
    startService(intent)
  }

  private fun startForegroundWithNotification() {
    ServiceCompat.startForeground(
      this,
      NOTIFICATION_ID,
      buildNotification(this),
      ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
    )
  }

  companion object {
    private const val TAG = "BlockprocMonitor"

    // Solo lo lee refreshTexts: evita publicar la notificación fija cuando
    // el servicio no está corriendo.
    @Volatile
    private var isRunning = false

    // D4 (batería): "idle" espacia sondeo y Tick cuando no hay nada que
    // vigilar. Lo decide el supervisor de JS (monitorMode.ts) tras cada
    // evento; al arrancar se parte de "watch", el modo seguro. Lo lee solo
    // el hilo principal (pollRunnable), y setMonitorMode se publica ahí.
    private var idle = false
    private var instance: MonitorService? = null

    fun setMonitorMode(mode: String) {
      Handler(Looper.getMainLooper()).post {
        val nextIdle = mode == "idle"
        if (nextIdle == idle) return@post
        idle = nextIdle
        Log.d(TAG, "setMonitorMode: $mode")
        // Al pasar a "watch" no se espera el resto del intervalo de "idle":
        // se sondea ya y el próximo Tick sale en el primer sondeo.
        val service = instance
        if (!nextIdle && service != null && service.isPolling) {
          service.lastTickDispatchedAt = 0L
          service.handler.removeCallbacks(service.pollRunnable)
          service.handler.post(service.pollRunnable)
        }
      }
    }

    // RF-76, RF-77: textos en el idioma elegido (ver NotificationTexts).
    // El ícono es uno del sistema, marcador temporal hasta tener uno propio.
    private fun buildNotification(context: Context): Notification {
      val texts = NotificationTexts.load(context)
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        // Recrear el canal con el mismo id solo actualiza su nombre.
        // IMPORTANCE_LOW (T63): con MIN, Android colapsa la notificación al
        // fondo de la bandeja, sin ícono ni texto legible; LOW la deja
        // visible, sin sonido ni interrupción.
        manager.createNotificationChannel(
          NotificationChannel(CHANNEL_ID, texts.monitorChannelName, NotificationManager.IMPORTANCE_LOW)
        )
      }
      return Notification.Builder(context, CHANNEL_ID)
        .setContentTitle(texts.monitorTitle)
        .setContentText(texts.monitorText)
        .setSmallIcon(android.R.drawable.ic_dialog_info)
        .setOngoing(true)
        .build()
    }

    /** RF-76: vuelve a publicar la notificación fija con los textos recién guardados. */
    fun refreshTexts(context: Context) {
      if (!isRunning) return
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.notify(NOTIFICATION_ID, buildNotification(context))
    }

    // "_v2": Android trata la importancia de un canal como fija una vez
    // creado (solo el usuario puede subirla a mano); un id nuevo es la
    // única forma de que el cambio a IMPORTANCE_LOW tenga efecto en
    // dispositivos donde ya existía el canal "monitor" en MIN.
    private const val CHANNEL_ID = "monitor_v2"
    private const val NOTIFICATION_ID = 1
    private const val POLL_INTERVAL_MS = 500L

    // Cada cuánto se envía el Tick al supervisor, independiente del sondeo
    // de primer plano (más frecuente, arriba). Los plazos que revisa (aviso
    // de 2 min, ventana de 2 min, espera de 5 min) no necesitan más precisión.
    private const val TICK_INTERVAL_MS = 10_000L
    // "idle": nada activo ni por empezar en 3 min (WATCH_LEAD_MS). El Tick
    // de 60 s alcanza para pasar a "watch" antes del aviso de 2 min (RF-68).
    private const val IDLE_POLL_INTERVAL_MS = 5_000L
    private const val IDLE_TICK_INTERVAL_MS = 60_000L
  }

  // Puente hacia el módulo de Expo: el servicio y el módulo corren en el
  // mismo proceso, así que basta una referencia en memoria (sin broadcasts
  // ni AIDL) para que el módulo reenvíe estos eventos a JS.
  object Callbacks {
    var onForegroundChanged: ((String) -> Unit)? = null
    var onScreenOn: (() -> Unit)? = null
    var onScreenOff: (() -> Unit)? = null
  }
}
