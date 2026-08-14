import { afterEach, beforeEach, describe, expect, it } from "vitest";
import handler from "./sync.js";

/**
 * Covers the guards that run *before* any Firebase call, so these tests need
 * no credentials and never touch the project. Everything past the guards
 * (account creation, the batch write) is exercised by the shared mapping
 * tests in src/services/students/collegePortalImportService.test.ts, which
 * assert this function's mapping module matches the web app's.
 */
function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };
  return res;
}

const VALID_SNAPSHOT = {
  rollNumber: "26B21CS058",
  attendance: { subjects: [], total: null },
};

describe("POST /api/sync guards", () => {
  beforeEach(() => {
    process.env.HANDY_SYNC_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.HANDY_SYNC_API_KEY;
  });

  it("answers the CORS preflight the x-handy-key header triggers", async () => {
    const res = mockRes();
    await handler({ method: "OPTIONS", headers: {} }, res);
    expect(res.statusCode).toBe(204);
    expect(res.headers["Access-Control-Allow-Headers"]).toContain("x-handy-key");
  });

  it("rejects anything that isn't a POST", async () => {
    const res = mockRes();
    await handler({ method: "GET", headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  it("refuses every request when the server has no key configured", async () => {
    delete process.env.HANDY_SYNC_API_KEY;
    const res = mockRes();
    await handler({ method: "POST", headers: { "x-handy-key": "anything" }, body: VALID_SNAPSHOT }, res);
    // Fails closed: a missing secret must never mean "let everyone in".
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe("server_not_configured");
  });

  it("rejects a wrong or missing key", async () => {
    const wrong = mockRes();
    await handler({ method: "POST", headers: { "x-handy-key": "nope" }, body: VALID_SNAPSHOT }, wrong);
    expect(wrong.statusCode).toBe(401);

    const missing = mockRes();
    await handler({ method: "POST", headers: {}, body: VALID_SNAPSHOT }, missing);
    expect(missing.statusCode).toBe(401);
  });

  it("rejects a body that isn't a usable snapshot", async () => {
    for (const body of [null, {}, { rollNumber: "26B21CS058" }, { attendance: { subjects: [] } }]) {
      const res = mockRes();
      await handler({ method: "POST", headers: { "x-handy-key": "test-key" }, body }, res);
      expect(res.statusCode, JSON.stringify(body)).toBe(400);
      expect(res.body.error).toBe("invalid_snapshot");
    }
  });

  it("accepts a JSON string body, since not every host pre-parses it", async () => {
    const res = mockRes();
    await handler(
      { method: "POST", headers: { "x-handy-key": "test-key" }, body: JSON.stringify({ bad: true }) },
      res,
    );
    // Parsed, then rejected on shape — not rejected as unparseable.
    expect(res.statusCode).toBe(400);
  });
});
