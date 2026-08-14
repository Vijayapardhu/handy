import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useNavigate } from "react-router-dom";
import { Send } from "lucide-react";
import { TopHeader } from "@/components/layout/TopHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { leaveRequestSchema, type LeaveRequestFormValues } from "@/lib/validators/leave";
import { useSubmitLeaveRequest } from "@/hooks/useLeaves";
import { todayIso } from "@/lib/date";
import { ROUTES } from "@/constants/routes";
import styles from "./LeaveRequestPage.module.css";

export function LeaveRequestPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefillDate = (location.state as { date?: string } | null)?.date ?? todayIso();
  const submitMutation = useSubmitLeaveRequest();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LeaveRequestFormValues>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: { startDate: prefillDate, endDate: prefillDate, reason: "" },
  });

  async function onSubmit(values: LeaveRequestFormValues) {
    await submitMutation.mutateAsync(values);
    navigate(ROUTES.leaves, { replace: true });
  }

  return (
    <div>
      <TopHeader title="Request Leave" subtitle="Submit a leave request for review" back />

      <Card>
        <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
          <p className={styles.note}>
            This request goes to your administrator for approval — it&rsquo;s separate from the Leave
            Planner&rsquo;s attendance impact check.
          </p>

          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.labelText}>Start Date</span>
              <input type="date" className={styles.input} {...register("startDate")} />
              {errors.startDate && <span className={styles.fieldError}>{errors.startDate.message}</span>}
            </label>
            <label className={styles.field}>
              <span className={styles.labelText}>End Date</span>
              <input type="date" className={styles.input} {...register("endDate")} />
              {errors.endDate && <span className={styles.fieldError}>{errors.endDate.message}</span>}
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.labelText}>Reason</span>
            <textarea
              className={styles.textarea}
              rows={4}
              placeholder="Briefly explain why you need leave…"
              {...register("reason")}
            />
            {errors.reason && <span className={styles.fieldError}>{errors.reason.message}</span>}
          </label>

          {submitMutation.isError && (
            <p className={styles.submitError} role="alert">
              Unable to submit your request. Please check your connection and try again.
            </p>
          )}

          <Button type="submit" fullWidth loading={isSubmitting}>
            <Send size={16} /> Submit Request
          </Button>
        </form>
      </Card>
    </div>
  );
}
