/// Timetable derivations — ported from src/lib/calculations/timetable.ts.
library;

import '../models/timetable_entry.dart';

class FreePeriod {
  const FreePeriod({required this.periodNo, required this.startTime, required this.endTime});
  final int periodNo;
  final String startTime;
  final String endTime;
}

List<TimetableEntry> entriesForDay(List<TimetableEntry> entries, int dayOfWeek) {
  final today = entries.where((e) => e.active && e.dayOfWeek == dayOfWeek).toList()
    ..sort((a, b) => a.startTime.compareTo(b.startTime));
  return today;
}

/// The class you're in or heading to — the first one that hasn't ended yet.
TimetableEntry? nextEntry(List<TimetableEntry> entries, int dayOfWeek, String nowHm) {
  for (final entry in entriesForDay(entries, dayOfWeek)) {
    if (entry.endTime.compareTo(nowHm) >= 0) return entry;
  }
  return null;
}

/// Periods in the week's grid with no class on [dayOfWeek].
///
/// The portal sends rows only for periods actually taught, so a missing row is
/// a free period. Times are recovered from the same period on another day,
/// since a period keeps its slot all week.
List<FreePeriod> freePeriods(List<TimetableEntry> entries, int dayOfWeek) {
  final timesByPeriod = <int, ({String start, String end})>{};
  for (final entry in entries) {
    final period = entry.periodNo;
    if (period != null && !timesByPeriod.containsKey(period)) {
      timesByPeriod[period] = (start: entry.startTime, end: entry.endTime);
    }
  }

  final busy = entries
      .where((e) => e.active && e.dayOfWeek == dayOfWeek)
      .map((e) => e.periodNo)
      .toSet();

  final free = timesByPeriod.entries
      .where((e) => !busy.contains(e.key))
      .map((e) => FreePeriod(periodNo: e.key, startTime: e.value.start, endTime: e.value.end))
      .toList()
    ..sort((a, b) => a.startTime.compareTo(b.startTime));
  return free;
}

/// A run of consecutive periods of the same subject, shown as one block.
///
/// The portal models a three-hour lab as three separate period rows. Listing
/// them separately is technically faithful and practically useless — a student
/// reading "Technical Hour" three times in a row has to work out for
/// themselves that it's one long session.
class ClassBlock {
  const ClassBlock({required this.entries});

  final List<TimetableEntry> entries;

  TimetableEntry get first => entries.first;
  String get startTime => entries.first.startTime;
  String get endTime => entries.last.endTime;
  int get periods => entries.length;
  bool get isMerged => entries.length > 1;
}

/// Groups a day's classes into blocks, merging neighbours that share a subject.
///
/// "Neighbouring" is by position in the sorted day, not by clock time: the
/// portal's periods butt up against each other but a lunch gap doesn't, and a
/// morning and afternoon session of the same subject should stay separate.
List<ClassBlock> classBlocksForDay(List<TimetableEntry> entries, int dayOfWeek) {
  final day = entriesForDay(entries, dayOfWeek);
  if (day.isEmpty) return [];

  final blocks = <ClassBlock>[];
  var current = <TimetableEntry>[day.first];

  for (final entry in day.skip(1)) {
    final previous = current.last;
    // Same subject *and* actually adjacent — the next period starts when the
    // last one ended, give or take the portal's ten-minute changeover.
    final adjacent = entry.subjectId == previous.subjectId &&
        _minutesBetween(previous.endTime, entry.startTime) <= 15;

    if (adjacent) {
      current.add(entry);
    } else {
      blocks.add(ClassBlock(entries: current));
      current = [entry];
    }
  }
  blocks.add(ClassBlock(entries: current));
  return blocks;
}

int _minutesBetween(String from, String to) {
  int minutes(String hhmm) {
    final parts = hhmm.split(':');
    return (int.tryParse(parts.first) ?? 0) * 60 + (parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0);
  }

  return minutes(to) - minutes(from);
}
