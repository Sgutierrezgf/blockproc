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
// cambios de app en primer plano mediante sondeo. RF-43: solo sondea con la
// pantalla encendida (con la pantalla apagada, ni siquiera se programa el
// siguiente sondeo).
//
// El intervalo es fijo por ahora (T09). El sondeo adaptativo según haya o no
// una app restringida en primer plano (plan.md, decisión D4) llega en una
// tarea posterior, cuando exista la configuración de apps restringidas que
// el servicio necesita para distinguir un caso del otro.
class MonitorService : Service() {

  private val handler = Handler(Looper.getMainLooper())
  private var isPolling = false

  // Solo se consulta el hueco desde el sondeo anterior, no una ventana fija:
  // así cada consulta a UsageStatsManager es barata, sin importar cuánto
  // lleve corriendo el servicio.
  private var lastQueryEnd = System.currentTimeMillis()
  private var lastForegroundPackage: String? = null

  // RF-15, RF-30, RF-33 (T63): estos avisos ("falta 1 minuto", "falta 2
  // minutos") dependen del evento Tick del supervisor (policy.ts,
  // handleTick), pero nada lo disparaba nunca en la app real — solo
  // ForegroundChanged, cuando cambia la app en primer plano. Con una app
  // restringida quieta en primer plano (el caso normal que ese aviso
  // necesita detectar) nunca se enviaba ningún Tick y el aviso no podía
  // salir jamás. Encontrado en la demo manual de la T63: usando Chrome de
  // verdad durante los 5 min del límite, el aviso del minuto 4 nunca
  // apareció. Se reaprovecha este mismo sondeo (ya atado a pantalla
  // encendida/apagada, RF-43) en vez de programar un segundo Handler.
  private var lastTickDispatchedAt = 0L

  private val screenReceiver = object : BroadcastReceiver() {
    override fun onReceive(receivedContext: Context, intent: Intent) {
      Log.d(TAG, "screenReceiver.onReceive: ${intent.action}")
      when (intent.action) {
        Intent.ACTION_SCREEN_ON -> {
          Callbacks.onScreenOn?.invoke()
          startPolling()
        }
        Intent.ACTION_SCREEN_OFF -> {
          stopPolling()
          Callbacks.onScreenOff?.invoke()
        }
      }
    }
  }

  private val pollRunnable = object : Runnable {
    override fun run() {
      poll()
      handler.postDelayed(this, POLL_INTERVAL_MS)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    Log.d(TAG, "onCreate")
    startForegroundWithNotification()
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
      triggerSupervisorTask(newest) // RF-9, RF-27 (T51): la lógica real, corra o no la UI
    }

    if (now - lastTickDispatchedAt >= TICK_INTERVAL_MS) {
      lastTickDispatchedAt = now
      triggerSupervisorTick()
    }
  }

  // RF-9, RF-27 (T51): arranca la tarea Headless JS con el evento
  // ForegroundChanged. Un startService normal (no startForegroundService)
  // basta: MonitorService, que ya corre en primer plano, exime a la app de
  // las restricciones de arranque en segundo plano para esta llamada.
  private fun triggerSupervisorTask(packageName: String) {
    Log.d(TAG, "triggerSupervisorTask: $packageName")
    val intent = Intent(this, SupervisorTaskService::class.java).apply {
      putExtra("event", "ForegroundChanged")
      putExtra("packageName", packageName)
    }
    startService(intent)
  }

  // RF-15, RF-30, RF-33 (T63): igual que triggerSupervisorTask, pero para
  // el evento periódico que faltaba (ver el comentario junto a
  // lastTickDispatchedAt).
  private fun triggerSupervisorTick() {
    val intent = Intent(this, SupervisorTaskService::class.java).apply {
      putExtra("event", "Tick")
    }
    startService(intent)
  }

  private fun startForegroundWithNotification() {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(
          CHANNEL_ID,
          "Vigilancia de apps restringidas",
          // RF-27 (T63): con IMPORTANCE_MIN, Android colapsa la notificación
          // del servicio en primer plano al fondo de la bandeja, sin ícono
          // en la barra de estado ni texto legible (encontrado al comprobar
          // la demo manual). LOW la deja visible, sin sonido ni interrupción.
          NotificationManager.IMPORTANCE_LOW
        )
      )
    }

    // El icono es un ícono del sistema, como marcador temporal del
    // prototipo; una tarea de pulido de la UI (fase 5) lo cambia por uno
    // propio de blockproc.
    val notification: Notification = Notification.Builder(this, CHANNEL_ID)
      .setContentTitle("blockproc")
      .setContentText("Vigilando el uso de las apps restringidas")
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setOngoing(true)
      .build()

    ServiceCompat.startForeground(
      this,
      NOTIFICATION_ID,
      notification,
      ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
    )
  }

  companion object {
    private const val TAG = "BlockprocMonitor"
    // "_v2": Android trata la importancia de un canal como fija una vez
    // creado (solo el usuario puede subirla a mano); un id nuevo es la
    // única forma de que el cambio a IMPORTANCE_LOW tenga efecto en
    // dispositivos donde ya existía el canal "monitor" en MIN.
    private const val CHANNEL_ID = "monitor_v2"
    private const val NOTIFICATION_ID = 1
    private const val POLL_INTERVAL_MS = 500L

    // RF-15, RF-30, RF-33 (T63): cada cuánto se revisan los avisos de "falta
    // 1/2 minutos", independiente del sondeo de primer plano (más frecuente,
    // arriba). No hace falta más precisión que esta para un aviso que se da
    // en minutos.
    private const val TICK_INTERVAL_MS = 10_000L
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
