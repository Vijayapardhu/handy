# Handy Admin

The operator panel for Handy — student directory, password resets, class-rep
grants, subject/timetable authoring, announcements, materials, push
notifications, release records, and analytics. A genuinely separate app and
deployment from the root student app (`../`), the same way `../mobile` and
`../extension` are — same Firebase project, own build, own Vercel project.

The design and every architectural decision here (why a separate app, why a
Firestore grant-doc instead of custom claims, why writes go through
`api/*.js` and reads go straight to Firestore) is written up in full in the
session that built this — ask if you need the reasoning, not just the result.

## 1. The one hard rule

**The admin cannot change a student's attendance.** Not "there's no button for
it" — `attendance` and `attendanceSummaries` keep `allow write: if false` in
`../firestore.rules` with no exception for admins, and there is no
`api/*.js` endpoint in this app that writes to either collection. If you're
ever asked to add one, that request needs its own conversation, not a quiet
addition here — read the closing comment in `../firestore.rules` first.

The one gray area — approving an `attendanceCorrections` request, which by
definition would need to adjust an attendance summary — is deliberately left
unbuilt. `src/pages/Reports/ReportsPage.tsx` shows pending corrections
read-only, with no approve/reject action, on purpose.

## 2. Setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

- `VITE_FIREBASE_*` — copy straight out of `../.env.local`. Same Firebase
  project, same client-safe values, just duplicated into a second Vite app.
- `FIREBASE_SERVICE_ACCOUNT` — same value as the root project's Vercel env
  var of the same name. Only needed locally if you're running `vercel dev`
  against `api/`; a plain `npm run dev` only exercises the frontend, which
  never touches the Admin SDK directly.
- `BLOB_READ_WRITE_TOKEN` — only needed for the Materials page's file-upload
  path. See §5.

```bash
npm run dev      # frontend at http://localhost:5174
```

## 3. Bootstrapping the first admin

There is no signup form here either — same philosophy as the root app, which
has none for students. The first admin is created by a script that lives in
the root project (it needs `service-account.json` there):

```bash
cd ..
node scripts/grant-admin.mjs you@realaddress.com "Your Name"
```

This refuses an email on the student domain (`@handy.local` by default) and
refuses to reuse an existing Firebase Auth account — an admin is always a
brand-new identity, deliberately separate from any student's. It prints a
generated password once; there is nowhere else to find it. After this,
granting more admins is self-service from the `/admins` page in this app.

## 4. Deploying

This is its own Vercel project, pointed at this `admin/` folder as the root
directory (Vercel supports this directly in a monorepo — no separate git
repo needed). Environment variables to set there:

| Variable | Value |
| --- | --- |
| `VITE_FIREBASE_*` | Same as the root project's |
| `FIREBASE_SERVICE_ACCOUNT` | Same value as the root project's |
| `BLOB_READ_WRITE_TOKEN` | From the Vercel Blob store — see §5 |

Two things that are easy to miss:

- **Firebase Auth → Settings → Authorized domains** needs this app's Vercel
  domain added, or sign-in will fail outright with no useful error in the
  browser console — it fails inside Firebase's own SDK before it gets that
  far.
- `admin/api/*.js` cannot reuse `../src/app/config/firebase.ts` or the root
  project's `api/*.js` `app()` helpers — those resolve Vite's
  `import.meta.env.VITE_*`, which doesn't exist in a Node function's runtime.
  This app bootstraps the Admin SDK itself, in `api/_admin.js`.

## 5. Materials file storage

Uploading a file (as opposed to publishing a link) on the Materials page goes
through [Vercel Blob](https://vercel.com/docs/storage/vercel-blob), public
access — study materials aren't sensitive the way announcement attachments'
signed-URL scheme (in the root project's `api/announce.js`) assumes.
Provision a Blob store on the admin Vercel project (Storage tab → Create
Database → Blob), which sets `BLOB_READ_WRITE_TOKEN` automatically. Until
that's done, the Materials page's "Link" mode still works — only file upload
needs it.

## 6. What's genuinely out of scope, not just unfinished

- **Assigning a synced student to an admin-authored semester/timetable.**
  Every real student's subjects and timetable are recomputed from their own
  portal sync on every sync (`self-<uid>` namespace,
  `collegePortalImportService.ts` in the root project) — an admin-assigned
  semester wouldn't survive that student's next sync. Subject/timetable
  authoring here (`/subjects`, `/timetables`) works, and is fenced off from
  ever touching that private namespace, but there is no "assign" action.
  Making one work would mean real changes to the sync pipeline itself — the
  one path every real student's data flows through — which is a bigger,
  separately-reviewed piece of work.
- **Wiring the landing page or a mobile update banner to `appUpdates`.** The
  `/updates` page publishes real release records today; nothing outside this
  app reads them yet. The root project's landing page still ships hardcoded
  download links.

## 7. Testing

```bash
npm test
```

Covers the two pieces of logic worth an executable guarantee rather than just
a comment: `api/_guards.js`'s `sanitizeStudentUpdate()` (the actual mechanism
behind §1 — the profile-edit endpoint literally cannot accept an
attendance-shaped field, and there's a test that tries) and
`api/_admin.js`'s `requireAdmin()`/`generatePassword()`. Everything else
follows the root project's convention: pure logic gets real assertions,
thin request handlers don't need their own mock-heavy test for guards that
are already covered where they're defined.

```bash
npm run typecheck && npm run lint && npm test && npm run build
```
