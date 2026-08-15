import { describe, expect, it } from "vitest";
import { detectCampus, usesPortalLogin } from "./campus";

describe("detectCampus", () => {
  it("recognises every real AUS roll in the live database", () => {
    // Not invented examples — these are the accounts that actually exist, and
    // they span two intakes, which is why the rule matches B + two digits
    // rather than a fixed B11/B21.
    const real = [
      "25B11CS101",
      "25B11CS669",
      "25b11cs012",
      "26B21CS058",
      "26B21CS059",
      "26B21DS013",
      "26b21cs140",
      "26b21cs141",
      "26b21cs142",
    ];
    for (const roll of real) {
      expect(detectCampus(roll)).toEqual({ campus: "AUS", confident: true });
    }
  });

  it("reads AUS admission numbers", () => {
    expect(detectCampus("AUS26-10819")).toEqual({ campus: "AUS", confident: true });
  });

  it("recognises the observed AEC and ACET rolls", () => {
    expect(detectCampus("24A91A0501")).toEqual({ campus: "AEC", confident: true });
    expect(detectCampus("23P31A0341")).toEqual({ campus: "ACET", confident: true });
  });

  it("does not decide on shape alone", () => {
    // The whole reason this keys on the college code. The seeded demo student
    // has the identical shape to the AEC and ACET rolls above and belongs to
    // neither — a shape-based rule would send its password to the wrong portal.
    expect(detectCampus("23A31A05B1")).toEqual({ campus: null, confident: false });
  });

  it("says it does not know rather than guessing", () => {
    for (const roll of ["", "X", "99Z99ZZ999", "hello", "12345678"]) {
      expect(detectCampus(roll)).toEqual({ campus: null, confident: false });
    }
  });

  it("is case-insensitive and tolerates surrounding space", () => {
    expect(detectCampus("  26b21cs058  ").campus).toBe("AUS");
    expect(detectCampus("24a91a0501").campus).toBe("AEC");
  });

  it("knows which campuses type a portal password", () => {
    expect(usesPortalLogin("AEC")).toBe(true);
    expect(usesPortalLogin("ACET")).toBe(true);
    // AUS never does — its portal enforces a captcha, so those students go
    // through the extension and are never asked for one.
    expect(usesPortalLogin("AUS")).toBe(false);
    expect(usesPortalLogin(null)).toBe(false);
  });
});
