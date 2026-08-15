// Vercel serverless function: POST /api/upload-url
//
// Hands a class rep a short-lived URL to upload one file straight to R2.
//
// Body: { idToken, groupKey, filename, size }
// Returns: { ok, key, uploadUrl, url, kind, contentType, expiresIn }
//
// Authorised exactly like /api/announce — the student's own Firebase ID token,
// never the shared sync key, because the sync key ships inside an extension on
// every user's disk and this grants writes to our bucket.
//
// The upload does not pass through this function. The client PUTs the bytes to
// R2 itself, which keeps a 25 MB photo out of a serverless request body and off
// the function's execution time. What the server keeps control of is *what may
// be uploaded*: who is asking, which class it lands under, the file type, the
// size, and the object key — all decided here, before any URL is minted.
import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { isClassRep } from "./_classGroups.js";
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_EXPIRY_SECONDS,
  describeUpload,
  presignPut,
  publicUrl,
  r2Config,
  uploadKey,
} from "./_r2.js";

function app() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  return initializeApp({ credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const config = r2Config();
  if (!config) {
    console.error("[upload-url] R2 environment is incomplete — refusing every request");
    return res.status(503).json({ ok: false, error: "storage_unconfigured" });
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

    const groupKey = String(payload?.groupKey ?? "").trim();
    const filename = String(payload?.filename ?? "").trim();
    const size = Number(payload?.size) || 0;

    if (!groupKey) return res.status(400).json({ ok: false, error: "missing_group" });
    if (!filename) return res.status(400).json({ ok: false, error: "missing_filename" });

    // Checked before the type, so a rep who picks a 200 MB video is told the
    // real problem rather than being sent to fix an extension that was fine.
    if (size > MAX_UPLOAD_BYTES) {
      return res.status(413).json({
        ok: false,
        error: "too_large",
        maxBytes: MAX_UPLOAD_BYTES,
      });
    }

    const described = describeUpload(filename);
    if (!described) return res.status(415).json({ ok: false, error: "unsupported_type" });

    // Same answer whether the group exists or not — a student probing for group
    // keys learns nothing either way. Mirrors /api/announce deliberately.
    if (!(await isClassRep(db, caller.uid, groupKey))) {
      return res.status(403).json({ ok: false, error: "not_a_class_rep" });
    }

    const key = uploadKey({ groupKey, extension: described.extension });

    return res.status(200).json({
      ok: true,
      key,
      uploadUrl: presignPut(config, key),
      url: publicUrl(config, key),
      kind: described.kind,
      contentType: described.contentType,
      expiresIn: UPLOAD_EXPIRY_SECONDS,
    });
  } catch (error) {
    console.error("[upload-url] failed:", error);
    return res.status(500).json({ ok: false, error: String(error?.message ?? error) });
  }
}

function safeParse(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}
