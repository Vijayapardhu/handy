import { describe, expect, it } from "vitest";
import { generatePassword, requireAdmin, AdminAuthError } from "./_admin.js";

describe("generatePassword — the only credential this system ever hands to an admin", () => {
  it("defaults to 16 characters", () => {
    expect(generatePassword()).toHaveLength(16);
  });

  it("honors a custom length", () => {
    expect(generatePassword(24)).toHaveLength(24);
  });

  it("never includes a visually-ambiguous character (0/O, 1/l/I) — read aloud or texted, not just typed", () => {
    const sample = Array.from({ length: 200 }, () => generatePassword()).join("");
    for (const ambiguous of ["0", "O", "1", "l", "I"]) {
      expect(sample).not.toContain(ambiguous);
    }
  });

  it("is not the same twice in a row", () => {
    // Not a real randomness test — just a smoke test that this isn't
    // accidentally deterministic (e.g. an unseeded PRNG, a stubbed clock).
    const a = generatePassword();
    const b = generatePassword();
    expect(a).not.toBe(b);
  });
});

describe("requireAdmin — the gate every privileged write passes through", () => {
  it("rejects a missing Authorization header before touching Firebase at all", async () => {
    // No FIREBASE_SERVICE_ACCOUNT and no credentials are configured in this
    // test run — if this reached app()/verifyIdToken() first, it would throw
    // a credentials error instead of the intended 401. Reaching the right
    // error here is itself proof the ordering fix (check the header first)
    // actually holds.
    await expect(requireAdmin({ headers: {} })).rejects.toMatchObject(
      new AdminAuthError(401, "missing_token"),
    );
  });

  it("rejects an Authorization header with no bearer token, the same way", async () => {
    await expect(requireAdmin({ headers: { authorization: "Bearer " } })).rejects.toMatchObject(
      new AdminAuthError(401, "missing_token"),
    );
  });
});
