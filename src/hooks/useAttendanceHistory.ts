import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { getAttendanceHistoryPage } from "@/services/attendance/attendanceService";
import { useAuth } from "@/app/providers/AuthProvider";
import type { AttendanceRecordDoc } from "@/types/attendance";

const PAGE_SIZE = 20;

/** Cursor-paginated attendance history (SRS §24, §62). Each page is appended client-side. */
export function useAttendanceHistory(subjectId?: string) {
  const { student } = useAuth();
  const queryClient = useQueryClient();
  const [pages, setPages] = useState<AttendanceRecordDoc[][]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const initialLoad = useQuery({
    queryKey: ["attendanceHistory", student?.id, subjectId],
    queryFn: async () => {
      const result = await getAttendanceHistoryPage(student!.id, PAGE_SIZE, null, subjectId);
      setPages([result.records]);
      setCursor(result.cursor);
      setHasMore(result.records.length === PAGE_SIZE);
      return result;
    },
    enabled: Boolean(student),
  });

  async function loadMore() {
    if (!student || !hasMore || !cursor) return;
    const result = await getAttendanceHistoryPage(student.id, PAGE_SIZE, cursor, subjectId);
    setPages((prev) => [...prev, result.records]);
    setCursor(result.cursor);
    setHasMore(result.records.length === PAGE_SIZE);
  }

  function reset() {
    setPages([]);
    setCursor(null);
    setHasMore(true);
    queryClient.invalidateQueries({ queryKey: ["attendanceHistory", student?.id, subjectId] });
  }

  return {
    records: pages.flat(),
    isLoading: initialLoad.isLoading,
    isError: initialLoad.isError,
    error: initialLoad.error,
    hasMore,
    loadMore,
    reset,
  };
}
