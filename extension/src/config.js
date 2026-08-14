// Firebase *web* config — the same values the Handy web app ships in its
// bundle (see .env.local / README "Firebase config is not a secret"). The API
// key here identifies the project to Google's APIs; it grants nothing on its
// own. Every write this extension makes is authenticated as the student's own
// Firebase account and authorised by firestore.rules, exactly like the web
// app's writes.
export const FIREBASE_API_KEY = "AIzaSyD9DSr-j8KfuiGVjETaiFzf_FvBtvn-qTI";
export const FIREBASE_PROJECT_ID = "handyy-aus";

// Must match VITE_AUTH_EMAIL_DOMAIN in the web app's .env.local — the two
// sides have to derive the same synthetic email from a roll number or they'd
// create two different accounts for the same student.
export const AUTH_EMAIL_DOMAIN = "handy.local";

/**
 * Live production URL. `handy-vijayapardhus-projects.vercel.app` is the other
 * alias for the same deployment but sits behind Vercel's SSO protection, so it
 * is NOT usable here. Update this (and manifest.json's host_permissions and
 * externally_connectable) if a custom domain is attached later.
 */
export const HANDY_URL = "https://handy-aus.vercel.app";

/**
 * Server-side sync endpoint (api/sync.js, deployed with the web app). Writing
 * through it means no student password is involved in syncing at all, so any
 * machine running this extension can keep any student's data current — even a
 * student who changed their Handy password.
 *
 * Set to null to force the direct-to-Firestore fallback (cloudSync.js), which
 * authenticates as the student instead.
 */
export const SYNC_ENDPOINT = `${HANDY_URL}/api/sync`;

/**
 * Shared secret for that endpoint; must equal HANDY_SYNC_API_KEY in the
 * Vercel project. It ships inside the extension, so treat it as a speed bump
 * against casual abuse rather than a real secret — the endpoint is also rate
 * limited per roll number. Rotate it in both places together.
 */
export const SYNC_API_KEY = "handy-sync-zKtSG70yVmMZtVpSp5PHijLMjBl8cijJ";

/** Mirrors rollNumberToEmail() in src/services/firebase/auth.ts. */
export function rollNumberToEmail(rollNumber) {
  return `${String(rollNumber).trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}
