/** Seeded and maintained by scripts/seed-faqs.mjs — never client-writable, see firestore.rules. */
export interface FaqDoc {
  id: string;
  category: string;
  question: string;
  answer: string;
  order: number;
  active: boolean;
  updatedAt: string;
}
