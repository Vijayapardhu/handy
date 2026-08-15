import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { clearMark, getAllMarks, getMarksForRange, setMark } from "@/services/attendance/attendanceMarkService";
import type { MarkStatus } from "@/types/attendanceMark";

/** Every mark the student has ever made — backs the Attendance History list view. */
export function useAllMarks() {
  const { student } = useAuth();
  return useQuery({
    queryKey: ["attendanceMarks", "all", student?.id],
    queryFn: () => getAllMarks(student!.id),
    enabled: Boolean(student),
  });
}

/**
 * One date range's marks — backs the calendar view (same bounded-range shape
 * as useAttendanceMonth used to have) and TimetablePage's inline marking,
 * which only ever wants "today" and should skip the query entirely on any
 * other day rather than ask Firestore a query it already knows is pointless.
 */
export function useMarksForRange(startIso: string, endIso: string, subjectId?: string, enabled = true) {
  const { student } = useAuth();
  return useQuery({
    queryKey: ["attendanceMarks", "range", student?.id, startIso, endIso, subjectId],
    queryFn: () => getMarksForRange(student!.id, startIso, endIso, subjectId),
    enabled: Boolean(student) && enabled,
  });
}

/**
 * The inline mark/clear mutation — used by TimetablePage's class rows. Tapping
 * the currently-set status again clears it (see the `TimetablePage` call
 * site); this hook just exposes both operations and invalidates every query
 * above so the History page and Streak card pick the change up immediately.
 */
export function useSetAttendanceMark() {
  const { student } = useAuth();
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["attendanceMarks"] });

  const set = useMutation({
    mutationFn: (vars: { subjectId: string; date: string; startTime: string; status: MarkStatus; periods?: number }) =>
      setMark(student!.id, vars.subjectId, vars.date, vars.startTime, vars.status, vars.periods),
    onSuccess: invalidate,
  });

  const clear = useMutation({
    mutationFn: (vars: { subjectId: string; date: string; startTime: string }) =>
      clearMark(student!.id, vars.subjectId, vars.date, vars.startTime),
    onSuccess: invalidate,
  });

  return { set, clear };
}
