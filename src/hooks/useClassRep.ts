import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  getAnnouncement,
  getClassRepRooms,
  getGroupAnnouncements,
  getMyClassGroupKeys,
  postAnnouncement,
  uploadAttachment,
  type PostAnnouncementInput,
} from "@/services/announcements/announcementService";

/**
 * The classes this student may post to — empty for almost everyone.
 *
 * An empty array is the normal answer, not an error state: the overwhelming
 * majority of students are not class reps, and the UI reads it that way.
 */
export function useClassRepRooms() {
  const { student } = useAuth();
  return useQuery({
    queryKey: ["classRepRooms", student?.id, student?.semesterId],
    queryFn: () => getClassRepRooms(student!.id, student!.semesterId),
    enabled: Boolean(student),
  });
}

/**
 * Uploads one attachment.
 *
 * Deliberately per-file rather than a single mutation over the whole set: on a
 * college connection one file in five failing is ordinary, and a rep should
 * lose only that file rather than the batch.
 */
export function useUploadAttachment() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ file, groupKey }: { file: File; groupKey: string }) => {
      const idToken = await user!.getIdToken();
      return uploadAttachment(file, groupKey, idToken);
    },
  });
}

export function useAnnouncement(announcementId: string | undefined) {
  return useQuery({
    queryKey: ["announcement", announcementId],
    queryFn: () => getAnnouncement(announcementId as string),
    enabled: Boolean(announcementId),
  });
}

/**
 * Every group this student is in. Cached per student and shared across subject
 * pages, so opening five subjects costs one read rather than five.
 */
export function useMyClassGroups() {
  const { student } = useAuth();
  return useQuery({
    queryKey: ["myClassGroups", student?.id],
    queryFn: () => getMyClassGroupKeys(student!.id),
    enabled: Boolean(student),
  });
}

/** Announcements for one class group — used by the subject page. */
export function useGroupAnnouncements(groupKey: string | null) {
  return useQuery({
    queryKey: ["groupAnnouncements", groupKey],
    queryFn: () => getGroupAnnouncements(groupKey as string),
    enabled: Boolean(groupKey),
  });
}

export function usePostAnnouncement() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: PostAnnouncementInput) => {
      // Fetched at send time rather than held: an ID token expires after an
      // hour, and composing a long post with attachments can outlive one.
      const idToken = await user!.getIdToken();
      return postAnnouncement(input, idToken);
    },
  });
}
