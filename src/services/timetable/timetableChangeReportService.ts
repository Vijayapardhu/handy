import { doc, setDoc } from "firebase/firestore";
import { timetableChangeReportsCol } from "@/services/firebase/collections";
import type { TimetableChangeReportDoc } from "@/types/timetableChangeReport";

export async function submitTimetableChangeReport(
  studentId: string,
  description: string,
  timetableVersionId: string | null,
  subjectId: string | null,
): Promise<void> {
  const ref = doc(timetableChangeReportsCol());
  const record: TimetableChangeReportDoc = {
    id: ref.id,
    studentId,
    timetableVersionId,
    subjectId,
    description,
    status: "pending",
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
  };
  await setDoc(ref, record);
}
