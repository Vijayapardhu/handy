// Presigned uploads to Cloudflare R2, signed by hand.
//
// R2 speaks the S3 API, so this is AWS Signature Version 4 in query-string
// form. It is written out rather than pulled from @aws-sdk because the SDK is a
// large dependency to add to a serverless function for one operation, and the
// signing itself is about sixty lines — most of the rest of this file is the
// encoding rules that are easy to get subtly wrong.
//
// Environment (set on the Vercel project, never in the repo — it is public):
//
//   R2_ACCOUNT_ID          the hex account id in the S3 endpoint hostname
//   R2_BUCKET              bucket name
//   R2_ACCESS_KEY_ID       S3 access key id
//   R2_SECRET_ACCESS_KEY   S3 secret
//   R2_PUBLIC_BASE_URL     public read base, e.g. https://pub-....r2.dev
import { createHash, createHmac, randomUUID } from "node:crypto";

/** R2 ignores the region but SigV4 requires one, and it must match on both sides. */
const REGION = "auto";
const SERVICE = "s3";

/** Long enough to upload a photo on college wifi, short enough to be worthless if leaked. */
export const UPLOAD_EXPIRY_SECONDS = 15 * 60;

export function r2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const publicBase = (process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");

  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    accountId,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBase,
    host: `${accountId}.r2.cloudflarestorage.com`,
  };
}

/**
 * RFC 3986 percent-encoding.
 *
 * encodeURIComponent leaves !'()* alone, and SigV4 canonicalisation requires
 * them encoded. A mismatch here produces a signature that verifies against a
 * different string than the one the client sends, and R2 answers 403 with
 * nothing to say about why — so this is the single most load-bearing function
 * in the file.
 */
function uriEncode(value) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Path segments are encoded individually; the separators stay literal. */
function encodePath(path) {
  return path.split("/").map(uriEncode).join("/");
}

const sha256Hex = (value) => createHash("sha256").update(value).digest("hex");
const hmac = (key, value) => createHmac("sha256", key).update(value).digest();

function signingKey(secret, date) {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, date), REGION), SERVICE), "aws4_request");
}

/**
 * A presigned URL for `key`, valid for `expiresIn` seconds.
 *
 * The client acts on it directly with no credentials of its own. The payload is
 * unsigned — we cannot hash a file the server never sees — which is why the
 * caller is responsible for constraining what may be uploaded (who, where, and
 * how big) before minting one of these.
 */
export function presign(config, key, { method = "PUT", expiresIn = UPLOAD_EXPIRY_SECONDS } = {}) {
  const now = new Date();
  const amzDate = `${now.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
  const date = amzDate.slice(0, 8);

  const canonicalUri = `/${encodePath(`${config.bucket}/${key}`)}`;
  const credential = `${config.accessKeyId}/${date}/${REGION}/${SERVICE}/aws4_request`;

  // Sorted by key, as SigV4 requires. Written as pairs rather than built from
  // an object so the ordering is visible and cannot drift with insertion order.
  const query = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", credential],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresIn)],
    ["X-Amz-SignedHeaders", "host"],
  ]
    .map(([k, v]) => `${uriEncode(k)}=${uriEncode(v)}`)
    .join("&");

  const canonicalRequest = [
    method,
    canonicalUri,
    query,
    `host:${config.host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    `${date}/${REGION}/${SERVICE}/aws4_request`,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = createHmac("sha256", signingKey(config.secretAccessKey, date))
    .update(stringToSign)
    .digest("hex");

  return `https://${config.host}${canonicalUri}?${query}&X-Amz-Signature=${signature}`;
}

/** The upload case, which is the only one the API hands to a client. */
export const presignPut = (config, key, options) => presign(config, key, { ...options, method: "PUT" });

/** Where the object will be readable once uploaded. */
export function publicUrl(config, key) {
  return config.publicBase ? `${config.publicBase}/${encodePath(key)}` : null;
}

/**
 * Extensions we will hand out an upload URL for, and what each counts as.
 *
 * An allowlist rather than a blocklist, and it decides `kind` too, so the
 * client cannot label an .exe as an image and have the app try to render it.
 */
const TYPES = {
  jpg: ["image", "image/jpeg"],
  jpeg: ["image", "image/jpeg"],
  png: ["image", "image/png"],
  webp: ["image", "image/webp"],
  gif: ["image", "image/gif"],
  heic: ["image", "image/heic"],
  pdf: ["file", "application/pdf"],
  doc: ["file", "application/msword"],
  docx: ["file", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ppt: ["file", "application/vnd.ms-powerpoint"],
  pptx: ["file", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  xls: ["file", "application/vnd.ms-excel"],
  xlsx: ["file", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  txt: ["file", "text/plain"],
  mp4: ["video", "video/mp4"],
  mov: ["video", "video/quicktime"],
  webm: ["video", "video/webm"],
};

export function describeUpload(filename) {
  const ext = String(filename ?? "").split(".").pop()?.toLowerCase() ?? "";
  const match = TYPES[ext];
  if (!match) return null;
  return { extension: ext, kind: match[0], contentType: match[1] };
}

/** What an upload is for, which decides only where it is filed. */
export const UPLOAD_PURPOSES = { announcement: "announcements", note: "notes" };

/**
 * The object key, chosen by the server.
 *
 * Grouped by purpose and then by class so a bucket listing is navigable, and
 * ending in a random id so one upload can never overwrite another — including
 * deliberately, by a rep who guesses a classmate's filename. The original name
 * is not used in the key at all: it travels in the document instead, where it
 * cannot carry a path traversal or a surprise second extension.
 */
export function uploadKey({ groupKey, extension, purpose = "announcement" }) {
  const folder = UPLOAD_PURPOSES[purpose] ?? UPLOAD_PURPOSES.announcement;
  const safeGroup = String(groupKey).replace(/[^A-Za-z0-9_-]/g, "_");
  return `${folder}/${safeGroup}/${randomUUID()}.${extension}`;
}

/** Per-file ceiling. Generous for board photos and slide decks, hostile to video dumps. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
