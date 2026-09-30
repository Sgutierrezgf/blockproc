package expo.modules.blockprocnative

import android.app.usage.UsageEvents
import android.os.Build

// Compartido entre el módulo (lecturas puntuales de depuración, T08) y el
// servicio de monitoreo (sondeo continuo, T09), para que ambos detecten el
// primer plano exactamente igual.
internal object ForegroundEventType {
  // ACTIVITY_RESUMED es la constante vigente desde Android 10 (API 29);
  // MOVE_TO_FOREGROUND (equivalente, pero obsoleta) es la única disponible
  // en las versiones que cubre minSdkVersion 26.
  val current: Int
    get() = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      UsageEvents.Event.ACTIVITY_RESUMED
    } else {
      @Suppress("DEPRECATION")
      UsageEvents.Event.MOVE_TO_FOREGROUND
    }
}
