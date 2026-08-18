import { describe, expect, it } from "vitest";
import handler from "./hub-attendance.js";

/** Only the guards that run before any Firebase call — same scope as sync.test.js. */
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

describe("POST /api/hub-attendance guards", () => {
  it("answers the CORS preflight", async () => {
    const res = mockRes();
    await handler({ method: "OPTIONS", headers: {} }, res);
    expect(res.statusCode).toBe(204);
  });

  it("rejects anything that isn't a POST", async () => {
    const res = mockRes();
    await handler({ method: "GET", headers: {} }, res);
    expect(res.statusCode).toBe(405);
    expect(res.body.error).toBe("method_not_allowed");
  });

  it("rejects a request with no Authorization header and no idToken in the body", async () => {
    const res = mockRes();
    await handler({ method: "POST", headers: {}, body: {} }, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("missing_token");
  });
});
