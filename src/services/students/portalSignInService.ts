import { signInWithCustomToken } from "@/services/firebase/auth";
import type { Campus } from "@/lib/campus";

/**
 * Signing in by proving you can sign into your own college portal.
 *
 * AEC and ACET have no captcha, so Handy's server can log in as the student and
 * read their attendance — and that login *is* the identity check. There is no
 * separate Handy password to remember: if Campus Connect accepts the
 * credentials, the account is created and signed into on the spot.
 *
 * The portal password is a local const for the length of one fetch. It goes to
 * /api/verify over HTTPS and nowhere else — not to Firestore, not to
 * localStorage, not to a log. The server does the same (see api/verify.js), and
 * hands back a short-lived Firebase custom token instead of any password.
 */
export class PortalSignInError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PortalSignInError";
  }
}

/**
 * Server codes turned into something a student can act on.
 *
 * `use_extension` is not a failure and does not read like one: an AUS student
 * has not done anything wrong, they are simply on the campus whose portal a
 * server cannot sign into.
 */
const MESSAGES: Record<string, string> = {
  invalid_credentials:
    "That roll number and portal password did not work. Check both — this is your college portal password, not a Handy one.",
  campus_locked:
    "Your campus is switched off for maintenance right now. Try again in a little while.",
  use_extension:
    "Aditya University accounts sync through the Handy browser extension on a laptop, which never needs your college password.",
  portal_returned_nothing:
    "Signed in, but the college portal sent nothing back. That is usually temporary — try again in a minute.",
  rate_limited: "Too many attempts. Wait a few minutes before trying again.",
  unsupported_campus: "Handy does not recognise that roll number's campus yet.",
  missing_credentials: "Enter both your roll number and your portal password.",
  storage_unconfigured: "Handy is not fully configured yet. Tell whoever set it up.",
};

const BY_STATUS: Record<number, string> = {
  401: "invalid_credentials",
  403: "campus_locked",
  409: "use_extension",
  429: "rate_limited",
  502: "portal_returned_nothing",
};

export interface PortalSignInResult {
  uid: string;
  name: string | null;
  /** Present for campuses whose portal exposes marks; "N/A" when it does not. */
  cgpa: string | null;
}

export async function signInWithPortal(
  rollNumber: string,
  portalPassword: string,
  campus: Campus,
): Promise<PortalSignInResult> {
  let response: Response;
  try {
    response = await fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rollNumber, password: portalPassword, campus }),
    });
  } catch {
    // Distinguished from a portal failure on purpose: "check your connection"
    // is actionable, and "the college server is down" would be a guess.
    throw new PortalSignInError(
      "network",
      "Could not reach Handy. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    let code = BY_STATUS[response.status] ?? "portal_failed";
    let serverMessage: string | undefined;
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      if (body.error) code = body.error;
      serverMessage = body.message;
    } catch {
      /* fall through to the mapped message */
    }
    throw new PortalSignInError(
      code,
      MESSAGES[code] ??
        serverMessage ??
        "The college portal could not be reached. Try again shortly.",
    );
  }

  const data = (await response.json()) as {
    uid: string;
    token: string;
    name?: string | null;
    cgpa?: string | null;
  };

  // onAuthStateChanged in AuthProvider takes it from here and loads the
  // profile, exactly as it does after a roll-number sign-in.
  await signInWithCustomToken(data.token);

  return { uid: data.uid, name: data.name ?? null, cgpa: data.cgpa ?? null };
}
