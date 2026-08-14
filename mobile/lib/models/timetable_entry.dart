/// Mirrors TimetableEntryDoc in src/types/timetable.ts.
class TimetableEntry {
  const TimetableEntry({
    required this.id,
    required this.timetableVersionId,
    required this.dayOfWeek,
    required this.startTime,
    required this.endTime,
    required this.subjectId,
    required this.facultyName,
    required this.room,
    required this.block,
    required this.periodNo,
    required this.type,
    required this.active,
  });

  final String id;
  final String timetableVersionId;

  /// 0 = Sunday .. 6 = Saturday, matching DateTime.weekday % 7.
  final int dayOfWeek;
  final String startTime; // "HH:mm"
  final String endTime;
  final String subjectId;
  final String facultyName;
  final String? room;

  /// Building the room sits in — "AGBI-2.1" and "RB-221" are different places.
  final String? block;
  final int? periodNo;
  final String type; // lecture | lab | technical | break | activity
  final bool active;

  factory TimetableEntry.fromMap(String id, Map<String, dynamic> data) {
    return TimetableEntry(
      id: id,
      timetableVersionId: data['timetableVersionId'] as String? ?? '',
      dayOfWeek: (data['dayOfWeek'] as num?)?.toInt() ?? 0,
      startTime: data['startTime'] as String? ?? '',
      endTime: data['endTime'] as String? ?? '',
      subjectId: data['subjectId'] as String? ?? '',
      facultyName: data['facultyName'] as String? ?? '',
      room: data['room'] as String?,
      block: data['block'] as String?,
      periodNo: (data['periodNo'] as num?)?.toInt(),
      type: data['type'] as String? ?? 'lecture',
      active: data['active'] as bool? ?? true,
    );
  }
}
