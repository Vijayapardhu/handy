import { useQuery } from "@tanstack/react-query";
import { getSubject, getSubjectsWithAttendance } from "@/services/subjects/subjectService";
import { useAuth } from "@/app/providers/AuthProvider";

export function useSubjectsWithAttendance() {
  const { student } = useAuth();
  return useQuery({
    queryKey: ["subjectsWithAttendance", student?.id, student?.semesterId],
    queryFn: () =>
      getSubjectsWithAttendance(student!.id, student!.semesterId, student!.collegeId),
    enabled: Boolean(student),
  });
}

export function useSubject(subjectId: string | undefined) {
  return useQuery({
    queryKey: ["subject", subjectId],
    queryFn: () => getSubject(subjectId as string),
    enabled: Boolean(subjectId),
  });
}
