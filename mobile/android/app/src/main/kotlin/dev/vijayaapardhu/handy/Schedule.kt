package dev.vijayaapardhu.handy

import android.content.SharedPreferences
import java.util.Calendar

/**
 * The day's classes, read straight from what the app saved, with the clock
 * applied here rather than in Dart.
 *
 * This is the difference between a widget that is right and one that was right
 * the last time the app was open. A countdown computed in the app is correct
 * for the instant it is written and wrong from then on; a student who has not
 * opened Handy since yesterday would be looking at yesterday's next class. The
 * app now saves the raw schedule and this picks the next class and phrases the
 * countdown at draw time — which happens on the update timer, on resize, and
 * after a reboot, with the app closed throughout.
 */
data class ClassSlot(
    val start: String,
    val end: String,
    val subject: String,
    val venue: String,
    val faculty: String,
) {
    val startMinutes get() = minutesOf(start)
    val endMinutes get() = minutesOf(end)
}

/** "09:30" -> 570. Returns -1 for anything unparseable, which sorts first. */
fun minutesOf(hhmm: String): Int {
    val parts = hhmm.split(":")
    if (parts.size != 2) return -1
    val h = parts[0].toIntOrNull() ?: return -1
    val m = parts[1].toIntOrNull() ?: return -1
    return h * 60 + m
}

class Schedule(private val slots: List<ClassSlot>, private val nowMinutes: Int) {

    val count get() = slots.size
    val finished get() = slots.count { it.endMinutes in 0 until nowMinutes }
    val remaining get() = count - finished

    /** The class you are in, or the next one you are heading to. */
    val next: ClassSlot? get() = slots.firstOrNull { it.endMinutes >= nowMinutes }

    val isRunning: Boolean
        get() = next?.let { nowMinutes in it.startMinutes until it.endMinutes } ?: false

    /**
     * "IN 41 MIN" / "NOW · ENDS 12:10" / "STARTS 09:30 TOMORROW".
     *
     * Deliberately coarse past an hour: the widget redraws on a timer, so a
     * minute-accurate figure three hours out would be visibly wrong most of
     * the time. Under an hour it is worth the precision and the redraws are
     * close enough together to keep it honest.
     */
    fun countdown(): String {
        val slot = next ?: return if (count == 0) "" else "DONE FOR TODAY"
        if (nowMinutes in slot.startMinutes until slot.endMinutes) {
            return "NOW · ENDS ${slot.end}"
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

    companion object {
        private const val MAX = 8

        fun from(data: SharedPreferences, calendar: Calendar = Calendar.getInstance()): Schedule {
            val count = data.getInt("schedCount", 0).coerceIn(0, MAX)
            val slots = (0 until count).mapNotNull { i ->
                val start = data.getString("sched${i}Start", "") ?: ""
                val end = data.getString("sched${i}End", "") ?: ""
                if (start.isEmpty() || end.isEmpty()) return@mapNotNull null
                ClassSlot(
                    start = start,
                    end = end,
                    subject = data.getString("sched${i}Subject", "") ?: "",
                    venue = data.getString("sched${i}Venue", "") ?: "",
                    faculty = data.getString("sched${i}Faculty", "") ?: "",
                )
            }.sortedBy { it.startMinutes }

            val now = calendar.get(Calendar.HOUR_OF_DAY) * 60 + calendar.get(Calendar.MINUTE)
            return Schedule(slots, now)
        }
    }
}
