import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  createNote,
  deleteNote,
  getGroupNotes,
  uploadNoteFile,
  type CreateNoteInput,
} from "@/services/announcements/notesService";

export function useGroupNotes(groupKey: string | null) {
  return useQuery({
    queryKey: ["groupNotes", groupKey],
    queryFn: () => getGroupNotes(groupKey as string),
    enabled: Boolean(groupKey),
  });
}

/** Per-file, so one failed upload on college wifi loses that file rather than the set. */
export function useUploadNoteFile() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ file, groupKey }: { file: File; groupKey: string }) => {
      const idToken = await user!.getIdToken();
      return uploadNoteFile(file, groupKey, idToken);
    },
  });
}

export function useCreateNote(groupKey: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateNoteInput) => {
      // Fetched at send time rather than held: an ID token lasts an hour, and
      // assembling a set of scans can outlive one.
      const idToken = await user!.getIdToken();
      return createNote(input, idToken);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groupNotes", groupKey] }),
  });
}

export function useDeleteNote(groupKey: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (noteId: string) => {
      const idToken = await user!.getIdToken();
      return deleteNote(noteId, idToken);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groupNotes", groupKey] }),
  });
}
