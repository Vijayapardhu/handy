// Service worker. Stores already-normalized captures (built by parser.js in
// the content script), pushes them into the student's own Handy/Firebase
// account (cloudSync.js), and answers three message channels:
//   - chrome.runtime.onMessage from capture.isolated.js / autoTimetable.js on
//     info.aec.edu.in.
//   - chrome.runtime.onMessage from the popup (status, manual re-sync).
//   - chrome.runtime.onMessageExternal from the Handy web app's own origin
//     (allow-listed in manifest.json's externally_connectable — no other site
//     can reach this).
//
// There is no opt-in step anywhere: seeing a roll number is enough to create
// that student's account and sync it (see account.js).
//
// Loaded as an ES module ("type": "module" in manifest.json) so it can import
// the modules below; the content scripts remain plain non-module scripts.
import { ACCOUNT_PASSWORD, ACCOUNT_STATE, forgetAccount, getAccount, setPassword } from "./account.js";
import { syncSnapshotToCloud } from "./cloudSync.js";

const SNAPSHOT_KEY = "handy:lastSnapshot";
const HISTORY_KEY = "handy:history";
const TIMETABLE_KEY = "handy:lastTimetable";
const AUTO_TIMETABLE_KEY = "handy:autoTimetablePending";
const MAX_HISTORY = 20;

const TIMETABLE_PAGE_URL = "https://info.aec.edu.in/aus/Academics/studenttimetableoption.aspx";
/** Give the helper tab this long to produce a timetable before leaving it to the student. */
const AUTO_TIMETABLE_TIMEOUT_MS = 30_000;

/** Tab this extension opened by itself, so it can close it again once it's done its job. */
let helperTabId = null;

console.log("[Handy] background service worker started");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[Handy] background received internal message:", message?.type, "from", sender?.url);

  if (message?.type === "CAPTURE_SNAPSHOT" && message.snapshot) {
    handleProfileCapture(message.snapshot)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: String(error?.message ?? error) }));
    return true; // keep the message channel open for the async response
  }

  if (message?.type === "CAPTURE_TIMETABLE" && message.timetable) {
    handleTimetableCapture(message.timetable)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: String(error?.message ?? error) }));
    return true;
  }

  handlePopupMessage(message).then(sendResponse);
  return true;
});

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  console.log("[Handy] background received external message:", message?.type, "from", sender?.origin);
  handleExternalMessage(message).then(sendResponse);
  return true;
});

// A sync that failed while offline shouldn't wait for the student to visit the
// portal again — retry once the browser comes back up.
chrome.runtime.onStartup.addListener(() => {
  retryPendingSync().catch((error) => console.warn("[Handy] startup retry failed:", error));
});

async function handleProfileCapture(snapshot) {
  await storeSnapshot(snapshot);
  console.log("[Handy] snapshot stored for", snapshot.rollNumber);

  const result = await syncNow();
  // The timetable lives on a different page the student has no reason to
  // visit, so fetch it for them rather than leaving Timetable/Leave Planner
  // permanently empty.
  await ensureTimetableCaptured();
  return { ok: true, ...result };
}

async function handleTimetableCapture(timetable) {
  await chrome.storage.local.set({ [TIMETABLE_KEY]: timetable, [AUTO_TIMETABLE_KEY]: false });
  console.log("[Handy] timetable stored:", timetable.name, timetable.slots.length, "slots");

  await closeHelperTab();

  // The timetable is only writable attached to a profile capture (it needs
  // the student's identity and branch), so re-sync the merged snapshot.
  const snapshot = await getStoredSnapshot();
  const result = snapshot ? await syncNow() : { ok: false, error: "no_snapshot" };
  return { ok: true, ...result };
}

async function storeSnapshot(snapshot) {
  await chrome.storage.local.set({ [SNAPSHOT_KEY]: snapshot });

  const { [HISTORY_KEY]: history = [] } = await chrome.storage.local.get(HISTORY_KEY);
  const next = [snapshot, ...history.filter((entry) => entry.capturedAt !== snapshot.capturedAt)].slice(
    0,
    MAX_HISTORY,
  );
  await chrome.storage.local.set({ [HISTORY_KEY]: next });
}

/**
 * The profile capture with the timetable capture attached. The two come from
 * different pages and arrive at different times, so they're stored separately
 * and merged here — every consumer (sync, popup, the web app) wants them as
 * one snapshot, and `timetable` is simply absent until that page is visited.
 */
async function getStoredSnapshot() {
  const { [SNAPSHOT_KEY]: snapshot = null, [TIMETABLE_KEY]: timetable = null } =
    await chrome.storage.local.get([SNAPSHOT_KEY, TIMETABLE_KEY]);
  if (!snapshot) return null;
  return timetable ? { ...snapshot, timetable } : snapshot;
}

async function syncNow() {
  const snapshot = await getStoredSnapshot();
  if (!snapshot?.rollNumber) {
    await setBadge("!", "#f59e0b", 0);
    return { ok: false, error: "no_roll_number" };
  }

  try {
    const result = await syncSnapshotToCloud(snapshot);
    await setBadge("✓", "#16a34a");
    return { ok: true, ...result };
  } catch (error) {
    console.warn("[Handy] cloud sync failed:", error);
    await setBadge("!", "#dc2626", 0);
    return { ok: false, error: error?.code ?? String(error?.message ?? error) };
  }
}

async function retryPendingSync() {
  const snapshot = await getStoredSnapshot();
  if (!snapshot?.rollNumber) return;
  const account = await getAccount(snapshot.rollNumber);
  if (account?.lastError) await syncNow();
}

/**
 * Opens the portal's timetable page in a background tab and lets
 * autoTimetable.js pick a timetable there. The flag is what authorises that
 * script to click anything — without it, it stays passive on pages the
 * student opened themselves.
 */
async function ensureTimetableCaptured() {
  const { [TIMETABLE_KEY]: timetable = null } = await chrome.storage.local.get(TIMETABLE_KEY);
  if (timetable) return;
  if (helperTabId !== null) return; // one attempt at a time

  console.log("[Handy] no timetable captured — opening the timetable page in the background");
  await chrome.storage.local.set({ [AUTO_TIMETABLE_KEY]: true });

  const tab = await chrome.tabs.create({ url: TIMETABLE_PAGE_URL, active: false });
  helperTabId = tab.id;

  // If the page never yields a timetable (layout changed, session expired),
  // stop tracking but leave the tab open — it's the student's way to finish
  // the job by hand, and silently closing it would hide the problem.
  setTimeout(async () => {
    if (helperTabId === tab.id) {
      console.warn("[Handy] timetable auto-capture timed out — leaving the tab open");
      helperTabId = null;
      await chrome.storage.local.set({ [AUTO_TIMETABLE_KEY]: false });
    }
  }, AUTO_TIMETABLE_TIMEOUT_MS);
}

async function closeHelperTab() {
  if (helperTabId === null) return;
  const tabId = helperTabId;
  helperTabId = null;
  try {
    await chrome.tabs.remove(tabId);
  } catch {
    // Already closed by the student — nothing to do.
  }
}

/** Everything the popup renders, in one round trip. */
async function buildStatus() {
  const snapshot = await getStoredSnapshot();
  const rollNumber = snapshot?.rollNumber ?? null;
  const account = rollNumber ? await getAccount(rollNumber) : null;

  return {
    ok: true,
    snapshot,
    password: ACCOUNT_PASSWORD,
    account: account
      ? {
          rollNumber: account.rollNumber,
          state: account.state ?? null,
          lastSyncAt: account.lastSyncAt ?? null,
          lastError: account.lastError ?? null,
        }
      : null,
  };
}

async function handlePopupMessage(message) {
  switch (message?.type) {
    case "GET_STATUS":
      return buildStatus();

    case "SYNC_NOW": {
      const result = await syncNow();
      await ensureTimetableCaptured();
      return { ...(await buildStatus()), syncResult: result };
    }

    case "RESET": {
      const snapshot = await getStoredSnapshot();
      if (snapshot?.rollNumber) await forgetAccount(snapshot.rollNumber);
      await chrome.storage.local.remove([SNAPSHOT_KEY, HISTORY_KEY, TIMETABLE_KEY, AUTO_TIMETABLE_KEY]);
      await setBadge("", "#000000", 0);
      return buildStatus();
    }

    default:
      return { ok: false, error: "unknown_message_type" };
  }
}

async function handleExternalMessage(message) {
  switch (message?.type) {
    case "PING":
      return { ok: true, version: chrome.runtime.getManifest().version };

    case "GET_LATEST_SNAPSHOT":
      return { ok: true, snapshot: await getStoredSnapshot() };

    /**
     * Lets Handy offer "continue as <roll number>" instead of a login form.
     * Only the origins in manifest.json's externally_connectable can send
     * this — Chrome enforces that, not us.
     */
    case "GET_ACCOUNT": {
      const snapshot = await getStoredSnapshot();
      if (!snapshot?.rollNumber) return { ok: true, account: null };
      const account = await getAccount(snapshot.rollNumber);
      if (!account?.uid || account.state === ACCOUNT_STATE.needsPassword) {
        return { ok: true, account: null };
      }
      return {
        ok: true,
        account: {
          rollNumber: account.rollNumber,
          password: account.password ?? ACCOUNT_PASSWORD,
        },
      };
    }

    /**
     * Keeps syncing alive without ever asking the student for a password.
     *
     * Accounts are created with a shared default, so the stored credential
     * only goes stale if the student changes their password in Handy — and at
     * that exact moment the web app knows the new one, so it pushes it here
     * (on a successful sign-in, and right after a password change). Sync
     * resumes on its own; the popup has no password input at all.
     *
     * `setPassword` verifies by signing in before storing, so a bogus push
     * can't overwrite a working credential, and only the allow-listed Handy
     * origins can send this at all (Chrome enforces externally_connectable).
     */
    case "SET_PASSWORD": {
      if (!message.rollNumber || !message.password) return { ok: false, error: "missing_fields" };
      try {
        await setPassword(message.rollNumber, message.password);
      } catch (error) {
        return { ok: false, error: error?.code ?? "sign_in_failed" };
      }
      // Push whatever is waiting locally now that we can authenticate again.
      const snapshot = await getStoredSnapshot();
      if (snapshot) await syncNow();
      return { ok: true };
    }

    case "CLEAR_SNAPSHOT":
      await chrome.storage.local.remove([SNAPSHOT_KEY, HISTORY_KEY, TIMETABLE_KEY]);
      return { ok: true };

    default:
      return { ok: false, error: "unknown_message_type" };
  }
}

/** `holdMs: 0` leaves the badge up until the next sync — used for states the student should see. */
async function setBadge(text, color, holdMs = 4000) {
  await chrome.action.setBadgeText({ text });
  if (text) await chrome.action.setBadgeBackgroundColor({ color });
  if (holdMs > 0) setTimeout(() => chrome.action.setBadgeText({ text: "" }), holdMs);
}
