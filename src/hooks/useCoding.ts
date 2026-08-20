import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  analyseComplexity,
  createSolution,
  deleteSolution,
  fetchCodingProfile,
  fetchContests,
  fetchDailyProblem,
  fetchLeaderboard,
  getSolutions,
  linkHandles,
  updateCodingSettings,
  updateSolution,
  type NewSolution,
  type SolutionEdits,
} from "@/services/coding/codingService";
import type { CodingPlatform, ComplexityVerdict } from "@/types/coding";

const profileKey = (uid: string | undefined) => ["codingProfile", uid];
const solutionsKey = (uid: string | undefined) => ["codingSolutions", uid];
const contestsKey = ["codingContests"];
const dailyKey = ["codingDaily"];
const leaderboardKey = (uid: string | undefined) => ["codingLeaderboard", uid];

/**
 * The student's platform snapshot.
 *
 * The server already caches the five-site fan-out for half an hour, so this
 * only decides how often the *browser* re-asks for that cached answer. The
 * Refresh button is the path that actually goes back to the platforms.
 */
export function useCodingProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: profileKey(user?.uid),
    queryFn: async () => fetchCodingProfile(await user!.getIdToken()),
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRefreshCodingProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => fetchCodingProfile(await user!.getIdToken(), true),
    onSuccess: (result) => queryClient.setQueryData(profileKey(user?.uid), result),
  });
}

export function useLinkHandles() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (handles: Partial<Record<CodingPlatform, string>>) =>
      linkHandles(handles, await user!.getIdToken()),
    onSuccess: (result) => {
      queryClient.setQueryData(profileKey(user?.uid), result);
      // Linking changes a total, which changes a board position.
      queryClient.invalidateQueries({ queryKey: leaderboardKey(user?.uid) });
    },
  });
}

export function useCodingSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: { weeklyTarget?: number; shareToLeaderboard?: boolean }) =>
      updateCodingSettings(settings, await user!.getIdToken()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKey(user?.uid) });
      queryClient.invalidateQueries({ queryKey: leaderboardKey(user?.uid) });
    },
  });
}

/** Shared across every student and cached server-side for six hours — this is just the browser's copy. */
export function useContests(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: contestsKey,
    queryFn: async () => fetchContests(await user!.getIdToken()),
    enabled: enabled && Boolean(user),
    staleTime: 60 * 60 * 1000,
  });
}

export function useDailyProblem(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: dailyKey,
    queryFn: async () => fetchDailyProblem(await user!.getIdToken()),
    enabled: enabled && Boolean(user),
    staleTime: 30 * 60 * 1000,
  });
}

export function useCodingLeaderboard(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: leaderboardKey(user?.uid),
    queryFn: async () => fetchLeaderboard(await user!.getIdToken()),
    enabled: enabled && Boolean(user),
    staleTime: 10 * 60 * 1000,
  });
}

export function useSolutions() {
  const { student } = useAuth();
  return useQuery({
    queryKey: solutionsKey(student?.id),
    queryFn: () => getSolutions(student!.id),
    enabled: Boolean(student),
  });
}

/** Every solve-log mutation lands on the same key, so the streak and the list stay in step. */
function useSolutionMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const { student } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: solutionsKey(student?.id) }),
  });
}

export function useCreateSolution() {
  const { student } = useAuth();
  return useSolutionMutation((solution: NewSolution) => createSolution(student!.id, solution));
}

export function useUpdateSolution() {
  return useSolutionMutation(({ solutionId, edits }: { solutionId: string; edits: SolutionEdits }) =>
    updateSolution(solutionId, edits),
  );
}

export function useDeleteSolution() {
  return useSolutionMutation((solutionId: string) => deleteSolution(solutionId));
}

/**
 * Reads a solution's complexity.
 *
 * Not a query: it costs money per call and must only ever run because a
 * student pressed the button.
 */
export function useAnalyseComplexity() {
  const { user } = useAuth();
  return useMutation<
    ComplexityVerdict,
    Error,
    { code: string; language: string; title?: string; platform?: CodingPlatform }
  >({
    mutationFn: async (input) => analyseComplexity(input, await user!.getIdToken()),
  });
}
