# Handover — College Portal Sync (browser extension + self-registration)

Written mid-task for a handoff to another AI/session. Read this before touching
anything below — several pieces are half-wired and will break the build or
silently no-op if you skip straight to "continue the feature."

## TL;DR of what this project became

"Handy" ([README.md](README.md)) is a React/TS/Vite + Firebase attendance app.
It started as a demo app with Firebase-seeded fake data. It now pulls **real**
attendance and the **real weekly timetable** from Aditya University's actual
student portal (`info.aec.edu.in`, an ASP.NET WebForms site behind Cloudflare)
via a companion browser extension. That extension also provisions the
student's Handy account — with a unique per-student password — and writes the
captured data straight into the same Firestore collections the rest of the app
reads. There is no signup form to fill in and no separate "synced" view: the
portal capture *is* the student's record.

Part 1 (capture) is tested and confirmed working against the live site. Part 2
(accounts, cloud sync, timetable) is fully written, unit-tested and deployed
but **has never been run in a browser** — read Part 2's "Verification status"
before assuming anything works end to end.

## Part 1 — Browser extension: DONE, tested, working end-to-end

`extension/` is a Manifest V3 Chrome extension, "Handy College Sync." Fully
built, tested, and confirmed working against the real site by the user. Do
not re-litigate this part unless something regresses.

**How it works:** `capture.main.js` (MAIN world) hooks the page's own
`fetch`/`XHR` and watches for the `ShowStudentProfileNew` response. `parser.js`
+ `capture.isolated.js` (isolated world) parse that response — an ASP.NET
PageMethod envelope `{"d": "<html string>"}`, NOT structured JSON — into a
normalized `snapshot` object, then relay it to `background.js` (service
worker) which stores it in `chrome.storage.local`. The popup shows it. The
Handy web app can pull it via `chrome.runtime.sendMessage` to a pinned
extension ID (`externally_connectable` in manifest.json, matching
`handy.vijayaapardhu.dev` and localhost:5173).

**Two real bugs found and fixed via testing** (see `extension/README.md` "Test
harness" section for how to re-run):
1. Bio-data parser let a blank "Name" row in the Guardian-Details section
   (further down the same HTML blob) clobber the real student name — fixed by
   scoping to the Personal Details table + first-match-wins.
2. The TOTAL row of the attendance table uses `colspan="3"` on its label
   cell, which collapses it to 4 `<td>`s instead of 6 in the actual DOM — a
   naive `cells.length < 6` guard was silently skipping it. Fixed by
   detecting "TOTAL" by content before that length check.

**One critical, non-obvious finding from live testing against the real
site:** the attendance/profile report on `StudentMaster.aspx` actually loads
inside an **`<iframe>`** (`Academics/StudentProfile.aspx?scrid=...`), not the
top-level frame. `manifest.json`'s `content_scripts` entries MUST keep
`"all_frames": true` — if someone "cleans that up" back to `false`, capture
silently stops working with no error anywhere. This is documented in
`extension/README.md` but is easy to miss/revert.

**Extension ID is pinned** via a generated RSA keypair (`extension/build/`,
gitignored — private key never needed at runtime) so the extension ID is
stable (`ledmfeohpnfmepdbncmcidoaflhijmkn`) regardless of how it's loaded.
This ID is hardcoded in `src/services/extension/handyExtensionBridge.ts`. If
you ever regenerate the keypair, update that constant too.

**Test harness** (`extension/test/`): `parser.test.html` runs the real
`parser.js` against a real captured sample (`sample-response.json`, from the
user's own account) and asserts every field — 17/17 passing as of this
writing. `popup.test.html` mocks `chrome.storage`/`chrome.tabs` and renders
the real `popup.js`. `server.mjs` is a zero-dep static file server to serve
these over `http://localhost:5588` (avoids file:// CORS quirks). Run via:
```bash
node extension/test/server.mjs
# open http://localhost:5588/extension/test/parser.test.html
```

**Repo-wide fixes made along the way** (not extension-specific, but were
blocking verification):
- `tsconfig.app.json`: `lib` bumped `ES2020` → `ES2022` (a pre-existing file,
  `attendanceService.ts`, used `Array.prototype.at()` which needs it).
- `eslint.config.js`: was missing almost all global type definitions
  (browser DOM globals, Node globals, `chrome`) — added proper `globals`
  package usage per file category (app `.ts/.tsx` → browser globals; config/
  script `.mjs`/`*.config.ts` → node globals; `extension/src|popup/*.js` →
  browser + webextensions globals). This fixed ~100 pre-existing lint errors
  repo-wide, not just in code from this session.
- `npm install` needs `--legacy-peer-deps` (pre-existing `eslint-plugin-
  react-hooks@4.6.2` vs `eslint@9` peer conflict, unrelated to this work).

**Local dev is fully working**: `.env.local` has the user's real Firebase
project config (`handyy-aus`) already filled in — this is a client-safe web
config, not a secret (see README). `node_modules` is installed.
`npm run typecheck` and `npm run lint` both pass clean except for a few
pre-existing, unrelated issues (3 `react-refresh` warnings in the
providers, one unused-var error in `collections.ts`) — none of those are
from this session's work and weren't touched.

Launch configs added to `.claude/launch.json`: `extension-test-server`
(port 5588) and `handy-dev` (`npm run dev`, port 5173).

## Part 2 — Zero-friction accounts + portal data as the real record: BUILT, NOT YET RUN LIVE

The product model changed from the original "admin provisions accounts,
students never self-register, official attendance is never client-writable"
to: **a student installs the extension, and it provisions their Handy account
and syncs their real portal data into the same Firestore collections the rest
of the app reads.** There is no separate "synced" view — the portal capture
*is* their attendance record.

All of this is written, typechecks, lints, and is covered by unit tests. **None
of it has been exercised against the real site or a real Firestore write yet**
— see "What is NOT verified" at the bottom, which is the first thing to do
next.

### The account model — READ THIS BEFORE CHANGING IT

**Every account is created with the shared password `Handy@123`**
(`ACCOUNT_PASSWORD`, defined in both `src/services/firebase/auth.ts` and
`extension/src/account.js` — keep them equal). Students may change it
afterwards at Profile → Change Password, but nothing makes them.

This was the user's explicit, repeated instruction. Per-student generated
passwords *were* built first, and were replaced on request. The security cost
was raised with the user twice and accepted both times, so **don't re-litigate
it** — but it is real and is documented in the README's auth section: roll
numbers are public and predictable, so until a student changes their password
anyone who guesses their roll number can read their attendance.

**Since then, a server-side sync endpoint was added** (`api/sync.js`, a Vercel
function using the Admin SDK), which takes student passwords out of the sync
path entirely — see "The sync endpoint" below. The shared password still
matters for *signing in*, but no longer for syncing.

The rest of the model:

- The extension registers `<roll>@handy.local` the first time it sees a roll
  number. **No consent prompt, no signup form, no questions** — that was also
  explicit. Seeing the roll number is the trigger.
- **There is no signup page at all** (it was built, then removed on request,
  along with `ROUTES.signup`, `signUpSchema`, `AuthProvider.signUp` and
  `registerWithRollNumber`). The extension is the only thing that can create
  an account. Don't reintroduce a signup screen without asking.
- **Captured data is not verified.** The roll-number mismatch warnings that
  used to sit on ConnectPortalPage and CollegePortalSyncCard were removed on
  request: the data comes from the college's own system, so it's treated as
  authoritative.
- Sign-in asks for a **roll number only**. `loginSchema.password` is optional;
  LoginPage submits `ACCOUNT_PASSWORD` when the field is empty and reveals a
  password field only after a credential error (or if the student clicks "I
  changed my password").
- It writes to Firestore **as that student** over the Identity Toolkit +
  Firestore REST APIs, carrying their own ID token. It holds no privileged
  credential; `firestore.rules` constrains it exactly like the web app.
- The web app's login page offers "Continue as `<roll>`", pulling the
  credential from the extension over `externally_connectable`.
- `/connect-portal` survives as a recovery screen only — "waiting for your
  data", for an account whose sync hasn't landed on this device. Nobody should
  see it in the normal flow.
- **Syncing never prompts for a password; the popup has no input at all.** If
  a student changes their password, the extension's stored credential goes
  stale (`ACCOUNT_STATE.needsPassword`) and the web app pushes the new one
  back over `externally_connectable` — `setExtensionPassword()` is called from
  LoginPage on a successful sign-in with a typed password, and from
  ChangePasswordPage right after a change. The extension verifies it by
  signing in before storing, so a bogus push can't clobber a working
  credential.

**Hard consequence:** `handy.local` is not routable, so Firebase's
password-reset email can never be delivered. Profile → Change Password while
signed in is the only way a password changes; a student who changes and
forgets theirs has lost the account.

Residual risk, unchanged from the old signup form and stated in the README:
nothing stops someone registering a roll number that isn't theirs, because
rules can't verify a Campus Connect session. Closing it needs a backend.

### The sync endpoint (`api/sync.js`)

Added last, to satisfy "my friend opens my profile on his laptop and my Handy
updates". That can't work through student credentials — a laptop that has
never seen you can only authenticate as you if your password is the shared
default — so the write moved server-side.

- The extension POSTs the snapshot to `/api/sync`; the function writes with
  the **Admin SDK**, creating the Firebase Auth account if the roll number is
  new. No student password anywhere on that path.
- It **imports `extension/src/snapshotMapping.js` directly**, so there is one
  mapping shared by three consumers (web app mirror, extension, server), and
  the existing parity test still guards it.
- Guarded by `HANDY_SYNC_API_KEY` (sent as `x-handy-key`) plus a
  per-roll-number rate limit in `syncRateLimits/{rollNumber}`, 40/hour. The
  key ships inside the extension, so it's a speed bump, not a secret; the
  rate limit is the durable protection. The function **fails closed** if the
  env var is unset.
- `cloudSync.js` falls back to the old direct-to-Firestore path only when the
  endpoint is genuinely unreachable (network error, 404, 5xx). A 401 or a 400
  surfaces instead of silently falling back — that distinction is deliberate.

**Deployment is not done.** Set `FIREBASE_SERVICE_ACCOUNT` and
`HANDY_SYNC_API_KEY` on Vercel, put the same key in `SYNC_API_KEY` in
`extension/src/config.js` (currently a placeholder), and deploy.
`firebase-admin` was moved from devDependencies to dependencies for this.

🔑 **Never put the service-account key in `extension/`**, no matter how it's
asked for. It bypasses every rule and grants total project control, and every
file in an extension is readable by anyone who installs it. This came up
directly and the answer was a server-side function instead.

### Deployed, and verified in production

Live at **https://handy-aus.vercel.app**. The sync endpoint was exercised
against the real project end to end (account created, 1 subject + 42 timetable
entries written, `section=T6(CA3)`, re-sync idempotent with `effectiveFrom`
preserved) and the test data deleted afterwards. So unlike everything before
it, this path is genuinely confirmed, not just typechecked.

Gotchas that cost time and will again:
- `handy-vijayapardhus-projects.vercel.app` is the **protected** alias (Vercel
  SSO). The extension must use `handy-aus.vercel.app`. Aliases have already
  changed once mid-session — if sync starts 404ing, check `vercel alias ls`
  first.
- Vercel's `npm install` fails without `.npmrc` (`legacy-peer-deps=true`),
  because of the pre-existing eslint-plugin-react-hooks/eslint@9 conflict.
- Env vars live only on Vercel (10 of them: 8 `VITE_*`, plus
  `FIREBASE_SERVICE_ACCOUNT` and `HANDY_SYNC_API_KEY`). `vercel env ls
  production` to check.

GitHub flagged the Firebase **web** API key in `extension/src/config.js` as a
leaked secret. It was dismissed as a false positive: that key is public by
design and the deployed bundle serves the same value. Don't "fix" it by
removing it — that breaks the extension and hides nothing. The service-account
key is the one that genuinely matters, and it exists only in
`service-account.json` (gitignored) and Vercel's env.

### Web push (FCM)

`api/notify.js` + `src/services/notifications/pushService.ts` +
`public/firebase-messaging-sw.js`. Two details worth knowing before touching
it:

- The FCM service worker receives its Firebase config as **query params at
  registration time**, because a file in `public/` can't read Vite env vars.
  It's registered explicitly on its own scope so it can't collide with the
  Workbox PWA worker, which is also why `globIgnores` excludes it from
  precache.
- `/api/notify` writes the `notifications` document **before** attempting the
  push, so a blocked permission or a dead token never loses the message. Dead
  tokens are pruned on the two error codes that mean "gone for good".

### The timetable fetches itself

The timetable only hits the network when something is chosen on
`studenttimetableoption.aspx`; the page doesn't request it on load. So after a
profile capture with no timetable stored, `background.js` opens that page in a
**background tab** and `extension/src/autoTimetable.js` drives it, then the
tab closes itself once the capture lands.

`autoTimetable.js` only acts while `background.js` has set the
`handy:autoTimetablePending` flag, so it can never click things on a page the
student opened themselves. Its selection is **heuristic** (first real
`<select>` option, then a button whose text matches /show|view|display/) —
because WebForms control ids are generated and the page's DOM has never been
inspected. It retries for ~5s, logs what it found, and leaves the tab open on
failure. **If auto-capture doesn't work, that console output is the thing to
read**, and the fix is likely a concrete selector.

### Timetable capture (added late in the session)

The user supplied a second endpoint —
`Academics/studenttimetableoption.aspx/ShowTimeTables` — which returns the
weekly timetable. This removed what had been a major limitation (Timetable,
NextClassCard and Leave Planner being permanently empty for self-registered
students).

Key differences from the profile capture, and where the bodies are buried:

- Same ASP.NET `{"d": ...}` envelope, but `d` holds a **JSON string**, not
  HTML — so `parseTimetableResponse` parses twice. A pleasant side effect:
  it needs no DOM, so it runs under Node in the normal vitest suite (the
  profile parser still can't without jsdom).
- It's a **different page** from the profile capture, so the two arrive
  separately. They're stored under separate `chrome.storage.local` keys and
  merged in `getStoredSnapshot()`. `snapshot.timetable` being absent means
  "not captured yet", never "no classes" — the popup and ConnectPortalPage
  both say so explicitly rather than showing an empty week.
- `dayid` 1..6 maps straight onto `DayOfWeek` (Mon..Sat). Assumed, matches
  the sample, worth confirming on the live site.
- It carries things the attendance capture doesn't: the portal's own subject
  abbreviations (`ADSAA`, `OOPC++` — now used for `shortName` instead of a
  truncated full name), room numbers, and `ttname` ("T6(CA3)") which is used
  as the student's `section`. **`students.section` and the timetable
  version's `section` must stay equal** or `getPublishedVersions()` won't
  match the student to their own timetable.
- Subjects join to the attendance import by **subject code**, so timetable
  entries point at the same `self-<uid>-<code>` subject docs.

### Files

Extension (`extension/`):
- `src/config.js` — Firebase web config + the synthetic-email domain. **Must
  stay in sync with `.env.local`'s `VITE_AUTH_EMAIL_DOMAIN`** or the two
  clients would derive different accounts for the same student.
- `src/firebaseRest.js` — zero-dependency Firebase over REST. Deliberately
  not the Web SDK: this extension has no build step, and MV3 forbids remote
  code. Includes the Firestore typed-value encoding, whose integer/double
  split mirrors what the SDK does (pinned by tests).
- `src/account.js` — password generation, the `chrome.storage` vault, and the
  sign-in → sign-up → needs-password state machine.
- `src/snapshotMapping.js` — **mirror of `buildImportDocs()`/
  `buildTimetableDocs()` in the web app.** Change one, change the other;
  `collegePortalImportService.test.ts` fails if they diverge.
- `src/cloudSync.js` — orchestrates the writes (ensure stub → one atomic
  commit → retire subjects and timetable versions the portal dropped).
- `src/background.js` — now an ES module (`"type": "module"` in the
  manifest); content scripts stay plain scripts.
- `src/parser.js` — gained `parseTimetableResponse`.
- `popup/popup.js` — account UI: consent, password-to-save, synced,
  needs-password, error.

Web app (`src/`):
- `components/layout/RequireCompleteProfile.tsx` — onboarding gate.
- `pages/Profile/ChangePasswordPage.tsx` — the only account recovery path.
- `services/students/collegePortalImportService.ts` — `buildImportDocs` and
  `buildTimetableDocs` are now **pure** and separately exported, precisely so
  the extension's mirror can be tested against them.
- `pages/Login/LoginPage.tsx` — "Continue as `<roll>`".
- `services/extension/handyExtensionBridge.ts` — added `GET_ACCOUNT`.

### Three races that were found and fixed (not in the original handover)

1. `onAuthStateChanged` fires *during* `signUp()`'s await, so its profile
   fetch reliably 404'd and left `student` null. The auth-state callback is
   now the single writer of `student` and uses `ensureStudentStub`.
2. `SignUpPage` redirected to Home the moment `user` became truthy — i.e.
   mid-submit. Suppressed while registering.
3. `importCollegePortalSnapshot` used `batch.update`, which hard-fails on a
   missing student doc. It now ensures the stub first.

### firestore.rules — WRITTEN AND DEPLOYED

`firebase deploy --only firestore:rules --project handyy-aus` was run twice
(once for the base changes, once after adding timetable support) and both
released successfully. Self-scoped writes only:

- `students`: `create` forced to `profileComplete: false`; `update` limited to
  an explicit field allowlist (which is what keeps `rollNumber`/`uid`/`email`/
  `createdAt` immutable), and `semesterId` may only move to `self-<uid>`.
- `subjects`, `timetableVersions`: create/update only when `semesterId ==
  'self-' + uid`, checked on **both** `resource` and `request.resource` so an
  admin-provisioned doc can't be hijacked by rewriting its `semesterId`.
- `timetableEntries`: fenced by a `matches()` prefix test on
  `timetableVersionId` (they carry no `semesterId` of their own).
- `attendanceSummaries`: own `studentId` **and** `source == 'collegePortal'`,
  so a self-write can never masquerade as admin-seeded.
- `attendance/{recordId}` deliberately stays `allow write: if false` — the
  portal exposes only aggregates, so Attendance History and the calendar
  remain empty for self-registered students. Known and accepted.

### Verification status

**Verified:**
- `npm run typecheck` — clean.
- `npm run lint` — clean apart from 4 pre-existing issues (3 react-refresh
  warnings in providers, 1 unused-var error in `collections.ts`) that predate
  this work.
- `npm test` — 43 passing, including: the real `ShowTimeTables` response
  parsed by the real parser, extension-vs-web mapping parity, and the REST
  value encoding.
- Rules compiled and released to the live project.

**Confirmed working on the live site:** the timetable capture path end to end
— `capture.main.js` matched the `ShowTimeTables` XHR inside the portal,
`parseTimetableResponse` produced `T6(CA3)` with all 42 slots, and the popup
rendered attendance + timetable correctly.

**Fixed after that first live run — read this before adding any Firestore
read:** the first real sync failed with `PERMISSION_DENIED`, from two
instances of the same misunderstanding. **Firestore security rules are not
filters.**
- A *list query* is rejected unless the query's own constraints prove every
  match is readable. `timetableVersions` may only be read when
  `status == 'published'`, so any query of it must filter on `status` — even
  though every document it would return belongs to the caller.
- A *get* of a document that doesn't exist yet is **denied, not 404'd**, when
  the read rule dereferences `resource.data` (`resource` is null). That's why
  `effectiveFrom` is now recovered from the query results instead of a
  `getDoc()` on the version id.

Both clients were fixed the same way and `queryCollection` now takes
`[[field, "==", value]]` filters. Regression tests cover the query shape.
`cloudSync.js` also records *which* stage failed now (`read-timetable-versions:
PERMISSION_DENIED`), because a bare rule error across five collections is
close to undebuggable.

**What is still NOT verified — start here:**
1. **The write path has never completed.** The fixes above are unit-tested but
   the corrected sync has not been run against real Firestore. Reload the
   unpacked extension (Chrome caches the old service worker) before retrying.
2. The web app itself has still never been rendered — no signup, onboarding,
   "Continue as", or Home/Timetable screen has been seen with real data.
3. The `popup.test.html` harness was rewritten with an account-state picker
   but **was not rendered** — an attempt to open it through browser
   automation hit what looked like a Claude-in-Chrome site-permission gate,
   not an app error (the server was confirmed bound; a second instance failed
   with `EADDRINUSE`). Open it manually:
   `node extension/test/server.mjs` → `http://localhost:5588/extension/test/popup.test.html`.
4. `dayid` → Monday..Saturday is an assumption from one sample.
5. The full flow — capture → account creation → sync → "Continue as" →
   Home/Subjects/Timetable showing real numbers — has never been walked end
   to end.
