import { useQuery } from "@tanstack/react-query";
import { getAttendanceForRange } from "@/services/attendance/attendanceService";
import { useAuth } from "@/app/providers/AuthProvider";
import { format, startOfMonth, endOfMonth } from "date-fns";

/** One month of attendance records, for the calendar view (SRS §24). `year`/`month` — month is 1-12. */
export function useAttendanceMonth(year: number, month: number, subjectId?: string) {
  const { student } = useAuth();
  const anchor = new Date(year, month - 1, 1);
  const startIso = format(startOfMonth(anchor), "yyyy-MM-dd");
  const endIso = format(endOfMonth(anchor), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["attendanceMonth", student?.id, year, month, subjectId],
    queryFn: () => getAttendanceForRange(student!.id, startIso, endIso, subjectId),
    enabled: Boolean(student),
  });
}
