// Popup UI. Deliberately a plain (non-module) script so the test harness in
// extension/test/popup.test.html can load it with mocked chrome APIs.
//
// This is a status window, not a control panel: everything happens by itself
// in the service worker, so the popup's job is to answer three questions at a
// glance — where do I stand, did it reach Handy, and how do I get in.
const HANDY_URL = "https://handy.vijayaapardhu.dev";

let status = null;

async function load() {
  status = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
  render();
}

function render() {
  const root = document.getElementById("root");
  root.classList.remove("loading");

  const snapshot = status?.snapshot ?? null;

  if (!snapshot) {
    root.innerHTML = `
      ${updateBanner()}
      <div class="empty">
        <div class="empty-mark">H</div>
        <p class="empty-title">Nothing captured yet</p>
        <p class="empty-hint">Sign in to Campus Connect and open your Student Profile.
        Handy picks it up from the page you're already on — and creates your account for you.</p>
      </div>`;
    wireUpdateBanner();
    return;
  }

  const total = snapshot.attendance?.total;
  const subjects = snapshot.attendance?.subjects ?? [];
  const percent = total?.percent ?? 0;

  root.innerHTML = `
    ${updateBanner()}

    <div class="hero ${band(percent)}">
      ${ring(percent)}
      <div class="hero-body">
        <div class="hero-name" title="${escapeHtml(snapshot.studentName ?? "")}">${escapeHtml(
          snapshot.studentName ?? "Unknown student",
        )}</div>
        <div class="hero-roll">${escapeHtml(snapshot.rollNumber ?? "")}</div>
        ${total ? `<div class="hero-meta">${total.attended} of ${total.held} classes</div>` : ""}
      </div>
    </div>

    ${statusBar()}

    <div class="subjects">${subjects.map(subjectRow).join("")}</div>

    <button id="openBtn" type="button" class="primary">Open Handy</button>
    <p class="signin">Sign in with <b>${escapeHtml(snapshot.rollNumber ?? "")}</b></p>
  `;

  document.getElementById("openBtn").addEventListener("click", () => chrome.tabs.create({ url: HANDY_URL }));
  document.getElementById("syncBtn")?.addEventListener("click", sync);
  wireUpdateBanner();
}

/**
 * A newer build is on record in appUpdates — see updateCheck.js. Chrome
 * cannot install it for the student (this extension is unpacked, not from the
 * Web Store), so the only honest offer here is the download and a reminder of
 * the manual reload step; INSTALL.md has the full version of those steps.
 *
 * `required` (the install has fallen below minSupportedVersion) drops the
 * dismiss control — matches AppUpdate.required on mobile, and for the same
 * reason: this build is expected to misbehave, not merely be behind.
 */
function updateBanner() {
  const update = status?.update ?? null;
  if (!update) return "";

  return `
    <div class="bar ${update.required ? "bad" : "update"} column">
      <span><b>Handy ${escapeHtml(update.version)} is out.</b> ${escapeHtml(
        update.required
          ? "This copy is old enough that syncing may misbehave — please update."
          : "New version available to download.",
      )}</span>
      <div class="row">
        <button id="updateBtn" type="button" class="ghost">Get it</button>
        ${update.required ? "" : '<button id="dismissUpdateBtn" type="button" class="ghost">Later</button>'}
      </div>
    </div>`;
}

function wireUpdateBanner() {
  const update = status?.update ?? null;
  if (!update) return;
  document
    .getElementById("updateBtn")
    ?.addEventListener("click", () => chrome.tabs.create({ url: update.downloadUrl || HANDY_URL }));
  document.getElementById("dismissUpdateBtn")?.addEventListener("click", async () => {
    status = await chrome.runtime.sendMessage({ type: "DISMISS_UPDATE" });
    render();
  });
}

/** Progress ring — the one piece of chrome worth the pixels, since the number is the whole point. */
function ring(percent) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * Math.min(Math.max(percent, 0), 100) / 100;
  return `
    <svg class="ring" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
      <circle class="ring-track" cx="32" cy="32" r="${radius}" fill="none" stroke-width="6" />
      <circle class="ring-value" cx="32" cy="32" r="${radius}" fill="none" stroke-width="6"
              stroke-linecap="round" stroke-dasharray="${filled} ${circumference}"
              transform="rotate(-90 32 32)" />
      <text class="ring-text" x="32" y="33" text-anchor="middle" dominant-baseline="middle">${percent.toFixed(
        2,
      )}%</text>
    </svg>`;
}

/**
 * One bar, one state. There is deliberately no input anywhere in this popup:
 * syncing never asks for a password. The one case where the stored credential
 * stops working — the student changed their Handy password — is fixed by
 * signing in on the website once, which pushes the new password back here
 * automatically (see handyExtensionBridge.setExtensionPassword).
 *
 * The bar answers "is my data reaching Handy", not "is every stored credential
 * current". Those came apart once the server sync route landed: it writes with
 * the Admin SDK and never touches a student password, so an account can be
 * flagged `needsPassword` while syncing perfectly. Showing an alarm then is
 * just wrong — it asks the student to fix something that isn't broken.
 */
function statusBar() {
  const account = status?.account ?? null;
  const hasTimetable = Boolean(status?.snapshot?.timetable);
  const blocked = account?.state === "needsPassword" && Boolean(account?.lastError);

  if (blocked) {
    return `
      <div class="bar bad column">
        <span>Your Handy password changed. Open Handy and sign in once — syncing resumes by itself.</span>
      </div>`;
  }

  if (account?.lastError) {
    return `
      <div class="bar bad">
        <span><b>Couldn't reach Handy.</b> Your data is saved here.</span>
        <button id="syncBtn" type="button" class="ghost">Retry</button>
      </div>`;
  }

  if (!account?.lastSyncAt) {
    return `<div class="bar muted"><span class="pulse">Syncing to Handy…</span></div>`;
  }

  return `
    <div class="bar good">
      <span>Synced ${escapeHtml(relativeTime(account.lastSyncAt))}${
        hasTimetable
          ? ` · timetable ${escapeHtml(status.snapshot.timetable.name ?? "")}`
          : " · getting timetable…"
      }</span>
      <button id="syncBtn" type="button" class="ghost">Sync</button>
    </div>`;
}

async function sync() {
  const btn = document.getElementById("syncBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "…";
  }
  status = await chrome.runtime.sendMessage({ type: "SYNC_NOW" });
  render();
}

function subjectRow(subject) {
  const pct = Math.min(Math.max(subject.percent, 0), 100);
  return `
    <div class="subject ${band(subject.percent)}">
      <div class="subject-top">
        <span class="subject-name" title="${escapeHtml(subject.name)}">${escapeHtml(subject.name)}</span>
        <span class="subject-pct">${subject.percent.toFixed(2)}%</span>
      </div>
      <div class="subject-track"><div class="subject-fill" style="width:${pct}%"></div></div>
      <div class="subject-meta">${subject.attended}/${subject.held}</div>
    </div>`;
}

/** Same thresholds the popup has always previewed with — not the college-configured ones. */
function band(percent) {
  if (percent >= 75) return "good";
  if (percent >= 65) return "warn";
  return "bad";
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function relativeTime(iso) {
  if (!iso) return "just now";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

load();
