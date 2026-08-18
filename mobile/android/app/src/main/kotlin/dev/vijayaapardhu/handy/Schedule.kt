package dev.vijayaapardhu.handy

import android.content.SharedPreferences
import org.json.JSONArray
import java.util.Calendar

/**
 * The day's classes, read straight from what the app saved, with the clock
 * applied here rather than in Dart.
 *
 * This is the difference between a widget that is right and one that was right
 * the last time the app was open. A countdown computed in the app is correct
 * for the instant it is written and wrong from then on; a student who has not
 * opened Handy since yesterday would be looking at yesterday's next class. The
 * app saves the whole week and this picks today, picks the next class and
 * phrases the countdown at draw time — which happens on the tick alarm, on
 * resize, and after a reboot, with the app closed throughout.
 *
 * The *week* rather than the day, because the day is the part that expires. A
 * widget handed Wednesday's list has nothing to show on Thursday and no app
 * running at midnight to hand it a new one, so it went on showing Wednesday.
 * See WidgetTick, which is what makes sure something redraws at midnight.
 */
data class ClassSlot(
    val start: String,
    val end: String,
    val subject: String,
    val short: String,
    val venue: String,
    val faculty: String,
    val type: String = "lecture",
) {
    val startMinutes get() = minutesOf(start)
    val endMinutes get() = minutesOf(end)

    /// The short name when the portal gave one, else the full name. Widgets
    /// are narrow and "ADSAA" says as much as the full title at a glance.
    val label get() = short.ifEmpty { subject }
}

/** "09:30" -> 570. Returns -1 for anything unparseable, which sorts first. */
fun minutesOf(hhmm: String): Int {
    val parts = hhmm.split(":")
    if (parts.size != 2) return -1
    val h = parts[0].toIntOrNull() ?: return -1
    val m = parts[1].toIntOrNull() ?: return -1
    return h * 60 + m
}

class Schedule(val slots: List<ClassSlot>, private val nowMinutes: Int) {

    val count get() = slots.size
    val finished get() = slots.count { it.endMinutes in 0..nowMinutes }
    val remaining get() = count - finished

    /**
     * The class you are in, or the next one you are heading to.
     *
     * Strictly greater than, not greater-or-equal: a class ending at exactly
     * this minute is over. With `>=` it stayed selected for its final minute
     * and, since the running test is exclusive at the end, the countdown fell
     * through to the not-yet-started branch and announced that a class which
     * had just finished was "starting now".
     */
    val next: ClassSlot? get() = slots.firstOrNull { it.endMinutes > nowMinutes }

    /** What follows the current one, so a running class can name what's after it. */
    val after: ClassSlot?
        get() {
            val current = next ?: return null
            return slots.firstOrNull { it.startMinutes >= current.endMinutes }
        }

    val isRunning: Boolean
        get() = next?.let { nowMinutes in it.startMinutes until it.endMinutes } ?: false

    /**
     * The day's list as it is worth reading at this moment.
     *
     * A tile that fits three rows and spends the afternoon showing the three
     * classes that are already over is a record, not a timetable — so the list
     * advances past what has finished. Once the whole day has, it falls back
     * to the whole day: "Day done" over an empty box says less than "Day done"
     * over what the day was.
     */
    val agenda: List<ClassSlot>
        get() = if (remaining == 0) slots else slots.filter { it.endMinutes > nowMinutes }

    /**
     * "IN 41 MIN" / "ONGOING · ENDS 12:10" / "AT 14:00".
     *
     * Minute-accurate under an hour, because that is the hour in which the
     * figure is worth reading and the tick alarm redraws every minute to keep
     * it honest. Past that the tile is only redrawn at the points where the
     * phrasing turns over, so the phrasing is deliberately coarse enough not
     * to need more. See nextChangeMinutes, which is the other half of this.
     */
    fun countdown(): String {
        val slot = next ?: return if (count == 0) "" else "DONE FOR TODAY"
        if (nowMinutes in slot.startMinutes until slot.endMinutes) {
            return "ONGOING · ENDS ${slot.end}"
        }
        val away = slot.startMinutes - nowMinutes
        return when {
            away <= 1 -> "STARTING NOW"
            away < 60 -> "IN $away MIN"
            away < 120 -> "IN ABOUT AN HOUR"
            else -> "AT ${slot.start}"
        }
    }

    /** "2 classes today" / "1 left today" — whichever is the live fact. */
    fun dayLabel(): String = when {
        count == 0 -> "No classes today"
        remaining == 0 -> "Day done"
        finished == 0 -> "$count class${if (count == 1) "" else "es"} today"
        else -> "$remaining of $count left"
    }

    /**
     * Minutes past midnight at which any of the above would read differently,
     * or null when nothing more changes today.
     *
     * This is what the tick alarm is set to, so a widget is redrawn exactly
     * when it has something new to say and not once in between. Every minute
     * within the hour before a class, because that is when the countdown
     * counts down; otherwise only at the moments the phrasing turns over.
     */
    fun nextChangeMinutes(): Int? {
        val candidates = sortedSetOf<Int>()
        // Every class ending moves the day label on and drops a row off the
        // list, whichever class it is.
        slots.forEach { candidates += it.endMinutes }
        next?.let { slot ->
            // The countdown is about one class only, so only that class's
            // approach is worth waking for. Adding every class's would have
            // redrawn an unchanged "ONGOING · ENDS 10:20" at 10:00 because the
            // 11:00 lecture was then an hour off.
            candidates += slot.startMinutes - 120 // "AT 11:00" -> "IN ABOUT AN HOUR"
            candidates += slot.startMinutes - 60 // -> "IN 59 MIN", and minutely from there
            candidates += slot.startMinutes // -> "ONGOING"
            // Ticking every minute for the whole day would spend the same
            // battery redrawing text that had not changed since the last one.
            if (!isRunning && slot.startMinutes - nowMinutes in 1..60) {
                candidates += nowMinutes + 1
            }
        }
        return candidates.firstOrNull { it > nowMinutes }
    }

    companion object {
        private const val MAX = 8

        fun from(data: SharedPreferences, calendar: Calendar = Calendar.getInstance()): Schedule {
            val now = calendar.get(Calendar.HOUR_OF_DAY) * 60 + calendar.get(Calendar.MINUTE)
            // Calendar counts Sunday as 1; the app writes the week with Sunday
            // at index 0, matching Dart's `weekday % 7`.
            val today = calendar.get(Calendar.DAY_OF_WEEK) - 1
            val slots = week(data, today) ?: legacy(data)
            return Schedule(slots.sortedBy { it.startMinutes }, now)
        }

        /**
         * Whether [weekday] (0=Sunday) holds a CodeForge session — a Technical
         * Hour — on the published timetable.
         *
         * Read for the daily refresh alarm, which fires only on the days a
         * CodeForge session actually falls, rather than every morning. Returns
         * false when the week cannot be read, which stops the alarm rather than
         * firing it blind.
         */
        fun hasTechnicalOn(data: SharedPreferences, weekday: Int): Boolean {
            val day = week(data, weekday) ?: return false
            return day.any { it.type == "technical" }
        }

        /** Today's classes out of the week the app published. */
        private fun week(data: SharedPreferences, day: Int): List<ClassSlot>? {
            val raw = data.getString("week", null) ?: return null
            return try {
                val days = JSONArray(raw)
                if (day !in 0 until days.length()) return emptyList()
                val today = days.getJSONArray(day)
                (0 until minOf(today.length(), MAX)).mapNotNull { i ->
                    val slot = today.getJSONObject(i)
                    val start = slot.optString("s")
                    val end = slot.optString("e")
                    if (start.isEmpty() || end.isEmpty()) return@mapNotNull null
                    ClassSlot(
                        start = start,
                        end = end,
                        subject = slot.optString("n"),
                        short = slot.optString("a"),
                        venue = slot.optString("v"),
                        faculty = slot.optString("f"),
                        type = slot.optString("t", "lecture"),
                    )
                }
            } catch (_: Exception) {
                // A widget that throws shows "Problem loading widget" until it
                // is removed and placed again, which is a worse failure than
                // anything it could have drawn. Malformed data falls back.
                null
            }
        }

        /**
         * The single day the previous version of the app used to save.
         *
         * Only reachable between installing an update and next opening Handy:
         * the new key is written on the first publish. Without this the widgets
         * would sit blank for however long that gap turns out to be.
         */
        private fun legacy(data: SharedPreferences): List<ClassSlot> {
            val count = data.getInt("schedCount", 0).coerceIn(0, MAX)
            return (0 until count).mapNotNull { i ->
                val start = data.getString("sched${i}Start", "") ?: ""
                val end = data.getString("sched${i}End", "") ?: ""
                if (start.isEmpty() || end.isEmpty()) return@mapNotNull null
                ClassSlot(
                    start = start,
                    end = end,
                    subject = data.getString("sched${i}Subject", "") ?: "",
                    short = data.getString("sched${i}Short", "") ?: "",
                    venue = data.getString("sched${i}Venue", "") ?: "",
                    faculty = data.getString("sched${i}Faculty", "") ?: "",
                )
            }
        }
    }
}
