import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAllMarks } from "@/services/attendance/attendanceMarkService";
import { useAuth } from "@/app/providers/AuthProvider";

const PAGE_SIZE = 20;

/**
 * The student's whole self-marked attendance history, newest first,
 * paginated client-side. A single, unbounded read rather than Firestore
 * cursor pagination — marks are self-reported and naturally low-volume (one
 * per class a student actually bothered to tap), the same reasoning mobile's
 * own AttendanceHistoryScreen uses for streaming the full set at once.
 *
 * Was previously cursor-paginated over `attendance` (AttendanceRecordDoc),
 * which is admin-only and never populated for a real student — this hook now
 * reads the collection that actually has data in it. See attendanceMarks.ts.
 */
export function useAttendanceHistory(subjectId?: string) {
  const { student } = useAuth();
  const queryClient = useQueryClient();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const query = useQuery({
    queryKey: ["attendanceMarks", "all", student?.id],
    queryFn: () => getAllMarks(student!.id),
    enabled: Boolean(student),
  });

  const sorted = useMemo(() => {
    const all = query.data ?? [];
    const filtered = subjectId ? all.filter((m) => m.subjectId === subjectId) : all;
    return [...filtered].sort((a, b) => (a.date === b.date ? b.startTime.localeCompare(a.startTime) : b.date.localeCompare(a.date)));
  }, [query.data, subjectId]);

  const records = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  function loadMore() {
    setVisibleCount((v) => v + PAGE_SIZE);
  }

  function reset() {
    setVisibleCount(PAGE_SIZE);
    queryClient.invalidateQueries({ queryKey: ["attendanceMarks", "all", student?.id] });
  }

  return {
    records,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    hasMore,
    loadMore,
    reset,
  };
}
