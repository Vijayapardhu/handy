import { useQuery } from "@tanstack/react-query";
import { getAcademicRecord } from "@/services/students/academicRecordService";
import { useAuth } from "@/app/providers/AuthProvider";

export function useAcademicRecord() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["academicRecord", user?.uid],
    queryFn: () => getAcademicRecord(user!.uid),
    enabled: Boolean(user),
    // Only ever updated by a portal sign-in, which is rare within a session —
    // no reason to refetch this on every mount the way a live number would need.
    staleTime: 10 * 60 * 1000,
  });
}
