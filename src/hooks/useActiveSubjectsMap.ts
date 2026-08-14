import { useQuery } from "@tanstack/react-query";
import { getActiveSubjects } from "@/services/subjects/subjectService";
import { useAuth } from "@/app/providers/AuthProvider";
import type { SubjectDoc } from "@/types/subject";

/** Small lookup map for rendering subject name/icon next to timetable entries, without N individual reads. */
export function useActiveSubjectsMap() {
  const { student } = useAuth();
  const query = useQuery({
    queryKey: ["activeSubjects", student?.semesterId],
    queryFn: () => getActiveSubjects(student!.semesterId),
    enabled: Boolean(student),
  });

  const bySubjectId = new Map<string, SubjectDoc>((query.data ?? []).map((s) => [s.id, s]));
  return { ...query, bySubjectId };
}
