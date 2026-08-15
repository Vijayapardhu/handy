/** Read-only in the admin panel — the one thing no client, student or admin, may write over. */
export interface FeedbackDoc {
  id: string;
  studentId: string;
  message: string;
  createdAt?: string;
}
