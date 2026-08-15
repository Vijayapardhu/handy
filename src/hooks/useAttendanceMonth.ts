import { useQuery } from "@tanstack/react-query";
import { getMarksForRange } from "@/services/attendance/attendanceMarkService";
import { useAuth } from "@/app/providers/AuthProvider";
import { format, startOfMonth, endOfMonth } from "date-fns";

/** One month of self-marked attendance, for the calendar view. `year`/`month` — month is 1-12. */
export function useAttendanceMonth(year: number, month: number, subjectId?: string) {
  const { student } = useAuth();
  const anchor = new Date(year, month - 1, 1);
  const startIso = format(startOfMonth(anchor), "yyyy-MM-dd");
  const endIso = format(endOfMonth(anchor), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["attendanceMarks", "range", student?.id, startIso, endIso, subjectId],
    queryFn: () => getMarksForRange(student!.id, startIso, endIso, subjectId),
    enabled: Boolean(student),
  });
}
