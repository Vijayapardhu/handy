import { useQuery } from "@tanstack/react-query";
import { getCollegeConfig } from "@/services/students/collegeConfigService";

export function useCollegeConfig(collegeId: string | undefined) {
  return useQuery({
    queryKey: ["collegeConfig", collegeId],
    queryFn: () => getCollegeConfig(collegeId as string),
    enabled: Boolean(collegeId),
    staleTime: 5 * 60_000,
  });
}
