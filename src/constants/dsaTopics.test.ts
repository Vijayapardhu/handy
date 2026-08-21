import { describe, expect, it } from "vitest";
import { DSA_TOPICS, normaliseTopic, topicResourceLinks, topicsFromTags } from "./dsaTopics";

describe("normaliseTopic", () => {
  it("maps real Codeforces tags to the canonical set", () => {
    expect(normaliseTopic("codeforces", "dp")).toBe("dp");
    expect(normaliseTopic("codeforces", "two pointers")).toBe("two-pointers");
    expect(normaliseTopic("codeforces", "DSU")).toBe("union-find");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(normaliseTopic("codeforces", "  Greedy  ")).toBe("greedy");
  });

  it("returns null for a style tag with no DSA-topic equivalent, rather than guessing", () => {
    expect(normaliseTopic("codeforces", "constructive algorithms")).toBeNull();
    expect(normaliseTopic("codeforces", "brute force")).toBeNull();
  });

  it("returns null for a platform with no tag map at all", () => {
    expect(normaliseTopic("codechef", "dp")).toBeNull();
    expect(normaliseTopic("gfg", "graphs")).toBeNull();
  });

  it("maps LeetCode's own vocabulary too", () => {
    expect(normaliseTopic("leetcode", "Dynamic Programming")).toBe("dp");
    expect(normaliseTopic("leetcode", "Hash Table")).toBe("hashing");
  });
});

describe("topicsFromTags", () => {
  it("de-duplicates when two raw tags map to the same canonical topic", () => {
    // "dfs and similar" and "shortest paths"-adjacent tags can both land on
    // one canonical bucket; the result should name it once.
    expect(topicsFromTags("codeforces", ["graphs", "shortest paths"])).toEqual(["graphs"]);
  });

  it("drops unmapped tags silently rather than erroring", () => {
    expect(topicsFromTags("codeforces", ["implementation", "dp"])).toEqual(["dp"]);
  });

  it("is empty for an untagged solve", () => {
    expect(topicsFromTags("codechef", [])).toEqual([]);
  });
});

describe("topicResourceLinks", () => {
  it("builds a real LeetCode tag URL for a topic LEETCODE_TAG_MAP actually reaches", () => {
    expect(topicResourceLinks("dp").leetcode).toBe("https://leetcode.com/tag/dynamic-programming/");
    expect(topicResourceLinks("two-pointers").leetcode).toBe("https://leetcode.com/tag/two-pointers/");
  });

  it("builds a real Codeforces tag URL for a topic CODEFORCES_TAG_MAP actually reaches", () => {
    expect(topicResourceLinks("dp").codeforces).toBe("https://codeforces.com/problemset?tags=dp");
  });

  it("leaves leetcode/codeforces null for a topic neither tag map reaches, rather than guessing", () => {
    const links = topicResourceLinks("number-theory");
    // number-theory has no clean single LeetCode tag in LEETCODE_TAG_MAP.
    expect(links.leetcode).toBeNull();
  });

  it("always gives a GFG search link, CodeChef and HackerRank practice links, for every topic", () => {
    for (const topic of DSA_TOPICS) {
      const links = topicResourceLinks(topic);
      expect(links.geeksforgeeks).toContain("geeksforgeeks.org/?s=");
      expect(links.codechef).toBe("https://www.codechef.com/practice");
      expect(links.hackerrank).toBe("https://www.hackerrank.com/domains/algorithms");
    }
  });
});
