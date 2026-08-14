import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { getAttendanceForRange } from "@/services/attendance/attendanceService";
import { useAuth } from "@/app/providers/AuthProvider";

/** Last `days` days of attendance across all subjects — backs the Home streak/weekly-comparison card. */
export function useRecentAttendance(days: number = 30) {
  const { student } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  const startIso = format(subDays(new Date(), days - 1), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["recentAttendance", student?.id, days, today],
    queryFn: () => getAttendanceForRange(student!.id, startIso, today),
    enabled: Boolean(student),
  });
}
