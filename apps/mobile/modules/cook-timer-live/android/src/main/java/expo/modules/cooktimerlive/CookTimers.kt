package expo.modules.cooktimerlive

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.text.format.DateUtils
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject

internal data class LiveTimer(
  val key: String,
  val title: String,
  /** Epoch ms the running timer hits zero; unused while paused. */
  val endsAt: Long,
  /** Whole seconds left while paused. */
  val remSec: Long = 0,
  val paused: Boolean = false,
  /** Ring at zero (the Profile timer alerts setting). */
  val ring: Boolean = true
)

/**
 * Cooking timers while Tortie is in the background. Tortie hands them over
 * (`arm`) when it leaves the foreground and takes them back (`disarm`) when it
 * returns. In between, this owns them: a live card per timer, an exact alarm
 * that swaps it for the Time's up card, and the card buttons. Every button
 * press is applied here at once and queued, so Tortie can replay it into its
 * own timers on return.
 */
internal object CookTimers {
  const val ACTION_PAUSE = "expo.modules.cooktimerlive.PAUSE"
  const val ACTION_RESUME = "expo.modules.cooktimerlive.RESUME"
  const val ACTION_DISMISS = "expo.modules.cooktimerlive.DISMISS"
  const val ACTION_STOP = "expo.modules.cooktimerlive.STOP"
  const val ACTION_RING = "expo.modules.cooktimerlive.RING"
  const val EXTRA_KEY = "tortie.cookTimerKey"
  private const val EXTRA_ENDS_AT = "tortie.cookTimerEndsAt"

  private const val PREFS = "tortie.cook_timers"
  private const val TIMERS = "timers"
  private const val ACTIONS = "actions"
  private const val LIVE_CHANNEL = "cook-timer-live"
  private const val RING_CHANNEL = "cook-timer-ring"
  private const val LIVE_TAG = "cook-live:"
  private const val RING_TAG = "cook-ring:"
  private const val RING_ID = 1
  private const val OPEN_APP_REQUEST = 0x7031
  private const val META_ICON = "expo.modules.notifications.default_notification_icon"
  /** Same as ALERT_MAX_MS in timer-clock.ts: an unanswered alarm ends on its own. */
  private const val ALERT_MAX_MS = 2 * 60 * 60_000L
  private val VIBRATE = longArrayOf(0, 500, 200, 500, 200, 800)
  private val ACCENT = Color.parseColor("#a23e18")

  fun arm(context: Context, timers: List<LiveTimer>) {
    clearCards(context)
    for (old in load(context).keys) cancelAlarm(context, old)
    val now = System.currentTimeMillis()
    val live = timers.filter { if (it.paused) it.remSec > 0 else it.endsAt > now }
    save(context, live.associateBy { it.key })
    for (timer in live) {
      postLive(context, timer)
      if (timer.ring && !timer.paused) scheduleAlarm(context, timer)
    }
  }

  /** Clears every card and alarm and returns the queued button presses, oldest first. */
  fun disarm(context: Context): List<Map<String, Any>> {
    for (key in load(context).keys) cancelAlarm(context, key)
    clearCards(context)
    val prefs = prefs(context)
    val queued = JSONArray(prefs.getString(ACTIONS, "[]"))
    prefs.edit().remove(TIMERS).remove(ACTIONS).apply()
    return (0 until queued.length()).map { i ->
      val item = queued.getJSONObject(i)
      buildMap {
        put("type", item.getString("type"))
        put("key", item.getString("key"))
        put("at", item.getLong("at").toDouble())
        if (item.has("endsAt")) put("endsAt", item.getLong("endsAt").toDouble())
      }
    }
  }

  fun handle(context: Context, intent: Intent) {
    val key = intent.getStringExtra(EXTRA_KEY) ?: return
    val timers = load(context).toMutableMap()
    val now = System.currentTimeMillis()
    when (intent.action) {
      ACTION_PAUSE -> {
        val timer = timers[key]?.takeIf { !it.paused } ?: return
        // Same rounding as remainingSec in timer-clock.ts, so the replay matches.
        val left = timer.endsAt - now
        if (left <= 0) return
        val paused = timer.copy(paused = true, remSec = (left + 999) / 1000)
        timers[key] = paused
        save(context, timers)
        cancelAlarm(context, key)
        postLive(context, paused)
        queue(context, "pause", key, now)
      }
      ACTION_RESUME -> {
        val timer = timers[key]?.takeIf { it.paused } ?: return
        val running = timer.copy(paused = false, endsAt = now + timer.remSec * 1000)
        timers[key] = running
        save(context, timers)
        postLive(context, running)
        if (running.ring) scheduleAlarm(context, running)
        queue(context, "resume", key, now)
      }
      ACTION_DISMISS -> {
        timers.remove(key)
        save(context, timers)
        cancelAlarm(context, key)
        cancelTagged(context, LIVE_TAG + key)
        queue(context, "dismiss", key, now)
      }
      ACTION_STOP -> {
        val endsAt = intent.getLongExtra(EXTRA_ENDS_AT, 0)
        timers.remove(key)
        save(context, timers)
        cancelTagged(context, RING_TAG + key)
        queue(context, "stop", key, now, endsAt)
      }
      ACTION_RING -> {
        val timer = timers[key] ?: return
        // A pause or resume since this alarm was set leaves it stale.
        if (timer.paused || timer.endsAt != intent.getLongExtra(EXTRA_ENDS_AT, 0)) return
        cancelTagged(context, LIVE_TAG + key)
        postRing(context, timer)
      }
    }
  }

  private fun postLive(context: Context, timer: LiveTimer) {
    ensureChannels(context)
    val builder = builder(context, LIVE_CHANNEL)
    if (!timer.paused && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      builder.setTimeoutAfter(timer.endsAt - System.currentTimeMillis())
    }
    builder
      .setContentTitle(timer.title)
      .setCustomContentView(liveViews(context, R.layout.cook_live_compact, timer))
      .setCustomBigContentView(liveViews(context, R.layout.cook_live_big, timer))
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setAutoCancel(true)
      .setCategory(Notification.CATEGORY_PROGRESS)
      .setContentIntent(openIntent(context, timer.key))
    // A new id per post: a timeout left by the previous post can't remove this one.
    cancelTagged(context, LIVE_TAG + timer.key)
    manager(context).notify(LIVE_TAG + timer.key, (SystemClock.elapsedRealtime() % Int.MAX_VALUE).toInt(), builder.build())
  }

  private fun liveViews(context: Context, layout: Int, timer: LiveTimer): RemoteViews =
    RemoteViews(context.packageName, layout).apply {
      setTextViewText(R.id.cook_title, timer.title)
      if (timer.paused) {
        setViewVisibility(R.id.cook_clock, View.GONE)
        setViewVisibility(R.id.cook_frozen, View.VISIBLE)
        setTextViewText(R.id.cook_frozen, DateUtils.formatElapsedTime(timer.remSec))
        setImageViewResource(R.id.cook_toggle, R.drawable.cook_live_play)
        setContentDescription(R.id.cook_toggle, "Resume timer")
        setOnClickPendingIntent(R.id.cook_toggle, broadcast(context, ACTION_RESUME, timer.key))
      } else {
        // Chronometer bases are on the elapsed-realtime clock.
        val base = SystemClock.elapsedRealtime() + (timer.endsAt - System.currentTimeMillis())
        setChronometer(R.id.cook_clock, base, null, true)
        setChronometerCountDown(R.id.cook_clock, true)
        setImageViewResource(R.id.cook_toggle, R.drawable.cook_live_pause)
        setContentDescription(R.id.cook_toggle, "Pause timer")
        setOnClickPendingIntent(R.id.cook_toggle, broadcast(context, ACTION_PAUSE, timer.key))
      }
      setContentDescription(R.id.cook_close, "Dismiss timer")
      setOnClickPendingIntent(R.id.cook_close, broadcast(context, ACTION_DISMISS, timer.key))
    }

  private fun postRing(context: Context, timer: LiveTimer) {
    ensureChannels(context)
    val stop = broadcast(context, ACTION_STOP, timer.key, timer.endsAt)
    val builder = builder(context, RING_CHANNEL)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      builder.setTimeoutAfter(ALERT_MAX_MS)
    } else {
      @Suppress("DEPRECATION")
      builder.setPriority(Notification.PRIORITY_MAX).setSound(ringSound(context)).setVibrate(VIBRATE)
    }
    builder
      .setContentTitle("Time's up · " + timer.title)
      .setCustomContentView(ringViews(context, R.layout.cook_ring_compact, timer, stop, false))
      .setCustomBigContentView(ringViews(context, R.layout.cook_ring_big, timer, stop, true))
      .setCategory(Notification.CATEGORY_ALARM)
      .setContentIntent(openAppIntent(context))
      .setDeleteIntent(stop)
    manager(context).notify(RING_TAG + timer.key, RING_ID, builder.build())
  }

  private fun ringViews(
    context: Context,
    layout: Int,
    timer: LiveTimer,
    stop: PendingIntent,
    big: Boolean
  ): RemoteViews =
    RemoteViews(context.packageName, layout).apply {
      setTextViewText(R.id.cook_title, timer.title)
      setTextViewText(R.id.cook_status, "Time's up")
      if (big) setTextViewText(R.id.cook_zero, "00:00")
      setContentDescription(R.id.cook_go, "Go to step")
      setOnClickPendingIntent(R.id.cook_go, openIntent(context, timer.key))
      setContentDescription(R.id.cook_close, "Stop alarm")
      setOnClickPendingIntent(R.id.cook_close, stop)
    }

  /** Header keeps only the app icon and name; Android 12+ always draws it for custom cards. */
  private fun builder(context: Context, channel: String): Notification.Builder {
    val builder =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Notification.Builder(context, channel)
      } else {
        @Suppress("DEPRECATION")
        Notification.Builder(context).setPriority(Notification.PRIORITY_LOW)
      }
    return builder
      .setSmallIcon(smallIcon(context))
      .setShowWhen(false)
      .setStyle(Notification.DecoratedCustomViewStyle())
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setColor(ACCENT)
  }

  private fun scheduleAlarm(context: Context, timer: LiveTimer) {
    val alarms = context.getSystemService(AlarmManager::class.java) ?: return
    val ring = broadcast(context, ACTION_RING, timer.key, timer.endsAt)
    val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()
    if (exact) {
      alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timer.endsAt, ring)
    } else {
      alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timer.endsAt, ring)
    }
  }

  private fun cancelAlarm(context: Context, key: String) {
    context.getSystemService(AlarmManager::class.java)?.cancel(broadcast(context, ACTION_RING, key))
  }

  /** The data URI keeps each action / timer pair its own PendingIntent. */
  private fun broadcast(context: Context, action: String, key: String, endsAt: Long = 0): PendingIntent {
    val intent =
      Intent(context, CookTimerReceiver::class.java)
        .setAction(action)
        .setData(Uri.parse("tortie-timer://" + action.substringAfterLast('.').lowercase() + "/" + Uri.encode(key)))
        .putExtra(EXTRA_KEY, key)
        .putExtra(EXTRA_ENDS_AT, endsAt)
    return PendingIntent.getBroadcast(
      context,
      0,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  /** Opens Tortie on the timer's step. */
  private fun openIntent(context: Context, key: String): PendingIntent? {
    val launch = launchIntent(context) ?: return null
    launch.putExtra(EXTRA_KEY, key)
    return PendingIntent.getActivity(
      context,
      key.hashCode(),
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  /** Opens Tortie as it is: the alert screen shows a timer still waiting for Stop. */
  private fun openAppIntent(context: Context): PendingIntent? {
    val launch = launchIntent(context) ?: return null
    return PendingIntent.getActivity(
      context,
      OPEN_APP_REQUEST,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun launchIntent(context: Context): Intent? =
    context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }

  private fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = manager(context)
    if (manager.getNotificationChannel(LIVE_CHANNEL) == null) {
      manager.createNotificationChannel(
        NotificationChannel(LIVE_CHANNEL, "Running timers", NotificationManager.IMPORTANCE_LOW).apply {
          description = "Live countdown while Tortie is closed"
          setShowBadge(false)
          lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
      )
    }
    if (manager.getNotificationChannel(RING_CHANNEL) == null) {
      manager.createNotificationChannel(
        NotificationChannel(RING_CHANNEL, "Timer alarms", NotificationManager.IMPORTANCE_HIGH).apply {
          description = "Rings when a cooking timer finishes"
          setShowBadge(false)
          lockscreenVisibility = Notification.VISIBILITY_PUBLIC
          setSound(
            ringSound(context),
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_ALARM)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build()
          )
          enableVibration(true)
          vibrationPattern = VIBRATE
          enableLights(true)
          lightColor = ACCENT
        }
      )
    }
  }

  /** The bundled alarm (expo-notifications copies it to res/raw), else the system alarm. */
  private fun ringSound(context: Context): Uri {
    val id = context.resources.getIdentifier("cook_alarm", "raw", context.packageName)
    if (id != 0) return Uri.parse("android.resource://" + context.packageName + "/" + id)
    return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
  }

  /** Same icon expo-notifications uses: its manifest meta-data, else the app icon. */
  private fun smallIcon(context: Context): Int {
    try {
      val info = context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
      val icon = info.metaData?.getInt(META_ICON, 0) ?: 0
      if (icon != 0) return icon
    } catch (_: Exception) {
    }
    return context.applicationInfo.icon
  }

  private fun clearCards(context: Context) {
    val manager = manager(context)
    for (active in manager.activeNotifications) {
      val tag = active.tag ?: continue
      if (tag.startsWith(LIVE_TAG) || tag.startsWith(RING_TAG)) manager.cancel(tag, active.id)
    }
  }

  private fun cancelTagged(context: Context, tag: String) {
    val manager = manager(context)
    for (active in manager.activeNotifications) {
      if (active.tag == tag) manager.cancel(tag, active.id)
    }
  }

  private fun queue(context: Context, type: String, key: String, at: Long, endsAt: Long? = null) {
    val prefs = prefs(context)
    val queued = JSONArray(prefs.getString(ACTIONS, "[]"))
    queued.put(
      JSONObject().put("type", type).put("key", key).put("at", at).apply {
        if (endsAt != null) put("endsAt", endsAt)
      }
    )
    prefs.edit().putString(ACTIONS, queued.toString()).apply()
  }

  private fun load(context: Context): Map<String, LiveTimer> {
    val stored = JSONObject(prefs(context).getString(TIMERS, "{}") ?: "{}")
    return stored.keys().asSequence().associateWith { key ->
      val item = stored.getJSONObject(key)
      LiveTimer(
        key = key,
        title = item.getString("title"),
        endsAt = item.getLong("endsAt"),
        remSec = item.optLong("remSec"),
        paused = item.optBoolean("paused"),
        ring = item.optBoolean("ring", true)
      )
    }
  }

  private fun save(context: Context, timers: Map<String, LiveTimer>) {
    val stored = JSONObject()
    for ((key, timer) in timers) {
      stored.put(
        key,
        JSONObject()
          .put("title", timer.title)
          .put("endsAt", timer.endsAt)
          .put("remSec", timer.remSec)
          .put("paused", timer.paused)
          .put("ring", timer.ring)
      )
    }
    prefs(context).edit().putString(TIMERS, stored.toString()).apply()
  }

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun manager(context: Context) =
    context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
}
