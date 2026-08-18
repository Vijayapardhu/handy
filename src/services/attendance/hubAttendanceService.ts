import type { HubAttendanceSnapshot } from "@/types/hubAttendance";

/**
 * Thin client for /api/hub-connect and /api/hub-attendance.
 *
 * Mirrors portalSignInService.ts's shape (a typed error class, server codes
 * mapped to a message the student can act on) — but this is not a sign-in:
 * the student is already authenticated with Handy, this is linking a second,
 * unrelated college system (Maya/Hub) on top of that.
 */
export class HubAttendanceError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HubAttendanceError";
  }
}

const MESSAGES: Record<string, string> = {
  invalid_credentials:
    "That roll number and password didn't work on CodeForge. This is your Maya/CodeForge login, not your Handy one.",
  missing_credentials: "Enter both your CodeForge roll number and password.",
  rate_limited: "Too many attempts. Wait a few minutes before trying again.",
  hub_failed: "Could not reach CodeForge. Try again shortly.",
};

async function readError(response: Response, fallback: string): Promise<HubAttendanceError> {
  try {
    const data = (await response.json()) as { error?: string; message?: string };
    const code = data.error ?? "unknown";
    return new HubAttendanceError(code, MESSAGES[code] ?? data.message ?? fallback);
  } catch {
    return new HubAttendanceError("unknown", fallback);
  }
}

export async function connectHub(rollNumber: string, password: string, idToken: string): Promise<void> {
  const response = await fetch("/api/hub-connect", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ rollNumber, password }),
  });
  if (!response.ok) throw await readError(response, "Could not connect to the Hub.");
}

export async function disconnectHub(idToken: string): Promise<void> {
  const response = await fetch("/api/hub-connect", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
  });
  if (!response.ok) throw await readError(response, "Could not disconnect the Hub.");
}

export interface HubAttendanceResult {
  linked: boolean;
  snapshot: HubAttendanceSnapshot | null;
}

export async function fetchHubAttendance(
  idToken: string,
  forceRefresh = false,
): Promise<HubAttendanceResult> {
  const response = await fetch("/api/hub-attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ forceRefresh }),
  });
  if (!response.ok) throw await readError(response, "Could not load Hub attendance.");
  const data = (await response.json()) as { linked: boolean; snapshot?: HubAttendanceSnapshot };
  return { linked: Boolean(data.linked), snapshot: data.snapshot ?? null };
}
