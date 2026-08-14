import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { ensureStudentStub, getStudentProfile } from "@/services/students/studentService";
import {
  emailToRollNumber,
  signInWithRollNumber,
  signOut as firebaseSignOut,
  subscribeToAuthState,
} from "@/services/firebase/auth";
import type { StudentDoc } from "@/types/student";

interface AuthContextValue {
  user: User | null;
  student: StudentDoc | null;
  /** True while the initial Firebase auth check (and student profile fetch) is in flight. */
  loading: boolean;
  signIn: (rollNumber: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshStudent: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [student, setStudent] = useState<StudentDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        try {
          // Deliberately the *only* place `student` is loaded after sign-in —
          // anything else writing `student` concurrently would race this fetch
          // and lose. ensureStudentStub covers the account whose Firestore doc
          // is missing (the extension created the Auth account but its sync
          // hasn't landed yet), so the app has something to gate on.
          const rollNumber = emailToRollNumber(nextUser.email);
          const profile = rollNumber
            ? await ensureStudentStub(nextUser.uid, rollNumber)
            : await getStudentProfile(nextUser.uid);
          setStudent(profile);
        } catch {
          setStudent(null);
        }
      } else {
        setStudent(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signIn(rollNumber: string, password: string) {
    await signInWithRollNumber(rollNumber, password);
    // onAuthStateChanged above will pick up the new user and load the profile.
  }

  async function signOut() {
    await firebaseSignOut();
    setStudent(null);
  }

  async function refreshStudent() {
    if (!user) return;
    const profile = await getStudentProfile(user.uid);
    setStudent(profile);
  }

  return (
    <AuthContext.Provider value={{ user, student, loading, signIn, signOut, refreshStudent }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
