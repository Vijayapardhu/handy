import { useQuery } from "@tanstack/react-query";
import { getMarksForRange } from "@/services/attendance/attendanceMarkService";
import {
  getPortalRecordsForRange,
  mergeAttendance,
} from "@/services/attendance/portalAttendanceService";
import { useAuth } from "@/app/providers/AuthProvider";
import { format, startOfMonth, endOfMonth } from "date-fns";

/**
 * One month of attendance for the calendar view. `year`/`month` — month is 1-12.
 *
 * Two sources, fetched together: the student's own marks, and — for campuses
 * whose portal reports a day rather than a running total — the college's own
 * record. Where both cover the same class on the same day the college's wins,
 * since that is the one that counts. See mergeAttendance.
 */
export function useAttendanceMonth(year: number, month: number, subjectId?: string) {
  const { student } = useAuth();
  const anchor = new Date(year, month - 1, 1);
  const startIso = format(startOfMonth(anchor), "yyyy-MM-dd");
  const endIso = format(endOfMonth(anchor), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["attendanceMerged", "range", student?.id, startIso, endIso, subjectId],
    queryFn: async () => {
      const [marks, records] = await Promise.all([
        getMarksForRange(student!.id, startIso, endIso, subjectId),
        getPortalRecordsForRange(student!.id, startIso, endIso, subjectId),
      ]);
      return mergeAttendance(marks, records);
    },
    enabled: Boolean(student),
  });
}
