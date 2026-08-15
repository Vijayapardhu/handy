// Pure, dependency-free guard logic shared by students.js, subjects.js, and
// timetables.js — pulled out specifically so it can be tested without
// touching Firebase (see _guards.test.js), the same way this repo's other
// pure calculation modules are.
//
// sanitizeStudentUpdate() is the actual mechanism behind "the admin cannot
// change a student's attendance": STUDENT_EDITABLE_FIELDS has no attendance
// field in it, so no request body — malformed, malicious, or just a bug in
// the frontend form — can make it through this function carrying one.

export function isSelfNamespace(id) {
  return String(id ?? "").startsWith("self-");
}

export const STUDENT_EDITABLE_FIELDS = [
  "name",
  "department",
  "course",
  "year",
  "section",
  "semesterId",
  "collegeId",
  "admissionNo",
  "semesterLabel",
  "gender",
  "dob",
  "mobileNo",
];

/**
 * Filters an update payload down to only the fields a student profile edit
 * may touch. Returns `{ ok: true, clean }` with `updatedAt` stamped in, or
 * `{ ok: false, error }` naming the first field that isn't allowed — never
 * silently drops an unexpected field, since a caller relying on a field
 * being applied should find out immediately if it wasn't.
 */
export function sanitizeStudentUpdate(updates, now = new Date().toISOString()) {
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    return { ok: false, error: "missing_updates" };
  }

  const clean = {};
  for (const key of Object.keys(updates)) {
    if (!STUDENT_EDITABLE_FIELDS.includes(key)) {
      return { ok: false, error: `field_not_editable:${key}` };
    }
    clean[key] = updates[key];
  }

  if (Object.keys(clean).length === 0) {
    return { ok: false, error: "no_fields" };
  }

  clean.updatedAt = now;
  return { ok: true, clean };
}
