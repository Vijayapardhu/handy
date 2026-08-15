import {
  onAuthStateChanged,
  signInWithCustomToken as firebaseSignInWithCustomToken,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword,
  type User,
} from "firebase/auth";
import { auth, AUTH_EMAIL_DOMAIN } from "@/app/config/firebase";

/**
 * Roll-number login (SRS request: "students login with their roll number and
 * password"). Firebase Authentication has no native roll-number method, so a
 * roll number maps deterministically to a synthetic email address and the
 * normal, well-tested email/password flow handles the rest — no custom
 * backend or Cloud Function is needed for this V1 (see README "Auth model").
 *
 * Accounts arrive here three ways: provisioned automatically by the "Handy
 * College Sync" browser extension the first time it sees a roll number
 * (the normal path), created through the signup form, or seeded by an
 * administrator (scripts/seed-students.mjs, Admin SDK).
 *
 * All of them use ACCOUNT_PASSWORD below, and students cannot change it —
 * see the warning there.
 */
/**
 * The single password every Handy account uses. Accounts are created for
 * students automatically (by the extension) rather than by the student, so
 * there is no moment at which they could choose one, and no reset email is
 * possible either — `handy.local` is not a routable domain.
 *
 * ⚠️ Known and accepted trade-off: roll numbers are public and follow a
 * predictable format, so anyone who knows a classmate's roll number can sign
 * in as them and read their attendance. This was chosen deliberately for
 * zero-friction onboarding. Closing it means per-student secrets, which means
 * giving students something to remember or lose.
 */
export const ACCOUNT_PASSWORD = "Handy@123";

export function rollNumberToEmail(rollNumber: string): string {
  const normalized = rollNumber.trim().toLowerCase();
  return `${normalized}@${AUTH_EMAIL_DOMAIN}`;
}

/**
 * Inverse of the above. Firebase Auth knows the synthetic email but nothing
 * about roll numbers, so this is how a recovery path (a signed-in user whose
 * `students/{uid}` doc is missing — see ensureStudentStub) recovers the roll
 * number from the Auth user alone. Returns null for anything not minted by
 * rollNumberToEmail.
 */
export function emailToRollNumber(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!local || domain !== AUTH_EMAIL_DOMAIN) return null;
  return local.toUpperCase();
}

export async function signInWithRollNumber(rollNumber: string, password: string): Promise<User> {
  const email = rollNumberToEmail(rollNumber);
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

/**
 * Signs in with a token minted by /api/verify.
 *
 * The server has already proved who this student is — by signing into their
 * college portal with credentials only they know — so it hands back a Firebase
 * custom token rather than the account's password. The password for an account
 * the server just created never has to travel back to the browser or be typed,
 * which means there is nothing here worth intercepting.
 */
export async function signInWithCustomToken(token: string): Promise<User> {
  const credential = await firebaseSignInWithCustomToken(auth, token);
  return credential.user;
}

// There is deliberately no registration function here. Accounts are created
// only by the browser extension, the moment it captures a roll number it
// hasn't seen (extension/src/account.js), or by /api/verify when a non-AUS
// student's portal credentials check out — never by a form in this app.

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Students may move off the shared ACCOUNT_PASSWORD onto one of their own
 * (Profile → Change Password). Requires a live session — there is no reset
 * email, because `handy.local` can't receive one.
 *
 * Note for anyone touching the extension: once this runs, the extension's
 * stored credential is stale, and it asks the student for the new one the
 * next time its refresh token expires.
 */
export async function changePassword(newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user.");
  await updatePassword(user, newPassword);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}
