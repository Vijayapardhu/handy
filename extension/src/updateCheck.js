// Checks whether a newer build of this extension has been published, and
// tells the popup about it.
//
// Chrome only auto-updates an extension installed from the Web Store. Handy's
// extension ships unpacked — see extension/tool/pack.mjs's comment on why
// there is no signing step and no store listing — and Chrome has no mechanism
// at all for a sideloaded extension to replace its own files. A student always
// has to re-download the zip and click "reload" in chrome://extensions
// themselves. So this cannot be an installer the way mobile's is; it can only
// notice and say so, the same honest ceiling extension/tool/INSTALL.md already
// describes for installing in the first place.
//
// The source of truth is the same `appUpdates` Firestore collection the
// mobile app already reads (mobile/lib/data/updates.dart) and the admin panel
// already publishes to (admin/src/pages/Updates/UpdatesPage.tsx, platform
// "extension" has been a selectable option there since it shipped) — one
// place to publish a release note, not a second one that quietly goes stale.
import { authenticate, listRollNumbers } from "./account.js";
import { queryCollection } from "./firebaseRest.js";

const UPDATE_KEY = "handy:updateAvailable";
const DISMISSED_KEY = "handy:updateDismissed";

/** The leading number in one dotted part, ignoring whatever decorates it.
 *
 * Mirrors Updates._part in mobile/lib/data/updates.dart exactly: versions are
 * typed by a person in the admin panel, and 'v1.2.0' is what someone copying a
 * GitHub tag pastes. Parsing that part strictly gives zero, which makes the
 * whole version 0.0.0 — older than every install, so nobody is ever told an
 * update exists and the failure is completely silent.
 */
function part(value) {
  const match = /\d+/.exec(String(value ?? ""));
  return match ? Number(match[0]) : 0;
}

/**
 * Compares dotted versions numerically. Same algorithm as
 * Updates.compareVersions in mobile/lib/data/updates.dart — string comparison
 * gets this wrong exactly when it matters ('1.10.0' sorts before '1.9.0'),
 * and the two clients disagreeing about which version is newer is worse than
 * either being wrong alone.
 */
export function compareVersions(a, b) {
  const left = String(a ?? "").split(".").map(part);
  const right = String(b ?? "").split(".").map(part);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * A token good enough to satisfy `appUpdates`' `isSignedIn()` read rule.
 *
 * The rule doesn't care *whose* token — appUpdates is platform-wide, not
 * student data — so this tries every account this browser knows about and
 * takes the first that authenticates, rather than needing to decide which
 * student "owns" a background check. On a machine with no captured account
 * yet, there is nothing to authenticate with; returns null rather than
 * throwing, and the caller skips the check for now.
 */
async function anyIdToken() {
  const rollNumbers = await listRollNumbers();
  for (const rollNumber of rollNumbers) {
    try {
      const { idToken } = await authenticate(rollNumber);
      return idToken;
    } catch {
      // Try the next account. A single student's expired session or
      // changed password is not a reason to skip the whole check.
    }
  }
  return null;
}

/**
 * Reads `appUpdates` and stores what the popup should show, if anything.
 *
 * Never throws — this runs unattended from an alarm, with nobody watching to
 * handle a rejection. A failed check just means the badge stays whatever it
 * already was; the next scheduled run tries again.
 */
export async function checkForUpdate() {
  try {
    const idToken = await anyIdToken();
    if (!idToken) return null;

    const docs = await queryCollection(idToken, "appUpdates", [["platform", "==", "extension"]]);
    if (docs.length === 0) return null;

    // Newest by version, not by publishedAt — a mistyped or backdated
    // publishedAt should not make an older release win.
    const latest = docs.reduce((best, doc) =>
      !best || compareVersions(doc.version, best.version) > 0 ? doc : best,
    );

    const currentVersion = chrome.runtime.getManifest().version;
    if (compareVersions(latest.version, currentVersion) <= 0) {
      // Caught up (or a stale doc got corrected downward) — clear anything
      // left over from a previous, newer-looking check.
      await chrome.storage.local.remove(UPDATE_KEY);
      await setBadge(null);
      return null;
    }

    const required =
      Boolean(latest.minSupportedVersion) && compareVersions(currentVersion, latest.minSupportedVersion) < 0;

    const update = {
      version: latest.version,
      changelog: latest.changelog ?? "",
      downloadUrl: latest.downloadUrl ?? "",
      required,
      checkedAt: new Date().toISOString(),
    };
    await chrome.storage.local.set({ [UPDATE_KEY]: update });
    await setBadge(required ? "!" : "•");
    return update;
  } catch {
    return null;
  }
}

/** What the popup should render, if anything — read from storage, not a live check. */
export async function getStoredUpdate() {
  const { [UPDATE_KEY]: update = null, [DISMISSED_KEY]: dismissed = null } =
    await chrome.storage.local.get([UPDATE_KEY, DISMISSED_KEY]);
  if (!update) return null;
  // A required update (below minSupportedVersion) is never dismissable —
  // matches AppUpdate.required on the mobile side, for the same reason: the
  // install is expected to misbehave, not merely be behind.
  if (!update.required && dismissed === update.version) return null;
  return update;
}

/** Marks the current update dismissed and clears the badge — not offered when `required`. */
export async function dismissUpdate() {
  const { [UPDATE_KEY]: update = null } = await chrome.storage.local.get(UPDATE_KEY);
  if (!update || update.required) return;
  await chrome.storage.local.set({ [DISMISSED_KEY]: update.version });
  await setBadge(null);
}

async function setBadge(text) {
  if (!chrome.action?.setBadgeText) return;
  await chrome.action.setBadgeText({ text: text ?? "" });
  if (text) await chrome.action.setBadgeBackgroundColor({ color: "#d97706" });
}
