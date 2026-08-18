package dev.vijayaapardhu.handy

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.os.Bundle
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetPlugin

/** The size the launcher has actually given a widget, in dp. */
data class WidgetSize(val width: Int, val height: Int)

/**
 * Shared plumbing for Handy's home-screen widgets.
 *
 * Every widget runs in the launcher's process with no Firebase access of its
 * own — it can only draw values the app saved for it (see
 * AppState.pushToWidget). Subclasses declare a layout and fill it in.
 *
 * Widgets are drawn to the size the student dragged them to, not to a fixed
 * design. A tile with a third of its height blank looks broken, and one that
 * clips its own text is worse — so each subclass is handed its current size
 * and decides what fits: how many rows to draw, how large to set the numbers,
 * which of the optional lines to keep. The smallest useful size is the
 * declared default, and everything above that earns more detail rather than
 * more whitespace.
 */
abstract class HandyBaseWidget : AppWidgetProvider() {
    abstract val layoutId: Int
    abstract fun render(context: Context, views: RemoteViews, data: SharedPreferences, size: WidgetSize)

    /**
     * Widgets can't read the app's theme, so appearance arrives as saved values.
     *
     * Open because CodeForge overrides it: that tile is deliberately outside the
     * shared palette, so a student cannot mistake its percentage for their
     * attendance. See CodeForgeWidgetProvider.
     */
    protected open fun background(data: SharedPreferences): Int = lookOf(data).background

    /** The student's cap on list rows (2-4, default 4); the size caps it further. */
    protected fun rowLimit(data: SharedPreferences): Int =
        data.getString("widgetRows", "4")?.toIntOrNull() ?: 4

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        val data = HomeWidgetPlugin.getData(context)
        appWidgetIds.forEach { draw(context, appWidgetManager, it, data) }
        // Aimed at the next thing that happens rather than at whatever was
        // next when the alarm was last set: after a sync, the timetable it was
        // aimed at may not be the one now being drawn. See WidgetTick.
        WidgetTick.arm(context)
    }

    /** First one placed — start ticking. */
    override fun onEnabled(context: Context) {
        WidgetTick.arm(context)
    }

    /**
     * Last one of *this* kind removed. arm() cancels rather than schedules when
     * nothing is left on the home screen at all, so a student who keeps the
     * attendance tile and drops the timetable one keeps their ticks.
     */
    override fun onDisabled(context: Context) {
        WidgetTick.arm(context)
    }

    /**
     * Resizing is the whole point of a responsive widget, and Android reports
     * it here rather than through onUpdate — without this a widget keeps its
     * first layout until the next half-hourly refresh.
     */
    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle,
    ) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
        draw(context, appWidgetManager, appWidgetId, HomeWidgetPlugin.getData(context))
    }

    private fun draw(
        context: Context,
        appWidgetManager: AppWidgetManager,
        widgetId: Int,
        data: SharedPreferences,
    ) {
        val size = measure(appWidgetManager, widgetId)
        val views = RemoteViews(context.packageName, layoutId)
        views.setInt(R.id.widget_root, "setBackgroundResource", background(data))

        // Padding scales too: 16dp of margin inside a one-cell tile is most of
        // the tile, and a tile can now be resized down to one cell.
        val pad = dp(
            context,
            when {
                size.height <= 50 || size.width <= 50 -> 6
                size.height <= 70 -> 10
                else -> 14
            },
        )
        views.setViewPadding(R.id.widget_root, pad, pad, pad, pad)

        render(context, views, data, size)
        // Tapping anywhere opens Handy — a widget that does nothing when
        // touched feels broken regardless of what it shows.
        views.setOnClickPendingIntent(R.id.widget_root, launchIntent(context))
        deepLink(context, views)
        appWidgetManager.updateAppWidget(widgetId, views)
    }

    /**
     * Portrait takes the narrow width and the tall height, which is the box the
     * widget is guaranteed in the orientation it is nearly always read in.
     * Options come back empty until the launcher has measured it, so fall back
     * to the smallest declared size rather than to zero.
     */
    private fun measure(appWidgetManager: AppWidgetManager, widgetId: Int): WidgetSize {
        val options = appWidgetManager.getAppWidgetOptions(widgetId)
        val width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
        val height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0)
        return WidgetSize(
            width = if (width > 0) width else 110,
            height = if (height > 0) height else 50,
        )
    }

    private fun dp(context: Context, value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()

    /**
     * Extra tap targets that open Handy somewhere specific.
     *
     * Overridden by widgets that have one; the base does nothing, so a widget
     * without a quick-add costs nothing for having the hook.
     */
    protected open fun deepLink(context: Context, views: RemoteViews) {}

    /**
     * A PendingIntent that opens the app at [uri].
     *
     * home_widget's own launch action is used rather than a bare Intent: the
     * plugin recognises that action and hands the URI to Dart, which is what
     * lets the app act on which part of the widget was tapped.
     */
    protected fun deepLinkIntent(context: Context, uri: String): PendingIntent =
        HomeWidgetLaunchIntent.getActivity(context, MainActivity::class.java, Uri.parse(uri))

    private fun launchIntent(context: Context): PendingIntent {
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            ?: Intent()
        return PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    protected fun RemoteViews.show(viewId: Int, visible: Boolean) {
        setViewVisibility(viewId, if (visible) View.VISIBLE else View.GONE)
    }

    /**
     * Shows a line only when there is both room for it and something to say,
     * styled from the student's palette.
     *
     * `wrap` is why room names stopped being cut off mid-word: a narrow tile
     * gives a room and a building two lines instead of one line and an
     * ellipsis, which on a widget is the difference between an address and a
     * riddle.
     */
    protected fun RemoteViews.line(
        viewId: Int,
        value: String?,
        room: Boolean,
        look: WidgetLook,
        secondary: Boolean = true,
        wrap: Int = 1,
    ) {
        if (value.isNullOrEmpty() || !room) {
            setViewVisibility(viewId, View.GONE)
        } else {
            setViewVisibility(viewId, View.VISIBLE)
            setTextViewText(viewId, if (secondary) look.secondary(value) else look.primary(value))
            setInt(viewId, "setMaxLines", wrap)
        }
    }

    protected fun RemoteViews.textSize(viewId: Int, sp: Float) {
        setTextViewTextSize(viewId, TypedValue.COMPLEX_UNIT_SP, sp)
    }

    /**
     * Rows that fit below a header.
     *
     * A row is one line on a wide tile and two on a narrow one, because that is
     * where a long class name wraps rather than being cut off — so the height a
     * row needs depends on the width. Assuming one line everywhere is how four
     * rows were promised and three-and-a-half were drawn.
     */
    protected fun rowsThatFit(size: WidgetSize, max: Int): Int {
        val usable = size.height - 42 // header + padding
        val perRow = if (size.width >= 250) 24 else 38
        return (usable / perRow).coerceIn(0, max)
    }
}

/**
 * Next class. At its smallest this is a countdown and a subject, which is the
 * whole question — "what have I got next, and how long have I got". Time,
 * room and faculty appear as the tile grows.
 */
class HandyWidgetProvider : HandyBaseWidget() {
    override val layoutId = R.layout.widget_next_class

    override fun render(context: Context, views: RemoteViews, data: SharedPreferences, size: WidgetSize) {
        val look = lookOf(data)
        val wide = size.width >= 250
        // Computed here, not read from a string the app wrote: see Schedule.kt.
        val schedule = Schedule.from(data)
        val next = schedule.next

        views.setTextViewText(R.id.next_countdown, look.secondary(schedule.countdown()))
        views.setTextViewText(
            R.id.next_subject,
            look.primary(next?.subject?.ifEmpty { "Class" } ?: "No more classes today"),
        )

        views.textSize(R.id.next_countdown, if (size.height <= 70) 9f else 11f)
        views.textSize(
            R.id.next_subject,
            when {
                size.height >= 140 -> 20f
                size.height >= 90 -> 17f
                else -> 14f
            },
        )
        // One line at a squeeze, two once there's room for them to land.
        views.setInt(R.id.next_subject, "setMaxLines", if (size.height >= 90) 2 else 1)

        // While a class is running, the time line carries what comes after it
        // as well. "Ongoing" answers where you are; "then ADSAA at 13:00"
        // answers the question you are actually asking during a lecture, which
        // is whether you can go anywhere when it ends.
        val afterwards = if (schedule.isRunning) schedule.after else null
        views.line(
            R.id.next_time,
            next?.let {
                val span = "${it.start} – ${it.end}"
                if (afterwards == null) span else "$span  ·  then ${afterwards.label} at ${afterwards.start}"
            } ?: "",
            size.height >= 72,
            look,
            wrap = if (wide) 1 else 2,
        )
        // Room and building wrap on a narrow tile instead of ellipsising, and
        // faculty names are long enough to need the same.
        views.line(
            R.id.next_venue, next?.venue ?: "", size.height >= 100, look,
            wrap = if (wide) 1 else 2,
        )
        // Faculty is opt-out and the first thing to go when space is short.
        val showFaculty = data.getString("widgetShowFaculty", "1") == "1"
        views.line(
            R.id.next_faculty,
            next?.faculty ?: "",
            showFaculty && size.height >= 124,
            look,
            wrap = if (wide) 1 else 2,
        )
    }
}

/**
 * The attendance percentage, sized to whatever it's been given. This is the
 * one widget worth keeping at a single cell, so the number scales rather than
 * the tile.
 */
class AttendanceWidgetProvider : HandyBaseWidget() {
    override val layoutId = R.layout.widget_attendance

    override fun render(context: Context, views: RemoteViews, data: SharedPreferences, size: WidgetSize) {
        val look = lookOf(data)
        views.setTextViewText(R.id.attendance_value, look.primary(data.getString("attendance", "—")))
        views.setTextViewText(R.id.attendance_meta, look.secondary(data.getString("attendanceMeta", "")))

        views.textSize(
            R.id.attendance_value,
            when {
                size.height >= 140 && size.width >= 180 -> 44f
                size.height >= 100 -> 34f
                size.height >= 70 -> 26f
                else -> 20f
            },
        )
        // "183 of 260 classes" under a number in a one-cell tile is two
        // illegible lines instead of one clear one.
        views.show(R.id.attendance_meta, size.height >= 78 && size.width >= 110)
    }
}

/** The day's classes — as many as fit, never more than the student asked for. */
class TodayWidgetProvider : HandyBaseWidget() {
    override val layoutId = R.layout.widget_today

    override fun render(context: Context, views: RemoteViews, data: SharedPreferences, size: WidgetSize) {
        val look = lookOf(data)
        val schedule = Schedule.from(data)
        // "2 of 3 left" rather than "3 classes today" once the day is under
        // way — which the app could not have known when it last wrote.
        views.setTextViewText(R.id.today_header, look.secondary(schedule.dayLabel()))
        views.show(R.id.today_header, size.height >= 66)

        val rows = listOf(
            Triple(R.id.today_row_0, R.id.today_time_0, R.id.today_subject_0),
            Triple(R.id.today_row_1, R.id.today_time_1, R.id.today_subject_1),
            Triple(R.id.today_row_2, R.id.today_time_2, R.id.today_subject_2),
            Triple(R.id.today_row_3, R.id.today_time_3, R.id.today_subject_3),
        )

        val limit = minOf(rowLimit(data), rowsThatFit(size, rows.size).coerceAtLeast(1))
        val agenda = schedule.agenda
        rows.forEachIndexed { i, (rowId, timeId, subjectId) ->
            val slot = agenda.getOrNull(i)
            if (slot == null || i >= limit) {
                views.show(rowId, false)
            } else {
                views.show(rowId, true)
                views.setTextViewText(timeId, look.secondary(slot.start))
                // The room is the first thing to drop on a narrow tile: it's
                // the least useful half of the line when read at a glance.
                views.setTextViewText(
                    subjectId,
                    look.primary(
                        if (slot.venue.isEmpty() || size.width < 180) {
                            slot.subject
                        } else {
                            "${slot.subject} · ${slot.venue}"
                        },
                    ),
                )
                views.setInt(subjectId, "setMaxLines", if (size.width >= 250) 1 else 2)
            }
        }
    }
}

/** What's due — as many as fit, soonest first. */
class DuesWidgetProvider : HandyBaseWidget() {
    override val layoutId = R.layout.widget_dues

    /**
     * The "+" opens the add form directly.
     *
     * Writing a deadline down has to be quicker than deciding not to bother,
     * and the gap between "open app, find tab, find button" and "one tap" is
     * exactly where a deadline gets forgotten.
     */
    override fun deepLink(context: Context, views: RemoteViews) {
        views.setOnClickPendingIntent(
            R.id.dues_add,
            deepLinkIntent(context, "handy://deadline/new"),
        )
    }

    override fun render(context: Context, views: RemoteViews, data: SharedPreferences, size: WidgetSize) {
        val look = lookOf(data)
        views.setTextViewText(R.id.dues_header, look.secondary(data.getString("tasks", "Nothing due")))
        views.show(R.id.dues_header, size.height >= 66)
        // The plus needs room to be a target rather than a decoration.
        views.setTextViewText(R.id.dues_add, look.primary("+"))
        views.show(R.id.dues_add, size.height >= 66 && size.width >= 130)

        val rows = listOf(
            Triple(R.id.dues_row_0, R.id.dues_title_0, R.id.dues_when_0),
            Triple(R.id.dues_row_1, R.id.dues_title_1, R.id.dues_when_1),
            Triple(R.id.dues_row_2, R.id.dues_title_2, R.id.dues_when_2),
        )

        val limit = minOf(rowLimit(data), rowsThatFit(size, rows.size).coerceAtLeast(1))
        val due = Dues.from(data)
        val today = Dues.today()
        rows.forEachIndexed { i, (rowId, titleId, whenId) ->
            val item = due.getOrNull(i)
            if (item == null || i >= limit) {
                views.show(rowId, false)
            } else {
                views.show(rowId, true)
                // Steps ride with the title rather than taking a column of
                // their own: most deadlines have none, and an empty column on
                // every row costs more than it ever shows.
                views.setTextViewText(
                    titleId,
                    look.primary(
                        if (item.steps.isEmpty()) item.title else "${item.title}  ·  ${item.steps}",
                    ),
                )
                views.setInt(titleId, "setMaxLines", if (size.width >= 250) 1 else 2)
                views.setTextViewText(whenId, look.secondary(item.label(today)))
                // The countdown is the point of this widget; on a narrow tile
                // it keeps its place and the title gives way instead.
                views.show(whenId, size.width >= 140)
            }
        }
    }
}
