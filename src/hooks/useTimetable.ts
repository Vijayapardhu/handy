import { useQuery } from "@tanstack/react-query";
import { getActiveTimetable } from "@/services/timetable/timetableService";
import { useAuth } from "@/app/providers/AuthProvider";
import { todayIso } from "@/lib/date";

export function useActiveTimetable(date: string = todayIso()) {
  const { student } = useAuth();
  return useQuery({
    queryKey: ["timetable", student?.semesterId, student?.department, student?.section, date],
    queryFn: () =>
      getActiveTimetable(student!.semesterId, student!.department, student!.section, date),
    enabled: Boolean(student),
  });
}
