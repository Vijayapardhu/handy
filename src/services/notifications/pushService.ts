import { getMessaging, getToken, isSupported, onMessage, type MessagePayload } from "firebase/messaging";
import { arrayUnion, updateDoc } from "firebase/firestore";
import { firebaseApp } from "@/app/config/firebase";
import { studentDocRef } from "@/services/firebase/collections";

/**
 * Web push via Firebase Cloud Messaging.
 *
 * The VAPID key below is the *public* half of the Web Push key pair from the
 * Firebase console (Cloud Messaging → Web Push certificates). Like the rest
 * of the Firebase web config it is meant to ship in the client — the private
 * half never leaves Google.
 */
const VAPID_KEY =
  (import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined) ??
  "BJHkLfqd4x2cvdpfm6yXEtrA-ZfZtU87ReV5XPHcOcKd52bcVfRa-fi3k7eu3gk9Q2J0BTkBJxzNzmOtP3OdSyE";

/**
 * FCM in a browser needs three things Handy can't assume: service workers,
 * the Push API, and Notification. iOS Safari in particular only has them for
 * an installed PWA, so every entry point here checks first.
 */
export async function isPushSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) {
    return false;
  }
  return isSupported();
}

/** Spelled out rather than using the DOM's `NotificationPermission` alias, which isn't visible to eslint's no-undef. */
export type PermissionState = "default" | "granted" | "denied" | "unsupported";

export function getPermissionState(): PermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/**
 * public/firebase-messaging-sw.js can't read Vite env vars, so the Firebase
 * config is handed to it as query params at registration time. Registering it
 * explicitly (rather than letting FCM find it by convention) is also what
 * keeps it from colliding with the Workbox PWA service worker.
 */
async function registerMessagingServiceWorker(): Promise<ServiceWorkerRegistration> {
  const options = firebaseApp.options as Record<string, string | undefined>;
  const params = new URLSearchParams();
  for (const key of ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"]) {
    if (options[key]) params.set(key, options[key]);
  }

  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params.toString()}`, {
    scope: "/firebase-cloud-messaging-push-scope",
  });
}

/**
 * Asks for permission (if not already decided), then registers this device
 * for push and records the token against the student.
 *
 * Tokens accumulate per device — a student on a phone and a laptop has two,
 * and both should ring — so this appends rather than replaces. Stale ones are
 * pruned server-side when a send is rejected (see api/notify.js).
 *
 * @returns the FCM token, or null if the student declined or push is unavailable.
 */
export async function enablePush(uid: string): Promise<string | null> {
  if (!(await isPushSupported())) return null;

  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await registerMessagingServiceWorker();
  const token = await getToken(getMessaging(firebaseApp), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) return null;

  await updateDoc(studentDocRef(uid), {
    fcmTokens: arrayUnion(token),
    updatedAt: new Date().toISOString(),
  });

  return token;
}

/**
 * Messages that arrive while Handy is open and focused. The browser shows
 * nothing by itself in that case — FCM hands the payload to the page instead,
 * which is why this exists alongside the service worker's handler.
 *
 * @returns an unsubscribe function.
 */
export async function onPushMessage(handler: (payload: MessagePayload) => void): Promise<() => void> {
  if (!(await isPushSupported())) return () => {};
  return onMessage(getMessaging(firebaseApp), handler);
}
