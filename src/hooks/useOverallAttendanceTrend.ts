import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMarksForRange } from "@/services/attendance/attendanceMarkService";
import { buildDailyAttendanceTrend } from "@/lib/calculations/attendanceMarks";
import { useAuth } from "@/app/providers/AuthProvider";
import { todayIso, addDaysIso } from "@/lib/date";

/**
 * Day-by-day attendance percentage across every subject, for the last `days`
 * days — the tracker behind Home's "Needs Attention" tip.
 *
 * Built from attendanceMarks (the student's own marked attendance) rather
 * than the `attendance` collection: that collection is admin/portal-only and
 * empty for almost every real student (see portalAttendanceService.ts) —
 * attendanceMarks is the one source with actual day-level granularity, the
 * same reasoning useAttendanceHistory and SubjectDetailPage's trend chart
 * already rest on.
 */
export function useOverallAttendanceTrend(days: number = 30) {
  const { student } = useAuth();
  const today = todayIso();
  const startIso = addDaysIso(today, -(days - 1));

  const query = useQuery({
    queryKey: ["attendanceMarks", "dailyTrend", student?.id, days, today],
    queryFn: () => getMarksForRange(student!.id, startIso, today),
    enabled: Boolean(student),
  });

  const points = useMemo(() => {
    if (!query.data) return undefined;
    const dates: string[] = [];
    for (let i = 0; i < days; i++) dates.push(addDaysIso(startIso, i));
    return buildDailyAttendanceTrend(query.data, dates);
  }, [query.data, startIso, days]);

  return { ...query, data: points };
}
