import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: cert(JSON.parse(readFileSync('service-account.json', 'utf8'))),
});
const db = getFirestore();

const version = '1.0.5';
const platform = 'android';
const downloadUrl = 'https://github.com/Vijayapardhu/handy/releases/download/v1.0.5/app-release.apk';
const changelog = '• Added Android Home Screen Practice Widget (problems solved & streak tracker)\n• Enhanced Tasks view with Deadlines, Practice, and Goals tabs\n• Whole-week timetable integration for widgets\n• General UI and performance improvements';
const minSupportedVersion = '1.0.0';

const ref = db.collection('appUpdates').doc();
await ref.set({
  version,
  platform,
  changelog,
  downloadUrl,
  minSupportedVersion,
  notifiedStudents: false,
  publishedAt: new Date().toISOString(),
  publishedBy: 'system',
});

console.log(`Successfully published update ${version} for ${platform} to appUpdates collection in Firestore (doc ID: ${ref.id})!`);
