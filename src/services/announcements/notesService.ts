import { getDocs, query, where } from "firebase/firestore";
import { classNotesCol } from "@/services/firebase/collections";
import { AnnouncementError, MAX_ATTACHMENT_BYTES } from "./announcementService";
import type { AnnouncementLink, AnnouncementMedia, ClassNoteDoc } from "@/types/announcement";

export const MAX_NOTE_FILES = 20;
export const MAX_NOTE_TITLE = 140;
export const MAX_NOTE_DESCRIPTION = 1000;

/**
 * Everything on this class's shelf, newest first.
 *
 * Sorted here rather than in the query so the collection needs no composite
 * index alongside the groupKey filter — the same trade the announcements list
 * makes.
 */
export async function getGroupNotes(groupKey: string): Promise<ClassNoteDoc[]> {
  try {
    const snapshot = await getDocs(query(classNotesCol(), where("groupKey", "==", groupKey)));
    return snapshot.docs
      .map((d) => d.data())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    // A rules rejection throws rather than returning empty; an empty shelf is
    // the same thing to a reader who is not in the room.
    return [];
  }
}

const MESSAGES: Record<string, string> = {
  not_a_class_rep: "You're not the class representative for this class any more.",
  nothing_attached: "Add at least one file or link — a title on its own isn't much use.",
  too_long: "That's longer than the limit — shorten the title or the description.",
  missing_title: "Give the material a name.",
  not_found: "That material has already been removed.",
  missing_token: "You've been signed out. Sign in again and retry.",
  invalid_token: "You've been signed out. Sign in again and retry.",
};

async function readError(response: Response, fallback: string): Promise<AnnouncementError> {
  try {
    const data = (await response.json()) as { error?: string };
    return new AnnouncementError(data.error ?? "unknown", MESSAGES[data.error ?? ""] ?? fallback);
  } catch {
    return new AnnouncementError("unknown", fallback);
  }
}

/**
 * Uploads one file to the notes shelf.
 *
 * Same two-step as an announcement attachment — the server decides whether the
 * upload may happen and under what key, the bytes go straight to R2 — but filed
 * under `notes/` rather than `announcements/`, so a bucket listing still says
 * what a thing is.
 */
export async function uploadNoteFile(
  file: File,
  groupKey: string,
  idToken: string,
): Promise<Omit<AnnouncementMedia, "url">> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new AnnouncementError(
      "too_large",
      "That file is over 25 MB. Try a smaller scan or split the PDF.",
    );
  }

  const ticket = await fetch("/api/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ groupKey, filename: file.name, size: file.size, purpose: "note" }),
  });

  if (!ticket.ok) throw await readError(ticket, "Could not start the upload.");
  const { uploadUrl, key, kind, contentType } = (await ticket.json()) as {
    uploadUrl: string;
    key: string;
    kind: AnnouncementMedia["kind"];
    contentType: string;
  };

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });

  if (!put.ok) {
    throw new AnnouncementError(
      "upload_failed",
      "The upload didn't complete. Check your connection and try again.",
    );
  }

  return { key, kind, name: file.name, size: file.size };
}

export interface CreateNoteInput {
  groupKey: string;
  title: string;
  description: string;
  media: Omit<AnnouncementMedia, "url">[];
  links: AnnouncementLink[];
}

export async function createNote(input: CreateNoteInput, idToken: string): Promise<{ id: string }> {
  const response = await fetch("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(input),
  });

  if (!response.ok) throw await readError(response, "Could not add the material.");
  return (await response.json()) as { id: string };
}

export async function deleteNote(noteId: string, idToken: string): Promise<void> {
  const response = await fetch("/api/notes", {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ noteId }),
  });

  if (!response.ok) throw await readError(response, "Could not remove the material.");
}
