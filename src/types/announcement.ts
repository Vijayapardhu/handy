/**
 * A grant that lets one student post to one class group.
 *
 * Written only by scripts/grant-class-rep.mjs with the Admin SDK — never by
 * the app, and never by a rule. Being *in* a class is not permission to
 * broadcast to it, so this is deliberately something the client can read and
 * nothing the client can award.
 */
export interface ClassRepGrantDoc {
  /** `<uid>_<groupKey>` */
  id: string;
  uid: string;
  rollNumber: string;
  /** `<timetableId>-<subjectCode>-<facultyId>` — see api/_classGroups.js. */
  groupKey: string;
  subjectCode: string;
  /** Revoked grants are kept with active:false rather than deleted, so a withdrawn grant leaves a trace. */
  active: boolean;
  updatedAt: string;
}

/**
 * Which class group a student sits in, written by the server on every sync.
 *
 * Server-written only: a student who could add themselves to a group could
 * read another class's announcements. Membership follows the portal.
 */
export interface ClassGroupMemberDoc {
  /** `<uid>_<groupKey>` */
  id: string;
  uid: string;
  groupKey: string;
  timetableId: string;
  joinedAt: string;
}

export type AnnouncementMediaKind = "image" | "video" | "file";

export interface AnnouncementMedia {
  /** The R2 object key. The durable identifier — survives the public base changing. */
  key: string;
  kind: AnnouncementMediaKind;
  name: string;
  size: number;
  /** Computed server-side from the key; never a URL the poster supplied. */
  url: string | null;
}

export interface AnnouncementLink {
  url: string;
  label: string;
}

export interface AnnouncementDoc {
  id: string;
  groupKey: string;
  authorUid: string;
  authorName: string;
  authorRoll: string;
  title: string;
  body: string;
  media: AnnouncementMedia[];
  links: AnnouncementLink[];
  important: boolean;
  createdAt: string;
}

/** A class group described for a human, rather than as `6-2501AI06-3202`. */
export interface ClassRepRoom {
  groupKey: string;
  subjectCode: string;
  /** Falls back to the code when the subject isn't in this student's list. */
  subjectName: string;
  facultyName: string | null;
}
