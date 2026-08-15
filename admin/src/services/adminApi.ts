import { getIdToken } from "@/services/firebase/auth";

/**
 * Every privileged write in this app goes through here — one call site, so
 * "attach a fresh ID token, throw on !ok" can't be forgotten by a page. The
 * corresponding server-side half is admin/api/_admin.js's requireAdmin().
 */
export async function callAdminApi<T = unknown>(path: string, body?: unknown): Promise<T> {
  const token = await getIdToken();
  if (!token) throw new Error("Not signed in.");

  const res = await fetch(`/api/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body ?? {}),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error ?? `Request to /api/${path} failed (${res.status}).`);
  }
  return data as T;
}
