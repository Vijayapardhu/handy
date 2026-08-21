# Handy — Student Attendance & Academic Assistant

React + TypeScript + Vite frontend, Firebase (Auth, Firestore) backend. Built against the SRS
in this repo's project brief: student-facing app only in this pass (no admin panel yet).

Free software under the [GNU AGPL v3](LICENSE). The browser extension installs
unpacked — see [extension/tool/INSTALL.md](extension/tool/INSTALL.md).

## 1. Setup

```bash
npm install
cp .env.example .env.local   # already pre-filled with your Firebase project's web config
npm run dev
```

The web config in `.env.local` is **not a secret** (see `src/app/config/firebase.ts` for why) —
it's fine that it's in a plain file. Nothing that *is* secret (a service-account key, an Admin
SDK credential) ever appears in this app; the one place a secret is used is
`scripts/seed-students.mjs`, which never ships to the browser.

## 2. Firebase project setup (one-time, in the Firebase Console)

1. **Enable Email/Password sign-in**: Authentication → Sign-in method → Email/Password → Enable.
   Roll-number login is built on top of this (see "Auth model" below) — without it, sign-in will
   fail with `auth/operation-not-allowed`.
2. **Create Firestore** in production mode if you haven't already (Firestore Database → Create
   database).
3. **Deploy security rules and indexes** (requires the Firebase CLI, `npm i -g firebase-tools`
   then `firebase login`):
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```
   The composite indexes in `firestore.indexes.json` are required for the queries in
   `src/services/*` — without them, those reads fail with a Firestore "index required" error
   that includes a direct console link to create it, if you'd rather do it that way.

## 3. Seed demo data

```bash
# Firebase Console → Project Settings → Service Accounts → Generate new private key
# save the download as ./service-account.json (already gitignored)
npm run seed
```

This creates one demo student (roll number `23A31A05B1`, password `Handy@123`, printed again at
the end of the script), 8 subjects, a published timetable version, and attendance summaries that
match the reference mockups exactly, so the app renders real numbers on first login. It also
seeds individual `attendance` records for every held class (evenly distributed present/absent so
the History list and the Attendance calendar view have real per-day data, not just aggregates),
two `leaveRequests` (one approved, one pending), and five `notifications` covering every
notification type. Re-running `npm run seed` is idempotent — records use deterministic ids.

## 4. Sign in

Open the app, enter roll number `23A31A05B1` and password `Handy@123` (or whatever you seeded).

## Auth model: roll number + password

Firebase Authentication has no native "roll number" method — it's email/password under the hood.
`rollNumberToEmail()` in `src/services/firebase/auth.ts` deterministically maps a roll number to a
synthetic address (`23a31a05b1@handy.local` by default; the domain is `VITE_AUTH_EMAIL_DOMAIN`),
then uses Firebase's normal, well-tested email/password flow. Students never see or type this
address. This keeps the roll-number requirement out of Firestore security rules entirely (Firebase
Auth already guarantees uniqueness/hashing/rate-limiting on the email/password pair).

**There is no signup screen.** Accounts are created by the browser extension and nothing else: the
first time "Handy College Sync" captures a roll number it hasn't seen, it registers
`<roll>@handy.local` with the default password `Handy@123` (`ACCOUNT_PASSWORD` in
`src/services/firebase/auth.ts`) and writes that student's real data straight in. No prompt, no
form, no consent step — and no verification of the captured data, because it comes from the
college's own system and is authoritative by definition.

So the whole journey is: install the extension → open your Campus Connect profile → open Handy.
Sign-in asks for a **roll number only**; the login screen offers "Continue as `<roll number>`" when
the extension is present, and otherwise signs in with the default password behind the scenes. A
password field appears only for a student who has changed theirs (Profile → Change Password), which
is optional and rare.

The one other way an account can exist is `scripts/seed-students.mjs`, the Admin SDK seeder used
for the demo student.

### Deployment

Live at **https://handy-aus.vercel.app** (Vercel project `vijayapardhus-projects/handy`, deployed
from this repo). Note `handy-vijayapardhus-projects.vercel.app` points at the same deployment but
sits behind Vercel's SSO protection — the extension must use the public alias above, which is what
`HANDY_URL` in `extension/src/config.js` and `manifest.json`'s `host_permissions` /
`externally_connectable` are set to.

`.npmrc` pins `legacy-peer-deps=true` because `eslint-plugin-react-hooks@4.6.2` predates `eslint@9`;
without it Vercel's `npm install` fails outright.

### Web push (`api/notify.js`)

Firebase Cloud Messaging, wired end to end:

- `src/services/notifications/pushService.ts` asks permission, registers
  `public/firebase-messaging-sw.js`, and appends the FCM token to
  `students/{uid}.fcmTokens` — one per device, so a phone and a laptop both ring.
- The service worker gets its Firebase config as **query params at registration**, since a file in
  `public/` can't read Vite env vars and hardcoding it would drift from `src/app/config/firebase.ts`.
- `POST /api/notify` (same `x-handy-key` guard) writes a `notifications` document **first**, then
  attempts the push. The in-app list is the reliable channel; push is best-effort on top. Tokens
  Firebase reports as unregistered are pruned automatically.

```bash
curl -X POST https://handy-aus.vercel.app/api/notify \
  -H "Content-Type: application/json" -H "x-handy-key: $HANDY_SYNC_API_KEY" \
  -d '{"rollNumber":"26B21CS058","title":"Attendance alert","body":"DMS is below 75%","type":"attendance","url":"/subjects"}'
```

`VITE_FIREBASE_VAPID_KEY` holds the public half of the Web Push key pair (Firebase Console → Cloud
Messaging → Web Push certificates) — client-safe, like the rest of the web config.

### The sync endpoint (`api/sync.js`)

The extension doesn't write to Firestore itself when this is deployed — it POSTs the capture to
`/api/sync`, a Vercel serverless function that writes with the **Firebase Admin SDK**. That takes
student passwords out of the sync path entirely, which is what lets any machine running the
extension keep any student's data current, including a student who has changed their password.

To deploy it, set two environment variables on the Vercel project:

| Variable | Value |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | the whole service-account JSON, as one string |
| `HANDY_SYNC_API_KEY` | any long random string; the extension sends it as `x-handy-key` |

Then put the same key in `SYNC_API_KEY` in `extension/src/config.js` and reload the extension.

🔑 **The service-account key must never be committed or shipped inside the extension.** It bypasses
every security rule and grants full control of the project — and an extension is just files on
every user's disk, so anything inside it is readable by anyone who installs it. `service-account.json`
is gitignored for the same reason (`scripts/seed-students.mjs` reads it locally).

Until the endpoint is deployed the extension falls back to writing directly to Firestore as the
student, which is the older path and still works — it just can't sync a student whose password was
changed on a different machine.

The endpoint is guarded by that shared key plus a per-roll-number rate limit (40 syncs/hour, held
in `syncRateLimits/{rollNumber}`). The key ships inside the extension, so it stops casual abuse
rather than a determined person; the rate limit is the durable part.

### Hub attendance (`api/hub-connect.js`, `api/hub-attendance.js`)

A second, unrelated college system: Aditya University's Maya platform (`maya.adityauniversity.in`)
tracks CodeForge and skills-hour ("Technical Hour") attendance separately from Campus Connect. A
student with a Technical Hour period in their timetable sees a second card on Home (swipe left on
Overall Attendance) offering to connect it.

Maya's CORS answer locks `access-control-allow-origin` to its own origin, so the browser can't call
it directly from Handy — both calls are proxied server-side, the same shape as `api/verify.js`.
Unlike the campus portal password, the Hub password *is* stored (at the student's request, so Handy
can silently refresh the hour-long Maya token instead of asking them to sign in every session) —
encrypted with `HUB_CRED_KEY` in a Firestore collection (`hubAccounts/{uid}`) with no client-side
rule at all, reachable only by these two endpoints with the Admin SDK.

| Variable | Value |
| --- | --- |
| `HUB_CRED_KEY` | 64 hex characters (32 bytes) — see `.env.example` for how to generate one |

If the stored password stops working (changed on the Hub since connecting), `hub-attendance.js`
drops the stored credential and reports `linked: false` rather than failing the same way forever —
the student just reconnects from Home.

### Coding practice (`api/coding.js`, `api/coding-complexity.js`)

The Tasks screen is three tabs — **Deadlines** (coursework, unchanged), **Practice**, and **Goals**.
Practice reads a student's public profiles on five sites from one place:

| Platform | Source | Gives |
| --- | --- | --- |
| LeetCode | GraphQL (`leetcode.com/graphql`) | solved + difficulty split, contest rating, submission calendar, recent accepted with tags, problem of the day |
| Codeforces | official REST API | distinct problems solved, rating/max, rank, recent accepted with tags |
| CodeChef | profile page, parsed with cheerio | rating, highest, stars, global rank, total solved |
| GeeksforGeeks | `authapi.geeksforgeeks.org` profile JSON | solved, score, POTD streak, institute rank |
| HackerRank | `/rest` profile + badges | per-track solved and stars |

**Usernames only — no passwords.** Every one of these pages is public, so unlike the Hub there is no
credential to store. Handles are typed by the student and can be cleared at any time by blanking the
field and saving.

Three of the five have no API contract, so each fetcher catches its own failure into a per-platform
`error` field instead of throwing: a CodeChef markup change blanks one card, never the page.
`api/_codingPlatforms.test.js` pins all five parsers against real trimmed payloads — that suite is
the thing that will tell you a scraper broke before a student does.

Writes go through `api/coding.js` with the Admin SDK only. `codingProfiles/{uid}` is read-only to its
owner and unreadable by anyone else, because `totalSolved` and `peerKey` decide leaderboard position
— a client that could write its own solved count could win. The class board is scoped to college +
department + year + section taken from the *student document*, is opt-out, and returns names and
totals only: never a classmate's handles, streak or solutions.

Upcoming contests (Codeforces, LeetCode, CodeChef) and LeetCode's problem of the day are shared by
every student, so both are cached in `codingCache/*` — six hours and one hour respectively — and can
be added to the deadline list in one tap, which is what puts them into the existing reminder path.

#### Topic mastery

How much of each DSA topic (Arrays, Graphs, DP, …) a student has actually practised, not just how
many problems solved overall — `src/lib/calculations/mastery.ts` on web, `mobile/lib/logic/mastery.dart`
on the phone, independent ports of the same deterministic formula (exposure + difficulty + recency,
nothing else) with their own full test suites. No "success rate" or "contest performance" factor:
Handy tracks neither, and a score built from data that doesn't exist would be exactly the kind of
invented number the rest of this app refuses to produce.

Topic tags come only from a platform that genuinely publishes them per solve — Codeforces directly,
LeetCode per-problem via `fetchLeetCodeTopicTags` (`api/_codingPlatforms.js`), which batches a
`question(titleSlug)` lookup for every recent solve into one extra GraphQL request using field
aliasing, not one request per problem. CodeChef/GeeksforGeeks/HackerRank publish none, so a solve
from those stays untagged until the student tags it themselves when logging it — never guessed from
a title.

#### Time and space complexity

No platform publishes it. LeetCode reports a runtime in milliseconds and a "beats 84%" percentile,
which is one machine on one day against one test set — not a complexity. So it is read off the
pasted code by a model via **OpenRouter**, and the student can overwrite any part of the verdict:
`source` records whether the stored answer is theirs or the model's, and the row is labelled
`estimate` for as long as it is the latter.

The key lives in Firestore at `appConfig/ai` — a document with no rule block, therefore unreadable by
any browser — rather than in an environment variable, and never in a `VITE_` one:

```bash
node scripts/set-ai-key.mjs sk-or-v1-...  [model]
```

`--status` prints a masked check, `--disable` is a kill switch that needs no redeploy. Analysis is
capped at 15 runs per student per hour (`codingAiLimits/{uid}`, deliberately tighter than the 40/hour
in `sync.js`, because each one costs money) and at 20,000 characters of code. With no key configured
anywhere the endpoint answers `ai_unconfigured` and the UI falls back to typing the complexity in by
hand — the solve log keeps working either way.

### ⚠️ Two things to be clear-eyed about

**The shared default password is a real access-control weakness.** Roll numbers are public and
follow a predictable format, so until a student changes their password, anyone who can guess their
roll number can sign in as them and read their attendance. This was chosen deliberately: it buys
onboarding with zero friction and zero secrets to lose. Closing it means per-student secrets —
which means giving students something to remember, and there is no reset channel to recover it
(see below). If this app's audience grows beyond people who are comfortable with that, this is the
first thing to revisit.

**There is no password reset.** `handy.local` is not a routable domain, so Firebase's reset email
can never be delivered. Profile → Change Password, while already signed in, is the only way a
password ever changes. A student who changes theirs and forgets it has lost the account.

Separately: an account gets created for whatever roll number the extension happens to capture, and
Firestore rules can't verify a Campus Connect session. In practice the capture only works for a
student already signed into the portal, so the data is genuinely theirs — but a modified copy of
the extension could claim any roll number. Closing that would need a backend that validates the
portal login.

## What's implemented

Everything under student scope from the SRS: roll-number login, home dashboard, subjects list +
detail, attendance history (paginated list **and** a month-grid calendar view colored by daily
status), attendance planner (three tabs: classes needed to reach target, projected attendance if
you attend regularly, and per-subject goal tracking with safe-absence counts), timetable with
version selection by effective date, jump-to-date, and a "Report a Change" form, leave planner
(impact calculator + recommendation + alternative dates), leave request + history, profile
(personal + academic info), notifications, and a tabbed Overall Attendance screen (Overview /
Subjects / Timetable / History) matching the mockups' tab pattern. Every page has loading/empty/error
states — tailored skeletons that mirror each page's real layout, not a single generic placeholder —
and offline is signaled via a banner, never silently pretended to sync.

**Also included:** dark mode (toggle in Profile → Preferences, remembers your choice, respects the
OS setting on first visit), an 8-week attendance trend chart per subject (Subject Detail page), a
day-streak + this-week-vs-last-week insight card on Home, CSV export of your attendance history,
and route-level code splitting (each page ships as its own chunk, fetched on first visit rather
than all up front) for a faster initial load.

**Coding practice:** the Tasks screen is now Deadlines / Practice / Goals. Practice tracks solved
counts, ratings and streaks across LeetCode, Codeforces, CodeChef, GeeksforGeeks and HackerRank from
public usernames alone, keeps a solve log with the time and space complexity of each solution (read
off the code, editable, never presented as fact), and surfaces the daily problem, a class board and
upcoming contests that can be added to the deadline list in one tap. See “Coding practice” above.

**Not implemented in this pass** (explicitly out of scope per the brief): the admin panel,
Cloud Functions for timetable publishing/leave approval/notification fan-out, and a live
"Mark Present" write path — `recordAttendance()` exists in the service layer but firestore.rules
deliberately denies students from writing to `attendance`/`attendanceSummaries` directly (SRS
§25, §36), so nothing in the UI currently calls it. Wire it up behind a Cloud Function when you
build that flow.

## Verification note (read this before trusting a green build blindly)

This project was authored in a sandboxed environment whose network policy blocks the npm
registry, so **`npm install`, `npm run build`, `npm run lint`, and `npm run test` (vitest) could
not actually be executed against this exact code** before delivery. What *was* verified here,
with real evidence, not assumptions:

- The entire attendance/leave/timetable calculation engine (`src/lib/calculations/*`) was
  exercised with real assertions via Node's `tsx` runtime (globally available, dependency-free) —
  every formula in SRS §11-16, and the §67-69 worked examples, actually ran and produced the
  claimed output. Two bugs were caught and fixed this way: the required-classes formula for two
  of the reference mockup's subjects doesn't match the mockup's own (apparently unverified)
  numbers — the code follows the textual formula in §13, confirmed correct by direct computation;
  see the comments in `attendance.test.ts` for the specific discrepancy.
- Every `@/...` import across all 102 source files was cross-checked against the target file's
  actual exports, and every relative import (including every `.module.css`) was checked to
  resolve to a real file — zero mismatches found.
- Every `.ts`/`.tsx` file was also run through the real TypeScript parser (`tsc --noEmit --noResolve`,
  filtered to syntax-only diagnostics since module resolution isn't possible without
  `node_modules`) — zero syntax errors across the codebase. This catches typos and malformed
  JSX/TS that the import cross-check above wouldn't.
- Two real type-correctness bugs in the Firestore write paths (`submitLeaveRequest`,
  `recordAttendance` — both used a converter-typed collection with a data shape missing the
  required `id` field) were found by manual review and fixed.
- The new streak/day-status logic (`src/lib/calculations/dayStatus.ts`) and the CSV export
  escaping (`src/lib/utils/csv.ts`) were exercised the same way as the calculation engine — real
  assertions via `tsx`, not just a read-through.

What was **not** verified: a full TypeScript compile against the real `react-router-dom`,
`firebase`, `zod`, `react-hook-form`, and `@tanstack/react-query` type definitions (they aren't
installed here), so it's possible a narrower type mismatch against one of those libraries' exact
API surface remains. After `npm install`, please run:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

and send me anything that fails — I'd rather fix a real error against real output than guess.

## Licence

Handy is free software: you can redistribute it and/or modify it under the
terms of the GNU Affero General Public License as published by the Free
Software Foundation, either version 3 of the License, or (at your option) any
later version.

Handy is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License along
with this program. If not, see <https://www.gnu.org/licenses/>.

Copyright (C) 2026 Vijaya Pardhu

### What the AGPL means here, in practice

The AGPL was chosen over the plain GPL deliberately, because most of Handy is a
service rather than something people download. Section 13 is the difference:

- **Run it unmodified?** Nothing is owed. Use it, install the extension, deploy
  it for your own college.
- **Modify it and run it as a service others use over a network?** Those users
  must be offered your modified source. Not just people you hand a copy to —
  anyone using your instance. That is the loophole the plain GPL leaves open
  and this one closes.
- **Fork it?** Fine, under the same licence. It cannot be closed up, folded
  into proprietary software, or relicensed.

Note that this cuts both ways: it binds a hosted Handy to publishing its
source. That is the intent — this exists so students can see exactly what reads
their attendance — but it is worth understanding before building anything
commercial on top of it.

## Signing in without the extension (`POST /api/verify`)

AUS students sync through the browser extension, which reads pages they have
already opened and never sees a college password. AEC and ACET cannot work that
way round: their portal has no captcha, so the server can sign in for them —
and the portal login *is* the identity check. If Campus Connect accepts the
credentials and returns data, a Handy account is created on the spot.

```
POST /api/verify
{ "rollNumber": "24A91A0501", "password": "…", "campus": "AEC" | "ACET" }
```

| Status | Meaning |
| --- | --- |
| `200` | Signed in. Returns `uid`, a Firebase **custom token**, and the SYSTEM_README §3 data shape. |
| `400` | Missing credentials, or a campus this endpoint does not serve. |
| `401` | The portal rejected the roll number or password. |
| `403` | Campus locked for maintenance (`appConfig/campus_<CAMPUS>.locked`). |
| `409` | `campus: "AUS"` — use the extension; the response says so in words. |
| `429` | Rate limited, sharing the per-roll-number ceiling with `/api/sync`. |
| `502` | Signed in, but the portal returned nothing. Deliberately not written. |
| `500` | Portal or parser failure. Fires the Discord alert if configured. |

The client exchanges `token` via `signInWithCustomToken`, so no password for the
account that was just created ever travels back or has to be typed.

**The password is never stored.** It is a local const for the length of the
request — not written to Firestore, not logged, not included in an alert.

### What these campuses do and do not get

The scrape produces a `CollegePortalSnapshot`, the same shape the extension
produces, and runs it through `ingestSnapshot()` — the same pipeline `/api/sync`
uses. Subjects, attendance summaries, history, projections and push all work
from one code path.

Two things do not, and both are limits of what the portal exposes rather than
decisions:

- **No timetable.** `getTimeTableReport` is AUS-only, so there are no class
  reminders, no home-screen timetable widgets and no free-period planning.
- **No class-rep announcements or notes.** The attendance table names a subject
  but never its lecturer, and a class group is `timetable-subject-faculty` —
  without the faculty, two lecturers' rooms cannot be told apart, so no group
  can be formed honestly.
