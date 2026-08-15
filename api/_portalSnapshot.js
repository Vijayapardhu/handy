// Turning a scraped AEC/ACET portal read into the snapshot the rest of Handy
// already understands.
//
// This is the whole reason the campuses share a codebase. `CollegePortalSnapshot`
// is what the browser extension produces for AUS, and everything downstream —
// subjects, attendance summaries, timetable versions, class groups, widgets,
// push — is written against it. Producing one here means AEC and ACET students
// get all of that without a second implementation of any of it.
//
// What honestly cannot be filled in is left null or empty rather than guessed
// at. A plausible-looking wrong value is worse than an absent one: absent shows
// up as a blank the student can report, invented shows up as a number they
// trust.

/**
 * The AEC/ACET attendance table gives a subject label, held, attended and a
 * percentage. It does not give a subject *code* or the lecturer.
 *
 * The label therefore has to serve as the code, because the code is the key
 * everything downstream joins on (`selfSubjectId(uid, code, slNo)`). It is
 * stable for as long as the portal prints the same label, which is the same
 * assumption the attendance table itself relies on.
 *
 * The consequence to know about: `facultyId` is empty, and classGroupKey()
 * returns null without one. So class-rep announcements and shared-timetable
 * notifications do not apply to these campuses — not because they were
 * disabled, but because the portal never says who teaches the class, and two
 * lecturers' rooms cannot be told apart without it.
 */
function toSubjects(subjects) {
  return subjects.map((row, index) => {
    const label = String(row.subject ?? "").trim();
    return {
      slNo: index + 1,
      code: label.toUpperCase(),
      name: label,
      facultyId: "",
      facultyName: "",
      held: Number(row.held) || 0,
      attended: Number(row.attended) || 0,
      percent: Number(row.percentage) || 0,
    };
  });
}

/** `{held, att, per}` from the portal's TOTAL row, renamed to the snapshot's fields. */
function toTotal(overall) {
  if (!overall) return null;
  const held = Number(overall.held) || 0;
  const attended = Number(overall.att) || 0;
  if (held === 0 && attended === 0) return null;
  return { held, attended, percent: Number(overall.per) || 0 };
}

export function toSnapshot({ campus, rollNumber, data }) {
  const subjects = toSubjects(data.subjects ?? []);

  return {
    rollNumber,
    studentName: data.name ?? null,

    // Everything below comes from the AUS profile page (ShowStudentProfileNew),
    // which AEC and ACET do not expose the same way. Null rather than "" so the
    // student's own edits in Handy are not overwritten with blanks on sync.
    admissionNo: null,
    course: null,
    branch: null,
    semesterLabel: null,
    photoUrl: null,
    gender: null,
    dob: null,
    mobileNo: null,
    email: null,

    attendance: {
      subjects,
      total: toTotal(data.overall),
    },

    // AEC/ACET have no timetable endpoint — getTimeTableReport is AUS-only.
    // Absent, not empty: an empty timetable would publish a version saying this
    // student has no classes, and wipe a real one if they ever had it.
    timetable: null,

    capturedAt: new Date().toISOString(),
    sourceUrl: `https://info.aec.edu.in/${campus.toLowerCase()}/Academics/studentattendance.aspx`,
  };
}
