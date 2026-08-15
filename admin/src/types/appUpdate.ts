export type AppUpdatePlatform = "android" | "extension" | "web";

/** A release/changelog record — see firestore.rules `appUpdates/{updateId}`. */
export interface AppUpdateDoc {
  id: string;
  version: string;
  platform: AppUpdatePlatform;
  changelog: string;
  downloadUrl: string;
  minSupportedVersion: string | null;
  notifiedStudents: boolean;
  publishedAt: string;
  publishedBy: string;
}
