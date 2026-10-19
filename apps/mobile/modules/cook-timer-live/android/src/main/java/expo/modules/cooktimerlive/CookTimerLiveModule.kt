package expo.modules.cooktimerlive

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS side of [CookTimers]: Tortie arms its running and paused timers when it leaves the
 * foreground and disarms them (getting back the button presses) when it
 * returns. Tapping a card opens Tortie with the timer key.
 */
class CookTimerLiveModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext)

  override fun definition() = ModuleDefinition {
    Name("CookTimerLive")

    Events("onOpen")

    Function("arm") { timers: List<Map<String, Any?>> ->
      CookTimers.arm(context, timers.mapNotNull(::liveTimer))
    }

    Function("disarm") {
      CookTimers.disarm(context)
    }

    /** Timer key of the card that cold-started Tortie, once. */
    Function("takeLaunchKey") {
      val intent = appContext.currentActivity?.intent ?: return@Function null
      val key = intent.getStringExtra(CookTimers.EXTRA_KEY)
      intent.removeExtra(CookTimers.EXTRA_KEY)
      key
    }

    OnNewIntent { intent ->
      val key = intent.getStringExtra(CookTimers.EXTRA_KEY) ?: return@OnNewIntent
      intent.removeExtra(CookTimers.EXTRA_KEY)
      sendEvent("onOpen", mapOf("key" to key))
    }
  }

  private fun liveTimer(item: Map<String, Any?>): LiveTimer? {
    val key = item["key"] as? String ?: return null
    return LiveTimer(
      key = key,
      title = item["title"] as? String ?: "Cooking timer",
      endsAt = (item["endsAt"] as? Number)?.toLong() ?: 0,
      remSec = (item["remSec"] as? Number)?.toLong() ?: 0,
      paused = item["paused"] as? Boolean ?: false,
      ring = item["ring"] as? Boolean ?: true
    )
  }
}
