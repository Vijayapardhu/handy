// Vercel serverless function: POST /api/topic-explainer
//
// Body:    { idToken, topic }
// Returns: { ok, explanation: { text, model, generatedAt } }
//
// A short, plain-language explanation of one DSA topic on the roadmap — "what
// is a sliding window", not an analysis of anything the student wrote. Unlike
// coding-complexity.js this has no per-request cost concern: there are at
// most 25 canonical topics (see DSA_TOPIC_IDS below), so it is generated once
// per topic and cached in Firestore forever after — "what a sliding window
// is" does not change between requests, unlike a solution's complexity.
//
// Shares appConfig/ai (key, model, enabled) with coding-complexity.js rather
// than duplicating that config — see that file for why it lives in Firestore
// and not a VITE_ variable.
import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-20b:free";

/**
 * Kept in sync by hand with DSA_TOPICS in src/constants/dsaTopics.ts — api/
 * does not import from src/ anywhere else in this project, so this is a
 * deliberate duplication rather than a cross-directory import Vercel's
 * function bundler was never asked to support. Validated against on every
 * request so a stale or made-up id from a future client build cannot spend a
 * model call on nonsense.
 */
const DSA_TOPIC_LABELS = {
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
  bst: "Binary Search Trees",
  heap: "Heap / Priority Queue",
  graphs: "Graphs",
  bfs: "Breadth-First Search",
  dfs: "Depth-First Search",
  greedy: "Greedy Algorithms",
  backtracking: "Backtracking",
  dp: "Dynamic Programming",
  "bit-manipulation": "Bit Manipulation",
  "number-theory": "Number Theory",
  "prefix-sum": "Prefix Sum",
  "union-find": "Union Find (Disjoint Set)",
  "segment-tree": "Segment Tree",
  trie: "Trie",
  "advanced-graph": "Advanced Graph Algorithms",
};

const CONFIG_TTL_MS = 5 * 60_000;
let configCache = null;

function app() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  return initializeApp({ credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
}

function safeParse(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

async function readAiConfig(db) {
  if (configCache && Date.now() - configCache.at < CONFIG_TTL_MS) return configCache.value;

  let stored = {};
  try {
    const snap = await db.doc("appConfig/ai").get();
    if (snap.exists) stored = snap.data() ?? {};
  } catch (error) {
    console.error("[topic-explainer] could not read appConfig/ai:", error?.message);
  }

  const value = {
    key: stored.openRouterKey || process.env.OPENROUTER_API_KEY || "",
    model: stored.model || process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
    enabled: stored.enabled !== false,
  };
  configCache = { at: Date.now(), value };
  return value;
}

const SYSTEM_PROMPT = `You explain a single data-structures-and-algorithms topic to a student preparing for competitive programming and technical interviews.

Rules:
- Two or three sentences: what the technique/structure is, and the shape of problem it is used for. No preamble, no "Sure, here is...".
- Plain language over formalism, but be precise about what actually makes the technique work.
- Do not describe a specific problem or write any code.

Answer with a single JSON object and nothing else:
{"text": string}`;

/** Models wrap JSON in prose or a fenced block often enough that the happy path cannot be the only path. */
export function extractText(content) {
  if (!content) return null;
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : content;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    const text = typeof parsed?.text === "string" ? parsed.text.trim() : "";
    return text ? text.slice(0, 700) : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const payload = typeof req.body === "string" ? safeParse(req.body) : req.body;
  const idToken = (req.headers.authorization ?? "").replace(/^Bearer /, "") || payload?.idToken;
  if (!idToken) return res.status(401).json({ ok: false, error: "missing_token" });

  app();
  const db = getFirestore();

  try {
    await getAuth().verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ ok: false, error: "invalid_token" });
  }

  const topic = String(payload?.topic ?? "").trim();
  if (!Object.hasOwn(DSA_TOPIC_LABELS, topic)) {
    return res.status(400).json({ ok: false, error: "unknown_topic" });
  }

  const cacheRef = db.doc(`topicExplainers/${topic}`);
  const cached = await cacheRef.get();
  if (cached.exists) {
    const data = cached.data();
    if (data?.text) {
      return res.status(200).json({
        ok: true,
        explanation: { text: data.text, model: data.model ?? null, generatedAt: data.generatedAt },
      });
    }
  }

  const config = await readAiConfig(db);
  if (!config.key || !config.enabled) {
    return res.status(200).json({ ok: false, error: "ai_unconfigured" });
  }

  let response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    try {
      response = await fetch(OPENROUTER_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${config.key}`,
          "Content-Type": "application/json",
          // Plain ASCII only — see coding-complexity.js's note on why an em
          // dash here once took the whole endpoint down.
          "HTTP-Referer": "https://handy.vijayaapardhu.dev",
          "X-Title": "Handy - topic explainer",
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0.2,
          max_tokens: 1200,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `Topic: ${DSA_TOPIC_LABELS[topic]}` },
          ],
        }),
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    console.error("[topic-explainer] openrouter unreachable:", error?.message);
    return res.status(502).json({ ok: false, error: "ai_unreachable" });
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[topic-explainer] openrouter ${response.status}:`, detail.slice(0, 300));
    if (response.status === 401 || response.status === 402) {
      return res.status(200).json({ ok: false, error: "ai_unconfigured" });
    }
    return res.status(502).json({ ok: false, error: "ai_failed" });
  }

  const body = await response.json().catch(() => null);
  const choice = body?.choices?.[0];

  if (choice?.finish_reason === "length") {
    console.error("[topic-explainer] truncated before an answer for", topic);
    return res.status(502).json({ ok: false, error: "ai_truncated" });
  }

  const text = extractText(choice?.message?.content);
  if (!text) {
    console.error("[topic-explainer] unparseable model reply for", topic, JSON.stringify(choice ?? {}).slice(0, 500));
    return res.status(502).json({ ok: false, error: "ai_unparseable" });
  }

  const model = body?.model ?? config.model;
  const generatedAt = new Date().toISOString();
  await cacheRef.set({ topic, text, model, generatedAt });

  return res.status(200).json({ ok: true, explanation: { text, model, generatedAt } });
}
