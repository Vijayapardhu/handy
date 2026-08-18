import { describe, expect, it, beforeEach } from "vitest";
import {
  aggregateHubCourse,
  decodeJwtExpiryMs,
  encryptHubPassword,
  decryptHubPassword,
} from "./_hubPortal.js";

/** Trimmed to two module rows from a real get-attendance-for-app-by-studentId response. */
const SAMPLE_ROWS = [
  {
    _id: "6a56fdaaa08ffb441058015a",
    batch_name: "CF_2029_INTERMEDIATE_B1",
    course_name: "CODEFORGE",
    technology_name: "CodeForge-Intermediate",
    technology_icon: "http://example/icon.png",
    module_name: "Day-1: Python — lists, strings, sets, functions",
    module_id: "6a603ceea4858d5333f4aea5",
    module_icon: "https://example/module-icon.png",
    topic: [{ topic_name: "Lists, strings, sets, tuples and functions", total_sessions: 1, attended_count: 0 }],
  },
  {
    _id: "6a56fdaaa08ffb441058015a",
    batch_name: "CF_2029_INTERMEDIATE_B1",
    course_name: "CODEFORGE",
    technology_name: "CodeForge-Intermediate",
    technology_icon: "http://example/icon.png",
    module_name: "Day-12: Sliding window — variants",
    module_id: "6a740787d7a244cb90987da5",
    module_icon: "https://example/module-icon-2.png",
    topic: [
      { topic_name: "Sliding Window - Fixed Length", total_sessions: 1, attended_count: 1 },
      { topic_name: "Sliding Window - Variable Length", total_sessions: 0, attended_count: 0 },
    ],
  },
];

const REQUEST_META = { batchId: "6a56fdaaa08ffb441058015a", technologyId: "6a56f848a08ffb441057d481" };

describe("aggregateHubCourse", () => {
  it("returns null for no rows", () => {
    expect(aggregateHubCourse([], REQUEST_META)).toBeNull();
    expect(aggregateHubCourse(undefined, REQUEST_META)).toBeNull();
  });

  it("sums sessions across modules and topics, and computes a percentage", () => {
    const course = aggregateHubCourse(SAMPLE_ROWS, REQUEST_META);
    expect(course.batchId).toBe(REQUEST_META.batchId);
    expect(course.technologyId).toBe(REQUEST_META.technologyId);
    expect(course.courseName).toBe("CODEFORGE");
    expect(course.technologyName).toBe("CodeForge-Intermediate");
    expect(course.modules).toHaveLength(2);

    // 1 + (1 + 0) held, 0 + (1 + 0) attended.
    expect(course.totalSessions).toBe(2);
    expect(course.attendedSessions).toBe(1);
    expect(course.percentage).toBe(50);
  });

  it("keys a course by the requested batch/technology pair, not the response's own _id — two separate enrollments of the same course share an _id", () => {
    const batchA = aggregateHubCourse(SAMPLE_ROWS, { batchId: "batch-A", technologyId: "tech-1" });
    const batchB = aggregateHubCourse(SAMPLE_ROWS, { batchId: "batch-B", technologyId: "tech-1" });
    expect(batchA.batchId).toBe("batch-A");
    expect(batchB.batchId).toBe("batch-B");
    expect(batchA.batchId).not.toBe(batchB.batchId);
  });

  it("reports a null percentage rather than dividing by zero when nothing has been held", () => {
    const course = aggregateHubCourse(
      [
        {
          _id: "batch1",
          course_name: "CODEFORGE",
          technology_name: "CodeForge-Intermediate",
          module_id: "m1",
          module_name: "Upcoming module",
          topic: [{ topic_name: "Not started", total_sessions: 0, attended_count: 0 }],
        },
      ],
      REQUEST_META,
    );
    expect(course.totalSessions).toBe(0);
    expect(course.percentage).toBeNull();
  });
});

describe("decodeJwtExpiryMs", () => {
  function fakeJwt(payload) {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${header}.${body}.fakesignature`;
  }

  it("reads the exp claim as milliseconds", () => {
    expect(decodeJwtExpiryMs(fakeJwt({ exp: 1787052575 }))).toBe(1787052575 * 1000);
  });

  it("returns null for garbage input instead of throwing", () => {
    expect(decodeJwtExpiryMs("not-a-jwt")).toBeNull();
    expect(decodeJwtExpiryMs("")).toBeNull();
  });
});

describe("encryptHubPassword / decryptHubPassword", () => {
  beforeEach(() => {
    process.env.HUB_CRED_KEY = "a".repeat(64);
  });

  it("round-trips a password", () => {
    const encrypted = encryptHubPassword("Pardhu@9");
    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.data).toBeTruthy();
    expect(encrypted.tag).toBeTruthy();
    expect(decryptHubPassword(encrypted)).toBe("Pardhu@9");
  });

  it("produces a different ciphertext each time (fresh IV)", () => {
    const a = encryptHubPassword("Pardhu@9");
    const b = encryptHubPassword("Pardhu@9");
    expect(a.data).not.toBe(b.data);
    expect(a.iv).not.toBe(b.iv);
  });

  it("fails to decrypt if the ciphertext was tampered with", () => {
    const encrypted = encryptHubPassword("Pardhu@9");
    encrypted.data = Buffer.from("tampered-ciphertext-bytes!!").toString("base64");
    expect(() => decryptHubPassword(encrypted)).toThrow();
  });
});
