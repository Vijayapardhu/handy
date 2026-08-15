import 'package:flutter/material.dart';

import '../data/settings.dart';
import '../main.dart';

/// Everything about how the home-screen widgets look and what they say.
///
/// Split out of Settings because it grew past the point where it could be one
/// section among five: palette, text colour, typeface, row count, and the
/// order of the Overview widget's blocks. Every change republishes
/// immediately — a widget preference that lands half an hour later reads as
/// broken, and the home screen is where the student is looking when they
/// change it.
class WidgetSettingsScreen extends StatelessWidget {
  const WidgetSettingsScreen({super.key});

  static Future<void> _apply(Future<void> Function() change) async {
    await change();
    await appState.pushToWidget();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Widgets')),
      body: ListenableBuilder(
        listenable: settings,
        builder: (context, _) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 36),
          children: [
            Text(
              'Long-press your home screen, choose Widgets, then Handy. There '
              'are five: next class, attendance, today, deadlines, and Overview '
              '— the one you arrange below.',
              style: Theme.of(context).textTheme.bodySmall,
            ),

            const SizedBox(height: 22),
            const _Label('Colour'),
            const SizedBox(height: 10),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: WidgetStyle.values.map((style) {
                    final selected = style == settings.widgetStyle;
                    return GestureDetector(
                      onTap: () => _apply(() => settings.setWidgetStyle(style)),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 180),
                            width: 46,
                            height: 46,
                            decoration: BoxDecoration(
                              color: style.swatch,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: selected
                                    ? Theme.of(context).colorScheme.onSurface
                                    : Theme.of(context).dividerColor,
                                width: selected ? 2.5 : 1,
                              ),
                            ),
                            child: selected
                                ? Icon(
                                    Icons.check,
                                    size: 20,
                                    // Light swatches need a dark tick; the
                                    // same white tick on white is invisible.
                                    color: style == WidgetStyle.light
                                        ? Colors.black
                                        : Colors.white,
                                  )
                                : null,
                          ),
                          const SizedBox(height: 6),
                          SizedBox(
                            width: 52,
                            child: Text(
                              style.label,
                              textAlign: TextAlign.center,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),

            const SizedBox(height: 22),
            const _Label('Text colour'),
            const SizedBox(height: 10),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: widgetTextColours.map((choice) {
                        return ChoiceChip(
                          label: Text(choice.label),
                          selected: settings.widgetTextColour == choice.hex,
                          avatar: choice.hex.isEmpty
                              ? null
                              : CircleAvatar(
                                  backgroundColor: Color(
                                    int.parse(choice.hex.substring(1), radix: 16) | 0xFF000000,
                                  ),
                                ),
                          onSelected: (_) =>
                              _apply(() => settings.setWidgetTextColour(choice.hex)),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Auto follows the colour you picked above, which already '
                      'pairs a background with text that stays readable on it.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 22),
            const _Label('Font'),
            const SizedBox(height: 10),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: WidgetFont.values.map((font) {
                    return ChoiceChip(
                      label: Text(font.label),
                      selected: settings.widgetFont == font,
                      onSelected: (_) => _apply(() => settings.setWidgetFont(font)),
                    );
                  }).toList(),
                ),
              ),
            ),

            const SizedBox(height: 22),
            const _Label('Overview widget'),
            const SizedBox(height: 10),
            Card(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Drag to reorder. The widget shows as many as fit, from '
                      'the top — so put what matters first.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 8),
                    _BlockOrder(onChanged: (b) => _apply(() => settings.setWidgetBlocks(b))),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 22),
            const _Label('List widgets'),
            const SizedBox(height: 10),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      value: settings.widgetShowFaculty,
                      onChanged: (v) => _apply(() => settings.setWidgetShowFaculty(v)),
                      title: const Text('Show faculty name', style: TextStyle(fontSize: 14)),
                      subtitle: Text('On the next-class widget',
                          style: Theme.of(context).textTheme.bodySmall),
                    ),
                    Text('Rows', style: Theme.of(context).textTheme.bodySmall),
                    const SizedBox(height: 8),
                    Row(
                      children: [2, 3, 4].map((rows) {
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ChoiceChip(
                            label: Text('$rows'),
                            selected: settings.widgetRows == rows,
                            onSelected: (_) => _apply(() => settings.setWidgetRows(rows)),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Drag-to-reorder list of Overview blocks, with the unused ones underneath.
///
/// One list rather than two panes: reordering and turning things on are the
/// same decision here, and a student who wants attendance first should not
/// have to find it in a second list before they can move it.
class _BlockOrder extends StatelessWidget {
  const _BlockOrder({required this.onChanged});

  final ValueChanged<List<WidgetBlock>> onChanged;

  @override
  Widget build(BuildContext context) {
    final chosen = settings.widgetBlocks;
    final rest = WidgetBlock.values.where((b) => !chosen.contains(b)).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ReorderableListView(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          buildDefaultDragHandles: false,
          onReorder: (from, to) {
            final next = [...chosen];
            // ReorderableListView reports the destination index as if the
            // dragged item were still in place, so anything moving down lands
            // one too far without this.
            if (to > from) to -= 1;
            next.insert(to, next.removeAt(from));
            onChanged(next);
          },
          children: [
            for (var i = 0; i < chosen.length; i++)
              ListTile(
                key: ValueKey(chosen[i]),
                contentPadding: EdgeInsets.zero,
                leading: ReorderableDragStartListener(
                  index: i,
                  child: const Icon(Icons.drag_handle, size: 20),
                ),
                title: Text(chosen[i].label, style: const TextStyle(fontSize: 14.5)),
                subtitle: Text(chosen[i].detail,
                    style: Theme.of(context).textTheme.bodySmall),
                trailing: IconButton(
                  tooltip: 'Remove',
                  // The last block cannot be removed: an empty widget is a
                  // blank rectangle on the home screen with no way back.
                  onPressed: chosen.length == 1
                      ? null
                      : () => onChanged([...chosen]..removeAt(i)),
                  icon: const Icon(Icons.remove_circle_outline, size: 20),
                ),
              ),
          ],
        ),
        if (rest.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text('ADD', style: Theme.of(context).textTheme.labelSmall),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: rest
                .map((block) => ActionChip(
                      avatar: const Icon(Icons.add, size: 16),
                      label: Text(block.label),
                      onPressed: () => onChanged([...chosen, block]),
                    ))
                .toList(),
          ),
          const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text);
  final String text;

  @override
  Widget build(BuildContext context) =>
      Text(text.toUpperCase(), style: Theme.of(context).textTheme.labelSmall);
}
