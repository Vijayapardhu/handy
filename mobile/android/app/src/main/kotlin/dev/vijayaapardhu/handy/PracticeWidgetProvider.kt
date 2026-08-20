package dev.vijayaapardhu.handy

import android.content.Context
import android.content.SharedPreferences
import android.widget.RemoteViews

/**
 * Coding practice on the home screen: problems solved, the streak, and the
 * week's goal.
 *
 * The streak is the reason this tile exists. A total climbs whether or not the
 * student is still practising, so a number on its own says nothing about this
 * week — and a streak is the one figure that goes down, which is what makes it
 * worth glancing at on the way past.
 *
 * Unlike the CodeForge tile, this one follows the student's chosen palette.
 * That tile is deliberately outside it because its percentage could be mistaken
 * for an attendance percentage at a glance; there is no such confusion here,
 * since nothing else on the home screen shows a solved count.
 *
 * The values are whatever the app last published (see publishPractice in
 * widget_publish.dart). A widget has no network of its own, so an unopened app
 * means yesterday's numbers rather than a spinner — which is why the tile says
 * when it was last read once it has the room to.
 */
class PracticeWidgetProvider : HandyBaseWidget() {
    override val layoutId = R.layout.widget_practice

    override fun render(context: Context, views: RemoteViews, data: SharedPreferences, size: WidgetSize) {
        val look = lookOf(data)
        val linked = data.getString("practiceLinked", "0") == "1"

        views.setTextViewText(R.id.practice_label, look.secondary("Practice"))
        // At one cell the number is all there is room for; a label above it in
        // a 40dp box is two illegible things instead of one clear one.
        views.show(R.id.practice_label, size.height >= 66 && size.width >= 90)

        if (!linked) {
            // Zero solved is a claim about a student who may well have solved
            // hundreds — they just have not told Handy where. Say what to do.
            views.setTextViewText(R.id.practice_value, look.primary("—"))
            views.textSize(R.id.practice_value, valueSize(size))
            views.show(R.id.practice_streak, false)
            views.line(
                R.id.practice_goal,
                "Tap to connect LeetCode & co.",
                size.height >= 84,
                look,
                wrap = 2,
            )
            views.show(R.id.practice_platforms, false)
            return
        }

        views.setTextViewText(R.id.practice_value, look.primary(data.getString("practiceSolved", "—")))
        views.textSize(R.id.practice_value, valueSize(size))

        // The streak sits beside the total rather than under it: they are the
        // same glance, and stacking them costs a row the small sizes do not
        // have. An empty string means no streak at all, and an absent streak
        // reads better than "0 days".
        views.line(
            R.id.practice_streak,
            data.getString("practiceStreak", ""),
            size.width >= 150,
            look,
            wrap = 1,
        )

        // Deliberately no progress bar, though a weekly goal is the obvious
        // shape for one. A ProgressBar's colours live in a drawable, and a
        // drawable cannot follow the palette from here — which is why the only
        // tile in this app with a bar is the CodeForge one, and why that tile
        // is the only one that opts out of the palette. A bar written for the
        // dark palettes would be white-on-white on the light one. The goal is
        // legible on all eight as styled text, so it is text.
        //
        // Empty when no goal is set: a goal nobody has chosen is a question,
        // not a figure, and a permanent "0 / 0" reads as failure.
        views.line(
            R.id.practice_goal,
            data.getString("practiceGoal", ""),
            // Baseline content (padding + label + value) is ~78dp; a line under
            // it needs another ~24 before it clips at the bottom edge.
            size.height >= 96,
            look,
            wrap = 1,
        )

        // Which platforms the total is made of. Last, because it is the line a
        // student reads once and then never again.
        views.line(
            R.id.practice_platforms,
            data.getString("practicePlatforms", ""),
            size.height >= 124,
            look,
            wrap = if (size.width < 200) 2 else 1,
        )
    }

    private fun valueSize(size: WidgetSize): Float = when {
        size.height >= 140 && size.width >= 180 -> 40f
        size.height >= 100 -> 32f
        size.height >= 70 -> 25f
        else -> 19f
    }
}
