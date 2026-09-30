package expo.modules.blockprocnative

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat

// RF-45: reanuda el servicio de monitoreo tras reiniciar el móvil, sin que
// el usuario tenga que abrir la app. "specialUse" no está entre los tipos de
// servicio en primer plano restringidos al arrancar desde BOOT_COMPLETED en
// Android 15+ (a diferencia de dataSync, camera, mediaPlayback, phoneCall,
// mediaProjection y microphone), así que no hace falta ningún rodeo.
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    Log.d("BlockprocMonitor", "BootReceiver.onReceive: ${intent.action}")
    if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
      ContextCompat.startForegroundService(context, Intent(context, MonitorService::class.java))
    }
  }
}
