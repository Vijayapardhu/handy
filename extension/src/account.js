// Handy account lifecycle, owned entirely by the service worker.
//
// The product decision behind this file: a student should never fill in a
// form, choose anything, or be asked for permission. The first time the
// extension sees a roll number it creates that student's Handy account and
// syncs their data, silently.
//
// That means every account shares one password (ACCOUNT_PASSWORD below), so
// the student can always sign in on any device by typing their roll number
// and a password they already know.
//
// ⚠️ The trade-off, recorded so nobody has to rediscover it: roll numbers are
// public and follow a predictable format, so anyone who knows a classmate's
// roll number can sign into that classmate's Handy account and read their
// attendance. This was chosen deliberately over per-student passwords for
// zero-friction onboarding. If that ever needs closing, the fix is
// per-student secrets (see git history — this file used to generate them).
import { FirebaseRestError, refreshIdToken, signInWithPassword, signUpWithPassword } from "./firebaseRest.js";
import { rollNumberToEmail } from "./config.js";

const ACCOUNTS_KEY = "handy:accounts";

/**
 * The password every Handy account is *created* with, and the one students
 * are told to sign in with. They may later change it in Handy (Profile →
 * Change Password), which is the only case where this extension has to ask
 * for anything — see ACCOUNT_STATE.needsPassword below.
 */
export const ACCOUNT_PASSWORD = "Handy@123";

export const ACCOUNT_STATE = {
  ready: "ready",
  /** The student changed their password in Handy, so the stored one no longer works. */
  needsPassword: "needsPassword",
};

async function readAll() {
  const { [ACCOUNTS_KEY]: accounts = {} } = await chrome.storage.local.get(ACCOUNTS_KEY);
  return accounts;
}

/**
 * Accounts are keyed by roll number rather than stored as a single "current
 * account" — college machines get shared, and the refresh token cached for
 * one student must not be handed to the next.
 */
export async function getAccount(rollNumber) {
  const accounts = await readAll();
  return accounts[rollNumber] ?? null;
}

async function patchAccount(rollNumber, patch) {
  const accounts = await readAll();
  accounts[rollNumber] = { ...(accounts[rollNumber] ?? { rollNumber }), ...patch };
  await chrome.storage.local.set({ [ACCOUNTS_KEY]: accounts });
  return accounts[rollNumber];
}

export async function forgetAccount(rollNumber) {
  const accounts = await readAll();
  delete accounts[rollNumber];
  await chrome.storage.local.set({ [ACCOUNTS_KEY]: accounts });
}

/**
 * Returns `{ idToken, uid }` for this roll number, creating the account on
 * first sight. Tries in order: cached refresh token (cheapest, and survives
 * service-worker eviction), sign-in, then registration.
 *
 * Identity Toolkit reports "no such user" and "wrong password" with the same
 * INVALID_LOGIN_CREDENTIALS code when email-enumeration protection is on, so
 * this can't branch on the sign-in failure — it just attempts registration
 * and treats EMAIL_EXISTS as the signal that the account exists with some
 * other password (only possible for accounts predating the shared one).
 */
export async function authenticate(rollNumber) {
  const email = rollNumberToEmail(rollNumber);
  const stored = await getAccount(rollNumber);

  if (stored?.refreshToken) {
    try {
      const tokens = await refreshIdToken(stored.refreshToken);
      await patchAccount(rollNumber, { refreshToken: tokens.refreshToken, uid: tokens.uid });
      return { idToken: tokens.idToken, uid: tokens.uid };
    } catch (error) {
      // A revoked/expired refresh token is recoverable by signing in again;
      // being offline is not, and must not fall through to a sign-up attempt
      // that would fail the same way.
      if (error instanceof FirebaseRestError && error.code === "NETWORK_ERROR") throw error;
    }
  }

  // `stored.password` is only ever set when the student changed theirs and
  // typed the new one into the popup; otherwise it's the shared default.
  try {
    const tokens = await signInWithPassword(email, stored?.password ?? ACCOUNT_PASSWORD);
    await patchAccount(rollNumber, {
      email,
      uid: tokens.uid,
      refreshToken: tokens.refreshToken,
      state: ACCOUNT_STATE.ready,
      lastError: null,
    });
    return { idToken: tokens.idToken, uid: tokens.uid };
  } catch (error) {
    if (error instanceof FirebaseRestError && error.code === "NETWORK_ERROR") throw error;
  }

  try {
    const tokens = await signUpWithPassword(email, ACCOUNT_PASSWORD);
    await patchAccount(rollNumber, {
      email,
      uid: tokens.uid,
      refreshToken: tokens.refreshToken,
      state: ACCOUNT_STATE.ready,
      createdAt: new Date().toISOString(),
      lastError: null,
    });
    return { idToken: tokens.idToken, uid: tokens.uid };
  } catch (error) {
    if (error instanceof FirebaseRestError && error.code === "EMAIL_EXISTS") {
      // The account exists but neither the default nor anything we hold opens
      // it — the student changed their password in Handy. Only they can
      // supply it, so ask rather than failing with a raw auth error.
      await patchAccount(rollNumber, { email, state: ACCOUNT_STATE.needsPassword });
      throw new NeedsPasswordError(rollNumber);
    }
    throw error;
  }
}

/** Thrown when the account exists but this browser can't prove ownership. */
export class NeedsPasswordError extends Error {
  constructor(rollNumber) {
    super(`Handy password for ${rollNumber} has changed`);
    this.name = "NeedsPasswordError";
    this.code = "NEEDS_PASSWORD";
    this.rollNumber = rollNumber;
  }
}

/** Popup path for the needsPassword state: verify what the student typed, then keep it. */
export async function setPassword(rollNumber, password) {
  const email = rollNumberToEmail(rollNumber);
  const tokens = await signInWithPassword(email, password);
  await patchAccount(rollNumber, {
    email,
    password,
    uid: tokens.uid,
    refreshToken: tokens.refreshToken,
    state: ACCOUNT_STATE.ready,
    lastError: null,
  });
  return { idToken: tokens.idToken, uid: tokens.uid };
}

export async function recordSyncResult(rollNumber, { ok, error }) {
  // On failure, leave lastSyncAt alone — "last synced 2 days ago, then this
  // error" is the useful thing to show, not a blanked-out timestamp.
  const patch = ok
    ? { lastSyncAt: new Date().toISOString(), lastError: null }
    : { lastError: error ?? "Unknown error" };
  await patchAccount(rollNumber, patch);
}
