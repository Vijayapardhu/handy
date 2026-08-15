import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth } from "@/app/config/firebase";

/**
 * Plain email+password — no roll-number logic at all. That scheme
 * (`<roll>@handy.local`) is purely a student-app concept; admin accounts are
 * real people with real email addresses, created by scripts/grant-admin.mjs.
 */
export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/** Fresh ID token for every admin/api/*.js call — never cached beyond Firebase's own short-lived cache. */
export async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}
