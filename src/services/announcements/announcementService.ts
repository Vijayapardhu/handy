import { doc, getDoc, getDocs, query, where } from "firebase/firestore";
import {
  announcementsCol,
  classGroupMembersCol,
  classRepsCol,
} from "@/services/firebase/collections";
import { getActiveSubjects } from "@/services/subjects/subjectService";
import type {
  AnnouncementDoc,
  AnnouncementLink,
  AnnouncementMedia,
  ClassRepRoom,
} from "@/types/announcement";

/**
 * The rooms this student may post to, named for a human.
 *
 * `classReps` is readable by any signed-in student (a grant is not a secret —
 * a class knowing who its rep is, is the point), so this filters to the caller
 * rather than relying on the rule to scope it. Revoked grants are kept with
 * `active: false`, so they are dropped here rather than assumed absent.
 */
export async function getClassRepRooms(uid: string, semesterId: string): Promise<ClassRepRoom[]> {
  const grants = await getDocs(query(classRepsCol(), where("uid", "==", uid)));
  const active = grants.docs.map((d) => d.data()).filter((g) => g.active);
  if (active.length === 0) return [];

  // The group key carries a subject *code* and a faculty id, neither of which
  // means anything on screen. This student's own subject list is the join —
  // and it is the right one even for an elective, because subjects are stored
  // per student, so their row already names the lecturer they actually sit with.
  const subjects = await getActiveSubjects(semesterId);
  const byCode = new Map(subjects.map((s) => [s.code.toUpperCase(), s]));

  return active.map((grant) => {
    const subject = byCode.get(grant.subjectCode.toUpperCase());
    return {
      groupKey: grant.groupKey,
      subjectCode: grant.subjectCode,
      subjectName: subject?.name ?? grant.subjectCode,
      facultyName: subject?.facultyName ?? null,
    };
  });
}

/**
 * One announcement, or null when it isn't readable.
 *
 * Null covers both "deleted" and "you're not in that class" — the rule refuses
 * the read either way, and the app has no business telling a student which.
 */
export async function getAnnouncement(announcementId: string): Promise<AnnouncementDoc | null> {
  try {
    const snapshot = await getDoc(doc(announcementsCol(), announcementId));
    return snapshot.exists() ? snapshot.data() : null;
  } catch {
    // A rules rejection throws rather than returning empty. Same answer.
    return null;
  }
}

/**
 * Everything posted to one class group, newest first.
 *
 * Sorted here rather than in the query so the collection needs no composite
 * index alongside the groupKey filter — the same trade the notifications inbox
 * makes, and for the same reason.
 */
export async function getGroupAnnouncements(groupKey: string): Promise<AnnouncementDoc[]> {
  try {
    const snapshot = await getDocs(query(announcementsCol(), where("groupKey", "==", groupKey)));
    return snapshot.docs
      .map((d) => d.data())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

/**
 * Every class group this student sits in, as written by the server on sync.
 *
 * Read once and matched locally rather than reconstructed from a timetable id
 * the web app does not store. It is also the honest source: these documents are
 * what `/api/announce` fans out to, so a subject page built on them shows
 * exactly the room the student would actually be notified in.
 */
export async function getMyClassGroupKeys(uid: string): Promise<string[]> {
  try {
    const snapshot = await getDocs(query(classGroupMembersCol(), where("uid", "==", uid)));
    return snapshot.docs.map((d) => d.data().groupKey);
  } catch {
    return [];
  }
}

/**
 * The one of those groups that is this subject, taught by this student's own
 * lecturer.
 *
 * A group key is `<timetableId>-<CODE>-<facultyId>`, and the last two parts are
 * exactly what separates two rooms taking the same subject — so matching on the
 * suffix picks the right room for an elective without needing the timetable id.
 */
export function matchGroupKey(
  keys: string[],
  subjectCode: string,
  facultyId: string,
): string | null {
  const suffix = `-${subjectCode.trim().toUpperCase()}-${facultyId.trim()}`;
  if (!subjectCode.trim() || !facultyId.trim()) return null;
  return keys.find((key) => key.toUpperCase().endsWith(suffix.toUpperCase())) ?? null;
}

/** Mirrors MAX_UPLOAD_BYTES in api/_r2.js — checked here only to fail fast and kindly. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const MAX_ATTACHMENTS = 10;
export const MAX_TITLE = 140;
export const MAX_BODY = 4000;

/** What the server accepts, so the file picker can filter and a bad pick is caught before upload. */
export const ACCEPTED_UPLOAD_TYPES =
  ".jpg,.jpeg,.png,.webp,.gif,.heic,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.mp4,.mov,.webm";

export class AnnouncementError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AnnouncementError";
  }
}

/** Server error codes turned into something a class rep can act on. */
const MESSAGES: Record<string, string> = {
  not_a_class_rep: "You're not the class representative for this class any more.",
  too_large: "That file is over 25 MB. Try a smaller photo or split the PDF.",
  unsupported_type: "That file type isn't allowed. Images, PDFs, Office files and video only.",
  missing_token: "You've been signed out. Sign in again and retry.",
  invalid_token: "You've been signed out. Sign in again and retry.",
  storage_unconfigured: "Attachments are temporarily unavailable. You can still post text.",
  too_long: "That's longer than the limit — shorten the title or the message.",
  missing_title: "Give the announcement a title.",
};

function describe(code: string, fallback: string): AnnouncementError {
  return new AnnouncementError(code, MESSAGES[code] ?? fallback);
}

async function readError(response: Response, fallback: string): Promise<AnnouncementError> {
  try {
    const data = (await response.json()) as { error?: string };
    return describe(data.error ?? "unknown", fallback);
  } catch {
    return new AnnouncementError("unknown", fallback);
  }
}

/**
 * Uploads one file and returns what /api/announce needs to reference it.
 *
 * Two steps on purpose. The server decides *whether* this upload may happen and
 * under what key, then hands back a short-lived presigned URL; the bytes go
 * straight from this browser to R2 without passing through a serverless
 * function, which is what keeps a 25 MB photo out of a request body.
 *
 * The returned object carries no URL. The poster does not get to say where an
 * attachment points — /api/announce derives that from the key it issued.
 */
export async function uploadAttachment(
  file: File,
  groupKey: string,
  idToken: string,
): Promise<Omit<AnnouncementMedia, "url">> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw describe("too_large", "That file is too large.");
  }

  const ticket = await fetch("/api/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ groupKey, filename: file.name, size: file.size }),
  });

  if (!ticket.ok) throw await readError(ticket, "Could not start the upload.");
  const { uploadUrl, key, kind, contentType } = (await ticket.json()) as {
    uploadUrl: string;
    key: string;
    kind: AnnouncementMedia["kind"];
    contentType: string;
  };

  // Content-Type is not part of the signature, so setting it is safe — and
  // necessary: without it the object serves as a generic download and an
  // <img> pointing at it renders nothing.
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

export interface RosterStudent {
  rollNumber: string;
  name: string;
  section: string;
  department: string;
  year: number | string;
}

export async function getClassRoster(
  groupKey: string,
  idToken: string,
): Promise<RosterStudent[]> {
  const response = await fetch("/api/class-roster", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ groupKey }),
  });

  if (!response.ok) throw await readError(response, "Could not load the class list.");
  const data = (await response.json()) as { students: RosterStudent[] };
  return data.students;
}

/**
 * RFC 4180 quoting.
 *
 * Every field is quoted rather than only the ones that need it. Names carry
 * commas ("RAJU, B"), and a spreadsheet silently splitting one student into two
 * columns is the kind of error nobody notices until the list is being read out.
 * Inner quotes are doubled, which is how CSV escapes them.
 */
function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function rosterToCsv(students: RosterStudent[]): string {
  const header = ["Roll Number", "Name", "Section", "Department", "Year"];
  const rows = students.map((s) =>
    [s.rollNumber, s.name, s.section, s.department, s.year].map(csvCell).join(","),
  );
  // CRLF and a trailing newline: Excel is the program these open in, and it is
  // the fussiest reader of the format.
  return [header.map(csvCell).join(","), ...rows].join("\r\n") + "\r\n";
}

export interface PostAnnouncementInput {
  groupKey: string;
  title: string;
  body: string;
  important: boolean;
  media: Omit<AnnouncementMedia, "url">[];
  links: AnnouncementLink[];
}

export interface PostAnnouncementResult {
  id: string;
  /** How many classmates it went to — worth showing, since a rep cannot otherwise tell. */
  recipients: number;
  delivered: number;
}

export async function postAnnouncement(
  input: PostAnnouncementInput,
  idToken: string,
): Promise<PostAnnouncementResult> {
  const response = await fetch("/api/announce", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(input),
  });

  if (!response.ok) throw await readError(response, "Could not post the announcement.");
  const data = (await response.json()) as PostAnnouncementResult;
  return data;
}
