package dev.vijayaapardhu.handy

import android.content.Context
import android.content.SharedPreferences
import android.view.View
import android.widget.RemoteViews

/**
 * The widget a student arranges themselves.
 *
 * The other four each answer one question. This one is a stack of blocks —
 * attendance, classes held, today's timetable, next class, what's due — that
 * the student turns on and orders in Settings. Four slots, because a home
 * screen tile that needs five is a screen, and past four the type is too small
 * to read at arm's length.
 *
 * Today's classes render as a table (time, subject, room) rather than as one
 * run-on line per class: the times line up down a column, which is what makes
 * a timetable scannable rather than merely present.
 */
class OverviewWidgetProvider : HandyBaseWidget() {
    override val layoutId = R.layout.widget_overview

    /** Ids for one slot, gathered so the render loop can stay readable. */
    private data class Slot(
        val root: Int,
        val header: Int,
        val value: Int,
        val sub: Int,
        val table: Int,
        val rows: List<Triple<Int, Int, Int>>,
        val rowRoots: List<Int>,
    )

    private val slots = listOf(
        Slot(
            R.id.slot0, R.id.slot0_header, R.id.slot0_value, R.id.slot0_sub, R.id.slot0_table,
            listOf(
                Triple(R.id.slot0_r0_c0, R.id.slot0_r0_c1, R.id.slot0_r0_c2),
                Triple(R.id.slot0_r1_c0, R.id.slot0_r1_c1, R.id.slot0_r1_c2),
                Triple(R.id.slot0_r2_c0, R.id.slot0_r2_c1, R.id.slot0_r2_c2),
                Triple(R.id.slot0_r3_c0, R.id.slot0_r3_c1, R.id.slot0_r3_c2),
            ),
            listOf(R.id.slot0_row0, R.id.slot0_row1, R.id.slot0_row2, R.id.slot0_row3),
        ),
        Slot(
            R.id.slot1, R.id.slot1_header, R.id.slot1_value, R.id.slot1_sub, R.id.slot1_table,
            listOf(
                Triple(R.id.slot1_r0_c0, R.id.slot1_r0_c1, R.id.slot1_r0_c2),
                Triple(R.id.slot1_r1_c0, R.id.slot1_r1_c1, R.id.slot1_r1_c2),
                Triple(R.id.slot1_r2_c0, R.id.slot1_r2_c1, R.id.slot1_r2_c2),
                Triple(R.id.slot1_r3_c0, R.id.slot1_r3_c1, R.id.slot1_r3_c2),
            ),
            listOf(R.id.slot1_row0, R.id.slot1_row1, R.id.slot1_row2, R.id.slot1_row3),
        ),
        Slot(
            R.id.slot2, R.id.slot2_header, R.id.slot2_value, R.id.slot2_sub, R.id.slot2_table,
            listOf(
                Triple(R.id.slot2_r0_c0, R.id.slot2_r0_c1, R.id.slot2_r0_c2),
                Triple(R.id.slot2_r1_c0, R.id.slot2_r1_c1, R.id.slot2_r1_c2),
                Triple(R.id.slot2_r2_c0, R.id.slot2_r2_c1, R.id.slot2_r2_c2),
                Triple(R.id.slot2_r3_c0, R.id.slot2_r3_c1, R.id.slot2_r3_c2),
            ),
            listOf(R.id.slot2_row0, R.id.slot2_row1, R.id.slot2_row2, R.id.slot2_row3),
        ),
        Slot(
            R.id.slot3, R.id.slot3_header, R.id.slot3_value, R.id.slot3_sub, R.id.slot3_table,
            listOf(
                Triple(R.id.slot3_r0_c0, R.id.slot3_r0_c1, R.id.slot3_r0_c2),
                Triple(R.id.slot3_r1_c0, R.id.slot3_r1_c1, R.id.slot3_r1_c2),
                Triple(R.id.slot3_r2_c0, R.id.slot3_r2_c1, R.id.slot3_r2_c2),
                Triple(R.id.slot3_r3_c0, R.id.slot3_r3_c1, R.id.slot3_r3_c2),
            ),
            listOf(R.id.slot3_row0, R.id.slot3_row1, R.id.slot3_row2, R.id.slot3_row3),
        ),
    )

    override fun render(
        context: Context,
        views: RemoteViews,
        data: SharedPreferences,
        size: WidgetSize,
    ) {
        val look = lookOf(data)
        val schedule = Schedule.from(data)
        val order = (data.getString("overviewBlocks", "attendance,today")
            ?: "attendance,today")
            .split(",")
            .map { it.trim() }
            .filter { it.isNotEmpty() }

        // Blocks are dropped from the bottom when the tile is short, in the
        // student's own order — the first thing they listed is the thing they
        // wanted to see, so it is the last thing to go.
        val room = ((size.height - 14) / 58).coerceIn(1, slots.size)

        slots.forEachIndexed { i, slot ->
            val block = order.getOrNull(i)
            if (block == null || i >= room) {
                views.show(slot.root, false)
                return@forEachIndexed
            }
            views.show(slot.root, true)
            renderBlock(views, slot, block, data, look, size, schedule)
        }
    }

    private fun renderBlock(
        views: RemoteViews,
        slot: Slot,
        block: String,
        data: SharedPreferences,
        look: WidgetLook,
        size: WidgetSize,
        schedule: Schedule,
    ) {
        // Every block starts from nothing showing, so a block that uses only a
        // value never inherits a stale table from the previous configuration.
        views.show(slot.value, false)
        views.show(slot.sub, false)
        views.show(slot.table, false)
        slot.rowRoots.forEach { views.show(it, false) }

        when (block) {
            "attendance" -> {
                header(views, slot, "Overall attendance", look)
                stat(
                    views, slot, look,
                    value = data.getString("attendance", "—"),
                    sub = data.getString("attendanceMeta", ""),
                    size = size,
                )
            }

            "held" -> {
                header(views, slot, "Classes", look)
                // A three-column table rather than a sentence: attended, held
                // and the gap between them are three numbers a student
                // compares, and comparing is what columns are for.
                val attended = data.getInt("attendedCount", 0)
                val held = data.getInt("heldCount", 0)
                views.show(slot.table, true)
                views.show(slot.rowRoots[0], true)
                row(views, slot, 0, look, "Attended", "$attended", "", bold = false)
                views.show(slot.rowRoots[1], true)
                row(views, slot, 1, look, "Held", "$held", "", bold = false)
                views.show(slot.rowRoots[2], true)
                row(views, slot, 2, look, "Missed", "${(held - attended).coerceAtLeast(0)}", "", bold = false)
            }

            "today" -> {
                header(views, slot, schedule.dayLabel(), look)
                views.show(slot.table, true)
                val agenda = schedule.agenda
                for (i in 0 until minOf(slot.rows.size, agenda.size)) {
                    val entry = agenda[i]
                    views.show(slot.rowRoots[i], true)
                    row(
                        views, slot, i, look,
                        entry.start,
                        entry.subject,
                        entry.venue,
                        bold = true,
                    )
                }
                if (agenda.isEmpty()) {
                    views.show(slot.table, false)
                    views.show(slot.sub, true)
                    views.setTextViewText(slot.sub, look.secondary("Nothing scheduled today"))
                }
            }

            "next" -> {
                val next = schedule.next
                val afterwards = if (schedule.isRunning) schedule.after else null
                header(views, slot, schedule.countdown().ifEmpty { "Next class" }, look)
                stat(
                    views, slot, look,
                    value = next?.subject?.ifEmpty { "Class" } ?: "No more classes today",
                    sub = listOfNotNull(
                        next?.let { "${it.start} – ${it.end}" },
                        next?.venue?.takeIf { it.isNotEmpty() },
                        // During a class, what follows is the useful half.
                        afterwards?.let { "then ${it.label} at ${it.start}" },
                    ).joinToString(" · "),
                    size = size,
                    // A subject name is words, not a figure, so it takes the
                    // body size and is allowed to wrap.
                    valueSize = 16f,
                    valueLines = 2,
                )
            }

            "dues" -> {
                header(views, slot, data.getString("tasks", "Due"), look)
                views.show(slot.table, true)
                val due = Dues.from(data)
                val today = Dues.today()
                for (i in 0 until minOf(slot.rows.size, due.size)) {
                    val item = due[i]
                    views.show(slot.rowRoots[i], true)
                    row(
                        views, slot, i, look,
                        item.steps,
                        item.title,
                        // Phrased now, not when the app last ran: a deadline
                        // saved as "2 days left" was still saying so on the
                        // morning it was due. See Dues.
                        item.label(today),
                        bold = false,
                    )
                }
                if (due.isEmpty()) {
                    views.show(slot.table, false)
                    views.show(slot.sub, true)
                    views.setTextViewText(slot.sub, look.secondary("Nothing due"))
                }
            }
        }
    }

    private fun header(views: RemoteViews, slot: Slot, text: String?, look: WidgetLook) {
        views.setTextViewText(slot.header, look.secondary(text))
    }

    private fun stat(
        views: RemoteViews,
        slot: Slot,
        look: WidgetLook,
        value: String?,
        sub: String?,
        size: WidgetSize,
        valueSize: Float? = null,
        valueLines: Int = 1,
    ) {
        views.show(slot.value, true)
        views.setTextViewText(slot.value, look.primary(value))
        views.setInt(slot.value, "setMaxLines", valueLines)
        views.textSize(
            slot.value,
            valueSize ?: when {
                size.width >= 250 -> 30f
                size.width >= 180 -> 26f
                else -> 21f
            },
        )
        if (!sub.isNullOrEmpty()) {
            views.show(slot.sub, true)
            views.setTextViewText(slot.sub, look.secondary(sub))
            // Two lines, because a room and a building on one line is exactly
            // the string that used to get cut off mid-word.
            views.setInt(slot.sub, "setMaxLines", if (size.width >= 250) 1 else 2)
        }
    }

    private fun row(
        views: RemoteViews,
        slot: Slot,
        index: Int,
        look: WidgetLook,
        left: String,
        middle: String,
        right: String,
        bold: Boolean,
    ) {
        val (c0, c1, c2) = slot.rows[index]
        views.setTextViewText(c0, look.secondary(left))
        views.setTextViewText(c1, if (bold) look.primary(middle) else look.primary(middle))
        views.setTextViewText(c2, look.secondary(right))
    }
}
