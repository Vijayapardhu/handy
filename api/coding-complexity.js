// Vercel serverless function: POST /api/coding-complexity
//
// Body:    { idToken, code, language, title?, platform? }
// Returns: { ok, verdict: { time, space, confidence, explanation, bottleneck, betterApproach, model } }
//
// What a submitted solution actually costs, in time and space.
//
// No coding platform publishes this. LeetCode reports a runtime in
// milliseconds and a "beats 84%" percentile, which is one machine on one day
// against one test set — not a complexity. So the verdict is read off the code
// itself by a model, through OpenRouter.
//
// The key lives in Firestore at `appConfig/ai`, not in the client and not in a
// VITE_ variable. `appConfig` has no rule block in firestore.rules at all,
// which under Firestore's default-deny means no browser can read it — only
// this function, with the Admin SDK. Set it with:
//
//   node scripts/set-ai-key.mjs sk-or-v1-...  [model]
//
// If no key is configured the endpoint answers `ai_unconfigured` rather than
// failing: the student can still type a complexity in by hand, and the page
// says so. An analysis feature that silently breaks the solve log would be
// worse than one that is plainly switched off.
import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Sensible default; overridden by `model` on appConfig/ai or OPENROUTER_MODEL.
 *
 * A free OpenRouter model, deliberately — this project runs analysis at no
 * cost per request rather than against a paid tier.
 *
 * Not `cohere/north-mini-code:free`, despite the code-flavoured name: it
 * reasons before answering, and how much is unpredictable — 31 tokens for
 * "Two Sum", 3130 for a two-function "Happy Number", both real measurements
 * against this endpoint's own prompt. That variance is what MAX_TOKENS below
 * has to cover, and it made the model expensive in the one currency a free
 * tier still charges: latency and the chance of hitting the cap before ever
 * answering (see the ai_truncated path). gpt-oss-20b measured at 445
 * reasoning tokens for the same "Happy Number" case and finished with room to
 * spare. OpenRouter's free lineup turns over; check
 * `https://openrouter.ai/models?max_price=0` before assuming this slug still
 * exists.
 */
const DEFAULT_MODEL = "openai/gpt-oss-20b:free";

/**
 * Longer than any single interview-style solution, short enough that a pasted
 * repository cannot run up a bill. Measured in characters, since that is what
 * the student pasted; tokens are roughly a quarter of this.
 */
const MAX_CODE_CHARS = 20_000;

/**
 * Per-student ceiling. Deliberately tighter than the 40/hour in sync.js:
 * every one of these costs real money, and nobody analysing their own
 * homework needs a 41st run in the same hour.
 */
const MAX_ANALYSES_PER_HOUR = 15;
const RATE_WINDOW_MS = 60 * 60_000;

/** Model answers are not free — a warm container should not re-read config per request. */
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

/**
 * The OpenRouter key and model.
 *
 * Firestore first so the key can be rotated (or the model swapped) without a
 * redeploy; the environment is the fallback for a local `vercel dev` where
 * nobody wants to write a document first.
 */
async function readAiConfig(db) {
  if (configCache && Date.now() - configCache.at < CONFIG_TTL_MS) return configCache.value;

  let stored = {};
  try {
    const snap = await db.doc("appConfig/ai").get();
    if (snap.exists) stored = snap.data() ?? {};
  } catch (error) {
    console.error("[complexity] could not read appConfig/ai:", error?.message);
  }

  const value = {
    key: stored.openRouterKey || process.env.OPENROUTER_API_KEY || "",
    model: stored.model || process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
    // A kill switch that does not need a deploy — useful the day a bill looks wrong.
    enabled: stored.enabled !== false,
  };
  configCache = { at: Date.now(), value };
  return value;
}

/** Same shape as sync.js's limiter, its own collection so the budgets never share. */
async function withinAnalysisLimit(db, uid) {
  const ref = db.doc(`codingAiLimits/${uid}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.exists ? snap.data() : null;
    const fresh = !data || now - data.windowStart > RATE_WINDOW_MS;
    const count = fresh ? 1 : data.count + 1;
    if (!fresh && count > MAX_ANALYSES_PER_HOUR) return false;
    tx.set(ref, { windowStart: fresh ? now : data.windowStart, count });
    return true;
  });
}

const SYSTEM_PROMPT = `You analyse the asymptotic complexity of a student's accepted competitive-programming solution.

Rules:
- Report worst-case complexity in terms of the input size, using the variable names the code itself uses (n, m, k, V, E). Define any variable you introduce.
- Time is the whole function including any sort, recursion or nested scan. Space is auxiliary space: exclude the input, include the recursion stack, and say so when the stack is what dominates.
- Judge only the code given. If a helper or library call is not shown, assume the standard implementation and say which assumption you made.
- confidence: "high" when the bound is plain from the structure; "medium" when a library call or an amortised argument decides it; "low" when the input constraints or missing code leave it genuinely ambiguous.
- explanation: two or three sentences, addressed to the student, pointing at the actual construct that produces each bound. No preamble, no restating the problem.
- bottleneck: the single construct that dominates the time bound, in a few words. null if nothing dominates.
- betterApproach: one sentence naming an asymptotically faster approach. null when the solution is already optimal for the problem as written — do not invent an improvement to fill the field.

Answer with a single JSON object and nothing else:
{"time": string, "space": string, "confidence": "high"|"medium"|"low", "explanation": string, "bottleneck": string|null, "betterApproach": string|null}`;

/**
 * Models wrap JSON in prose or a fenced block often enough that the happy path
 * cannot be the only path. Falls back to the outermost braces.
 */
export function extractVerdict(content) {
  if (!content) return null;
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : content;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Trusts the model for prose, never for shape — every field is coerced before it reaches a student. */
export function normaliseVerdict(raw, model) {
  if (!raw || typeof raw !== "object") return null;
  const text = (value, max) => {
    const str = typeof value === "string" ? value.trim() : "";
    return str ? str.slice(0, max) : null;
  };

  const time = text(raw.time, 60);
  const space = text(raw.space, 60);
  if (!time || !space) return null;

  const confidence = ["high", "medium", "low"].includes(raw.confidence) ? raw.confidence : "medium";

  return {
    time,
    space,
    confidence,
    explanation: text(raw.explanation, 800) ?? "",
    bottleneck: text(raw.bottleneck, 160),
    betterApproach: text(raw.betterApproach, 300),
    source: "ai",
    model,
    analyzedAt: new Date().toISOString(),
  };
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

  let caller;
  try {
    caller = await getAuth().verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ ok: false, error: "invalid_token" });
  }

  const code = String(payload?.code ?? "").trim();
  if (!code) return res.status(400).json({ ok: false, error: "missing_code" });
  if (code.length > MAX_CODE_CHARS) return res.status(400).json({ ok: false, error: "code_too_long" });

  const config = await readAiConfig(db);
  if (!config.key || !config.enabled) {
    return res.status(200).json({ ok: false, error: "ai_unconfigured" });
  }

  if (!(await withinAnalysisLimit(db, caller.uid))) {
    return res.status(429).json({ ok: false, error: "rate_limited" });
  }

  const language = String(payload?.language ?? "").trim().slice(0, 30) || "unknown";
  const title = String(payload?.title ?? "").trim().slice(0, 200);
  const platform = String(payload?.platform ?? "").trim().slice(0, 30);

  const userPrompt = [
    title ? `Problem: ${title}` : null,
    platform ? `Platform: ${platform}` : null,
    `Language: ${language}`,
    "",
    "Solution:",
    "```",
    code,
    "```",
  ]
    .filter((line) => line !== null)
    .join("\n");

  let response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 75_000);
    try {
      response = await fetch(OPENROUTER_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${config.key}`,
          "Content-Type": "application/json",
          // OpenRouter attributes usage to these; they show up on the
          // dashboard, which is how a runaway bill gets traced to a feature.
          //
          // Plain ASCII only, deliberately — a header *value* (not the body)
          // has to be Latin-1, and Node's fetch throws synchronously on
          // anything outside that range rather than encoding it. An em dash
          // here once took the whole endpoint down: every request failed
          // before it left the function, was caught by the generic network
          // handler below, and reported as "ai_unreachable" — a message that
          // pointed at OpenRouter for a bug that was entirely local.
          "HTTP-Referer": "https://handy.vijayaapardhu.dev",
          "X-Title": "Handy - practice complexity",
        },
        body: JSON.stringify({
          model: config.model,
          // Not a creative task: the same solution should get the same bound
          // twice, or a student rightly stops believing it.
          temperature: 0,
          // Generous on purpose. Free OpenRouter models commonly reason
          // before they answer, and that reasoning is billed against this
          // same cap — "Happy Number" (one helper function, one while loop)
          // measured at 709 reasoning tokens before a single character of the
          // JSON answer. At the old cap of 900 that finished with
          // finish_reason "length" and a null content every time; nothing
          // wrong with the code, the model simply never got to answer.
          max_tokens: 4000,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
        }),
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    console.error("[complexity] openrouter unreachable:", error?.message);
    return res.status(502).json({ ok: false, error: "ai_unreachable" });
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[complexity] openrouter ${response.status}:`, detail.slice(0, 300));
    // 401/402 is a key or credit problem, not something the student did — the
    // client turns this into "analysis is unavailable, type it in yourself".
    if (response.status === 401 || response.status === 402) {
      return res.status(200).json({ ok: false, error: "ai_unconfigured" });
    }
    return res.status(502).json({ ok: false, error: "ai_failed" });
  }

  const body = await response.json().catch(() => null);
  const choice = body?.choices?.[0];

  // A model that reasons before it answers spends part of max_tokens on that
  // reasoning, invisibly to the cap the caller set. Caught explicitly, ahead
  // of the parse attempt, so a truncated reply is never lumped in with a
  // genuinely malformed one — the two need different advice ("try again" vs.
  // "something is actually wrong").
  if (choice?.finish_reason === "length") {
    console.error(
      `[complexity] truncated before an answer for ${caller.uid}:`,
      JSON.stringify(body?.usage ?? {}),
    );
    return res.status(502).json({ ok: false, error: "ai_truncated" });
  }

  const verdict = normaliseVerdict(extractVerdict(choice?.message?.content), body?.model ?? config.model);
  if (!verdict) {
    console.error("[complexity] unparseable model reply for", caller.uid, JSON.stringify(choice ?? {}).slice(0, 500));
    return res.status(502).json({ ok: false, error: "ai_unparseable" });
  }

  return res.status(200).json({ ok: true, verdict });
}
