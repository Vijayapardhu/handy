// Vercel serverless function: /api/notes
//
//   POST   { idToken, groupKey, title, description?, media, links? }  → add
//   DELETE { idToken, noteId }                                        → remove
//
// Course material for one class, filed under the subject rather than announced.
//
// The split from /api/announce is deliberate and is the whole design: an
// announcement is a moment — it pushes to every phone and is read once. A note
// is a shelf. Nobody wants a notification for the eleventh slide deck, and
// everybody wants to find it in week nine. So this writes no notification and
// sends no push; a rep who wants the class told posts an announcement too.
//
// Authorised exactly like /api/announce: the student's own Firebase ID token,
// never the shared sync key.
import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { isClassRep } from "./_classGroups.js";
import { presign, publicUrl, r2Config } from "./_r2.js";

const MAX_TITLE = 140;
const MAX_DESCRIPTION = 1000;
const MAX_FILES = 20;

function app() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  return initializeApp({ credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const payload = typeof req.body === "string" ? safeParse(req.body) : req.body;
  const idToken = (req.headers.authorization ?? "").replace(/^Bearer /, "") || payload?.idToken;
  if (!idToken) return res.status(401).json({ ok: false, error: "missing_token" });

  try {
    app();
    const db = getFirestore();

    let caller;
    try {
      caller = await getAuth().verifyIdToken(idToken);
    } catch {
      return res.status(401).json({ ok: false, error: "invalid_token" });
    }

    return req.method === "POST"
      ? await create(db, caller, payload, res)
      : await remove(db, caller, payload, res);
  } catch (error) {
    console.error("[notes] failed:", error);
    return res.status(500).json({ ok: false, error: String(error?.message ?? error) });
  }
}

async function create(db, caller, payload, res) {
  const groupKey = String(payload?.groupKey ?? "").trim();
  const title = String(payload?.title ?? "").trim();
  const description = String(payload?.description ?? "").trim();

  if (!groupKey) return res.status(400).json({ ok: false, error: "missing_group" });
  if (!title) return res.status(400).json({ ok: false, error: "missing_title" });
  if (title.length > MAX_TITLE || description.length > MAX_DESCRIPTION) {
    return res.status(400).json({ ok: false, error: "too_long" });
  }

  // Same answer whether the group exists or not — a student probing for group
  // keys learns nothing either way. Mirrors /api/announce.
  if (!(await isClassRep(db, caller.uid, groupKey))) {
    return res.status(403).json({ ok: false, error: "not_a_class_rep" });
  }

  const media = normaliseFiles(payload?.media);
  const links = normaliseLinks(payload?.links);

  // A note with neither a file nor a link is a title on a shelf. The endpoint
  // says so rather than storing an entry that disappoints whoever opens it.
  if (media.length === 0 && links.length === 0) {
    return res.status(400).json({ ok: false, error: "nothing_attached" });
  }

  const student = await db.doc(`students/${caller.uid}`).get();
  const note = await db.collection("classNotes").add({
    groupKey,
    authorUid: caller.uid,
    authorName: student.get("name") ?? "Class rep",
    authorRoll: student.get("rollNumber") ?? "",
    title,
    description,
    media,
    links,
    createdAt: new Date().toISOString(),
  });

  return res.status(200).json({ ok: true, id: note.id });
}

/**
 * Removes a note, and the files behind it.
 *
 * Only a current rep of that note's own group may do this — not the author,
 * because a rep who has handed over should not still be able to delete the
 * shelf, and the rep who took over should. The R2 objects go too: a materials
 * library that only ever grows is a bucket bill, and an orphaned object is one
 * nobody can find but everybody pays for.
 */
async function remove(db, caller, payload, res) {
  const noteId = String(payload?.noteId ?? "").trim();
  if (!noteId) return res.status(400).json({ ok: false, error: "missing_note" });

  const ref = db.doc(`classNotes/${noteId}`);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ ok: false, error: "not_found" });

  if (!(await isClassRep(db, caller.uid, snap.get("groupKey")))) {
    return res.status(403).json({ ok: false, error: "not_a_class_rep" });
  }

  const config = r2Config();
  if (config) {
    // Best effort, and deliberately before the document is deleted only in
    // ordering, not in importance: if a delete fails the entry still goes, and
    // a stranded object is better than a listing pointing at nothing.
    await Promise.all(
      (snap.get("media") ?? []).map(async (item) => {
        try {
          await fetch(presign(config, item.key, { method: "DELETE" }), { method: "DELETE" });
        } catch (error) {
          console.error("[notes] could not delete object", item.key, error);
        }
      }),
    );
  }

  await ref.delete();
  return res.status(200).json({ ok: true });
}

/** Files are referenced by the R2 key we issued, never by a URL the client chose. */
function normaliseFiles(media) {
  if (!Array.isArray(media)) return [];
  const config = r2Config();
  return media
    .slice(0, MAX_FILES)
    .map((item) => ({
      key: String(item?.key ?? "").trim(),
      kind: ["image", "video", "file"].includes(item?.kind) ? item.kind : "file",
      name: String(item?.name ?? "").trim().slice(0, 120),
      size: Number(item?.size) || 0,
    }))
    .filter((item) => item.key.length > 0 && !item.key.includes(".."))
    .map((item) => ({ ...item, url: config ? publicUrl(config, item.key) : null }));
}

/** Only http(s) — a javascript: or intent: URL in course material has no legitimate use. */
function normaliseLinks(links) {
  if (!Array.isArray(links)) return [];
  return links
    .slice(0, MAX_FILES)
    .map((item) => ({
      url: String(item?.url ?? "").trim(),
      label: String(item?.label ?? "").trim().slice(0, 120),
    }))
    .filter((item) => /^https?:\/\//i.test(item.url));
}

function safeParse(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}
