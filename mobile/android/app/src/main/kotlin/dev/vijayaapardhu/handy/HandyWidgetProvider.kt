package dev.vijayaapardhu.handy

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetPlugin

/**
 * Home-screen widget: overall attendance, the next class with its room, and
 * how many tasks are open.
 *
 * The widget runs in the launcher's process, not the app's, so it has no
 * Firebase access and cannot fetch anything. It can only render what the app
 * last saved for it — AppState.pushToWidget() writes those values whenever the
 * underlying data changes.
 */
class HandyWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        val data = HomeWidgetPlugin.getData(context)

        appWidgetIds.forEach { widgetId ->
            val views = RemoteViews(context.packageName, R.layout.handy_widget).apply {
                setTextViewText(R.id.widget_attendance, data.getString("attendance", "—"))
                setTextViewText(
                    R.id.widget_next_class,
                    data.getString("nextClass", "Open Handy to sync"),
                )
                setTextViewText(R.id.widget_next_meta, data.getString("nextClassMeta", ""))
                setTextViewText(R.id.widget_tasks, data.getString("tasks", ""))
            }
            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }
}
