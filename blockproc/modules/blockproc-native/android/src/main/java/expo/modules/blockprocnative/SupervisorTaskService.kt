package expo.modules.blockprocnative

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

// RF-9, RF-27 (T51): corre el supervisor de TypeScript aunque la app esté
// cerrada de verdad (proceso completo, no solo sin pantalla visible).
// MonitorService la arranca con startService (no startForegroundService:
// esta clase no llama a startForeground() y no hace falta — MonitorService
// ya es un servicio en primer plano, lo que exime a la app de las
// restricciones de arranque en segundo plano para esta llamada).
class SupervisorTaskService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val extras = intent?.extras ?: return null
    return HeadlessJsTaskConfig(
      TASK_NAME,
      Arguments.fromBundle(extras),
      TASK_TIMEOUT_MS,
      true // permitir con la app en primer plano: no sabemos si su UI está abierta o no
    )
  }

  companion object {
    // Tiene que coincidir exactamente con el nombre registrado en
    // headlessTask.ts: es el único enlace entre ambos lados.
    private const val TASK_NAME = "BlockprocSupervisor"
    private const val TASK_TIMEOUT_MS = 5_000L
  }
}
