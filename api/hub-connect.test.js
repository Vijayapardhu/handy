import { describe, expect, it } from "vitest";
import handler from "./hub-connect.js";

/**
 * Only the guards that run before any Firebase call — same scope as
 * sync.test.js. Everything past `verifyIdToken` needs a real Firebase project
 * and isn't exercised here.
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

describe("/api/hub-connect guards", () => {
  it("answers the CORS preflight", async () => {
    const res = mockRes();
    await handler({ method: "OPTIONS", headers: {} }, res);
    expect(res.statusCode).toBe(204);
  });

  it("rejects anything that isn't POST or DELETE", async () => {
    const res = mockRes();
    await handler({ method: "GET", headers: {} }, res);
    expect(res.statusCode).toBe(405);
    expect(res.body.error).toBe("method_not_allowed");
  });

  it("rejects a POST with no Authorization header and no idToken in the body", async () => {
    const res = mockRes();
    await handler({ method: "POST", headers: {}, body: { rollNumber: "26B21CS058", password: "x" } }, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("missing_token");
  });

  it("rejects a DELETE with no token the same way", async () => {
    const res = mockRes();
    await handler({ method: "DELETE", headers: {}, body: {} }, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("missing_token");
  });
});
