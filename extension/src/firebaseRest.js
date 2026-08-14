// Zero-dependency Firebase client over the public REST APIs.
//
// Why REST and not the Firebase Web SDK: this extension has no build step —
// every file here is loaded directly by Chrome — and MV3 forbids remote code,
// so using the SDK would mean vendoring a bundler and ~200KB of bundle into a
// service worker whose auth-persistence story is awkward anyway. Three plain
// `fetch` endpoints cover everything this extension needs.
//
// Security note: nothing here is privileged. Every Firestore call carries the
// ID token of the *student's own* Firebase account, so firestore.rules
// constrains these writes exactly as it constrains the web app's.
import { FIREBASE_API_KEY, FIREBASE_PROJECT_ID } from "./config.js";

const IDENTITY_BASE = "https://identitytoolkit.googleapis.com/v1/accounts";
const TOKEN_BASE = "https://securetoken.googleapis.com/v1/token";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

/** Fully-qualified Firestore document name, which is what the REST API keys writes by. */
export function documentName(collection, docId) {
  return `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`;
}

/**
 * Identity Toolkit reports failures as a 400 with `{error:{message:"EMAIL_EXISTS"}}`.
 * Callers branch on `.code`, so surface that string rather than a generic HTTP error.
 */
export class FirebaseRestError extends Error {
  constructor(code, status, detail) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "FirebaseRestError";
    this.code = code;
    this.status = status;
  }
}

async function postJson(url, body, idToken) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    // No response at all — offline, DNS failure, blocked. Distinct from a
    // rejection by the server, and the only case worth retrying blindly.
    throw new FirebaseRestError("NETWORK_ERROR", 0, cause?.message);
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const raw = payload?.error?.message ?? payload?.[0]?.error?.message ?? `HTTP_${response.status}`;
    // "WEAK_PASSWORD : Password should be at least 6 characters" -> "WEAK_PASSWORD"
    throw new FirebaseRestError(String(raw).split(" ")[0].trim(), response.status, String(raw));
  }

  return payload;
}

export async function signUpWithPassword(email, password) {
  const data = await postJson(`${IDENTITY_BASE}:signUp?key=${FIREBASE_API_KEY}`, {
    email,
    password,
    returnSecureToken: true,
  });
  return { idToken: data.idToken, refreshToken: data.refreshToken, uid: data.localId };
}

export async function signInWithPassword(email, password) {
  const data = await postJson(`${IDENTITY_BASE}:signInWithPassword?key=${FIREBASE_API_KEY}`, {
    email,
    password,
    returnSecureToken: true,
  });
  return { idToken: data.idToken, refreshToken: data.refreshToken, uid: data.localId };
}

/**
 * ID tokens expire after an hour, and a service worker can be evicted and
 * revived at any time, so a stored refresh token is what keeps a re-sync from
 * needing the password again. Note this endpoint is form-encoded, not JSON.
 */
export async function refreshIdToken(refreshToken) {
  let response;
  try {
    response = await fetch(`${TOKEN_BASE}?key=${FIREBASE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }).toString(),
    });
  } catch (cause) {
    throw new FirebaseRestError("NETWORK_ERROR", 0, cause?.message);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new FirebaseRestError(payload?.error?.message ?? `HTTP_${response.status}`, response.status);
  }
  return { idToken: payload.id_token, refreshToken: payload.refresh_token, uid: payload.user_id };
}

// --- Firestore value serialization -----------------------------------------
// The REST API takes explicitly-typed values ({"stringValue": "x"}) where the
// Web SDK infers them from JS types. To keep documents written by this
// extension identical to the web app's, the integer/double split below
// mirrors what the SDK does: a safe integer becomes integerValue, anything
// else doubleValue.

export function toValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toValue) } };
  if (typeof value === "object") return { mapValue: { fields: toFields(value) } };
  throw new TypeError(`Cannot serialize ${typeof value} to a Firestore value`);
}

export function toFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue; // matches the Web SDK's "ignoreUndefinedProperties: false" no-op for absent keys
    fields[key] = toValue(value);
  }
  return fields;
}

export function fromValue(value) {
  if (!value || typeof value !== "object") return null;
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("stringValue" in value) return value.stringValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(fromValue);
  if ("mapValue" in value) return fromFields(value.mapValue.fields ?? {});
  return null;
}

export function fromFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields ?? {})) out[key] = fromValue(value);
  return out;
}

// --- Documents --------------------------------------------------------------

/** Returns null on 404 rather than throwing — "does this student doc exist yet" is a normal question. */
export async function getDocument(idToken, collection, docId) {
  let response;
  try {
    response = await fetch(`${FIRESTORE_BASE}/${collection}/${encodeURIComponent(docId)}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
  } catch (cause) {
    throw new FirebaseRestError("NETWORK_ERROR", 0, cause?.message);
  }

  if (response.status === 404) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new FirebaseRestError(payload?.error?.status ?? `HTTP_${response.status}`, response.status);
  }
  return fromFields(payload.fields);
}

/**
 * Equality query over one or more fields, written as `[[field, "==", value]]`
 * to mirror the Web SDK's where() — only "==" is supported.
 *
 * Multiple filters matter for more than convenience: Firestore rules are not
 * filters. A list query is rejected outright unless the query's own
 * constraints prove every match satisfies the read rule — so reading
 * `timetableVersions`, whose rule requires `status == 'published'`, means
 * filtering on `status` here even though we'd want those documents anyway.
 * (Equality-only queries need no composite index.)
 */
export async function queryCollection(idToken, collection, filters) {
  const fieldFilters = filters.map(([field, op, value]) => {
    if (op !== "==") throw new TypeError(`queryCollection only supports "==", got "${op}"`);
    return { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: toValue(value) } };
  });

  const payload = await postJson(
    `${FIRESTORE_BASE}:runQuery`,
    {
      structuredQuery: {
        from: [{ collectionId: collection }],
        where:
          fieldFilters.length === 1
            ? fieldFilters[0]
            : { compositeFilter: { op: "AND", filters: fieldFilters } },
      },
    },
    idToken,
  );

  // runQuery streams results as an array of {document?} envelopes; an empty
  // result set still returns one envelope, just without a `document`.
  return (Array.isArray(payload) ? payload : [])
    .filter((entry) => entry.document)
    .map((entry) => ({
      id: entry.document.name.split("/").pop(),
      ...fromFields(entry.document.fields),
    }));
}

/** Full-document write (replaces every field), like setDoc() without merge. */
export function setWrite(collection, docId, data) {
  return { update: { name: documentName(collection, docId), fields: toFields(data) } };
}

/**
 * Partial write, like updateDoc(): only `fieldPaths` are touched. The
 * `currentDocument: {exists: true}` precondition makes it fail loudly on a
 * missing document instead of quietly creating a half-populated one.
 */
export function updateWrite(collection, docId, data) {
  return {
    update: { name: documentName(collection, docId), fields: toFields(data) },
    updateMask: { fieldPaths: Object.keys(data) },
    currentDocument: { exists: true },
  };
}

/** All writes in one commit succeed or fail together — same atomicity as writeBatch(). */
export async function commitWrites(idToken, writes) {
  return postJson(`${FIRESTORE_BASE}:commit`, { writes }, idToken);
}
