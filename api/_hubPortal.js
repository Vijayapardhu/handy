// Talking to Aditya University's Maya platform (maya.adityauniversity.in) —
// the separate system CodeForge/skills-hour attendance lives on. Nothing
// about this touches Campus Connect (_campusPortal.js); it's a different
// college system with its own login and its own JWT.
//
// Handy proxies both calls (see hub-connect.js, hub-attendance.js) because
// Maya's CORS answer locks access-control-allow-origin to
// https://maya.adityauniversity.in — a browser sitting on Handy's own origin
// is refused outright, token or not.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const HUB_API_BASE = "https://api.maya.adityauniversity.in/node/api";
const HUB_ORIGIN = "https://maya.adityauniversity.in";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

/** Raised for a bad roll number or password, so the endpoint can answer 401 rather than 500. */
export class InvalidHubCredentialsError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidHubCredentialsError";
  }
}

function hubHeaders(extra = {}) {
  return {
    "Content-Type": "application/json",
    Origin: HUB_ORIGIN,
    Referer: `${HUB_ORIGIN}/`,
    "User-Agent": USER_AGENT,
    ...extra,
  };
}

/** Decodes a JWT's payload without verifying the signature — Maya signed it, this only needs `exp`. */
export function decodeJwtExpiryMs(token) {
  try {
    const [, payload] = token.split(".");
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function postSecureLogin(rollNumber, password, forceLogin) {
  let response;
  try {
    response = await fetch(`${HUB_API_BASE}/secure-login`, {
      method: "POST",
      headers: hubHeaders(),
      body: JSON.stringify({ roll_no: rollNumber, password, forcelogin: forceLogin }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error("Could not reach the Hub. Try again shortly.");
  }
  const data = await response.json().catch(() => null);
  return { response, data };
}

/**
 * Signs in as the student against Maya and reports back what a token is good
 * for and which courses (batch + technology pairs) attendance can be read for.
 *
 * The password is a local const for the length of this call — same discipline
 * as _campusPortal.js's scrapeCampus, never returned or logged.
 */
export async function hubSecureLogin(rollNumber, password) {
  let { response, data } = await postSecureLogin(rollNumber, password, false);

  // 423 Locked is Maya's answer to "already signed in somewhere else" — the
  // `forcelogin` field exists for exactly this, to sign that other session
  // out. Handy is acting on the student's own behalf here (they just typed
  // their own password into their own Profile page), so retrying with it set
  // is the same choice a student would make themselves rather than a
  // silent escalation of what was asked for.
  if (response.status === 423) {
    ({ response, data } = await postSecureLogin(rollNumber, password, true));
  }

  if (!response.ok || !data?.token) {
    if (response.status === 401 || response.status === 400 || response.status === 403) {
      throw new InvalidHubCredentialsError(
        data?.message || data?.error || "The Hub rejected that roll number and password.",
      );
    }
    throw new Error(`Hub returned ${response.status} instead of a token.`);
  }

  const tokenExp = decodeJwtExpiryMs(data.token) ?? Date.now() + 55 * 60 * 1000;

  return {
    studentId: data.student_id,
    rollNumber: data.roll_no ?? rollNumber,
    name: data.first_name ?? null,
    token: data.token,
    tokenExp,
    // Deduped by (batch, technology) so re-fetching attendance doesn't repeat
    // an identical call for the same course twice.
    courses: dedupeCourses(
      (data.current_courses ?? []).map((c) => ({
        batchId: c.batch_id,
        technologyId: c.technology_id,
        technologyName: c.technology_name ?? null,
        technologyIcon: c.technology_icon ?? null,
        category: c.technology_category ?? null,
      })),
    ),
  };
}

function dedupeCourses(courses) {
  const seen = new Set();
  return courses.filter((c) => {
    const key = `${c.batchId}_${c.technologyId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * One course's module/topic rows for a student. Maya answers with an array
 * wrapping one array of module rows (`[[ {...}, {...} ]]`) — `.flat()` copes
 * with that and with a flat `[...]` the same way, in case that nesting isn't
 * load-bearing.
 */
export async function hubFetchCourseModules({ studentId, rollNumber, batchId, technologyId }) {
  const response = await fetch(`${HUB_API_BASE}/get-attendance-for-app-by-studentId`, {
    method: "POST",
    headers: hubHeaders(),
    body: JSON.stringify({
      student_id: studentId,
      roll_no: rollNumber,
      batch_id: batchId,
      technology: technologyId,
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) return [];
  const data = await response.json().catch(() => null);
  return Array.isArray(data) ? data.flat() : [];
}

/**
 * Module rows for one course into the HubCourse shape the client renders.
 *
 * `batchId`/`technologyId` come from the request that produced `rows` — the
 * pair every course is keyed by everywhere else (hub-connect.js's stored
 * course list, the request this function's caller just made) — not from the
 * response's own `_id` field. That field turned out to be a curriculum id
 * shared across separate enrollments of the same course (two different
 * "Arithmetic Ability" batches both echoed the same `_id`), which collided
 * both the React key and the open/closed state on the breakdown page: opening
 * one batch opened every batch of the same course.
 */
export function aggregateHubCourse(rows, { batchId, technologyId }) {
  if (!rows || rows.length === 0) return null;

  const modules = rows.map((row) => {
    const topics = (row.topic ?? []).map((t) => ({
      topicName: t.topic_name,
      totalSessions: t.total_sessions ?? 0,
      attendedCount: t.attended_count ?? 0,
    }));
    const totalSessions = topics.reduce((sum, t) => sum + t.totalSessions, 0);
    const attendedSessions = topics.reduce((sum, t) => sum + t.attendedCount, 0);
    return {
      moduleId: row.module_id,
      moduleName: row.module_name,
      moduleIcon: row.module_icon ?? null,
      topics,
      totalSessions,
      attendedSessions,
    };
  });

  const totalSessions = modules.reduce((sum, m) => sum + m.totalSessions, 0);
  const attendedSessions = modules.reduce((sum, m) => sum + m.attendedSessions, 0);
  const first = rows[0];

  return {
    batchId,
    technologyId,
    courseName: first.course_name ?? null,
    technologyName: first.technology_name ?? null,
    technologyIcon: first.technology_icon ?? null,
    modules,
    totalSessions,
    attendedSessions,
    percentage: totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 10000) / 100 : null,
  };
}

/* ---------------------------------------------------------------------- *
 * Storing the Hub password server-side, encrypted.
 *
 * Distinct from _campusPortal.js's AES_KEY/AES_IV, which encrypts a password
 * to *send* it (matching Campus Connect's own login script — that key is
 * public, sitting in a script tag). This is the opposite direction: Handy is
 * choosing to remember the Hub password at rest, at the student's request, so
 * it can silently re-log-in once the hour-long token expires without asking
 * again every session. AES-256-GCM with a server-only secret and a fresh IV
 * per write, so the encrypted value on its own proves nothing was tampered
 * with (the auth tag) and never repeats.
 * ---------------------------------------------------------------------- */

function hubCredKey() {
  const key = process.env.HUB_CRED_KEY ?? "";
  if (key.length !== 64) {
    throw new Error("HUB_CRED_KEY must be a 64-character hex string (32 bytes) — see .env.example");
  }
  return Buffer.from(key, "hex");
}

export function encryptHubPassword(password) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", hubCredKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    data: ciphertext.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptHubPassword({ iv, data, tag }) {
  const decipher = createDecipheriv("aes-256-gcm", hubCredKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
