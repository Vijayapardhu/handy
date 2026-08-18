package dev.vijayaapardhu.handy

import android.content.Context
import android.content.SharedPreferences
import android.graphics.Color
import android.widget.RemoteViews

/**
 * CodeForge sessions on the home screen.
 *
 * Its own tile rather than a block inside the Overview one, because it is its
 * own thing: these sessions come from Maya, not from Campus Connect, and the
 * percentage has nothing to do with the 75% a degree depends on. A student
 * glancing at a home screen has no time to read a label carefully, so the two
 * figures are kept in separate tiles that do not look alike.
 *
 * ## Why this one ignores the palette
 *
 * Every other widget follows whatever theme was chosen in Settings, and should:
 * they are all views of the same attendance and belong to one set. This one is
 * deliberately outside that. It is blue whatever the student picked, with orange
 * as the accent — the two colours CodeForge is identified by — so it can never
 * be mistaken at a glance for the tile next to it. The one thing it does honour
 * is the light/dark choice, because black text on a dark slab is not a style
 * preference, it is unreadable.
 *
 * Text colour is picked from the background rather than fixed, for the same
 * reason: white on the dark tile, near-black on the light one.
 */
class CodeForgeWidgetProvider : HandyBaseWidget() {
    override val layoutId = R.layout.widget_codeforge

    /**
     * Blue, always — but the *right* blue for the theme the student is in.
     *
     * Derived from whether their chosen palette is a dark one, so the tile
     * follows the rest of the home screen into dark mode without following it
     * into orange or plum.
     */
    override fun background(data: SharedPreferences): Int =
        if (isLight(data)) R.drawable.widget_bg_forge_light else R.drawable.widget_bg_forge

    override fun render(context: Context, views: RemoteViews, data: SharedPreferences, size: WidgetSize) {
        val light = isLight(data)
        val ink = if (light) Color.parseColor("#0B2545") else Color.WHITE
        val quiet = if (light) Color.parseColor("#4A6C93") else Color.parseColor("#9CC3F0")
        // Orange holds up on both, and is the one colour that stays put.
        val accent = Color.parseColor(if (light) "#C2570B" else "#F9A857")

        val percent = data.getString("forgePercent", "") ?: ""
        val linked = data.getString("forgeLinked", "0") == "1"

        views.setTextColor(R.id.forge_label, quiet)
        views.setTextColor(R.id.forge_value, ink)
        views.setTextColor(R.id.forge_sessions, quiet)
        views.setTextColor(R.id.forge_course, ink)
        views.setTextColor(R.id.forge_next, accent)

        views.setTextViewText(R.id.forge_label, "CodeForge")
        // The label is the first thing to go: at one cell the number is all
        // there is room for, and "CODEFORGE" above a percentage in a 40dp box
        // is two illegible things instead of one clear one.
        views.show(R.id.forge_label, size.height >= 66 && size.width >= 90)

        if (!linked) {
            // A tile that shows 0% for an unconnected account is stating a
            // figure nobody has. It says what to do instead.
            views.setTextViewText(R.id.forge_value, "—")
            views.textSize(R.id.forge_value, valueSize(size))
            views.show(R.id.forge_sessions, false)
            views.show(R.id.forge_bar, false)
            views.line(R.id.forge_course, "Tap to connect CodeForge", size.height >= 84, wrap = 2)
            views.show(R.id.forge_next, false)
            return
        }

        views.setTextViewText(R.id.forge_value, percent.ifEmpty { "—" })
        views.textSize(R.id.forge_value, valueSize(size))

        views.line(
            R.id.forge_sessions,
            data.getString("forgeSessions", ""),
            // Alongside the number, so it needs the width for both.
            size.width >= 150,
            wrap = 1,
        )

        views.show(R.id.forge_bar, size.height >= 66)
        views.setProgressBar(
            R.id.forge_bar,
            100,
            percent.removeSuffix("%").toFloatOrNull()?.toInt()?.coerceIn(0, 100) ?: 0,
            false,
        )

        // The worst CodeForge course, and the next Technical Hour, each shown
        // only when there is genuine room below the bar for it — not merely
        // when the tile is nominally tall enough. Baseline content (padding +
        // label + value + bar) is ~90dp; a course line needs another ~24, and a
        // course *plus* the next line another ~24 again. Showing either sooner
        // is what clipped the course at the bottom edge.
        //
        // A course name wraps to two lines only once there is room for two —
        // otherwise the second line is the thing that clips.
        val twoLineCourse = size.height >= 156 && size.width < 240
        views.line(
            R.id.forge_course,
            data.getString("forgeCourse", ""),
            size.height >= 114,
            wrap = if (twoLineCourse) 2 else 1,
        )

        views.line(
            R.id.forge_next,
            data.getString("forgeNext", ""),
            // After a one-line course; after a two-line one it needs more still.
            size.height >= (if (twoLineCourse) 164 else 140),
            wrap = 1,
        )
    }

    private fun valueSize(size: WidgetSize): Float = when {
        size.height >= 140 && size.width >= 180 -> 34f
        size.height >= 96 -> 30f
        size.height >= 66 -> 24f
        else -> 19f
    }

    /**
     * Whether the student's chosen palette is a light one.
     *
     * Read off the palette name rather than the system theme: a widget cannot
     * see the app's ThemeMode, and the palette is the choice the student
     * actually made about how these tiles should look.
     */
    private fun isLight(data: SharedPreferences): Boolean =
        data.getString("widgetStyle", "accent") == "light"

    /** Text colour comes from this provider, not from the shared palette. */
    private fun RemoteViews.line(viewId: Int, value: String?, room: Boolean, wrap: Int) {
        if (value.isNullOrEmpty() || !room) {
            show(viewId, false)
        } else {
            show(viewId, true)
            setTextViewText(viewId, value)
            setInt(viewId, "setMaxLines", wrap)
        }
    }
}
