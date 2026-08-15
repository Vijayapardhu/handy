import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Send, X } from "@/components/ui/icons";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { timetableReportSchema, type TimetableReportFormValues } from "@/lib/validators/timetableReport";
import { useSubmitTimetableChangeReport } from "@/hooks/useTimetableChangeReport";
import type { SubjectDoc } from "@/types/subject";
import styles from "./ReportChangeForm.module.css";

interface ReportChangeFormProps {
  timetableVersionId: string | null;
  subjects: SubjectDoc[];
  onClose: () => void;
}

export function ReportChangeForm({ timetableVersionId, subjects, onClose }: ReportChangeFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const mutation = useSubmitTimetableChangeReport(timetableVersionId);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TimetableReportFormValues>({ resolver: zodResolver(timetableReportSchema) });

  async function onSubmit(values: TimetableReportFormValues) {
    await mutation.mutateAsync({
      description: values.description,
      subjectId: values.subjectId || null,
    });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <Card className={styles.successCard}>
        <CheckCircle2 size={20} className={styles.successIcon} />
        <div>
          <p className={styles.successTitle}>Thanks — we&rsquo;ve logged it</p>
          <p className={styles.successBody}>
            Your administrator will review this. Reporting an issue doesn&rsquo;t change the published
            timetable by itself.
          </p>
        </div>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </Card>
    );
  }

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <p className={styles.title}>Report a Change</p>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className={styles.form}>
        <label className={styles.field}>
          <span className={styles.labelText}>Subject (optional)</span>
          <select className={styles.select} {...register("subjectId")}>
            <option value="">General / not subject-specific</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.labelText}>What looks wrong?</span>
          <textarea
            className={styles.textarea}
            rows={3}
            placeholder="e.g. DBMS is showing Room 201 but it actually moved to Room 305"
            {...register("description")}
          />
          {errors.description && <span className={styles.fieldError}>{errors.description.message}</span>}
        </label>
        {mutation.isError && (
          <p className={styles.submitError} role="alert">
            Unable to submit your report. Please check your connection and try again.
          </p>
        )}
        <Button type="submit" size="sm" loading={isSubmitting}>
          <Send size={14} /> Submit Report
        </Button>
      </form>
    </Card>
  );
}
