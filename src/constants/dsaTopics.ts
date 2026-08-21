/**
 * The canonical DSA topic vocabulary, and how to get there from what a
 * platform actually publishes.
 *
 * Zero-manual-tracking (the product goal) only holds where a platform really
 * publishes topic tags per solved problem — Codeforces does directly, and
 * LeetCode does per-problem, reached with one extra batched request per
 * profile refresh (see fetchLeetCodeTopicTags in api/_codingPlatforms.js).
 * CodeChef/GeeksforGeeks/HackerRank expose none at all. Rather than guess a
 * topic from a title, every other source stays untagged until the student
 * tags it themselves when logging a solve — an untagged solve counts toward
 * nothing rather than toward a topic nobody confirmed.
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
 * canonical set. Fed by api/_codingPlatforms.js's fetchLeetCodeTopicTags,
 * which batches a per-problem `question(titleSlug)` lookup for every recent
 * solve into one extra request (aliased fields, not N+1) — LeetCode's own
 * recent-submissions query carries no tags on its own.
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

/**
 * The reverse of a tag map: canonical topic -> that platform's own primary
 * tag name for it, for a "browse this topic on X" link. Built from the maps
 * above rather than a second hand-written list, so it can never name a
 * platform tag those maps do not already vouch for. Where a topic has more
 * than one raw tag (LEETCODE_TAG_MAP's "tree" and "binary tree" both reach
 * "trees"), the first one in the map's own declaration order wins — that is
 * the more general, more natural one to send a student to.
 */
function primaryTagFor(map: Record<string, DsaTopic>): Partial<Record<DsaTopic, string>> {
  const out: Partial<Record<DsaTopic, string>> = {};
  for (const [raw, topic] of Object.entries(map)) {
    if (!(topic in out)) out[topic] = raw;
  }
  return out;
}

const LEETCODE_PRIMARY_TAG = primaryTagFor(LEETCODE_TAG_MAP);
const CODEFORCES_PRIMARY_TAG = primaryTagFor(CODEFORCES_TAG_MAP);

/**
 * Where to read up on and practise one topic — never a guessed URL. LeetCode
 * and Codeforces get a real per-topic link only when that topic's own tag map
 * above actually reaches it (23 of 25 topics for LeetCode, 15 of 25 for
 * Codeforces — number-theory and advanced-graph, for instance, have no clean
 * single LeetCode tag). GeeksforGeeks and CodeChef/HackerRank publish no
 * topic taxonomy Handy can trust (confirmed investigating their APIs for
 * solve-level tagging — see fetchLeetCodeTopicTags's neighbours in
 * api/_codingPlatforms.js), so GFG gets a search link rather than a guessed
 * article slug, and CodeChef/HackerRank get their general practice page
 * rather than a fabricated topic filter.
 */
export interface TopicResourceLinks {
  leetcode: string | null;
  codeforces: string | null;
  geeksforgeeks: string;
  codechef: string;
  hackerrank: string;
}

export function topicResourceLinks(topic: DsaTopic): TopicResourceLinks {
  const leetcodeTag = LEETCODE_PRIMARY_TAG[topic];
  const codeforcesTag = CODEFORCES_PRIMARY_TAG[topic];
  return {
    leetcode: leetcodeTag ? `https://leetcode.com/tag/${leetcodeTag.replace(/\s+/g, "-")}/` : null,
    codeforces: codeforcesTag
      ? `https://codeforces.com/problemset?tags=${encodeURIComponent(codeforcesTag)}`
      : null,
    geeksforgeeks: `https://www.geeksforgeeks.org/?s=${encodeURIComponent(DSA_TOPIC_LABELS[topic])}`,
    codechef: "https://www.codechef.com/practice",
    hackerrank: "https://www.hackerrank.com/domains/algorithms",
  };
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
