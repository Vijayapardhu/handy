/**
 * The canonical DSA topic vocabulary, and how to get there from what a
 * platform actually publishes.
 *
 * Zero-manual-tracking (the product goal) only holds where a platform really
 * publishes topic tags per solved problem — today that is Codeforces alone.
 * LeetCode's public API exposes tags per *problem*, not per accepted
 * submission in a student's recent list, and CodeChef/GeeksforGeeks/
 * HackerRank expose none at all. Rather than guess a topic from a title,
 * every other source stays untagged until the student tags it themselves when
 * logging a solve — an untagged solve counts toward nothing rather than
 * toward a topic nobody confirmed.
 */

export type DsaTopic =
  | "arrays"
  | "strings"
  | "hashing"
  | "two-pointers"
  | "sliding-window"
  | "binary-search"
  | "stack"
  | "queue"
  | "linked-list"
  | "trees"
  | "bst"
  | "heap"
  | "graphs"
  | "bfs"
  | "dfs"
  | "greedy"
  | "backtracking"
  | "dp"
  | "bit-manipulation"
  | "number-theory"
  | "prefix-sum"
  | "union-find"
  | "segment-tree"
  | "trie"
  | "advanced-graph";

/** Display order doubles as the default learning-path order used by nextFocusTopic(). */
export const DSA_TOPICS: DsaTopic[] = [
  "arrays",
  "strings",
  "hashing",
  "two-pointers",
  "sliding-window",
  "binary-search",
  "stack",
  "queue",
  "linked-list",
  "trees",
  "bst",
  "heap",
  "bfs",
  "dfs",
  "graphs",
  "greedy",
  "backtracking",
  "dp",
  "bit-manipulation",
  "prefix-sum",
  "union-find",
  "number-theory",
  "segment-tree",
  "trie",
  "advanced-graph",
];

export const DSA_TOPIC_LABELS: Record<DsaTopic, string> = {
  arrays: "Arrays",
  strings: "Strings",
  hashing: "Hashing",
  "two-pointers": "Two Pointers",
  "sliding-window": "Sliding Window",
  "binary-search": "Binary Search",
  stack: "Stack",
  queue: "Queue",
  "linked-list": "Linked List",
  trees: "Trees",
  bst: "BST",
  heap: "Heap",
  graphs: "Graphs",
  bfs: "BFS",
  dfs: "DFS",
  greedy: "Greedy",
  backtracking: "Backtracking",
  dp: "Dynamic Programming",
  "bit-manipulation": "Bit Manipulation",
  "number-theory": "Number Theory",
  "prefix-sum": "Prefix Sum",
  "union-find": "Union Find",
  "segment-tree": "Segment Tree",
  trie: "Trie",
  "advanced-graph": "Advanced Graphs",
};

/**
 * Codeforces' own tag vocabulary, lowercased, mapped to the canonical set.
 *
 * Deliberately partial. CF tags such as "constructive algorithms", "brute
 * force", "implementation", "games" or "probabilities" name a *style* of
 * problem rather than a data structure or algorithm family, and forcing one
 * onto the canonical list would be inventing structure CF never claimed.
 * `normaliseTopic` returns null for those, and a null is simply not counted —
 * which is the honest outcome for a tag with no real DSA-topic equivalent.
 */
const CODEFORCES_TAG_MAP: Record<string, DsaTopic> = {
  "data structures": "arrays",
  strings: "strings",
  "string suffix structures": "strings",
  hashing: "hashing",
  "two pointers": "two-pointers",
  "binary search": "binary-search",
  "dfs and similar": "dfs",
  trees: "trees",
  graphs: "graphs",
  "shortest paths": "graphs",
  "graph matchings": "advanced-graph",
  "flows": "advanced-graph",
  greedy: "greedy",
  dp: "dp",
  "divide and conquer": "backtracking",
  bitmasks: "bit-manipulation",
  "number theory": "number-theory",
  "chinese remainder theorem": "number-theory",
  dsu: "union-find",
  "*special": "advanced-graph",
};

/**
 * LeetCode's own topicTags, exactly as GraphQL names them, mapped to the
 * canonical set. Not wired to a live query yet — see the module doc — kept
 * here so a future fetch of per-problem tags has a normaliser ready rather
 * than needing this file touched twice.
 */
const LEETCODE_TAG_MAP: Record<string, DsaTopic> = {
  array: "arrays",
  string: "strings",
  "hash table": "hashing",
  "two pointers": "two-pointers",
  "sliding window": "sliding-window",
  "binary search": "binary-search",
  stack: "stack",
  queue: "queue",
  "linked list": "linked-list",
  tree: "trees",
  "binary tree": "trees",
  "binary search tree": "bst",
  "heap (priority queue)": "heap",
  graph: "graphs",
  "breadth-first search": "bfs",
  "depth-first search": "dfs",
  greedy: "greedy",
  backtracking: "backtracking",
  "dynamic programming": "dp",
  "bit manipulation": "bit-manipulation",
  "prefix sum": "prefix-sum",
  "union find": "union-find",
  "segment tree": "segment-tree",
  trie: "trie",
};

const TAG_MAPS: Partial<Record<"codeforces" | "leetcode", Record<string, DsaTopic>>> = {
  codeforces: CODEFORCES_TAG_MAP,
  leetcode: LEETCODE_TAG_MAP,
};

/** A platform's own raw tag, normalised to a canonical topic — or null when it names no real DSA topic. */
export function normaliseTopic(platform: string, rawTag: string): DsaTopic | null {
  const map = TAG_MAPS[platform as "codeforces" | "leetcode"];
  if (!map) return null;
  return map[rawTag.trim().toLowerCase()] ?? null;
}

/** Every raw tag a solve carries, reduced to the distinct canonical topics it maps to. */
export function topicsFromTags(platform: string, rawTags: string[]): DsaTopic[] {
  const found = new Set<DsaTopic>();
  for (const tag of rawTags) {
    const topic = normaliseTopic(platform, tag);
    if (topic) found.add(topic);
  }
  return [...found];
}

export type MasteryBand = "starting" | "learning" | "practicing" | "strong" | "advanced" | "mastered";

export const MASTERY_BAND_LABELS: Record<MasteryBand, string> = {
  starting: "Starting",
  learning: "Learning",
  practicing: "Practicing",
  strong: "Strong",
  advanced: "Advanced",
  mastered: "Mastered",
};

/** The 0-20/20-40/... bands as stated in the spec, applied by bandFor() in lib/calculations/mastery.ts. */
export const MASTERY_BAND_FLOORS: [number, MasteryBand][] = [
  [95, "mastered"],
  [80, "advanced"],
  [60, "strong"],
  [40, "practicing"],
  [20, "learning"],
  [0, "starting"],
];
