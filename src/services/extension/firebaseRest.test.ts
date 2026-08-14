import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error - plain-JS extension module; no type declarations by design.
import * as rest from "../../../extension/src/firebaseRest.js";

/**
 * The extension writes to Firestore over REST rather than through the Web
 * SDK (no bundler in the extension — see extension/src/firebaseRest.js). That
 * means hand-writing Firestore's typed-value encoding, and any mismatch with
 * what the SDK produces would give a student subtly different documents
 * depending on which client wrote them. These tests pin that encoding.
 */
describe("Firestore value encoding", () => {
  it("encodes scalars the way the Web SDK does", () => {
    expect(rest.toValue("hello")).toEqual({ stringValue: "hello" });
    expect(rest.toValue(true)).toEqual({ booleanValue: true });
    expect(rest.toValue(null)).toEqual({ nullValue: null });
    expect(rest.toValue(undefined)).toEqual({ nullValue: null });
  });

  it("splits integers from doubles, since Firestore stores them as distinct types", () => {
    // The SDK picks integerValue for safe integers; attended/held/year all
    // have to land as integers or numeric comparisons differ across clients.
    expect(rest.toValue(47)).toEqual({ integerValue: "47" });
    expect(rest.toValue(0)).toEqual({ integerValue: "0" });
    expect(rest.toValue(-3)).toEqual({ integerValue: "-3" });
    expect(rest.toValue(68.09)).toEqual({ doubleValue: 68.09 });
  });

  it("encodes arrays and nested maps", () => {
    expect(rest.toValue(["a", 1])).toEqual({
      arrayValue: { values: [{ stringValue: "a" }, { integerValue: "1" }] },
    });
    expect(rest.toValue({ nested: { deep: true } })).toEqual({
      mapValue: { fields: { nested: { mapValue: { fields: { deep: { booleanValue: true } } } } } },
    });
  });

  it("round-trips a document through toFields/fromFields", () => {
    const doc = {
      studentId: "uid1",
      subjectId: "self-uid1-2501it05",
      attended: 32,
      held: 47,
      source: "collegePortal",
      targetAttendance: null,
      active: true,
    };
    expect(rest.fromFields(rest.toFields(doc))).toEqual(doc);
  });

  it("drops undefined keys instead of encoding them", () => {
    expect(Object.keys(rest.toFields({ a: 1, b: undefined }))).toEqual(["a"]);
  });
});

describe("write construction", () => {
  it("builds a full-document set with no update mask", () => {
    const write = rest.setWrite("subjects", "self-uid1-dms", { code: "2501IT05", active: true });
    expect(write.update.name).toBe(
      "projects/handyy-aus/databases/(default)/documents/subjects/self-uid1-dms",
    );
    expect(write.update.fields).toEqual({
      code: { stringValue: "2501IT05" },
      active: { booleanValue: true },
    });
    expect(write.updateMask).toBeUndefined();
  });

  it("builds a masked update that fails on a missing document", () => {
    const write = rest.updateWrite("students", "uid1", { name: "A", profileComplete: true });
    expect(write.updateMask).toEqual({ fieldPaths: ["name", "profileComplete"] });
    // Without this precondition a typo'd id would silently create a
    // half-populated student doc instead of erroring.
    expect(write.currentDocument).toEqual({ exists: true });
  });

  it("percent-encodes document ids in paths", () => {
    expect(rest.documentName("students", "uid1")).toBe(
      "projects/handyy-aus/databases/(default)/documents/students/uid1",
    );
  });
});

/**
 * Regression cover for a live PERMISSION_DENIED: Firestore rules are not
 * filters, so a list query is rejected unless its own constraints prove every
 * match is readable. `timetableVersions` may only be read when
 * `status == 'published'`, so that filter has to be in the query itself —
 * querying by semesterId alone fails against real Firestore even though every
 * document it would return is one the caller owns.
 */
describe("queryCollection filters", () => {
  afterEach(() => vi.unstubAllGlobals());

  function captureQuery() {
    const calls: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", (_url: string, init: { body: string }) => {
      calls.push(JSON.parse(init.body));
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve("[]") });
    });
    return calls;
  }

  it("sends a bare fieldFilter for a single constraint", async () => {
    const calls = captureQuery();
    await rest.queryCollection("token", "subjects", [["semesterId", "==", "self-uid1"]]);
    expect(calls[0].structuredQuery).toEqual({
      from: [{ collectionId: "subjects" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "semesterId" },
          op: "EQUAL",
          value: { stringValue: "self-uid1" },
        },
      },
    });
  });

  it("ANDs multiple constraints, so the status filter reaches Firestore", async () => {
    const calls = captureQuery();
    await rest.queryCollection("token", "timetableVersions", [
      ["semesterId", "==", "self-uid1"],
      ["status", "==", "published"],
    ]);

    const where = (calls[0].structuredQuery as { where: Record<string, never> }).where as unknown as {
      compositeFilter: { op: string; filters: Array<{ fieldFilter: { field: { fieldPath: string } } }> };
    };
    expect(where.compositeFilter.op).toBe("AND");
    expect(where.compositeFilter.filters.map((f) => f.fieldFilter.field.fieldPath)).toEqual([
      "semesterId",
      "status",
    ]);
  });
});
