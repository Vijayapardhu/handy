import { TopHeader } from "@/components/layout/TopHeader";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/app/providers/AuthProvider";
import styles from "./InfoPage.module.css";

export function PersonalInfoPage() {
  const { student, user } = useAuth();
  if (!student) return null;

  return (
    <div>
      <TopHeader title="Personal Information" back />
      <Card className={styles.card}>
        <Field label="Full Name" value={student.name} />
        <Field label="Roll Number" value={student.rollNumber} readonlyNote="Set by your college — contact your administrator to change this." />
        <Field label="Login Email (internal)" value={user?.email ?? "—"} readonlyNote="Generated automatically from your roll number for sign-in." />
        <Field label="Sign-up date" value={new Date(student.createdAt).toLocaleDateString()} />
      </Card>
      <p className={styles.footnote}>
        Only your photo can be updated here (SRS §27). Roll number, course, and year are managed by your
        college administrator to keep official records consistent.
      </p>
    </div>
  );
}

function Field({ label, value, readonlyNote }: { label: string; value: string; readonlyNote?: string }) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {readonlyNote && <span className={styles.note}>{readonlyNote}</span>}
    </div>
  );
}
