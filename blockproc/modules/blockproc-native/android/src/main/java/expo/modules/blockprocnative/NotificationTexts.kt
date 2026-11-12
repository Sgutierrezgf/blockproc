package expo.modules.blockprocnative

import android.content.Context

// RF-76, RF-77: textos de Android que no pasan por ninguna pantalla de React
// (nombres de canal y notificación fija del servicio). El idioma lo elige el
// usuario dentro de la app, no el sistema, así que no sirven los recursos
// values-xx: JS los manda ya traducidos (setNotificationTexts) cada vez que
// cambia el idioma y quedan guardados acá para el servicio, que puede
// arrancar sin JS (tras un reinicio, BootReceiver). Por defecto, español.
data class NotificationTexts(
  val alertsChannelName: String,
  val monitorChannelName: String,
  val monitorTitle: String,
  val monitorText: String,
) {
  fun save(context: Context) {
    prefs(context).edit()
      .putString(KEY_ALERTS_CHANNEL, alertsChannelName)
      .putString(KEY_MONITOR_CHANNEL, monitorChannelName)
      .putString(KEY_MONITOR_TITLE, monitorTitle)
      .putString(KEY_MONITOR_TEXT, monitorText)
      .apply()
  }

  companion object {
    private const val PREFS_NAME = "blockproc_notification_texts"
    private const val KEY_ALERTS_CHANNEL = "alertsChannelName"
    private const val KEY_MONITOR_CHANNEL = "monitorChannelName"
    private const val KEY_MONITOR_TITLE = "monitorTitle"
    private const val KEY_MONITOR_TEXT = "monitorText"

    private val DEFAULTS = NotificationTexts(
      alertsChannelName = "Avisos",
      monitorChannelName = "Vigilancia de bloqueos",
      monitorTitle = "blockproc",
      monitorText = "Vigilando tus bloqueos",
    )

    private fun prefs(context: Context) =
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun load(context: Context): NotificationTexts {
      val prefs = prefs(context)
      return NotificationTexts(
        alertsChannelName = prefs.getString(KEY_ALERTS_CHANNEL, null) ?: DEFAULTS.alertsChannelName,
        monitorChannelName = prefs.getString(KEY_MONITOR_CHANNEL, null) ?: DEFAULTS.monitorChannelName,
        monitorTitle = prefs.getString(KEY_MONITOR_TITLE, null) ?: DEFAULTS.monitorTitle,
        monitorText = prefs.getString(KEY_MONITOR_TEXT, null) ?: DEFAULTS.monitorText,
      )
    }
  }
}
