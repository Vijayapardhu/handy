// Shared by every admin/api/*.js endpoint.
//
// Own Admin SDK bootstrap — this can't reuse src/app/config/firebase.ts (that
// resolves Vite `import.meta.env.VITE_*` values, which don't exist in a Node
// function's runtime) or the root app's api/*.js `app()` helpers (this is a
// separate Vercel project with its own env vars, even though they typically
// hold the same FIREBASE_SERVICE_ACCOUNT value — same Firebase project, two
// deployments).
//
// requireAdmin() is the one gate every privileged write passes through:
// verify the caller's Firebase ID token, then confirm admins/{uid}.active —
// the same live Firestore-doc-grant check firestore.rules' isAdmin() does,
// duplicated here because the Admin SDK bypasses rules entirely and this is
// the only enforcement a server-side write actually gets.
import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export function app() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  return initializeApp({ credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
}

export class AdminAuthError extends Error {
  constructor(statusCode, error) {
    super(error);
    this.statusCode = statusCode;
    this.error = error;
  }
}

/**
 * Resolves and authorizes the caller. Throws AdminAuthError (never returns a
 * falsy value) — every handler should let it propagate to a catch block that
 * responds with `err.statusCode`/`err.error`.
 *
 * Returns `{ uid, email, name }` of the admin, read from their own
 * `admins/{uid}` doc rather than the token, so a revoked admin's cached ID
 * token can never carry a name/email a caller might display as if it were
 * still current.
 */
export async function requireAdmin(req) {
  // Checked before app() — same reasoning as api/sync.js's own guards: a
  // request with no token at all shouldn't cost a Firebase Admin SDK
  // initialization, and it means this specific failure is testable with no
  // credentials configured at all (see _admin.test.js).
  const idToken = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  if (!idToken) throw new AdminAuthError(401, "missing_token");

  app();
  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(idToken);
  } catch {
    throw new AdminAuthError(401, "invalid_token");
  }

  const db = getFirestore();
  const snap = await db.doc(`admins/${decoded.uid}`).get();
  if (!snap.exists || snap.get("active") !== true) {
    throw new AdminAuthError(403, "not_an_admin");
  }

  return { uid: decoded.uid, email: snap.get("email") ?? decoded.email ?? "", name: snap.get("name") ?? "" };
}

/** Every handler's outermost catch — one place that turns AdminAuthError into the right HTTP response. */
export function handleAdminError(res, error) {
  if (error instanceof AdminAuthError) {
    return res.status(error.statusCode).json({ ok: false, error: error.error });
  }
  console.error("[admin api] unexpected error:", error);
  return res.status(500).json({ ok: false, error: String(error?.message ?? error) });
}

/**
 * A cryptographically random password for admin-issued resets — never derived
 * from anything guessable (roll number, timestamp). 16 characters from an
 * alphabet that excludes visually-ambiguous characters (0/O, 1/l/I), since an
 * admin reads this once and relays it to a student by voice or text.
 */
const PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
export function generatePassword(length = 16) {
  const bytes = new Uint8Array(length);
  // Node 19+ / the Vercel Node runtime both expose Web Crypto globally.
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) out += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
  return out;
}
