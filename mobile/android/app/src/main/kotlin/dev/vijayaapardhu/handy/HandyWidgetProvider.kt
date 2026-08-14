package dev.vijayaapardhu.handy

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetPlugin

/**
 * Shared plumbing for Handy's home-screen widgets.
 *
 * Every widget runs in the launcher's process with no Firebase access of its
 * own — it can only draw values the app saved for it (see
 * AppState.pushToWidget). Subclasses declare a layout and fill it in.
 */
abstract class HandyBaseWidget : AppWidgetProvider() {
    abstract val layoutId: Int
    abstract fun render(views: RemoteViews, data: android.content.SharedPreferences)

    /** Widgets can't read the app's theme, so appearance arrives as saved values. */
    protected fun background(data: android.content.SharedPreferences): Int =
        if (data.getString("widgetStyle", "accent") == "dark") {
            R.drawable.widget_background_dark
        } else {
            R.drawable.widget_background
        }

    /** How many rows the list widgets should draw (2-4, default 4). */
    protected fun rowLimit(data: android.content.SharedPreferences): Int =
        data.getString("widgetRows", "4")?.toIntOrNull() ?: 4

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        val data = HomeWidgetPlugin.getData(context)

        appWidgetIds.forEach { widgetId ->
            val views = RemoteViews(context.packageName, layoutId)
            views.setInt(R.id.widget_root, "setBackgroundResource", background(data))
            render(views, data)
            // Tapping anywhere opens Handy — a widget that does nothing when
            // touched feels broken regardless of what it shows.
            views.setOnClickPendingIntent(R.id.widget_root, launchIntent(context))
            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }

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

    /** Hides a row entirely when there's nothing to put in it. */
    protected fun RemoteViews.setRow(rowId: Int, textId: Int, value: String?) {
        if (value.isNullOrEmpty()) {
            setViewVisibility(rowId, android.view.View.GONE)
        } else {
            setViewVisibility(rowId, android.view.View.VISIBLE)
            setTextViewText(textId, value)
        }
    }
}

/** Next class: subject, countdown, time, venue and faculty. */
class HandyWidgetProvider : HandyBaseWidget() {
    override val layoutId = R.layout.widget_next_class

    override fun render(views: RemoteViews, data: android.content.SharedPreferences) {
        views.setTextViewText(R.id.next_subject, data.getString("nextClass", "Open Handy"))
        views.setTextViewText(R.id.next_countdown, data.getString("nextClassCountdown", ""))
        views.setTextViewText(R.id.next_time, data.getString("nextClassTime", ""))
        views.setTextViewText(R.id.next_venue, data.getString("nextClassVenue", ""))
        // Faculty is opt-out: useful on a big widget, noise on a small one.
        val showFaculty = data.getString("widgetShowFaculty", "1") == "1"
        views.setViewVisibility(
            R.id.next_faculty,
            if (showFaculty) android.view.View.VISIBLE else android.view.View.GONE,
        )
        views.setTextViewText(R.id.next_faculty, data.getString("nextClassFaculty", ""))
    }
}

/** Small: the attendance percentage and nothing else. */
class AttendanceWidgetProvider : HandyBaseWidget() {
    override val layoutId = R.layout.widget_attendance

    override fun render(views: RemoteViews, data: android.content.SharedPreferences) {
        views.setTextViewText(R.id.attendance_value, data.getString("attendance", "—"))
        views.setTextViewText(R.id.attendance_meta, data.getString("attendanceMeta", ""))
    }
}

/** The whole day, up to four sessions. */
class TodayWidgetProvider : HandyBaseWidget() {
    override val layoutId = R.layout.widget_today

    override fun render(views: RemoteViews, data: android.content.SharedPreferences) {
        views.setTextViewText(R.id.today_header, data.getString("todayCount", ""))

        val rows = listOf(
            Triple(R.id.today_row_0, R.id.today_time_0, R.id.today_subject_0),
            Triple(R.id.today_row_1, R.id.today_time_1, R.id.today_subject_1),
            Triple(R.id.today_row_2, R.id.today_time_2, R.id.today_subject_2),
            Triple(R.id.today_row_3, R.id.today_time_3, R.id.today_subject_3),
        )

        val limit = rowLimit(data)
        rows.forEachIndexed { i, (rowId, timeId, subjectId) ->
            val subject = data.getString("day${i}Subject", "")
            if (subject.isNullOrEmpty() || i >= limit) {
                views.setViewVisibility(rowId, android.view.View.GONE)
            } else {
                views.setViewVisibility(rowId, android.view.View.VISIBLE)
                views.setTextViewText(timeId, data.getString("day${i}Time", ""))
                val venue = data.getString("day${i}Venue", "")
                views.setTextViewText(
                    subjectId,
                    if (venue.isNullOrEmpty()) subject else "$subject · $venue",
                )
            }
        }
    }
}

/** What's due: up to three tasks with their countdowns. */
class DuesWidgetProvider : HandyBaseWidget() {
    override val layoutId = R.layout.widget_dues

    override fun render(views: RemoteViews, data: android.content.SharedPreferences) {
        views.setTextViewText(R.id.dues_header, data.getString("tasks", "Nothing due"))

        val rows = listOf(
            Triple(R.id.dues_row_0, R.id.dues_title_0, R.id.dues_when_0),
            Triple(R.id.dues_row_1, R.id.dues_title_1, R.id.dues_when_1),
            Triple(R.id.dues_row_2, R.id.dues_title_2, R.id.dues_when_2),
        )

        val limit = rowLimit(data)
        rows.forEachIndexed { i, (rowId, titleId, whenId) ->
            val title = data.getString("due${i}Title", "")
            if (title.isNullOrEmpty() || i >= limit) {
                views.setViewVisibility(rowId, android.view.View.GONE)
            } else {
                views.setViewVisibility(rowId, android.view.View.VISIBLE)
                views.setTextViewText(titleId, title)
                views.setTextViewText(whenId, data.getString("due${i}When", ""))
            }
        }
    }
}
