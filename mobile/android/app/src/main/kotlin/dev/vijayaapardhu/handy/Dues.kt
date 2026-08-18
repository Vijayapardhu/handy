package dev.vijayaapardhu.handy

import android.content.SharedPreferences
import org.json.JSONArray
import java.util.Calendar
import java.util.TimeZone

/**
 * What is due, with the countdown phrased here rather than in Dart.
 *
 * The same argument as Schedule: "2 days left" is a sentence about the moment
 * it was written. Saved as English it stayed at two days for as long as the
 * student left the app alone, and on the morning it was actually due the
 * widget was still promising two days. The due *date* travels instead and the
 * phrasing happens at draw time.
 *
 * A whole day count, not a timestamp — a deadline is a date, and measuring it
 * in hours would flip "1 day left" at some arbitrary point in the evening.
 * This mirrors getDeadline in lib/logic/deadlines.dart; the two have to agree,
 * because the same deadline is read on the Today screen and on the widget.
 */
data class Due(val title: String, val dueOn: Long?, val steps: String, val saidWhen: String) {

    /** "Due today" / "Due tomorrow" / "3 days left" / "2 days overdue". */
    fun label(today: Long): String {
        // No date means these came from the keys the previous version wrote,
        // where the phrase was all there was. Stale, but it is that or blank.
        val due = dueOn ?: return saidWhen
        val days = due - today
        return when {
            days < 0 -> {
                val overdue = -days
                if (overdue == 1L) "1 day overdue" else "$overdue days overdue"
            }
            days == 0L -> "Due today"
            days == 1L -> "Due tomorrow"
            else -> "$days days left"
        }
    }
}

object Dues {
    /** Dues shows three rows, Overview four. */
    private const val MAX = 4

    fun from(data: SharedPreferences): List<Due> = published(data) ?: legacy(data)

    /**
     * Whole days since the epoch for the local calendar date.
     *
     * Built from the local Y/M/D reinterpreted as UTC, which is exactly what
     * Dart's `DateTime.utc(y, m, d)` does — so a deadline is the same number
     * of days away on both sides of the divide, in any timezone.
     */
    fun today(calendar: Calendar = Calendar.getInstance()): Long {
        val utc = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        utc.clear()
        utc.set(
            calendar.get(Calendar.YEAR),
            calendar.get(Calendar.MONTH),
            calendar.get(Calendar.DAY_OF_MONTH),
        )
        return Math.floorDiv(utc.timeInMillis, 86_400_000L)
    }

    private fun published(data: SharedPreferences): List<Due>? {
        val raw = data.getString("dues", null) ?: return null
        return try {
            val items = JSONArray(raw)
            (0 until minOf(items.length(), MAX)).mapNotNull { i ->
                val item = items.getJSONObject(i)
                val title = item.optString("t")
                if (title.isEmpty()) return@mapNotNull null
                Due(
                    title = title,
                    dueOn = if (item.has("d")) item.optLong("d") else null,
                    steps = item.optString("s"),
                    saidWhen = "",
                )
            }
        } catch (_: Exception) {
            null
        }
    }

    /** The keys the previous version wrote — see Schedule.legacy. */
    private fun legacy(data: SharedPreferences): List<Due> =
        (0 until MAX).mapNotNull { i ->
            val title = data.getString("due${i}Title", "") ?: ""
            if (title.isEmpty()) return@mapNotNull null
            Due(
                title = title,
                dueOn = null,
                steps = data.getString("due${i}Steps", "") ?: "",
                saidWhen = data.getString("due${i}When", "") ?: "",
            )
        }
}
