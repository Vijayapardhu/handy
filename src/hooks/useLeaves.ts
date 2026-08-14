import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getLeaveRequests, submitLeaveRequest } from "@/services/leaves/leaveService";
import {
  calculateLeaveImpactForDate,
  findAlternativeDates,
} from "@/services/leaves/leaveImpactService";
import { useAuth } from "@/app/providers/AuthProvider";

export function useLeaveRequests() {
  const { student } = useAuth();
  return useQuery({
    queryKey: ["leaveRequests", student?.id],
    queryFn: () => getLeaveRequests(student!.id),
    enabled: Boolean(student),
  });
}

export function useSubmitLeaveRequest() {
  const { student } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { startDate: string; endDate: string; reason: string }) =>
      submitLeaveRequest(student!.id, input.startDate, input.endDate, input.reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaveRequests", student?.id] });
    },
  });
}

export function useLeaveImpact(date: string | null) {
  const { student } = useAuth();
  return useQuery({
    queryKey: ["leaveImpact", student?.id, date],
    queryFn: () =>
      calculateLeaveImpactForDate(
        student!.id,
        student!.semesterId,
        student!.department,
        student!.section,
        student!.collegeId,
        date as string,
      ),
    enabled: Boolean(student) && Boolean(date),
  });
}

export function useAlternativeDates(fromDate: string | null) {
  const { student } = useAuth();
  return useQuery({
    queryKey: ["alternativeDates", student?.id, fromDate],
    queryFn: () =>
      findAlternativeDates(
        student!.id,
        student!.semesterId,
        student!.department,
        student!.section,
        student!.collegeId,
        fromDate as string,
      ),
    enabled: Boolean(student) && Boolean(fromDate),
  });
}
