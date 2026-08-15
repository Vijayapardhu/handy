"""One-off sweep: Material `Icons.*` -> Hugeicons, via the AppIcon wrapper.

Kept in the repo rather than run and thrown away, because the mapping *is* the
decision. Which Hugeicon stands in for `Icons.donut_small` is a judgement, and
the next person to add a screen needs to see the same choices rather than
guess. Every target below was checked against the package's own name list
before this ran; a typo there is a compile error, not a missing glyph.

Re-running is harmless: nothing here matches an already-converted file.
"""
import io
import os
import re

MAP = {
    # Navigation
    'today_outlined': 'Calendar03', 'today': 'Calendar03',
    'donut_small_outlined': 'PieChart', 'donut_small': 'PieChart',
    'calendar_month_outlined': 'Calendar01', 'calendar_month': 'Calendar01',
    'checklist_outlined': 'TaskDone01', 'checklist': 'TaskDone01',
    'person_outline': 'User', 'person': 'UserCircle',

    # Chrome
    'chevron_right': 'ArrowRight01', 'chevron_left': 'ArrowLeft01',
    'add': 'Add01', 'close': 'Cancel01', 'check': 'Tick02',
    'search': 'Search01', 'tune': 'Settings02', 'logout': 'Logout01',
    'expand_more': 'ArrowDown01', 'expand_less': 'ArrowUp01',
    'drag_handle': 'DragDropVertical', 'remove_circle_outline': 'MinusSign',
    'open_in_new': 'LinkSquare01',

    # Account and settings
    'lock_outline': 'SquareLock01', 'school_outlined': 'Mortarboard01',
    'notifications_none': 'Notification01', 'dark_mode_outlined': 'Moon02',
    'help_outline': 'HelpCircle', 'mail_outline': 'Mail01',
    'info_outline': 'InformationCircle', 'widgets_outlined': 'DashboardSquare01',
    'public': 'Globe02', 'language': 'Globe02', 'code': 'SourceCode',
    'inventory_2_outlined': 'PackageOpen', 'settings': 'Settings02',
    'visibility_outlined': 'View', 'visibility_off_outlined': 'ViewOff',

    # Content
    'delete_outline': 'Delete02', 'edit_outlined': 'Edit02',
    'event': 'Calendar02', 'schedule': 'Clock01', 'place_outlined': 'Location01',
    'tag': 'Hashtag', 'repeat': 'Repeat', 'undo': 'ArrowTurnBackward',
    'menu_book_outlined': 'BookOpen01', 'category_outlined': 'Layers01',
    'sticky_note_2_outlined': 'Note01', 'flag_outlined': 'Flag02',
    'groups_outlined': 'UserGroup', 'free_breakfast_outlined': 'Coffee02',

    # State
    'check_circle': 'CheckmarkCircle02', 'check_circle_outline': 'CheckmarkCircle01',
    'priority_high': 'Alert02', 'trending_up': 'ChartUp', 'trending_down': 'ChartDown',
    'sync': 'Refresh', 'history': 'Clock04', 'play_circle_fill': 'PlayCircle',
    'event_available_outlined': 'CalendarCheckIn01', 'checklist_rtl': 'TaskDone02',
}


def sweep(lib='lib'):
    changed = []
    for root, _, files in os.walk(lib):
        for name in files:
            if not name.endswith('.dart'):
                continue
            path = os.path.join(root, name)
            if path.endswith(os.path.join('widgets', 'app_icon.dart')):
                continue

            original = io.open(path, encoding='utf-8').read()
            text = original

            # `Icon(` -> `AppIcon(`, without catching AppIcon/IconButton/etc.
            text = re.sub(r'\bconst Icon\(', 'AppIcon(', text)
            text = re.sub(r'(?<![A-Za-z])Icon\(', 'AppIcon(', text)
            text = re.sub(r'\bIconData\b', 'AppIconData', text)

            def swap(match):
                key = match.group(1)
                if key not in MAP:
                    return match.group(0)
                return 'HugeIcons.strokeRounded' + MAP[key]

            text = re.sub(r'Icons\.([a-zA-Z_0-9]+)', swap, text)
            if text == original:
                continue

            # A list of glyphs can no longer be const: Hugeicons are runtime
            # lists, where IconData was a compile-time constant.
            text = text.replace('static const _tabs = [', 'static final _tabs = [')

            if 'app_icon.dart' not in text:
                rel = os.path.relpath(
                    os.path.join(lib, 'widgets', 'app_icon.dart'), root,
                ).replace(os.sep, '/')
                imports = list(re.finditer(r"^import '.*';$", text, re.M))
                at = imports[-1].end()
                text = text[:at] + "\nimport '" + rel + "';" + text[at:]

            io.open(path, 'w', encoding='utf-8').write(text)
            changed.append(path)
    return changed


if __name__ == '__main__':
    for path in sweep():
        print('rewrote', path)
