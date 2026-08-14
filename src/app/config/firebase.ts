import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

/**
 * Client-safe Firebase Web SDK config (SRS §57-58). These are NOT secrets —
 * Firebase Admin/service-account credentials must never appear here or
 * anywhere in this React app; those live only in scripts/seed-students.mjs
 * and Cloud Functions, run outside the browser.
 */
const firebaseConfig = {
  apiKey: requireEnv("VITE_FIREBASE_API_KEY"),
  authDomain: requireEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: requireEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: requireEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: requireEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: requireEnv("VITE_FIREBASE_APP_ID"),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined,
};

export const AUTH_EMAIL_DOMAIN: string = import.meta.env.VITE_AUTH_EMAIL_DOMAIN || "handy.local";

function requireEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${key}. Copy .env.example to .env.local and fill in your Firebase project's web config.`,
    );
  }
  return value as string;
}

export const firebaseApp: FirebaseApp = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(firebaseApp);

// Offline-friendly cached data (SRS §47-48): Firestore keeps the last-synced
// documents available across tabs even without a connection.
export const db: Firestore = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const storage: FirebaseStorage = getStorage(firebaseApp);
