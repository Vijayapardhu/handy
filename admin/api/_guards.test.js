import { describe, expect, it } from "vitest";
import { isSelfNamespace, sanitizeStudentUpdate, STUDENT_EDITABLE_FIELDS } from "./_guards.js";

describe("isSelfNamespace", () => {
  it("recognizes a student's own private namespace", () => {
    expect(isSelfNamespace("self-abc123uid")).toBe(true);
  });

  it("does not flag a real, admin-authored semester id", () => {
    expect(isSelfNamespace("2026-sem1")).toBe(false);
  });

  it("is false for anything falsy, rather than throwing", () => {
    expect(isSelfNamespace(null)).toBe(false);
    expect(isSelfNamespace(undefined)).toBe(false);
    expect(isSelfNamespace("")).toBe(false);
  });
});

describe("sanitizeStudentUpdate — the actual mechanism behind 'admin cannot touch attendance'", () => {
  it("rejects an attendance-shaped field outright, rather than dropping it silently", () => {
    // This is the test that matters most in this whole panel: if someone
    // ever adds "attendance" or "attended"/"held" to a request body — bug,
    // malicious client, anything — this must fail loudly, not quietly strip
    // the field and let the rest of the write through.
    for (const field of ["attendance", "attended", "held", "attendanceSummary"]) {
      const result = sanitizeStudentUpdate({ [field]: 999 });
      expect(result.ok, `expected ${field} to be rejected`).toBe(false);
      expect(result.error).toBe(`field_not_editable:${field}`);
    }
  });

  it("accepts every field STUDENT_EDITABLE_FIELDS actually lists", () => {
    for (const field of STUDENT_EDITABLE_FIELDS) {
      const result = sanitizeStudentUpdate({ [field]: "x" });
      expect(result.ok, `expected ${field} to be accepted`).toBe(true);
    }
  });

  it("rejects the whole update if even one field is not allowed, mixed in with valid ones", () => {
    const result = sanitizeStudentUpdate({ name: "New Name", attended: 40 });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("field_not_editable:attended");
  });

  it("stamps updatedAt onto an accepted update", () => {
    const result = sanitizeStudentUpdate({ name: "New Name" }, "2026-01-01T00:00:00.000Z");
    expect(result.ok).toBe(true);
    expect(result.clean).toEqual({ name: "New Name", updatedAt: "2026-01-01T00:00:00.000Z" });
  });

  it("rejects an empty update", () => {
    expect(sanitizeStudentUpdate({}).ok).toBe(false);
    expect(sanitizeStudentUpdate({}).error).toBe("no_fields");
  });

  it("rejects a non-object payload without throwing", () => {
    for (const bad of [null, undefined, "name", 42, ["name"]]) {
      const result = sanitizeStudentUpdate(bad);
      expect(result.ok).toBe(false);
      expect(result.error).toBe("missing_updates");
    }
  });
});
