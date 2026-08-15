import { useQuery } from "@tanstack/react-query";
import { addWeeks, endOfWeek, format, startOfWeek, subWeeks } from "date-fns";
import { getMarksForRange } from "@/services/attendance/attendanceMarkService";
import { markAttendedHeld } from "@/lib/calculations/attendanceMarks";
import { calculateAttendance, roundPercentage } from "@/lib/calculations/attendance";
import { useAuth } from "@/app/providers/AuthProvider";
import type { TrendPoint } from "@/components/charts/TrendChart";

/**
 * Per-week attendance percentage for one subject over the last `weeks` weeks
 * (default 8) — a single bounded range query, then grouped client-side.
 * Weeks with zero classes held show as a gap (null), not 0%.
 */
export function useSubjectTrend(subjectId: string | undefined, weeks: number = 8) {
  const { student } = useAuth();
  const today = new Date();
  const rangeStart = startOfWeek(subWeeks(today, weeks - 1), { weekStartsOn: 1 });
  const startIso = format(rangeStart, "yyyy-MM-dd");
  const endIso = format(today, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["attendanceMarks", "trend", student?.id, subjectId, weeks, endIso],
    queryFn: async (): Promise<TrendPoint[]> => {
      const marks = await getMarksForRange(student!.id, startIso, endIso, subjectId);

      const buckets: TrendPoint[] = [];
      for (let i = 0; i < weeks; i++) {
        const weekStart = addWeeks(rangeStart, i);
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const weekStartIso = format(weekStart, "yyyy-MM-dd");
        const weekEndIso = format(weekEnd, "yyyy-MM-dd");

        const weekMarks = marks.filter((m) => m.date >= weekStartIso && m.date <= weekEndIso);
        const { attended, held } = markAttendedHeld(weekMarks);

        buckets.push({
          label: format(weekStart, "d MMM"),
          value: held === 0 ? null : roundPercentage(calculateAttendance(attended, held)),
        });
      }
      return buckets;
    },
    enabled: Boolean(student && subjectId),
  });
}
