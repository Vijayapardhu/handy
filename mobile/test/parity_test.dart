import 'package:flutter_test/flutter_test.dart';
import 'package:handy/logic/attendance.dart';
import 'package:handy/logic/campus.dart';
import 'package:handy/logic/campus_features.dart';
import 'package:handy/logic/hub_status.dart';
import 'package:handy/models/hub_attendance.dart';
import 'package:handy/models/models.dart';

/// The rules the phone now shares with the website.
///
/// Everything here exists on both sides — which features a campus gets, how a
/// Hub percentage is graded, where a projection lands, what a leave request
/// looks like coming back out of Firestore. A student comparing the two must
/// never see two different answers, so both sides are pinned rather than left
/// to drift.
void main() {
  group('campus features', () {
    test('portal-login campuses lose the surfaces their portal cannot fill', () {
      // AEC, ACET and AGBS are read by signing into their portal, which
      // exposes attendance but no timetable and no lecturer.
      for (final roll in ['24A91A0501', '23P31A0341', '23A91M0035']) {
        final features = campusFeaturesFor(roll);
        expect(features.hasTimetable, isFalse, reason: roll);
        expect(features.hasClassGroups, isFalse, reason: roll);
      }
    });

    test('Aditya University keeps everything', () {
      final features = campusFeaturesFor('23B81A05B1');
      expect(features.campus, Campus.aus);
      expect(features.hasTimetable, isTrue);
      expect(features.hasClassGroups, isTrue);
    });

    test('an unplaceable roll keeps everything rather than losing a tab', () {
      // Matches useCampusFeatures: someone Handy cannot place is far more
      // likely to be at the university than to be someone whose features
      // should quietly vanish. The demo student's A31 is one of these.
      for (final roll in ['23A31A05B1', '', 'nonsense']) {
        final features = campusFeaturesFor(roll);
        expect(features.hasTimetable, isTrue, reason: roll);
      }
      expect(campusFeaturesFor(null).hasTimetable, isTrue);
    });

    test('a numeric AGBS admission number is not gated on a guess', () {
      // fallbackCampus would call this AGBS to offer it a password prompt,
      // where a wrong guess costs one failed attempt. Taking a tab away on
      // the same guess is not the same trade, so gating ignores it.
      expect(fallbackCampus('240218301030'), Campus.agbs);
      expect(campusFeaturesFor('240218301030').hasTimetable, isTrue);
    });
  });

  group('hub status', () {
    test('bands match HUB_STATUS_THRESHOLDS on the web', () {
      expect(hubStatus(null), HubStatus.na);
      expect(hubStatus(0), HubStatus.critical);
      expect(hubStatus(49.9), HubStatus.critical);
      expect(hubStatus(50), HubStatus.low);
      expect(hubStatus(64.9), HubStatus.low);
      expect(hubStatus(65), HubStatus.average);
      expect(hubStatus(74.9), HubStatus.average);
      expect(hubStatus(75), HubStatus.good);
      expect(hubStatus(89.9), HubStatus.good);
      expect(hubStatus(90), HubStatus.excellent);
      expect(hubStatus(100), HubStatus.excellent);
    });
  });

  group('hub snapshot', () {
    HubCourse course(String name, double? percent) => HubCourse(
          batchId: 'b',
          technologyId: name,
          courseName: name,
          technologyName: name,
          modules: const [],
          totalSessions: 0,
          attendedSessions: 0,
          percentage: percent,
        );

    test('courses that have run sort first, worst first', () {
      final snapshot = HubAttendanceSnapshot(
        studentName: null,
        rollNumber: null,
        courses: [course('Verbal', 80), course('Zeta', null), course('Arith', 40)],
        totalSessions: 0,
        attendedSessions: 0,
        percentage: null,
        fetchedAt: null,
      );

      expect(
        snapshot.sortedCourses.map((c) => c.technologyName),
        ['Arith', 'Verbal', 'Zeta'],
      );
    });

    test('a batch and a technology together identify a course', () {
      // A student can sit the same course in two batches; batchId alone
      // would collapse them into one accordion.
      expect(course('Arith', null).key, 'b_Arith');
    });

    test('a lone topic named after its module is not worth a second line', () {
      const module = HubModule(
        moduleId: 'm',
        moduleName: 'Loops',
        topics: [HubTopic(topicName: 'loops', totalSessions: 2, attendedCount: 1)],
        totalSessions: 2,
        attendedSessions: 1,
      );
      expect(module.hasDistinctTopics, isFalse);
      expect(module.started, isTrue);
    });

    test('a module with nothing held has not started', () {
      const module = HubModule(
        moduleId: 'm',
        moduleName: 'Recursion',
        topics: [],
        totalSessions: 0,
        attendedSessions: 0,
      );
      expect(module.started, isFalse);
      expect(module.hasDistinctTopics, isFalse);
    });
  });

  group('planner projections', () {
    test('turning up from here moves the figure, missing more does not', () {
      // 32/47 is the real DMS row from the sample capture. Twenty more
      // attended in a row: 52/67.
      expect(roundPercentage(projectedAfter(32, 47, 20)), 77.61);
      // The same twenty with five missed alongside them.
      expect(roundPercentage(projectedAfter(32, 47, 20, 5)), 72.22);
    });

    test('projecting nothing leaves the figure where it was', () {
      expect(roundPercentage(projectedAfter(32, 47, 0)), roundPercentage(calculateAttendance(32, 47)));
    });

    test('a subject with nothing held has nothing to project from', () {
      expect(projectedAfter(0, 0, 0), isNull);
      // Once classes are attended there is something to divide by.
      expect(projectedAfter(0, 0, 4), 100);
    });
  });

  group('subject target', () {
    test("a subject's own target wins, and the college's is the fallback", () {
      // Mirrors subjectService.ts: subject.targetAttendance ?? config minimum.
      const withOwn = Subject(
        id: 's',
        code: 'C',
        name: 'N',
        shortName: 'N',
        facultyName: '',
        targetAttendance: 80,
      );
      const withNone = Subject(id: 's', code: 'C', name: 'N', shortName: 'N', facultyName: '');

      expect(withOwn.targetAttendance, 80);
      expect(withNone.targetAttendance, isNull);
    });

    test('an unprovisioned college still renders against a sane default', () {
      expect(CollegeConfig.fromMap(const {}).minimumAttendancePercentage, 75);
      expect(
        CollegeConfig.fromMap(const {'minimumAttendancePercentage': 80})
            .minimumAttendancePercentage,
        80,
      );
    });
  });

  group('leave requests', () {
    LeaveRequest parse(Map<String, dynamic> d) => LeaveRequest.fromMap('id', d);

    test('a one-day leave is one day, not zero', () {
      final request = parse({
        'startDate': '2026-03-02',
        'endDate': '2026-03-02',
        'reason': 'Medical',
        'status': 'pending',
        'submittedAt': '2026-03-01T09:00:00.000Z',
      });
      expect(request.days, 1);
      expect(request.status, LeaveStatus.pending);
    });

    test('a range counts both ends', () {
      final request = parse({
        'startDate': '2026-03-02',
        'endDate': '2026-03-06',
        'reason': 'Wedding',
        'status': 'approved',
        'submittedAt': '2026-03-01T09:00:00.000Z',
        'reviewedAt': '2026-03-01T15:00:00.000Z',
      });
      expect(request.days, 5);
      expect(request.status, LeaveStatus.approved);
      expect(request.reviewedAt, isNotNull);
    });

    test('an unknown status reads as pending rather than as approval', () {
      // The safe direction: a request nobody has acted on must never render
      // as one somebody approved.
      expect(parse(const {'status': 'weird'}).status, LeaveStatus.pending);
      expect(parse(const {}).status, LeaveStatus.pending);
      expect(parse(const {}).reviewedAt, isNull);
    });
  });

  group('codeforge — percentage is CodeForge only', () {
    HubCourse course(String tech, String name, int attended, int total) => HubCourse(
          batchId: 'b-$tech',
          technologyId: tech,
          courseName: name,
          technologyName: tech,
          modules: const [],
          totalSessions: total,
          attendedSessions: attended,
          percentage: total == 0 ? null : attended / total * 100,
        );

    HubAttendanceSnapshot snap(List<HubCourse> courses) => HubAttendanceSnapshot(
          studentName: null,
          rollNumber: null,
          courses: courses,
          totalSessions: courses.fold(0, (s, c) => s + c.totalSessions),
          attendedSessions: courses.fold(0, (s, c) => s + c.attendedSessions),
          percentage: null,
          fetchedAt: null,
        );

    test('recognises every level spelling, however it is written', () {
      // The real names, from api/_hubPortal.test.js — and the inconsistent
      // separators Maya actually uses between them.
      for (final tech in const [
        'CodeForge-Intermediate',
        'CodeForge - Beginner',
        'CodeForge-Advanced',
        'CODEFORGE',
      ]) {
        expect(course(tech, 'CODEFORGE', 1, 1).isCodeForge, isTrue, reason: tech);
      }
    });

    test('excludes the ability courses that share the Maya login', () {
      for (final tech in const ['Arithmetic Ability', 'Logical Ability', 'Verbal Ability']) {
        expect(course(tech, tech, 1, 1).isCodeForge, isFalse, reason: tech);
      }
    });

    test('the headline percentage counts CodeForge and nothing else', () {
      final s = snap([
        course('CodeForge - Beginner', 'CODEFORGE', 8, 10),   // 80%
        course('CodeForge-Advanced', 'CODEFORGE', 4, 10),     // 40%  → CF total 12/20 = 60%
        course('Arithmetic Ability', 'Arithmetic Ability', 0, 20), // dragged the old total to 12/40 = 30%
      ]);
      expect(s.codeForgeAttended, 12);
      expect(s.codeForgeTotal, 20);
      expect(s.codeForgePercentage, 60);
      // The all-courses total is still there for anyone who wants it — it is
      // just no longer what "CodeForge attendance" means.
      expect(s.totalSessions, 40);
    });

    test('a student with no CodeForge course gets null, not an ability figure', () {
      final s = snap([course('Verbal Ability', 'Verbal Ability', 9, 10)]);
      expect(s.codeForgePercentage, isNull);
      expect(s.codeForgeCourses, isEmpty);
      expect(s.otherCourses, hasLength(1));
    });
  });

}
