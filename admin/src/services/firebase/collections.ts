import {
  collection,
  doc,
  type CollectionReference,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/app/config/firebase";
import type { StudentDoc } from "@/types/student";
import type { SubjectDoc } from "@/types/subject";
import type { TimetableVersionDoc, TimetableEntryDoc } from "@/types/timetable";
import type { AttendanceSummaryDoc, AttendanceCorrectionDoc } from "@/types/attendance";
import type { LeaveRequestDoc } from "@/types/leave";
import type { NotificationDoc } from "@/types/notification";
import type { AnnouncementDoc, ClassGroupMemberDoc, ClassRepDoc } from "@/types/classGroup";
import type { FeedbackDoc } from "@/types/feedback";
import type { AdminDoc } from "@/types/admin";
import type { MaterialDoc } from "@/types/material";
import type { AppUpdateDoc } from "@/types/appUpdate";
import type { SemesterDoc } from "@/types/semester";
import type { FacultyDoc } from "@/types/faculty";
import type { CollegeConfigDoc } from "@/types/college";

/** Same converter idiom as the root app's collections.ts — id in, id stripped on write. */
function makeConverter<T extends { id: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore(model: T): DocumentData {
      const { id: _id, ...rest } = model;
      return rest;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): T {
      return { id: snapshot.id, ...snapshot.data() } as T;
    },
  };
}

function typedCollection<T extends { id: string }>(path: string): CollectionReference<T> {
  return collection(db, path).withConverter(makeConverter<T>());
}

export const COLLECTIONS = {
  students: "students",
  subjects: "subjects",
  timetableVersions: "timetableVersions",
  timetableEntries: "timetableEntries",
  attendanceSummaries: "attendanceSummaries",
  attendanceCorrections: "attendanceCorrections",
  leaveRequests: "leaveRequests",
  notifications: "notifications",
  classGroupMembers: "classGroupMembers",
  classReps: "classReps",
  announcements: "announcements",
  feedback: "feedback",
  admins: "admins",
  materials: "materials",
  appUpdates: "appUpdates",
  semesters: "semesters",
  faculty: "faculty",
  colleges: "colleges",
} as const;

export const studentsCol = () => typedCollection<StudentDoc>(COLLECTIONS.students);
export const subjectsCol = () => typedCollection<SubjectDoc>(COLLECTIONS.subjects);
export const timetableVersionsCol = () => typedCollection<TimetableVersionDoc>(COLLECTIONS.timetableVersions);
export const timetableEntriesCol = () => typedCollection<TimetableEntryDoc>(COLLECTIONS.timetableEntries);
export const attendanceSummariesCol = () => typedCollection<AttendanceSummaryDoc>(COLLECTIONS.attendanceSummaries);
export const attendanceCorrectionsCol = () =>
  typedCollection<AttendanceCorrectionDoc>(COLLECTIONS.attendanceCorrections);
export const leaveRequestsCol = () => typedCollection<LeaveRequestDoc>(COLLECTIONS.leaveRequests);
export const notificationsCol = () => typedCollection<NotificationDoc>(COLLECTIONS.notifications);
export const classGroupMembersCol = () => typedCollection<ClassGroupMemberDoc>(COLLECTIONS.classGroupMembers);
export const classRepsCol = () => typedCollection<ClassRepDoc>(COLLECTIONS.classReps);
export const announcementsCol = () => typedCollection<AnnouncementDoc>(COLLECTIONS.announcements);
export const feedbackCol = () => typedCollection<FeedbackDoc>(COLLECTIONS.feedback);
export const adminsCol = () => typedCollection<AdminDoc>(COLLECTIONS.admins);
export const materialsCol = () => typedCollection<MaterialDoc>(COLLECTIONS.materials);
export const appUpdatesCol = () => typedCollection<AppUpdateDoc>(COLLECTIONS.appUpdates);
export const semestersCol = () => typedCollection<SemesterDoc>(COLLECTIONS.semesters);
export const facultyCol = () => typedCollection<FacultyDoc>(COLLECTIONS.faculty);
export const collegesCol = () => typedCollection<CollegeConfigDoc>(COLLECTIONS.colleges);

export const studentDocRef = (studentId: string) =>
  doc(db, COLLECTIONS.students, studentId).withConverter(makeConverter<StudentDoc>());

export const adminDocRef = (uid: string) => doc(db, COLLECTIONS.admins, uid).withConverter(makeConverter<AdminDoc>());

export const collegeDocRef = (collegeId: string) =>
  doc(db, COLLECTIONS.colleges, collegeId).withConverter(makeConverter<CollegeConfigDoc>());
