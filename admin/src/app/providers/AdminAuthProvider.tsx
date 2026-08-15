import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { adminDocRef } from "@/services/firebase/collections";
import { signIn as firebaseSignIn, signOut as firebaseSignOut, subscribeToAuthState } from "@/services/firebase/auth";
import type { AdminDoc } from "@/types/admin";

interface AdminAuthContextValue {
  user: User | null;
  admin: AdminDoc | null;
  loading: boolean;
  /** True once auth has resolved and the signed-in user is definitively not a granted admin. */
  notAnAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

/**
 * Mirrors the root app's AuthProvider shape, but the second half of the check
 * is different in kind, not just in data: a signed-in Firebase user here is
 * not automatically anything. `admins/{uid}` — self-readable only, per
 * firestore.rules — is what actually says so. A user who signs in without
 * that doc (or with `active: false`) is signed back out immediately; nothing
 * in this app is reachable in between.
 */
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState<AdminDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [notAnAdmin, setNotAnAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (nextUser) => {
      setNotAnAdmin(false);
      setUser(nextUser);

      if (!nextUser) {
        setAdmin(null);
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(adminDocRef(nextUser.uid));
        const doc = snap.exists() ? (snap.data() as AdminDoc) : null;
        if (doc && doc.active) {
          setAdmin(doc);
        } else {
          setAdmin(null);
          setNotAnAdmin(true);
          await firebaseSignOut();
          setUser(null);
        }
      } catch {
        // A permission-denied read here means the same thing as "no doc" —
        // firestore.rules only grants self-read to an admin whose doc exists.
        setAdmin(null);
        setNotAnAdmin(true);
        await firebaseSignOut();
        setUser(null);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  async function signIn(email: string, password: string) {
    setNotAnAdmin(false);
    await firebaseSignIn(email, password);
    // subscribeToAuthState above picks up the new user and runs the admin check.
  }

  async function signOut() {
    await firebaseSignOut();
    setAdmin(null);
  }

  return (
    <AdminAuthContext.Provider value={{ user, admin, loading, notAnAdmin, signIn, signOut }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
