package dev.vijayaapardhu.handy

import android.content.SharedPreferences
import android.graphics.Color
import android.text.SpannableString
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.text.style.TypefaceSpan

/**
 * How a widget looks: background, text colours, typeface.
 *
 * None of this lives in the layout XML. A colour written into a TextView there
 * cannot follow a palette change, which is exactly how the old widgets ended up
 * rendering slate-grey section headers on an orange background — the layout was
 * written for the dark theme and the accent background was applied over it.
 * Every colour and typeface is applied by the provider instead, from values the
 * app saved.
 */
data class WidgetLook(
    val background: Int,
    val primary: Int,
    val secondary: Int,
    val typeface: String?,
) {
    /**
     * Text with the chosen colour and typeface baked in as spans.
     *
     * RemoteViews has no setter for a typeface, but it parcels a CharSequence
     * with its spans intact, so a TypefaceSpan travels to the launcher's
     * process and applies there. Colour goes the same way rather than through
     * setTextColor, so a single call styles a view completely.
     */
    fun text(value: CharSequence?, colour: Int): CharSequence {
        val s = SpannableString(value ?: "")
        if (s.isEmpty()) return s
        s.setSpan(ForegroundColorSpan(colour), 0, s.length, Spanned.SPAN_INCLUSIVE_EXCLUSIVE)
        typeface?.let {
            s.setSpan(TypefaceSpan(it), 0, s.length, Spanned.SPAN_INCLUSIVE_EXCLUSIVE)
        }
        return s
    }

    fun primary(value: CharSequence?) = text(value, primary)
    fun secondary(value: CharSequence?) = text(value, secondary)
}

/**
 * Palettes a student can pick between. Each names a background drawable and the
 * two text colours that stay legible on it — the pairing is the point, since
 * choosing a background and a text colour independently is how people end up
 * with white on white.
 */
private val THEMES = mapOf(
    "accent" to Triple(R.drawable.widget_bg_accent, "#FFFFFF", "#FFE7D5"),
    "dark" to Triple(R.drawable.widget_bg_dark, "#F1F5F9", "#94A3B8"),
    "light" to Triple(R.drawable.widget_bg_light, "#0F172A", "#475569"),
    "midnight" to Triple(R.drawable.widget_bg_midnight, "#E2E8F0", "#8FA3C8"),
    "forest" to Triple(R.drawable.widget_bg_forest, "#ECFDF5", "#A7F3D0"),
    "rose" to Triple(R.drawable.widget_bg_rose, "#FFF1F2", "#FECDD3"),
    "slate" to Triple(R.drawable.widget_bg_slate, "#F8FAFC", "#CBD5E1"),
    "plum" to Triple(R.drawable.widget_bg_plum, "#F5F3FF", "#DDD6FE"),
)

/** Families TypefaceSpan understands on every Android version we support. */
private val FONTS = mapOf(
    "default" to null,
    "condensed" to "sans-serif-condensed",
    "serif" to "serif",
    "mono" to "monospace",
    "light" to "sans-serif-light",
    "medium" to "sans-serif-medium",
)

fun lookOf(data: SharedPreferences): WidgetLook {
    val theme = THEMES[data.getString("widgetStyle", "accent")] ?: THEMES["accent"]!!
    val (background, primaryHex, secondaryHex) = theme

    // An explicit text colour overrides the palette's primary but leaves the
    // secondary derived from it, so the hierarchy survives the override.
    val chosen = data.getString("widgetTextColour", "")?.takeIf { it.isNotEmpty() }
    val primary = chosen?.let { runCatching { Color.parseColor(it) }.getOrNull() }
        ?: Color.parseColor(primaryHex)
    val secondary = if (chosen == null) {
        Color.parseColor(secondaryHex)
    } else {
        // 70% of the chosen colour over the background reads as "quieter" on
        // any palette, which a second fixed hex would not.
        Color.argb(180, Color.red(primary), Color.green(primary), Color.blue(primary))
    }

    return WidgetLook(
        background = background,
        primary = primary,
        secondary = secondary,
        typeface = FONTS[data.getString("widgetFont", "default")],
    )
}
