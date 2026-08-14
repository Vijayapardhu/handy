/**
 * Maps low-level Firebase/network errors to human-readable copy (SRS §51).
 * Technical detail still reaches the console for debugging; users only see
 * the friendly message.
 */
const FIREBASE_AUTH_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "That roll number or password doesn't match our records.",
  "auth/invalid-email": "That roll number doesn't look right.",
  "auth/user-not-found": "We couldn't find an account for that roll number.",
  "auth/wrong-password": "That roll number or password doesn't match our records.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/network-request-failed": "You appear to be offline. Check your connection and try again.",
  "auth/user-disabled": "This account has been disabled. Contact your administrator.",
  "auth/email-already-in-use": "An account already exists for that roll number. Try signing in instead.",
  "auth/weak-password": "That password is too easy to guess — use at least 6 characters.",
};

export function toFriendlyAuthMessage(error: unknown): string {
  const code = getFirebaseErrorCode(error);
  if (code && FIREBASE_AUTH_MESSAGES[code]) return FIREBASE_AUTH_MESSAGES[code];
  return "Something went wrong signing you in. Please try again.";
}

export function toFriendlyDataError(error: unknown, context: string): string {
  const code = getFirebaseErrorCode(error);
  if (code === "permission-denied") {
    return `You don't have access to ${context}.`;
  }
  if (code === "unavailable" || code === "auth/network-request-failed") {
    return `Unable to load ${context}. Please check your connection and try again.`;
  }
  return `Unable to load ${context} right now. Please try again.`;
}

function getFirebaseErrorCode(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}
