import { useQuery } from "@tanstack/react-query";
import { getAttendanceSummaryForSubject } from "@/services/attendance/attendanceService";
import { useAuth } from "@/app/providers/AuthProvider";

export function useAttendanceSummaryForSubject(subjectId: string | undefined) {
  const { student } = useAuth();
  return useQuery({
    queryKey: ["attendanceSummary", student?.id, subjectId],
    queryFn: () => getAttendanceSummaryForSubject(student!.id, subjectId as string),
    enabled: Boolean(student) && Boolean(subjectId),
  });
}
