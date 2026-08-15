import { useState } from "react";
import { CheckCircle2, Send } from "@/components/ui/icons";
import { TopHeader } from "@/components/layout/TopHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSubmitFeedback } from "@/hooks/useFeedback";
import type { FeedbackKind } from "@/types/feedback";
import { cn } from "@/lib/utils/cn";
import styles from "./FeedbackPage.module.css";

const KINDS: { value: FeedbackKind; label: string }[] = [
  { value: "bug", label: "Something is broken" },
  { value: "idea", label: "An idea" },
  { value: "question", label: "A question" },
  { value: "other", label: "Anything else" },
];

const MAX_MESSAGE_LENGTH = 4000;

export function FeedbackPage() {
  const submit = useSubmitFeedback();
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit() {
    if (!message.trim()) {
      setValidationError("Write something first.");
      return;
    }
    setValidationError(null);
    submit.mutate({ kind, message, contact });
  }

  if (submit.isSuccess) {
    return (
      <div className="page-narrow">
        <TopHeader title="Feedback" back />
        <Card className={styles.sentCard}>
          <CheckCircle2 size={22} className={styles.sentIcon} />
          <div>
            <p className={styles.sentTitle}>Sent — thank you</p>
            <p className={styles.sentHint}>
              Handy is one student maintaining it in their spare time, so a reply may take a while — but it is read.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-narrow">
      <TopHeader title="Feedback" subtitle="Share your feedback with us" back />

      <p className={styles.intro}>
        Found something broken, or something missing? This goes straight to whoever maintains Handy.
      </p>

      <p className={styles.label}>What is it</p>
      <div className={styles.kindRow}>
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            className={cn(styles.kindChip, kind === k.value && styles.kindChipActive)}
            onClick={() => setKind(k.value)}
          >
            {k.label}
          </button>
        ))}
      </div>

      <p className={styles.label}>Message</p>
      <textarea
        className={styles.textarea}
        placeholder="What happened, or what would you change?"
        rows={6}
        maxLength={MAX_MESSAGE_LENGTH}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />

      <p className={styles.label}>Email or phone (optional)</p>
      <input
        className={styles.input}
        placeholder="Only if you want a reply"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
      />

      {(validationError || submit.isError) && (
        <p className={styles.error}>{validationError ?? "Could not send that. Check your connection and try again."}</p>
      )}

      <Button fullWidth loading={submit.isPending} onClick={handleSubmit} className={styles.submitButton}>
        <Send size={16} /> Send
      </Button>

      <p className={styles.footnote}>
        Your roll number and app version are attached so the problem can be traced. Nothing else is.
      </p>
    </div>
  );
}
