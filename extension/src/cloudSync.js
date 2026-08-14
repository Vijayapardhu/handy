// Gets a captured snapshot into Firestore, by one of two routes:
//
//   1. POST it to the server (api/sync.js), which writes with the Admin SDK.
//      Preferred, because no student password is involved — so any machine
//      can sync any student, including one who changed their password.
//   2. Write it directly over the Firestore REST API, authenticated as the
//      student. Used only when the endpoint is unreachable. This is the
//      original path and stays because it needs no server to be deployed.
//
// Both produce the documents src/services/students/collegePortalImportService.ts
// writes — read that first. Route 2's sequence:
//
//   a. ensure `students/{uid}` exists (create the stub if it doesn't)
//   b. one atomic commit: student profile fields, one subject + one summary
//      per captured subject, and deactivate subjects a previous sync left
//      behind that this capture no longer contains
import { authenticate, recordSyncResult } from "./account.js";
import {
  buildImportDocs,
  buildStudentStub,
  buildTimetableDocs,
  selfImportSemesterId,
  selfTimetableVersionId,
} from "./snapshotMapping.js";
import { rollNumberToEmail, SYNC_API_KEY, SYNC_ENDPOINT } from "./config.js";
import { commitWrites, getDocument, queryCollection, setWrite, updateWrite } from "./firebaseRest.js";

/**
 * @returns {Promise<{uid: string, subjectCount: number}>}
 * @throws {NeedsPasswordError|FirebaseRestError} — the caller decides what to
 *         surface; NeedsPasswordError in particular is a prompt, not a bug.
 */
export async function syncSnapshotToCloud(snapshot) {
  const rollNumber = snapshot?.rollNumber;
  if (!rollNumber) throw new Error("Snapshot has no roll number — refusing to guess whose account this is");

  // Preferred route: the server writes with the Admin SDK, so no student
  // password is involved and this works on any machine. Falls back to writing
  // as the student only when the endpoint isn't reachable at all.
  if (SYNC_ENDPOINT) {
    try {
      const result = await syncViaEndpoint(rollNumber, snapshot);
      await recordSyncResult(rollNumber, { ok: true });
      return result;
    } catch (error) {
      if (!isEndpointUnavailable(error)) {
        await recordSyncResult(rollNumber, { ok: false, error: `endpoint: ${error?.message ?? error}` });
        throw error;
      }
      console.warn("[Handy] sync endpoint unreachable, writing directly instead:", error?.message);
    }
  }

  return syncDirectToFirestore(rollNumber, snapshot);
}

/**
 * A rejected key or a rejected snapshot is a real problem and must surface —
 * only a genuinely absent endpoint (offline, not deployed yet, 5xx) is worth
 * falling back from.
 */
function isEndpointUnavailable(error) {
  return error?.code === "NETWORK_ERROR" || error?.status === 404 || error?.status >= 500;
}

async function syncViaEndpoint(rollNumber, snapshot) {
  let response;
  try {
    response = await fetch(SYNC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-handy-key": SYNC_API_KEY },
      body: JSON.stringify(snapshot),
    });
  } catch (cause) {
    const error = new Error(cause?.message ?? "network error");
    error.code = "NETWORK_ERROR";
    throw error;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    const error = new Error(payload.error ?? `HTTP_${response.status}`);
    error.status = response.status;
    throw error;
  }

  console.log("[Handy] synced via endpoint:", rollNumber, payload);
  return { uid: payload.uid, subjectCount: payload.subjectCount, slotCount: payload.slotCount };
}

/**
 * Fallback: authenticate as the student and write to Firestore directly. Only
 * works while their password is one this browser knows, which is why the
 * endpoint above is preferred.
 */
async function syncDirectToFirestore(rollNumber, snapshot) {
  let stage = "authenticate";
  try {
    const { idToken, uid } = await authenticate(rollNumber);
    const now = new Date().toISOString();
    const writes = [];

    // `updateWrite` below carries a currentDocument:{exists:true}
    // precondition, and firestore.rules only accepts a *create* whose
    // profileComplete is false — so the stub has to be a separate,
    // earlier commit, exactly like ensureStudentStub() on the web side.
    stage = "read-student";
    const existing = await getDocument(idToken, "students", uid);
    if (!existing) {
      stage = "create-student-stub";
      await commitWrites(idToken, [
        setWrite("students", uid, buildStudentStub(uid, rollNumber, rollNumberToEmail(rollNumber), now)),
      ]);
    }

    stage = "read-subjects";
    const { studentUpdate, subjects, summaries } = buildImportDocs(uid, snapshot, now);
    writes.push(updateWrite("students", uid, studentUpdate));
    for (const subject of subjects) writes.push(setWrite("subjects", subject.id, subject.doc));
    for (const summary of summaries) writes.push(setWrite("attendanceSummaries", summary.id, summary.doc));

    const importedIds = new Set(subjects.map((s) => s.id));
    const previous = await queryCollection(idToken, "subjects", [
      ["semesterId", "==", selfImportSemesterId(uid)],
    ]);
    for (const stale of previous) {
      if (stale.active === true && !importedIds.has(stale.id)) {
        writes.push(updateWrite("subjects", stale.id, { active: false, updatedAt: now }));
      }
    }

    let slotCount = 0;
    if (snapshot.timetable) {
      stage = "read-timetable-versions";
      slotCount = await appendTimetableWrites(writes, idToken, uid, snapshot, now);
    }

    stage = "commit";
    await commitWrites(idToken, writes);
    await recordSyncResult(rollNumber, { ok: true });
    return { uid, subjectCount: subjects.length, slotCount };
  } catch (error) {
    // Record *which* step failed. A bare "PERMISSION_DENIED" doesn't say
    // whether a read or a write was rejected, and this sync touches five
    // collections — that ambiguity cost a debugging round trip once already.
    await recordSyncResult(rollNumber, {
      ok: false,
      error: `${stage}: ${error?.message ?? String(error)}`,
    });
    throw error;
  }
}

/**
 * Timetable half — see buildTimetableDocs(). Kept separate because the
 * timetable comes from a different page than the attendance capture and may
 * simply not be there yet.
 */
async function appendTimetableWrites(writes, idToken, uid, snapshot, now) {
  const timetable = snapshot.timetable;
  const versionId = selfTimetableVersionId(uid, timetable.ttNo);

  // One query does both jobs, and deliberately NOT a get() on versionId:
  // reading a document that doesn't exist yet would be denied, not 404'd,
  // because the read rule dereferences `resource.data.status` and `resource`
  // is null for a missing document.
  const published = await queryCollection(idToken, "timetableVersions", [
    ["semesterId", "==", selfImportSemesterId(uid)],
    ["status", "==", "published"],
  ]);

  const { version, entries } = buildTimetableDocs(uid, timetable, {
    department: snapshot.branch ?? "",
    // Preserve the date this version was first seen; only a brand-new one
    // starts today (see the web-side comment).
    effectiveFrom: published.find((v) => v.id === versionId)?.effectiveFrom ?? now.slice(0, 10),
    now,
  });

  writes.push(setWrite("timetableVersions", version.id, version.doc));
  for (const entry of entries) writes.push(setWrite("timetableEntries", entry.id, entry.doc));

  // Any other still-published version of ours is now stale (new semester or
  // section) and must stop winning getActiveTimetableVersion().
  for (const other of published) {
    if (other.id !== version.id) {
      writes.push(
        updateWrite("timetableVersions", other.id, {
          status: "archived",
          effectiveUntil: now.slice(0, 10),
        }),
      );
    }
  }

  return entries.length;
}
