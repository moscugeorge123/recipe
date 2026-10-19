package expo.modules.cooktimerlive

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Card buttons and the zero alarm; runs with Tortie closed, no JS. */
class CookTimerReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    CookTimers.handle(context.applicationContext, intent)
  }
}
