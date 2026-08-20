import { describe, expect, it } from "vitest";
import { compareVersions } from "../src/updateCheck.js";

// Same suite mobile/test/updates_test.dart runs against Updates.compareVersions
// — the two implementations have to agree, or a build could read as current on
// one platform and stale on the other.
describe("compareVersions", () => {
  it("orders by number, not by string", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareVersions("1.9.0", "1.10.0")).toBeLessThan(0);
  });

  it("treats equal versions as equal", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
  });

  it("pads missing parts with zero", () => {
    expect(compareVersions("1.2", "1.2.0")).toBe(0);
    expect(compareVersions("1.2.1", "1.2")).toBeGreaterThan(0);
  });

  it("does not mistake a patch bump for a major one", () => {
    expect(compareVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
  });

  it("recognises every level, however it is spelled", () => {
    expect(compareVersions("v1.2.0", "1.2.0")).toBe(0);
    expect(compareVersions("1.2.0-beta", "1.2.0")).toBe(0);
  });

  it("survives junk rather than throwing", () => {
    expect(compareVersions("", "1.0.0")).toBeLessThan(0);
    expect(compareVersions(null, undefined)).toBe(0);
    expect(compareVersions("not-a-version", "1.0.0")).toBeLessThan(0);
  });
});
