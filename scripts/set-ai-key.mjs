// Stores the OpenRouter key that api/coding-complexity.js analyses solutions with.
//
//   node scripts/set-ai-key.mjs <openrouter-key> [model]
//   node scripts/set-ai-key.mjs --disable
//   node scripts/set-ai-key.mjs --status
//
// The key lands on `appConfig/ai`, which has no block in firestore.rules at
// all. Under Firestore's default-deny that means no browser can read it —
// only the Admin SDK, which is this script and the serverless function. It is
// deliberately not a VITE_ variable: anything with that prefix ships inside
// the client bundle, where a key is not a secret but a giveaway.
//
// Rotating is just running this again with the new key; nothing is cached
// server-side for more than five minutes.
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: cert(JSON.parse(readFileSync('service-account.json', 'utf8'))),
});
const db = getFirestore();
const ref = db.doc('appConfig/ai');

const [first, second] = process.argv.slice(2);

if (!first || first === '--help') {
  console.error('Usage: node scripts/set-ai-key.mjs <openrouter-key> [model]');
  console.error('       node scripts/set-ai-key.mjs --disable');
  console.error('       node scripts/set-ai-key.mjs --status');
  process.exit(1);
}

if (first === '--status') {
  const snap = await ref.get();
  if (!snap.exists) {
    console.log('appConfig/ai does not exist — complexity analysis is off.');
    process.exit(0);
  }
  const data = snap.data();
  // Never print the key back. A masked tail is enough to tell two keys apart.
  const key = data.openRouterKey ?? '';
  console.log(`enabled: ${data.enabled !== false}`);
  console.log(`model:   ${data.model ?? '(default)'}`);
  console.log(`key:     ${key ? `set, ending ...${key.slice(-6)}` : 'not set'}`);
  console.log(`updated: ${data.updatedAt ?? 'unknown'}`);
  process.exit(0);
}

if (first === '--disable') {
  await ref.set({ enabled: false, updatedAt: new Date().toISOString() }, { merge: true });
  console.log('Complexity analysis disabled. The key is kept — re-enable by setting it again.');
  process.exit(0);
}

if (!first.startsWith('sk-or-')) {
  console.error(`Refusing: "${first.slice(0, 8)}..." does not look like an OpenRouter key (sk-or-...).`);
  console.error('Get one at https://openrouter.ai/keys');
  process.exit(1);
}

// A free OpenRouter model by default — analysis runs at no per-request cost
// unless a paid model is explicitly named as the second argument. OpenRouter's
// free lineup turns over; `--status` shows what is actually stored, and
// https://openrouter.ai/models?max_price=0 is the current list.
const model = second ?? 'cohere/north-mini-code:free';

await ref.set(
  {
    openRouterKey: first,
    model,
    enabled: true,
    updatedAt: new Date().toISOString(),
  },
  { merge: true },
);

console.log(`Stored. Model: ${model}`);
console.log('Students can analyse a solution from Tasks → Practice → Solve log.');
