/** Mirrors the shapes api/_classGroups.js and scripts/grant-class-rep.mjs already write. */

export interface ClassGroupMemberDoc {
  id: string;
  uid: string;
  groupKey: string;
  timetableId: string;
  joinedAt: string;
}

export interface ClassRepDoc {
  id: string;
  uid: string;
  rollNumber: string;
  groupKey: string;
  subjectCode: string;
  active: boolean;
  updatedAt: string;
}

export interface AnnouncementAttachment {
  key: string;
  kind: "image" | "video" | "file";
  name: string;
  size: number;
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
  media: AnnouncementAttachment[];
  links: AnnouncementLink[];
  important: boolean;
  createdAt: string;
}
