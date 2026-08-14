import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearPortalSnapshot,
  getLatestPortalSnapshot,
  isExtensionAvailable,
} from "@/services/extension/handyExtensionBridge";

const AVAILABILITY_KEY = ["collegePortalExtension", "available"];
const SNAPSHOT_KEY = ["collegePortalExtension", "snapshot"];

/**
 * Bridges the "Handy College Sync" browser extension (extension/) into the
 * app: is it installed, and what's the latest attendance snapshot it
 * captured from a Campus Connect page the student was already logged into.
 *
 * This hook itself only reads. Turning a snapshot into the student's actual
 * record is a separate, explicit step — importCollegePortalSnapshot(), called
 * from ConnectPortalPage (onboarding) and CollegePortalSyncCard (re-sync).
 */
export function useCollegePortalSync() {
  const queryClient = useQueryClient();

  const availabilityQuery = useQuery({
    queryKey: AVAILABILITY_KEY,
    queryFn: isExtensionAvailable,
    staleTime: 30_000,
  });

  const snapshotQuery = useQuery({
    queryKey: SNAPSHOT_KEY,
    queryFn: getLatestPortalSnapshot,
    enabled: availabilityQuery.data === true,
  });

  async function sync() {
    const { data: available } = await availabilityQuery.refetch();
    if (available) await snapshotQuery.refetch();
  }

  async function clear() {
    await clearPortalSnapshot();
    queryClient.setQueryData(SNAPSHOT_KEY, null);
  }

  return {
    isAvailable: availabilityQuery.data ?? false,
    isCheckingAvailability: availabilityQuery.isLoading,
    snapshot: snapshotQuery.data ?? null,
    isSyncing: availabilityQuery.isFetching || snapshotQuery.isFetching,
    sync,
    clear,
  };
}
