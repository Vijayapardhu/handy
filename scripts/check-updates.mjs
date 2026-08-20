import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: cert(JSON.parse(readFileSync('service-account.json', 'utf8'))),
});
const db = getFirestore();

const snap = await db.collection('appUpdates').get();
console.log('App updates count:', snap.size);
snap.docs.forEach(doc => {
  console.log(doc.id, '=>', doc.data());
});
