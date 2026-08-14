// Plain (non-module) script loaded before capture.isolated.js in the same
// content_scripts entry — content scripts declared in the same "js" array
// share one execution context, so HandyParser below is just a global that
// capture.isolated.js can call directly, no import/export needed.
//
// ShowStudentProfileNew responds with the classic ASP.NET PageMethod
// envelope `{"d": "<html string>"}` — the "d" value is a server-rendered
// HTML fragment (bio-data table, attendance table, fee table, ...), not
// structured JSON. So this parses it as HTML and reads specific tables by
// their known headers/ids, rather than JSON field names.
(() => {
  function textOf(el) {
    // U+00A0 is the non-breaking space &nbsp; decodes to — normalize to a regular space.
    return el ? el.textContent.replace(/\u00A0/g, " ").trim() : "";
  }

  /** "2501IT05-Database Management Systems" -> {code, name}; same shape works for "5734-DR. ..." faculty cells. */
  function splitCodeName(raw) {
    const value = (raw ?? "").trim();
    const idx = value.indexOf("-");
    if (idx === -1) return { code: "", name: value };
    return { code: value.slice(0, idx).trim(), name: value.slice(idx + 1).trim() };
  }

  function toNumber(text) {
    const n = Number(String(text ?? "").trim());
    return Number.isFinite(n) ? n : 0;
  }

  function parseAttendanceTable(doc) {
    const headerCell = Array.from(doc.querySelectorAll("td")).find((td) => textOf(td) === "Sl.No.");
    const table = headerCell?.closest("table") ?? null;
    if (!table) return { subjects: [], total: null };

    const rows = Array.from(table.querySelectorAll("tr")).slice(1); // skip header row
    const subjects = [];
    let total = null;

    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("td")).map(textOf);
      if (cells.length === 0) continue;

      // The TOTAL row's label cell uses colspan="3" — that's a rendering
      // hint, not extra <td> elements, so this row only has 4 <td>s
      // (label, held, attended, percent), not 6. Detect it by content
      // before the column-count check below would otherwise skip it.
      if (/total/i.test(cells[0])) {
        const [held, attend, percent] = cells.slice(-3);
        total = { held: toNumber(held), attended: toNumber(attend), percent: toNumber(percent) };
        continue;
      }

      if (cells.length < 6) continue;
      const [slNo, courseRaw, facultyRaw, held, attend, percent] = cells;

      const course = splitCodeName(courseRaw);
      const faculty = splitCodeName(facultyRaw);
      subjects.push({
        slNo: toNumber(slNo) || subjects.length + 1,
        code: course.code,
        name: course.name,
        facultyId: faculty.code,
        facultyName: faculty.name,
        held: toNumber(held),
        attended: toNumber(attend),
        percent: toNumber(percent),
      });
    }

    return { subjects, total };
  }

  const BIO_FIELD_MAP = {
    "Admission.No": "admissionNo",
    RollNo: "rollNumber",
    Name: "studentName",
    Course: "course",
    Branch: "branch",
    Semester: "semesterLabel",
    Gender: "gender",
    DOB: "dob",
    "Mobile.No": "mobileNo",
    Email: "email",
  };

  function parseBioData(doc) {
    const bio = {};
    // Scoped to the "Personal Details" table specifically (the first table
    // in #divProfile_BioData) — later tables in the same div (Guardian
    // Details, Parent's Details) reuse some of the same labels (e.g. "Name"),
    // often with blank values, and would otherwise clobber the real ones.
    const personalDetailsTable = doc.querySelector("#divProfile_BioData table");
    const rows = personalDetailsTable ? personalDetailsTable.querySelectorAll(":scope > tbody > tr, :scope > tr") : [];
    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll("td"));
      // Rows alternate label / ":" / value [/ label / ":" / value] — walk in triples.
      for (let i = 0; i + 2 < cells.length; i += 1) {
        if (textOf(cells[i + 1]) !== ":") continue;
        const key = BIO_FIELD_MAP[textOf(cells[i])];
        if (key && !(key in bio)) bio[key] = textOf(cells[i + 2]);
      }
    });
    const img = doc.querySelector("#divProfile_BioData img");
    bio.photoUrl = img ? img.getAttribute("src") : null;
    return bio;
  }

  /**
   * @param {string} rawBodyText - raw HTTP response body text
   * @param {string} sourceUrl
   * @param {string} capturedAt - ISO timestamp
   * @returns {object|null} normalized snapshot, or null if the body wasn't the expected envelope
   */
  function parseProfileResponse(rawBodyText, sourceUrl, capturedAt) {
    let envelope;
    try {
      envelope = JSON.parse(rawBodyText);
    } catch {
      return null;
    }

    const html = typeof envelope === "string" ? envelope : envelope?.d;
    if (typeof html !== "string" || !html.trim()) return null;

    const doc = new DOMParser().parseFromString(html, "text/html");
    const bio = parseBioData(doc);
    const attendance = parseAttendanceTable(doc);

    if (!bio.rollNumber && attendance.subjects.length === 0) return null;

    return {
      rollNumber: bio.rollNumber || null,
      studentName: bio.studentName || null,
      admissionNo: bio.admissionNo || null,
      course: bio.course || null,
      branch: bio.branch || null,
      semesterLabel: bio.semesterLabel || null,
      photoUrl: bio.photoUrl || null,
      gender: bio.gender || null,
      dob: bio.dob || null,
      mobileNo: bio.mobileNo || null,
      email: bio.email || null,
      attendance,
      capturedAt,
      sourceUrl,
    };
  }

  // --- Timetable ------------------------------------------------------------
  // studenttimetableoption.aspx/ShowTimeTables uses the same ASP.NET PageMethod
  // envelope as the profile call, but its "d" is a JSON *string*, not HTML —
  // so this parses twice and reads fields, where parseProfileResponse has to
  // parse markup. Shape:
  //   { timetables: [{ttno, ttname}], subjects: [{subjectid, subjectcode,
  //     subjectname, short_name}], faculty: [{subjectid, employeecode,
  //     employeename, roomno, blockname}], ttdetails: [{dayid, periodno,
  //     fromtime, totime, subjectid, subject_type}], periods: [...] }

  /** Portal `subject_type` -> the app's TimetableEntryType (see src/types/timetable.ts). */
  const SUBJECT_TYPE = { T: "lecture", L: "lab", O: "technical" };

  /** "09:30:00" -> "09:30"; the app stores and compares times as "HH:mm" strings. */
  function toHm(value) {
    const text = String(value ?? "").trim();
    return /^\d{2}:\d{2}/.test(text) ? text.slice(0, 5) : "";
  }

  function parseTimetableResponse(rawBodyText, sourceUrl, capturedAt) {
    let envelope;
    try {
      envelope = JSON.parse(rawBodyText);
    } catch {
      return null;
    }

    const inner = typeof envelope === "string" ? envelope : envelope?.d;
    if (typeof inner !== "string" || !inner.trim()) return null;

    let data;
    try {
      data = JSON.parse(inner);
    } catch {
      return null;
    }

    if (!Array.isArray(data?.ttdetails) || !Array.isArray(data?.subjects)) return null;

    // Faculty and room come keyed by the portal's numeric subjectid, one row
    // per subject rather than per slot — so they're folded into the subject.
    const facultyBySubjectId = new Map();
    for (const row of Array.isArray(data.faculty) ? data.faculty : []) {
      if (!facultyBySubjectId.has(row.subjectid)) facultyBySubjectId.set(row.subjectid, row);
    }

    const subjectsById = new Map();
    const subjects = [];
    for (const row of data.subjects) {
      const faculty = facultyBySubjectId.get(row.subjectid);
      const subject = {
        code: String(row.subjectcode ?? "").trim(),
        name: String(row.subjectname ?? "").trim(),
        // The portal's own abbreviation ("ADSAA", "OOPC++") — far better than
        // anything we could derive by truncating the full name.
        shortName: String(row.short_name ?? "").trim() || null,
        facultyId: faculty ? String(faculty.employeecode ?? "").trim() : "",
        facultyName: faculty ? String(faculty.employeename ?? "").trim() : "",
        room: faculty && faculty.roomno ? String(faculty.roomno).trim() : null,
        // The building. "AGBI-2.1" and "RB-221" are in different places on
        // campus, and a room number alone doesn't say which.
        block: faculty && faculty.blockname ? String(faculty.blockname).trim() : null,
        // Class size. `noof_students` is the cohort the slot is scheduled for
        // (144 where two sections are combined, as for Technical Hour);
        // `opted_students` is how many actually take it.
        strength: faculty ? Number(faculty.noof_students) || null : null,
        opted: faculty ? Number(faculty.opted_students) || null : null,
      };
      if (!subject.code) continue;
      subjectsById.set(row.subjectid, subject);
      subjects.push(subject);
    }

    const slots = [];
    for (const row of data.ttdetails) {
      const subject = subjectsById.get(row.subjectid);
      const startTime = toHm(row.fromtime);
      const endTime = toHm(row.totime);
      if (!subject || !startTime || !endTime) continue;

      slots.push({
        // dayid runs 1..6 for Mon..Sat, which already matches JS getDay();
        // the modulo only matters if the portal ever emits 7 for Sunday.
        dayOfWeek: Number(row.dayid) % 7,
        periodNo: Number(row.periodno),
        startTime,
        endTime,
        subjectCode: subject.code,
        type: SUBJECT_TYPE[String(row.subject_type ?? "").toUpperCase()] ?? "activity",
      });
    }

    if (slots.length === 0) return null;

    const timetable = Array.isArray(data.timetables) ? data.timetables[0] : null;
    return {
      ttNo: timetable?.ttno ?? null,
      // e.g. "T6(CA3)" — the closest thing the portal gives to a section.
      name: timetable?.ttname ? String(timetable.ttname).trim() : null,
      subjects,
      slots,
      capturedAt,
      sourceUrl,
    };
  }

  self.HandyParser = { parseProfileResponse, parseTimetableResponse };
})();
