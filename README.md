# Handy — Student Attendance & Academic Assistant

React + TypeScript + Vite frontend, Firebase (Auth, Firestore) backend. Built against the SRS
in this repo's project brief: student-facing app only in this pass (no admin panel yet).

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
