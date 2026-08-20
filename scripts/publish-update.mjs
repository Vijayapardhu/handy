import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

initializeApp({
  credential: cert(JSON.parse(readFileSync('service-account.json', 'utf8'))),
});
const db = getFirestore();
const messaging = getMessaging();

const version = process.argv[2] || '1.0.5';
const platform = 'android';
const downloadUrl = `https://github.com/Vijayapardhu/handy/releases/download/v${version}/app-release.apk`;
const changelog = '• Added Android Home Screen Practice Widget (problems solved & streak tracker)\n• Enhanced Tasks view with Deadlines, Practice, and Goals tabs\n• Whole-week timetable integration for widgets\n• General UI and performance improvements';
const minSupportedVersion = '1.0.0';

const now = new Date().toISOString();
const ref = db.collection('appUpdates').doc();
await ref.set({
  version,
  platform,
  changelog,
  downloadUrl,
  minSupportedVersion,
  notifiedStudents: true,
  publishedAt: now,
  publishedBy: 'system',
});

console.log(`Published update ${version} for ${platform} to appUpdates (doc ID: ${ref.id})!`);

// Send notifications to all students
const title = `Handy ${version} is available 🎉`;
const body = changelog ? changelog.slice(0, 200) : `A new ${platform} update is ready for Handy.`;

const studentsSnap = await db.collection('students').get();
console.log(`Notifying ${studentsSnap.size} students...`);

let notificationCount = 0;
for (let i = 0; i < studentsSnap.docs.length; i += 400) {
  const batch = db.batch();
  for (const doc of studentsSnap.docs.slice(i, i + 400)) {
    batch.set(db.collection('notifications').doc(), {
      userId: doc.id,
      type: 'announcement',
      title,
      body,
      actionUrl: downloadUrl,
      read: false,
      createdAt: now,
    });
    notificationCount++;
  }
  await batch.commit();
}
console.log(`Created ${notificationCount} in-app notification records.`);

// FCM Push Notifications
const tokens = studentsSnap.docs.flatMap(d => d.data()?.fcmTokens ?? []);
if (tokens.length > 0) {
  console.log(`Sending FCM push to ${tokens.length} tokens...`);
  for (let i = 0; i < tokens.length; i += 450) {
    const batchTokens = tokens.slice(i, i + 450);
    const result = await messaging.sendEachForMulticast({
      tokens: batchTokens,
      notification: { title, body },
      data: { type: 'announcement', version, url: downloadUrl },
      android: { notification: { channelId: 'handy_push', icon: 'ic_notification', color: '#F97316' } },
    });
    console.log(`Pushed to ${result.successCount}/${batchTokens.length} devices.`);
  }
} else {
  console.log('No registered FCM tokens found for push notifications.');
}
