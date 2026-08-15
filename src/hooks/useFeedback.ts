import { useMutation } from "@tanstack/react-query";
import { submitFeedback } from "@/services/feedback/feedbackService";
import { useAuth } from "@/app/providers/AuthProvider";
import type { FeedbackKind } from "@/types/feedback";

export function useSubmitFeedback() {
  const { student } = useAuth();
  return useMutation({
    mutationFn: (input: { kind: FeedbackKind; message: string; contact: string }) =>
      submitFeedback(student!.id, student!.rollNumber, input.kind, input.message, input.contact),
  });
}
