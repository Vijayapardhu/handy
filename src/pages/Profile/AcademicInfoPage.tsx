import { TopHeader } from "@/components/layout/TopHeader";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/app/providers/AuthProvider";
import styles from "./InfoPage.module.css";

export function AcademicInfoPage() {
  const { student } = useAuth();
  if (!student) return null;

  return (
    <div>
      <TopHeader title="Academic Information" back />
      <Card className={styles.card}>
        <Field label="Course" value={student.course} />
        <Field label="Department" value={student.department} />
        <Field label="Year" value={`Year ${student.year}`} />
        <Field label="Section" value={student.section} />
        <Field label="Semester" value={student.semesterId} />
      </Card>
      <p className={styles.footnote}>
        Academic details are managed by your college administrator and update automatically each
        semester.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  );
}
