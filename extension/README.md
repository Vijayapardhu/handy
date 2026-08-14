# Handy College Sync (browser extension)

Reads your Aditya University attendance and timetable from the Campus Connect
pages you're **already logged into**, provisions your Handy account, and
syncs the data into it. It never sees, stores, asks for, or submits your
*college* roll number/password — the sign-in you do on `info.aec.edu.in`
(Cloudflare check included) happens exactly as it always does, in your own
browser tab. This extension only reads responses that page's own script
already fetched, after you're signed in.

It does hold one credential: the **Handy** password it generates for you (see
"Your Handy account" below).

## How it works

1. `src/capture.main.js` runs in the *page's* JS context on
   `info.aec.edu.in` and watches for the site's own `fetch`/`XHR` calls that
   hit `.../studentprofile.aspx/ShowStudentProfileNew` (attendance) or
   `.../studenttimetableoption.aspx/ShowTimeTables` (weekly timetable). It
   doesn't make any request itself — it observes ones the page already makes.
   **Confirmed by live testing:** on `StudentMaster.aspx`, this call actually
   happens inside an `<iframe>` (`Academics/StudentProfile.aspx?scrid=...`),
   not the top-level frame — that's why both `content_scripts` entries in
   `manifest.json` set `"all_frames": true`. If you ever narrow that back to
   `false` "to reduce noise," the extension silently stops capturing again.
2. `src/parser.js` + `src/capture.isolated.js` parse those responses. Both
   arrive in the ASP.NET `{"d": ...}` envelope, but the payloads differ: the
   profile one wraps **HTML** (parsed as markup), the timetable one wraps a
   **JSON string** (parsed twice). Output is a normalized snapshot: bio-data,
   per-subject attendance (held/attended/%), a total row, and the weekly
   slot grid.
3. `src/background.js` stores the latest capture in `chrome.storage.local`
   and then syncs it to Firestore as *you* (see below). The two captures are
   stored separately and merged, since they come from different pages.
4. The Handy web app (an allow-listed origin in `manifest.json`'s
   `externally_connectable`) can also ask the extension for the snapshot and
   for the account credential, via `chrome.runtime.sendMessage`.

## Your Handy account

The first time it sees a roll number, the extension creates that student's
Handy account and syncs their data. There is no signup form and no permission
prompt — seeing the roll number is enough.

- `src/account.js` registers `<roll>@handy.local` with the shared password
  `Handy@123` and caches the refresh token in `chrome.storage.local`, keyed by
  roll number (so a shared college machine doesn't hand one student's session
  to the next).
- `src/cloudSync.js` prefers to POST the capture to the Handy web app's
  `/api/sync` endpoint (`api/sync.js`), which writes with the Firebase Admin
  SDK server-side. **No student password is involved on that path**, which is
  what lets any machine sync any student. `SYNC_API_KEY` in `src/config.js`
  must match `HANDY_SYNC_API_KEY` on the server.
- If that endpoint is unreachable (not deployed, offline, 5xx), it falls back
  to `src/firebaseRest.js`, which talks to Firebase over plain REST —
  Identity Toolkit for auth, Firestore's `:commit` for writes. **No Firebase
  SDK and no bundler**, which is why this extension is still just files
  Chrome loads directly. Those writes carry *that student's* ID token, so
  `firestore.rules` constrains them exactly as it constrains the web app.
- Either way the extension holds **no privileged credential**. The
  service-account key lives only in the server function's environment and
  must never be placed in this folder — anything shipped here is readable by
  anyone who installs the extension, and that key bypasses every rule.
- `src/snapshotMapping.js` mirrors `buildImportDocs()` in the web app
  (`src/services/students/collegePortalImportService.ts`) so both routes
  write byte-identical documents. `src/services/students/collegePortalImportService.test.ts`
  asserts the two agree — **if you change one, change the other.**

⚠️ The shared password is a deliberate trade — see the README's auth section
for what it costs. There is also **no password reset** (`handy.local` can't
receive mail); Profile → Change Password while signed in is the only way one
ever changes.

**Syncing never asks for a password, and the popup has no input in it at
all.** If a student changes their Handy password, the stored credential goes
stale — and at that moment the web app is the only thing that knows the new
one, so it pushes it back over `externally_connectable` (on a successful
sign-in, and immediately after a change). `SET_PASSWORD` verifies the
credential by signing in before storing it, so a bogus push can't clobber a
working one. Syncing resumes by itself; the popup just says "open Handy and
sign in once" while it waits.

Two things keep that message honest, both learned the hard way:

- A stale credential is only *concluded* from an outright rejection by
  Identity Toolkit (`INVALID_LOGIN_CREDENTIALS` and friends). Sign-in and
  sign-up fail identically when the account exists but the server was
  throttling or erroring, and treating that as "your password changed" sends
  a student to fix a password that was never wrong.
- The popup asks "is my data reaching Handy", not "is every stored credential
  current". Those came apart when the server sync route landed: it writes with
  the Admin SDK and never touches a student password, so an account can sit
  flagged `needsPassword` while syncing perfectly. The bar only appears when
  the stale credential is actually blocking a sync, and a successful sync
  through the server re-checks the stored password once and clears the flag if
  it still works.

The Handy web app has **no signup screen** — this extension is the only thing
that can create an account. A student who has never run it has nothing to sign
in to.

## Automatic timetable capture

The timetable only hits the network when something is chosen on
`studenttimetableoption.aspx` — the page doesn't fetch it on load — so a
purely passive extension would never see it. After a profile capture with no
timetable stored, `background.js` opens that page in a **background tab** and
`src/autoTimetable.js` picks a timetable there; the tab closes itself as soon
as the capture lands.

Two things to know if this misbehaves:

- `autoTimetable.js` only acts when `background.js` has set the
  `handy:autoTimetablePending` flag, so it can never click things on a page
  you opened yourself.
- The page is WebForms with generated control ids, so the selection is
  **heuristic** — first real `<select>` option, then a button whose text looks
  like "show". If the page layout changes it gives up after ~5s, logs what it
  found, and leaves the tab open for you to finish by hand.

## Load it (unpacked, for development)

1. Chrome/Edge → `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select this `extension/` folder.
3. Log into `https://info.aec.edu.in/aus/` as you normally do and open your
   **Student Profile** page (Menu → Profile, or wherever "PERFORMANCE
   (Present)" attendance loads). That's the only page you need to visit — the
   extension fetches the timetable itself, in a background tab.
4. The badge shows a green check once it has synced, or a red `!` if
   something failed. Click the icon to see what was captured.
5. Open Handy and hit "Continue as `<roll number>`" on the login screen, or
   sign in with your roll number and `Handy@123`.

## Trusted origins

`manifest.json` → `externally_connectable.matches` lists which web origins
are allowed to message this extension: the deployed app
(`https://handy.vijayaapardhu.dev`) and local dev
(`http://localhost:5173`, `http://127.0.0.1:5173`). No other site can reach
it. Add more origins there if you deploy Handy elsewhere.

## Stable extension ID

`manifest.json` embeds a `"key"` (a public key) so the extension gets the
same ID (`ledmfeohpnfmepdbncmcidoaflhijmkn`) whether it's loaded unpacked
from any folder or eventually packed/published — the Handy web app hardcodes
this ID to talk to the extension. The matching private key lives in
`build/ext-private.pem` (gitignored) — you only need it if you ever
re-generate the keypair; it's not used at runtime.

## Test harness (parser + popup, no browser install needed)

`extension/test/` has two harness pages that exercise the real shipped code
against the real sample `ShowStudentProfileNew` response (`sample-response.json`,
captured from a real account) — no extension install, no login, no
Cloudflare involved:

- `parser.test.html` — runs `HandyParser.parseProfileResponse` on the sample
  and asserts the output field-by-field (roll number, bio data, all 8
  subjects, the TOTAL row, a zero-held subject).
- `popup.test.html` — mocks `chrome.runtime`/`chrome.tabs` and loads the real
  `popup.js` + `popup.css`, so you can eyeball the actual popup UI. Buttons at
  the top switch between every state (synced, awaiting timetable, syncing,
  sync failed, changed password, wrong password, nothing captured) — the
  fastest way to review the UI without provisioning real accounts. (Note the
  percentages render to two decimals everywhere, ring included — the exact
  figure is the point, so it is never rounded for display.)

The timetable half is covered by the repo's normal `npm test` instead:
`src/services/students/collegePortalImportService.test.ts` runs the real
`parseTimetableResponse` against the real `sample-timetable.json` under
Node (that payload is JSON, so unlike the profile parser it needs no DOM),
then asserts the extension's and the web app's document mappings agree
exactly. `src/services/extension/firebaseRest.test.ts` pins the REST
value-encoding against what the Firebase SDK would write.

Serve the repo root and open either page:

```bash
node extension/test/server.mjs   # serves the repo at http://localhost:5588
# then open http://localhost:5588/extension/test/parser.test.html
# and       http://localhost:5588/extension/test/popup.test.html
```

This is what caught two real bugs during development: the bio-data parser
was letting the (usually blank) Guardian-Details "Name" row clobber the
student's actual name, and the TOTAL row's `colspan="3"` cell was collapsing
the row to 4 `<td>`s instead of 6, so it got silently skipped. Both are
fixed and covered by `parser.test.html`'s assertions now.

What this harness does **not** cover: the real capture path (`capture.main.js`
hooking the page's `fetch`/`XHR`, `capture.isolated.js` relaying via
`postMessage`, `background.js` storing it) — that only runs inside an
actually-loaded extension on the real site, which requires you to load it
unpacked and log in yourself (see above).

## Regenerating icons or the keypair

```bash
node extension/scripts/generate-icons.mjs
```

See the commands in this project's session history (or re-derive with
`openssl genrsa` / `openssl rsa -pubout -outform DER`) if you need a fresh
keypair — doing so changes the extension ID, so you'd also need to update
`EXTENSION_ID` in the Handy app's `src/services/extension/handyExtensionBridge.ts`.
