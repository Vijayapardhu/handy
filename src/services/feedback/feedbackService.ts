import { doc, setDoc } from "firebase/firestore";
import { feedbackCol } from "@/services/firebase/collections";
import type { FeedbackDoc, FeedbackKind } from "@/types/feedback";

/** Mirrors handyVersion in mobile/lib/screens/support_screens.dart — attached to every piece of feedback. */
export const APP_VERSION = "1.0.3";

export async function submitFeedback(
  studentId: string,
  rollNumber: string | null,
  kind: FeedbackKind,
  message: string,
  contact: string,
): Promise<void> {
  const ref = doc(feedbackCol());
  const record: FeedbackDoc = {
    id: ref.id,
    studentId,
    rollNumber,
    kind,
    message: message.trim(),
    contact: contact.trim() || null,
    appVersion: APP_VERSION,
    createdAt: new Date().toISOString(),
  };
  await setDoc(ref, record);
}
