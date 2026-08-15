export type MaterialType = "pdf" | "link" | "video" | "other";

/** Study material the admin panel publishes — see firestore.rules `materials/{materialId}`. */
export interface MaterialDoc {
  id: string;
  title: string;
  description: string;
  type: MaterialType;
  /** Resolved, public URL — a Vercel Blob URL for uploaded files, or the link itself for type "link"/"video". */
  url: string;
  /** Vercel Blob pathname, present only for type "pdf"/"other" (i.e. an actual upload, not an external link). */
  fileKey: string | null;
  subjectId: string | null;
  semesterId: string | null;
  section: string | null;
  visible: boolean;
  uploadedBy: string;
  uploadedAt: string;
}
