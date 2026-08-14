import { useMutation } from "@tanstack/react-query";
import { submitTimetableChangeReport } from "@/services/timetable/timetableChangeReportService";
import { useAuth } from "@/app/providers/AuthProvider";

export function useSubmitTimetableChangeReport(timetableVersionId: string | null) {
  const { student } = useAuth();
  return useMutation({
    mutationFn: (input: { description: string; subjectId: string | null }) =>
      submitTimetableChangeReport(student!.id, input.description, timetableVersionId, input.subjectId),
  });
}
