import type { CollegePortalSnapshot } from "@/types/collegePortal";

/**
 * ID of the "Handy College Sync" extension (extension/) when it's the build we
 * signed ourselves: manifest.json pins a "key", which fixes the ID for both the
 * unpacked and the self-hosted package.
 *
 * A store does not honour that pin — it assigns its own ID — so this is a
 * fallback, not the answer. Published builds announce their real ID instead.
 */
const SELF_HOSTED_ID = "ledmfeohpnfmepdbncmcidoaflhijmkn";

/**
 * The ID the installed extension says it has.
 *
 * Set by the extension's announce.js content script on this origin, so the same
 * code reaches the unpacked build, the self-hosted one, and the Edge Add-ons
 * listing without knowing any of their IDs in advance.
 *
 * Untrusted, and doesn't need to be trusted: it only names where to send. The
 * browser enforces the extension's own externally_connectable list on delivery,
 * so a page that lies here gets its message dropped rather than answered.
 */
function extensionId(): string {
  return document.documentElement.dataset.handyExtension || SELF_HOSTED_ID;
}

interface ChromeRuntimeLike {
  sendMessage: (extensionId: string, message: unknown, callback: (response: unknown) => void) => void;
  lastError?: { message?: string } | null;
}

function getChromeRuntime(): ChromeRuntimeLike | null {
  const w = window as unknown as { chrome?: { runtime?: ChromeRuntimeLike } };
  return w.chrome?.runtime ?? null;
}

function sendToExtension<T>(message: unknown, timeoutMs = 4000): Promise<T | null> {
  const runtime = getChromeRuntime();
  if (!runtime) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    try {
      runtime.sendMessage(extensionId(), message, (response) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        // chrome.runtime.lastError is set (not thrown) when no listener answers —
        // e.g. the extension isn't installed. Treat that as "unavailable".
        resolve(runtime.lastError ? null : ((response as T) ?? null));
      });
    } catch {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    }
  });
}

export async function isExtensionAvailable(): Promise<boolean> {
  const res = await sendToExtension<{ ok: boolean }>({ type: "PING" });
  return Boolean(res?.ok);
}

export async function getLatestPortalSnapshot(): Promise<CollegePortalSnapshot | null> {
  const res = await sendToExtension<{ ok: boolean; snapshot: CollegePortalSnapshot | null }>({
    type: "GET_LATEST_SNAPSHOT",
  });
  return res?.snapshot ?? null;
}

export interface ExtensionAccount {
  rollNumber: string;
  password: string;
}

/**
 * Credentials for the account the extension provisioned on this machine, so
 * Handy can offer "continue as <roll number>" instead of asking a student to
 * type a password that was generated for them.
 *
 * The extension will only answer origins listed in its manifest's
 * `externally_connectable` (Chrome enforces this) — but note that this does
 * put a password in this page's memory, so it stays in the sign-in path and
 * is never stored by the web app.
 */
export async function getExtensionAccount(): Promise<ExtensionAccount | null> {
  const res = await sendToExtension<{ ok: boolean; account: ExtensionAccount | null }>({
    type: "GET_ACCOUNT",
  });
  return res?.account ?? null;
}

/**
 * Hands the extension a working credential so it can keep syncing unattended.
 *
 * The extension never asks a student for a password. It doesn't need to while
 * accounts sit on the shared default — and the moment one doesn't (the
 * student changed it), the web app is the only place that knows the new one,
 * so it pushes it here: on a successful sign-in, and right after a change.
 *
 * Best-effort by design — the extension may not be installed, and a failure
 * here must never block signing in. The extension verifies the credential
 * before storing it.
 */
export async function setExtensionPassword(rollNumber: string, password: string): Promise<boolean> {
  const res = await sendToExtension<{ ok: boolean }>({ type: "SET_PASSWORD", rollNumber, password });
  return Boolean(res?.ok);
}

export async function clearPortalSnapshot(): Promise<boolean> {
  const res = await sendToExtension<{ ok: boolean }>({ type: "CLEAR_SNAPSHOT" });
  return Boolean(res?.ok);
}
