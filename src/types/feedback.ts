export type FeedbackKind = "bug" | "idea" | "question" | "other";

/**
 * Write-only from the app's point of view — firestore.rules refuses reads to
 * every client, including the student who wrote it (see the `feedback` match
 * block). `id` is only ever set on write, for the shared typedCollection
 * converter's sake; nothing client-side ever reads one back.
 */
export interface FeedbackDoc {
  id: string;
  studentId: string;
  rollNumber: string | null;
  kind: FeedbackKind;
  message: string;
  contact: string | null;
  appVersion: string;
  createdAt: string;
}
