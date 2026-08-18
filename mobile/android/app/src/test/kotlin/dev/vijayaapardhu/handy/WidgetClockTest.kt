package dev.vijayaapardhu.handy

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * The clock work the widgets now do for themselves.
 *
 * All of it used to be done in Dart and saved as finished English, which is
 * why it never needed testing and never worked: a phrase written at 09:00 is
 * not a claim about 14:00, and nobody was there to rewrite it. Now the tiles
 * work it out at draw time, so what they work out is worth checking at the
 * hours nobody is looking — the minute a class ends, the minute before
 * midnight, the afternoon after the last lecture.
 */
class WidgetClockTest {

    private fun slot(start: String, end: String, subject: String = "Maths") =
        ClassSlot(start, end, subject, "", "", "")

    private val day = listOf(
        slot("09:30", "10:20", "Maths"),
        slot("11:00", "11:50", "Physics"),
        slot("14:00", "14:50", "Lab"),
    )

    private fun at(hhmm: String) = Schedule(day, minutesOf(hhmm))

    // — which class is next —

    @Test
    fun `a class ending this minute is over`() {
        // The boundary that used to announce a just-finished class as
        // "starting now": at exactly 10:20 the 09:30 class is done.
        assertEquals("Physics", at("10:20").next?.subject)
    }

    @Test
    fun `a running class is the next one`() {
        assertEquals("Maths", at("09:45").next?.subject)
        assertEquals(true, at("09:45").isRunning)
    }

    @Test
    fun `nothing is next once the day is over`() {
        assertNull(at("15:00").next)
    }

    // — how it is phrased —

    @Test
    fun `countdown counts the minutes inside the hour`() {
        assertEquals("IN 41 MIN", at("08:49").countdown())
    }

    @Test
    fun `countdown goes coarse beyond the hour`() {
        assertEquals("IN ABOUT AN HOUR", at("08:00").countdown())
        assertEquals("AT 09:30", at("07:00").countdown())
    }

    @Test
    fun `countdown names the end of a running class`() {
        assertEquals("ONGOING · ENDS 10:20", at("09:45").countdown())
    }

    @Test
    fun `countdown says so once the day is done`() {
        assertEquals("DONE FOR TODAY", at("15:00").countdown())
        assertEquals("", Schedule(emptyList(), minutesOf("15:00")).countdown())
    }

    @Test
    fun `day label turns over as classes finish`() {
        assertEquals("3 classes today", at("08:00").dayLabel())
        assertEquals("2 of 3 left", at("10:30").dayLabel())
        assertEquals("Day done", at("15:00").dayLabel())
        assertEquals("No classes today", Schedule(emptyList(), 600).dayLabel())
    }

    // — the list —

    @Test
    fun `agenda drops what has already finished`() {
        assertEquals(listOf("Physics", "Lab"), at("10:30").agenda.map { it.subject })
    }

    @Test
    fun `agenda falls back to the whole day once it is over`() {
        // Better than an empty box under "Day done".
        assertEquals(3, at("15:00").agenda.size)
    }

    // — when to redraw —

    @Test
    fun `redraws every minute inside the hour before a class`() {
        assertEquals(minutesOf("08:50"), at("08:49").nextChangeMinutes())
    }

    @Test
    fun `redraws only at the phrasing boundaries further out`() {
        // 07:00 is more than two hours off the 09:30 start, so the next thing
        // that changes is "AT 09:30" becoming "IN ABOUT AN HOUR".
        assertEquals(minutesOf("07:30"), at("07:00").nextChangeMinutes())
        assertEquals(minutesOf("08:30"), at("07:45").nextChangeMinutes())
    }

    @Test
    fun `a running class redraws when it ends`() {
        // Nothing it shows changes before then, so nothing wakes up before
        // then — not even at 10:00, when the 11:00 lecture comes within the
        // hour but is not the class the tile is counting down to.
        assertEquals(minutesOf("10:20"), at("09:45").nextChangeMinutes())
    }

    @Test
    fun `nothing left to redraw after the last class`() {
        // Null is the signal to fall back to midnight, where the day label and
        // every deadline turn over.
        assertNull(at("15:00").nextChangeMinutes())
        assertNull(Schedule(emptyList(), minutesOf("09:00")).nextChangeMinutes())
    }

    // — deadlines —

    @Test
    fun `deadline label is phrased against today, not against the day it was saved`() {
        val due = Due(title = "Report", dueOn = 20_000, steps = "", saidWhen = "")
        assertEquals("4 days left", due.label(19_996))
        assertEquals("Due tomorrow", due.label(19_999))
        assertEquals("Due today", due.label(20_000))
        assertEquals("1 day overdue", due.label(20_001))
        assertEquals("3 days overdue", due.label(20_003))
    }

    @Test
    fun `a deadline saved by the old app keeps the phrase it came with`() {
        // Stale, but it is that or a blank column for the one launch it takes
        // the updated app to publish real dates.
        val legacy = Due(title = "Report", dueOn = null, steps = "", saidWhen = "2 days left")
        assertEquals("2 days left", legacy.label(20_000))
    }
}
