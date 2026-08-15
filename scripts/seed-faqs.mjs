// Seeds the `faqs` collection.
//
// Run with:  node scripts/seed-faqs.mjs
//
// Uses the Admin SDK, so it bypasses firestore.rules — which is the point:
// `faqs` is `allow write: if false` for every client, and this is the only
// thing that writes it. Re-running is safe; each entry is keyed by its own id
// and overwritten in place rather than appended.
//
// A note on the answers below, because it matters and is easy to undo by
// accident: none of them describe *how* Handy obtains attendance or timetable
// data. Students are told what Handy does with their data and what it will
// never do — that is what they have a right to know. The mechanism is not
// theirs to publish, and an FAQ is a public document.
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp({
  credential: cert(JSON.parse(readFileSync('service-account.json', 'utf8'))),
});

const db = getFirestore();

/** Order is the display order; category groups them under headings. */
const FAQS = [
  {
    id: 'what-is-handy',
    category: 'Getting started',
    order: 10,
    question: 'What is Handy?',
    answer:
      'Handy is an attendance and timetable app for Aditya University students. '
      + 'It shows where your attendance stands in every subject, what it would take '
      + 'to get back above 75%, when your classes are, and what you have coming up — '
      + 'without you having to open the portal and read a table.',
  },
  {
    id: 'how-do-i-sign-in',
    category: 'Getting started',
    order: 20,
    question: 'How do I sign in?',
    answer:
      'With your roll number and the password Handy@123. Your account is created for '
      + 'you the first time your details reach Handy — there is no sign-up form to fill in.',
  },
  {
    id: 'change-my-password',
    category: 'Getting started',
    order: 30,
    question: 'Should I change my password?',
    answer:
      'Yes. Roll numbers are public and predictable, so the shared default is not a '
      + 'secret. You: Settings, Change Password. There is no reset email — Handy '
      + 'accounts have no real inbox — so pick something you will remember.',
  },
  {
    id: 'data-out-of-date',
    category: 'Your data',
    order: 40,
    question: 'My attendance looks out of date. Why?',
    answer:
      'Handy shows the last figures it received from the college. It does not invent '
      + 'or estimate anything, so if the college record has not been updated yet, '
      + 'neither has Handy. Pull down on the Today screen to fetch the latest.',
  },
  {
    id: 'wrong-numbers',
    category: 'Your data',
    order: 50,
    question: 'A number looks wrong. Can I correct it?',
    answer:
      'No, and that is deliberate. Every attendance figure in Handy comes from the '
      + 'college record exactly as the college holds it. If a figure is wrong there, '
      + 'it is wrong in Handy too, and the fix is with your department — an app that '
      + 'let you edit it would only be lying to you more comfortably.',
  },
  {
    id: 'who-can-see',
    category: 'Your data',
    order: 60,
    question: 'Who can see my attendance?',
    answer:
      'Your data is scoped to your own account. Handy does not show your attendance '
      + 'to other students, does not rank you against them, and does not sell or share '
      + 'anything with advertisers. Anyone who knows your roll number and password can '
      + 'sign in as you, which is the reason to change yours.',
  },
  {
    id: 'seventy-five',
    category: 'Attendance',
    order: 70,
    question: 'Where does 75% come from?',
    answer:
      'It is the usual minimum attendance requirement. Handy uses it as the line for '
      + '"safe" and "at risk", and every subject shows what it would take to get back '
      + 'above it. Check your own regulations — some courses differ.',
  },
  {
    id: 'can-i-miss',
    category: 'Attendance',
    order: 80,
    question: 'What does "you can miss 3 more" mean?',
    answer:
      'How many further classes you could miss in that subject and still be at or above '
      + '75%, assuming every remaining class is held. It is the number most people '
      + 'actually want, which is why it sits under the percentage rather than being '
      + 'left as arithmetic.',
  },
  {
    id: 'timetable-empty',
    category: 'Timetable',
    order: 90,
    question: 'My timetable is empty.',
    answer:
      'Handy needs your timetable to have reached it at least once. If the Timetable '
      + 'tab is blank, it has not arrived yet — everything else in the app still works '
      + 'in the meantime.',
  },
  {
    id: 'sunday',
    category: 'Timetable',
    order: 100,
    question: 'Why is there no Sunday?',
    answer:
      'Because there are no classes on it. A seventh column could only ever say '
      + '"nothing scheduled", so it is not drawn.',
  },
  {
    id: 'reminders',
    category: 'Deadlines and reminders',
    order: 110,
    question: 'When do reminders arrive?',
    answer:
      'Two days before a deadline and again the evening before. They are scheduled on '
      + 'your phone, so they work with no signal.',
  },
  {
    id: 'deadlines-private',
    category: 'Deadlines and reminders',
    order: 120,
    question: 'Are my deadlines and notes private?',
    answer:
      'Yes. Deadlines, steps and class notes are the one thing in Handy you write '
      + 'rather than the college — they are stored against your account and nobody '
      + 'else can read them.',
  },
  {
    id: 'widgets',
    category: 'Widgets and notifications',
    order: 130,
    question: 'How do I add a widget?',
    answer:
      'Long-press your home screen, choose Widgets, then Handy. There are five: next '
      + 'class, attendance, today, deadlines, and Overview — which you arrange yourself '
      + 'in Settings, Widgets. All of them resize.',
  },
  {
    id: 'widget-stale',
    category: 'Widgets and notifications',
    order: 140,
    question: 'My widget is showing old information.',
    answer:
      'Widgets refresh about every half hour, and immediately whenever you open the app '
      + 'or change a widget setting. Opening Handy once is the quickest way to force it.',
  },
  {
    id: 'cost',
    category: 'About',
    order: 150,
    question: 'Does Handy cost anything?',
    answer:
      'No. It is free, has no adverts, and no paid tier.',
  },
  {
    id: 'not-official',
    category: 'About',
    order: 160,
    question: 'Is Handy an official college app?',
    answer:
      'No. Handy is an independent student project built by Vijaya Pardhu Magapu. It is '
      + 'not affiliated with, endorsed by, or operated by Aditya University. The college '
      + 'record remains the authority on your attendance.',
  },
];

const batch = db.batch();
const now = new Date().toISOString();

for (const { id, ...faq } of FAQS) {
  batch.set(db.doc(`faqs/${id}`), { ...faq, active: true, updatedAt: now });
}

await batch.commit();
console.log(`seeded ${FAQS.length} FAQs`);
