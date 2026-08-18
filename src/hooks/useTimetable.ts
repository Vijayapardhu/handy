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
    // A published timetable changes rarely — without a staleTime this was
    // refetched from Firestore on every mount (every Home visit, every tab
    // switch), which is exactly the "requesting from the server every time"
    // delay it doesn't need to pay. 10 minutes is short enough that a same-day
    // publish still shows up on the next natural navigation.
    staleTime: 10 * 60 * 1000,
  });
}
