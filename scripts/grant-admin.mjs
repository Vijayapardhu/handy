// Bootstraps the first admin account.
//
//   node scripts/grant-admin.mjs <email> <name>
//
// After this, granting more admins goes through the panel itself
// (admin/api/grant-admin.js) — this script exists only because that endpoint
// needs at least one admin to already exist to call it. Mirrors
// scripts/grant-class-rep.mjs's shape: Admin SDK, service-account.json,
// outside every Firestore rule.
//
// Two things this refuses to do, both load-bearing:
//   - Reuse an existing Firebase Auth account. Admin identity is deliberately
//     separate from student identity, even though both live in the same
//     Firebase project's Auth pool.
//   - Accept an email on the synthetic student domain (`@handy.local` by
//     default). That domain means "student account" everywhere else in this
//     codebase; an admin colliding with it would be a real footgun for any
//     future code that treats the domain as a signal.
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const STUDENT_EMAIL_DOMAIN = process.env.VITE_AUTH_EMAIL_DOMAIN || 'handy.local';

initializeApp({
  credential: cert(JSON.parse(readFileSync('service-account.json', 'utf8'))),
});
const auth = getAuth();
const db = getFirestore();

const [email, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(' ');

if (!email || !name) {
  console.error('Usage: node scripts/grant-admin.mjs <email> <name>');
  process.exit(1);
}

const normalizedEmail = email.trim().toLowerCase();

if (normalizedEmail.endsWith(`@${STUDENT_EMAIL_DOMAIN}`)) {
  console.error(
    `Refusing: ${normalizedEmail} is on the student domain (@${STUDENT_EMAIL_DOMAIN}).`,
    '\nUse a real email address for an admin account.',
  );
  process.exit(1);
}

const existing = await auth.getUserByEmail(normalizedEmail).catch(() => null);
if (existing) {
  console.error(`${normalizedEmail} already has a Firebase Auth account (uid ${existing.uid}).`);
  console.error('Refusing to repurpose an existing account as an admin — create a new one.');
  process.exit(1);
}

function generatePassword(length = 16) {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(length);
  let out = '';
  for (const byte of bytes) out += alphabet[byte % alphabet.length];
  return out;
}

const password = generatePassword();
const user = await auth.createUser({ email: normalizedEmail, password, displayName: name });

await db.doc(`admins/${user.uid}`).set({
  uid: user.uid,
  email: normalizedEmail,
  name,
  active: true,
  grantedAt: new Date().toISOString(),
  grantedBy: 'bootstrap-script',
});

console.log(`Created admin ${name} <${normalizedEmail}>`);
console.log(`  uid:      ${user.uid}`);
console.log(`  password: ${password}`);
console.log('\nRelay this password to them now — it is not stored anywhere and will not be shown again.');
