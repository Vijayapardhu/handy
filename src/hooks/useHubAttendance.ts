import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  connectHub,
  disconnectHub,
  fetchHubAttendance,
} from "@/services/attendance/hubAttendanceService";

const hubAttendanceKey = (uid: string | undefined) => ["hubAttendance", uid];

/**
 * `enabled` is the technical-hour gate from HomePage: no point calling the
 * endpoint for a student whose timetable has no Technical Hour at all.
 */
export function useHubAttendance(enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: hubAttendanceKey(user?.uid),
    queryFn: async () => {
      const idToken = await user!.getIdToken();
      return fetchHubAttendance(idToken);
    },
    enabled: enabled && Boolean(user),
    // The Maya token itself is only good for an hour; re-fetching more often
    // than this just re-does the same silent refresh for no new data.
    staleTime: 5 * 60 * 1000,
  });
}

export function useConnectHub() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ rollNumber, password }: { rollNumber: string; password: string }) => {
      const idToken = await user!.getIdToken();
      await connectHub(rollNumber, password, idToken);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hubAttendanceKey(user?.uid) }),
  });
}

export function useDisconnectHub() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const idToken = await user!.getIdToken();
      await disconnectHub(idToken);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hubAttendanceKey(user?.uid) }),
  });
}
