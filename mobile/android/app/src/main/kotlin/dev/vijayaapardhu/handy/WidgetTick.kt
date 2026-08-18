package dev.vijayaapardhu.handy

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import es.antonborri.home_widget.HomeWidgetBackgroundIntent
import es.antonborri.home_widget.HomeWidgetPlugin
import java.util.Calendar

/**
 * What redraws the widgets when the app is not running.
 *
 * Nothing did, which is the whole of the "widgets only update if I open the
 * app" complaint. `updatePeriodMillis` in the provider XML looks like it
 * should: it is set to its floor of thirty minutes, and Android will not honour
 * anything shorter. But it is also the *first* thing deferred when the device
 * dozes, so in practice a tile was redrawn about once an hour — while showing a
 * countdown that changes every minute, a day label that turns over at each
 * class, and a deadline that turns over at midnight. Every one of those was
 * wrong most of the time, and opening the app was the only way to fix it,
 * because opening the app is what called updateWidget.
 *
 * So the widgets set their own alarm, for the exact minute at which what they
 * are showing would read differently — the next minute during the hour before
 * a class, the end of a running one, midnight otherwise. Between those there
 * is nothing to redraw and no alarm pending.
 *
 * The redraw tick is deliberately RTC and not RTC_WAKEUP: a widget nobody can
 * see does not need redrawing, so it rides along with the next time the device
 * is awake rather than waking it. (The separate once-a-day CodeForge refresh
 * below does wake the device — see armDailyRefresh — because "daily at ten"
 * means ten.) And deliberately setWindow rather than setExact, which from
 * Android 12 needs a permission that a home-screen tile has no
 * business asking for.
 */
object WidgetTick {
    const val ACTION_TICK = "dev.vijayaapardhu.handy.WIDGET_TICK"

    /** Close enough for a countdown; loose enough for the OS to batch it. */
    private const val WINDOW_MS = 30_000L

    /** Never sooner than this, so a redraw can't schedule its own successor. */
    private const val FLOOR_MS = 15_000L

    /** The hour CodeForge is refreshed on session days. Fixed and named so it
     *  is a one-line change if the college's sessions move. */
    const val REFRESH_HOUR = 10

    /** URI the background isolate reads to know this is the CodeForge refresh. */
    const val REFRESH_URI = "handy://codeforge/refresh"

    const val ACTION_REFRESH = "dev.vijayaapardhu.handy.CODEFORGE_REFRESH"

    /** Look this far for the next session day. The timetable is weekly, so a
     *  fortnight is comfortably enough to find one if any exists. */
    private const val REFRESH_HORIZON_DAYS = 14

    private val providers = listOf(
        HandyWidgetProvider::class.java,
        AttendanceWidgetProvider::class.java,
        TodayWidgetProvider::class.java,
        DuesWidgetProvider::class.java,
        OverviewWidgetProvider::class.java,
        CodeForgeWidgetProvider::class.java,
    )

    /**
     * Sets the next redraw, replacing any already pending.
     *
     * Called after every draw, so the alarm is always aimed at the next thing
     * that happens rather than at whatever was next when it was last set —
     * which matters most right after a sync, when the timetable it was aimed
     * at may no longer be the one being shown.
     */
    fun arm(context: Context) {
        val alarms = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        if (!anyPlaced(context)) {
            cancel(context)
            return
        }
        val at = nextChange(context)
        try {
            alarms.setWindow(AlarmManager.RTC, at, WINDOW_MS, pending(context))
        } catch (_: SecurityException) {
            // Some OEM builds cap how many alarms an app may hold. A widget
            // that quietly stops ticking is better than one that crashes the
            // launcher's process on a redraw.
        }
        armDailyRefresh(context)
    }

    /**
     * Sets the next CodeForge refresh — the next [REFRESH_HOUR]:00 that falls on
     * a day holding a Technical Hour, and no alarm at all when the timetable has
     * none.
     *
     * A separate alarm from the redraw one: that fires every minute or two to
     * keep the countdown honest and only redraws from saved data, while this
     * fires once a day and reaches across the network. RTC_WAKEUP, not RTC:
     * "daily at ten" means ten, so this wakes a dozing device rather than
     * waiting for the next time it happens to come on — a once-a-day wake is a
     * negligible battery cost, unlike the every-minute redraw tick, which stays
     * non-waking. setAndAllowWhileIdle is what lets it through Doze at all.
     *
     * Re-armed after every draw and, crucially, by the refresh receiver itself
     * before it triggers the fetch — so a network failure at ten never stops
     * tomorrow's attempt.
     */
    fun armDailyRefresh(context: Context) {
        val alarms = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        if (!anyPlaced(context)) {
            alarms.cancel(refreshPending(context))
            return
        }
        val at = nextRefresh(context)
        if (at == null) {
            // No Technical Hour on this student's timetable — nothing to refresh.
            alarms.cancel(refreshPending(context))
            return
        }
        try {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, refreshPending(context))
        } catch (_: SecurityException) {
        }
    }

    /**
     * Wall-clock millis of the next [REFRESH_HOUR]:00 on a session day, or null
     * when no day in the horizon holds one.
     */
    private fun nextRefresh(context: Context): Long? {
        val data = HomeWidgetPlugin.getData(context)
        val now = Calendar.getInstance()
        for (offset in 0..REFRESH_HORIZON_DAYS) {
            val day = (now.clone() as Calendar).apply {
                add(Calendar.DAY_OF_YEAR, offset)
                set(Calendar.HOUR_OF_DAY, REFRESH_HOUR)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            // Today only counts if ten has not already passed.
            if (day.timeInMillis <= System.currentTimeMillis() + FLOOR_MS) continue
            val weekday = day.get(Calendar.DAY_OF_WEEK) - 1
            if (Schedule.hasTechnicalOn(data, weekday)) return day.timeInMillis
        }
        return null
    }

    private fun refreshPending(context: Context): PendingIntent {
        // Aimed at our own receiver, not straight at home_widget's: the receiver
        // re-arms tomorrow's alarm before it triggers the fetch, so a failed
        // fetch can never break the daily cycle. Distinct request code from the
        // redraw alarm so the two PendingIntents never collide.
        val intent = Intent(context, CodeForgeRefreshReceiver::class.java)
            .setAction(ACTION_REFRESH)
            .setData(Uri.parse(REFRESH_URI))
        return PendingIntent.getBroadcast(
            context,
            1,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    fun cancel(context: Context) {
        val alarms = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        alarms.cancel(pending(context))
    }

    /** Redraws every placed widget, then aims the alarm at the next change. */
    fun redraw(context: Context) {
        val manager = AppWidgetManager.getInstance(context) ?: return
        for (provider in providers) {
            val ids = manager.getAppWidgetIds(ComponentName(context, provider))
            if (ids.isEmpty()) continue
            context.sendBroadcast(
                Intent(context, provider).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                },
            )
        }
        arm(context)
    }

    private fun anyPlaced(context: Context): Boolean {
        val manager = AppWidgetManager.getInstance(context) ?: return false
        return providers.any {
            manager.getAppWidgetIds(ComponentName(context, it)).isNotEmpty()
        }
    }

    /**
     * When the tiles would next read differently, as a wall-clock time.
     *
     * The schedule answers this for the classes; midnight is the backstop,
     * because the day label, the day's list and every deadline countdown turn
     * over there whether or not there are classes on either side of it.
     */
    private fun nextChange(context: Context): Long {
        val now = Calendar.getInstance()
        val midnight = (now.clone() as Calendar).apply {
            add(Calendar.DAY_OF_YEAR, 1)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis

        val minutes = Schedule.from(HomeWidgetPlugin.getData(context), now).nextChangeMinutes()
        val at = if (minutes == null) {
            midnight
        } else {
            val start = (now.clone() as Calendar).apply {
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }.timeInMillis
            minOf(start + minutes * 60_000L, midnight)
        }
        return maxOf(at, System.currentTimeMillis() + FLOOR_MS)
    }

    private fun pending(context: Context): PendingIntent = PendingIntent.getBroadcast(
        context,
        0,
        Intent(context, WidgetTickReceiver::class.java).setAction(ACTION_TICK),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
}

/** Receives the tick alarm and redraws. */
class WidgetTickReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        WidgetTick.redraw(context)
    }
}

/**
 * Fires at [WidgetTick.REFRESH_HOUR]:00 on a CodeForge session day.
 *
 * Re-arms tomorrow's refresh *before* triggering the fetch, deliberately: the
 * fetch reaches Maya over the network and can fail, and a failure must never be
 * what stops the daily cycle. Then it dispatches home_widget's background
 * intent, which spins up the Dart isolate and calls codeForgeBackgroundCallback
 * — see background_codeforge.dart.
 */
class CodeForgeRefreshReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        WidgetTick.armDailyRefresh(context)
        try {
            HomeWidgetBackgroundIntent
                .getBroadcast(context, Uri.parse(WidgetTick.REFRESH_URI))
                .send()
        } catch (_: Exception) {
            // A cancelled PendingIntent or a background-start restriction. The
            // alarm is already re-armed, so tomorrow tries again.
        }
    }
}

/**
 * Re-arms the alarm after the events that lose it.
 *
 * A reboot clears every pending alarm, and so does replacing the package on an
 * update — after either, a widget would sit frozen until something else
 * happened to redraw it. The clock changes are here for the same reason from
 * the other direction: an alarm set for 09:29 is aimed at the wrong instant
 * once the timezone moves under it.
 */
class WidgetBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        WidgetTick.redraw(context)
    }
}
