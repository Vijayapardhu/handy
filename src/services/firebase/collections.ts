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
import type { AttendanceRecordDoc, AttendanceCorrectionDoc, AttendanceSummaryDoc } from "@/types/attendance";
import type { AttendanceMarkDoc } from "@/types/attendanceMark";
import type { LeaveRequestDoc } from "@/types/leave";
import type { NotificationDoc } from "@/types/notification";
import type { CollegeConfigDoc } from "@/types/config";
import type { TimetableChangeReportDoc } from "@/types/timetableChangeReport";
import type { TaskDoc } from "@/types/task";
import type { FaqDoc } from "@/types/faq";
import type { FeedbackDoc } from "@/types/feedback";
import type { AcademicRecordDoc } from "@/types/academicRecord";
import type { CodingSolutionDoc } from "@/types/coding";
import type {
  AnnouncementDoc,
  ClassGroupMemberDoc,
  ClassNoteDoc,
  ClassRepGrantDoc,
} from "@/types/announcement";

/**
 * Firestore doesn't round-trip a document's own id, so every converter
 * injects `id: snapshot.id` on read and strips it on write. This is the only
 * place collection <-> type wiring happens (SRS §30 data model).
 */
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
  attendance: "attendance",
  attendanceMarks: "attendanceMarks",
  attendanceSummaries: "attendanceSummaries",
  attendanceCorrections: "attendanceCorrections",
  leaveRequests: "leaveRequests",
  notifications: "notifications",
  colleges: "colleges",
  timetableChangeReports: "timetableChangeReports",
  tasks: "tasks",
  classReps: "classReps",
  announcements: "announcements",
  classGroupMembers: "classGroupMembers",
  classNotes: "classNotes",
  faqs: "faqs",
  feedback: "feedback",
  academicRecords: "academicRecords",
  codingSolutions: "codingSolutions",
} as const;

export const studentsCol = () => typedCollection<StudentDoc>(COLLECTIONS.students);
export const subjectsCol = () => typedCollection<SubjectDoc>(COLLECTIONS.subjects);
export const timetableVersionsCol = () =>
  typedCollection<TimetableVersionDoc>(COLLECTIONS.timetableVersions);
export const timetableEntriesCol = () =>
  typedCollection<TimetableEntryDoc>(COLLECTIONS.timetableEntries);
export const attendanceCol = () => typedCollection<AttendanceRecordDoc>(COLLECTIONS.attendance);
export const attendanceMarksCol = () => typedCollection<AttendanceMarkDoc>(COLLECTIONS.attendanceMarks);
export const attendanceSummariesCol = () =>
  typedCollection<AttendanceSummaryDoc>(COLLECTIONS.attendanceSummaries);
export const attendanceCorrectionsCol = () =>
  typedCollection<AttendanceCorrectionDoc>(COLLECTIONS.attendanceCorrections);
export const leaveRequestsCol = () => typedCollection<LeaveRequestDoc>(COLLECTIONS.leaveRequests);
export const notificationsCol = () => typedCollection<NotificationDoc>(COLLECTIONS.notifications);
export const collegesCol = () => typedCollection<CollegeConfigDoc>(COLLECTIONS.colleges);
export const timetableChangeReportsCol = () =>
  typedCollection<TimetableChangeReportDoc>(COLLECTIONS.timetableChangeReports);
export const tasksCol = () => typedCollection<TaskDoc>(COLLECTIONS.tasks);
export const classRepsCol = () => typedCollection<ClassRepGrantDoc>(COLLECTIONS.classReps);
export const announcementsCol = () => typedCollection<AnnouncementDoc>(COLLECTIONS.announcements);
export const classGroupMembersCol = () =>
  typedCollection<ClassGroupMemberDoc>(COLLECTIONS.classGroupMembers);
export const classNotesCol = () => typedCollection<ClassNoteDoc>(COLLECTIONS.classNotes);
export const faqsCol = () => typedCollection<FaqDoc>(COLLECTIONS.faqs);
export const feedbackCol = () => typedCollection<FeedbackDoc>(COLLECTIONS.feedback);

export const codingSolutionsCol = () =>
  typedCollection<CodingSolutionDoc>(COLLECTIONS.codingSolutions);

export const studentDocRef = (studentId: string) =>
  doc(db, COLLECTIONS.students, studentId).withConverter(makeConverter<StudentDoc>());

export const collegeDocRef = (collegeId: string) =>
  doc(db, COLLECTIONS.colleges, collegeId).withConverter(makeConverter<CollegeConfigDoc>());

export const academicRecordDocRef = (studentId: string) =>
  doc(db, COLLECTIONS.academicRecords, studentId).withConverter(makeConverter<AcademicRecordDoc>());
