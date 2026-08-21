import { describe, expect, it } from "vitest";
import { bandFor, computeTopicMastery, nextFocusTopic, roadmapMastery, weakestTopic } from "./mastery";
import type { CodingSolutionDoc, ProblemDifficulty } from "@/types/coding";
import { DSA_TOPICS } from "@/constants/dsaTopics";

const TODAY = "2026-08-20";

function solution(
  id: string,
  solvedAt: string,
  topics: string[],
  difficulty: ProblemDifficulty | null = "medium",
): CodingSolutionDoc {
  return {
    id,
    studentId: "s1",
    platform: "codeforces",
    title: id,
    url: "",
    difficulty,
    language: "C++",
    code: "",
    notes: "",
    complexity: null,
    topics,
    solvedAt,
    createdAt: TODAY,
    updatedAt: TODAY,
  };
}

describe("bandFor", () => {
  it("matches the spec's stated bands exactly", () => {
    expect(bandFor(0)).toBe("starting");
    expect(bandFor(19)).toBe("starting");
    expect(bandFor(20)).toBe("learning");
    expect(bandFor(39)).toBe("learning");
    expect(bandFor(40)).toBe("practicing");
    expect(bandFor(59)).toBe("practicing");
    expect(bandFor(60)).toBe("strong");
    expect(bandFor(79)).toBe("strong");
    expect(bandFor(80)).toBe("advanced");
    expect(bandFor(94)).toBe("advanced");
    expect(bandFor(95)).toBe("mastered");
    expect(bandFor(100)).toBe("mastered");
  });
});

describe("computeTopicMastery", () => {
  it("is empty with nothing solved", () => {
    expect(computeTopicMastery([], TODAY)).toEqual([]);
  });

  it("ignores an untagged solve entirely — it counts toward no topic", () => {
    expect(computeTopicMastery([solution("a", TODAY, [])], TODAY)).toEqual([]);
  });

  it("counts one solve toward every topic it is tagged with", () => {
    const result = computeTopicMastery([solution("a", TODAY, ["dp", "graphs"])], TODAY);
    expect(result.map((r) => r.topic).sort()).toEqual(["dp", "graphs"]);
    expect(result.every((r) => r.solved === 1)).toBe(true);
  });

  it("weighs hard above medium above easy", () => {
    const easy = computeTopicMastery([solution("a", TODAY, ["dp"], "easy")], TODAY)[0].percent;
    const medium = computeTopicMastery([solution("b", TODAY, ["dp"], "medium")], TODAY)[0].percent;
    const hard = computeTopicMastery([solution("c", TODAY, ["dp"], "hard")], TODAY)[0].percent;
    expect(easy).toBeLessThan(medium);
    expect(medium).toBeLessThan(hard);
  });

  it("treats an unrecorded difficulty the same as easy, not as medium", () => {
    const unset = computeTopicMastery([solution("a", TODAY, ["dp"], null)], TODAY)[0].percent;
    const easy = computeTopicMastery([solution("b", TODAY, ["dp"], "easy")], TODAY)[0].percent;
    expect(unset).toBe(easy);
  });

  it("weighs a recent solve above an old one", () => {
    const recent = computeTopicMastery([solution("a", TODAY, ["dp"], "hard")], TODAY)[0].percent;
    const old = computeTopicMastery([solution("b", "2024-01-01", ["dp"], "hard")], TODAY)[0].percent;
    expect(recent).toBeGreaterThan(old);
  });

  it("never exceeds 100 no matter how much is solved", () => {
    const many = Array.from({ length: 50 }, (_, i) => solution(`a${i}`, TODAY, ["dp"], "hard"));
    expect(computeTopicMastery(many, TODAY)[0].percent).toBe(100);
  });

  it("reports the real difficulty split alongside the score", () => {
    const solutions = [
      solution("a", TODAY, ["arrays"], "easy"),
      solution("b", TODAY, ["arrays"], "easy"),
      solution("c", TODAY, ["arrays"], "hard"),
    ];
    expect(computeTopicMastery(solutions, TODAY)[0].byDifficulty).toEqual({ easy: 2, medium: 0, hard: 1 });
  });

  it("sorts most-practiced first", () => {
    const solutions = [
      solution("a", TODAY, ["arrays"], "easy"),
      solution("b", TODAY, ["graphs"], "hard"),
      solution("c", TODAY, ["graphs"], "hard"),
    ];
    expect(computeTopicMastery(solutions, TODAY)[0].topic).toBe("graphs");
  });

  it("ignores a topic id that is not in the current canonical list", () => {
    const weird = solution("a", TODAY, ["some-future-topic-id"]);
    expect(computeTopicMastery([weird], TODAY)).toEqual([]);
  });
});

describe("weakestTopic", () => {
  it("requires at least two solves before calling a topic weak", () => {
    const oneOff = computeTopicMastery([solution("a", TODAY, ["dp"], "easy")], TODAY);
    expect(weakestTopic(oneOff)).toBeNull();
  });

  it("picks the lowest-percent topic once it qualifies", () => {
    const solutions = [
      solution("a", TODAY, ["arrays"], "hard"),
      solution("b", TODAY, ["arrays"], "hard"),
      solution("c", TODAY, ["graphs"], "easy"),
      solution("d", TODAY, ["graphs"], "easy"),
    ];
    expect(weakestTopic(computeTopicMastery(solutions, TODAY))?.topic).toBe("graphs");
  });

  it("is null with nothing solved", () => {
    expect(weakestTopic([])).toBeNull();
  });
});

describe("nextFocusTopic", () => {
  it("recommends the first untouched topic in the curated order", () => {
    // Solve everything except the first two in DSA_TOPICS order.
    const solutions = DSA_TOPICS.slice(2).map((topic, i) => solution(`s${i}`, TODAY, [topic], "medium"));
    expect(nextFocusTopic(computeTopicMastery(solutions, TODAY))).toBe(DSA_TOPICS[0]);
  });

  it("falls back to the weakest topic once everything has been touched", () => {
    const solutions = DSA_TOPICS.flatMap((topic, i) =>
      // Every topic gets two solves so weakestTopic can qualify; one topic
      // gets only easy ones so it is the clear weakest.
      i === 0
        ? [solution(`${topic}-1`, TODAY, [topic], "easy"), solution(`${topic}-2`, TODAY, [topic], "easy")]
        : [solution(`${topic}-1`, TODAY, [topic], "hard"), solution(`${topic}-2`, TODAY, [topic], "hard")],
    );
    expect(nextFocusTopic(computeTopicMastery(solutions, TODAY))).toBe(DSA_TOPICS[0]);
  });

  it("recommends the very first curated topic for a student who has solved nothing", () => {
    expect(nextFocusTopic([])).toBe(DSA_TOPICS[0]);
  });
});

describe("roadmapMastery", () => {
  it("returns every canonical topic, not just the ones with exposure", () => {
    const roadmap = roadmapMastery([], TODAY);
    expect(roadmap).toHaveLength(DSA_TOPICS.length);
    expect(roadmap.map((entry) => entry.topic)).toEqual(DSA_TOPICS);
  });

  it("fills an untouched topic with a real zero rather than leaving it out", () => {
    const roadmap = roadmapMastery([], TODAY);
    expect(roadmap[0]).toEqual({
      topic: DSA_TOPICS[0],
      solved: 0,
      byDifficulty: { easy: 0, medium: 0, hard: 0 },
      percent: 0,
      band: "starting",
      lastSolvedAt: null,
    });
  });

  it("carries the real computed entry through for a topic with exposure", () => {
    const solutions = [solution("s1", TODAY, [DSA_TOPICS[0]], "hard")];
    const roadmap = roadmapMastery(solutions, TODAY);
    expect(roadmap[0].solved).toBe(1);
    expect(roadmap[0].byDifficulty).toEqual({ easy: 0, medium: 0, hard: 1 });
    expect(roadmap[0].percent).toBeGreaterThan(0);
  });

  it("stays in curated order regardless of solve order", () => {
    const solutions = [solution("s1", TODAY, [DSA_TOPICS[10]]), solution("s2", TODAY, [DSA_TOPICS[2]])];
    const roadmap = roadmapMastery(solutions, TODAY);
    expect(roadmap.map((entry) => entry.topic)).toEqual(DSA_TOPICS);
  });
});
