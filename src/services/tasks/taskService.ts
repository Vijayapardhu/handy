import { addDoc, deleteDoc, doc, getDocs, orderBy, query, updateDoc, where } from "firebase/firestore";
import { tasksCol } from "@/services/firebase/collections";
import { nextOccurrence } from "@/lib/calculations/deadlines";
import type { Subtask, TaskDoc, TaskKind, TaskRepeat } from "@/types/task";

export interface NewTask {
  title: string;
  notes?: string;
  kind: TaskKind;
  dueDate: string;
  dueTime?: string | null;
  subjectId?: string | null;
  subtasks?: Subtask[];
  repeat?: TaskRepeat;
  attachDay?: number | null;
  attachTime?: string | null;
  attachLabel?: string | null;
  leadDays?: number | null;
}

/**
 * Ordered by deadline, not by creation — the next thing due is the only thing
 * a student is looking for. Completed tasks come back too so the list can show
 * them struck through; filtering happens in the UI.
 */
export async function getTasks(studentId: string): Promise<TaskDoc[]> {
  const q = query(tasksCol(), where("studentId", "==", studentId), orderBy("dueDate", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data());
}

export async function createTask(studentId: string, task: NewTask): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(tasksCol(), {
    studentId,
    title: task.title.trim(),
    notes: task.notes?.trim() ?? "",
    kind: task.kind,
    dueDate: task.dueDate,
    dueTime: task.dueTime || null,
    subjectId: task.subjectId || null,
    done: false,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    subtasks: task.subtasks ?? [],
    repeat: task.repeat ?? "none",
    attachDay: task.attachDay ?? null,
    attachTime: task.attachTime ?? null,
    attachLabel: task.attachLabel ?? null,
    leadDays: task.leadDays ?? null,
  } as TaskDoc);
  return ref.id;
}

export interface TaskEdits {
  title?: string;
  notes?: string;
  kind?: TaskKind;
  dueDate?: string;
  dueTime?: string | null;
  subjectId?: string | null;
  subtasks?: Subtask[];
  repeat?: TaskRepeat;
  attachDay?: number | null;
  attachTime?: string | null;
  attachLabel?: string | null;
  leadDays?: number | null;
}

/** Partial update — only the fields passed are written, so this serves both a full edit and a single subtask tick. */
export async function updateTask(taskId: string, edits: TaskEdits): Promise<void> {
  const data: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (edits.title !== undefined) data.title = edits.title.trim();
  if (edits.notes !== undefined) data.notes = edits.notes.trim();
  if (edits.kind !== undefined) data.kind = edits.kind;
  if (edits.dueDate !== undefined) data.dueDate = edits.dueDate;
  if (edits.dueTime !== undefined) data.dueTime = edits.dueTime;
  if (edits.subjectId !== undefined) data.subjectId = edits.subjectId;
  if (edits.subtasks !== undefined) data.subtasks = edits.subtasks;
  if (edits.repeat !== undefined) data.repeat = edits.repeat;
  if (edits.attachDay !== undefined) data.attachDay = edits.attachDay;
  if (edits.attachTime !== undefined) data.attachTime = edits.attachTime;
  if (edits.attachLabel !== undefined) data.attachLabel = edits.attachLabel;
  if (edits.leadDays !== undefined) data.leadDays = edits.leadDays;
  await updateDoc(doc(tasksCol(), taskId), data);
}

/**
 * Marks a deadline done, and rolls a repeating one forward.
 *
 * The completed copy stays as history rather than being mutated into the next
 * occurrence — "did I hand in last week's record" is a question worth being
 * able to answer. Subtasks come back unticked, since the next occurrence has
 * to be done again from the start. Mirrors Repository.setTaskDone in
 * mobile/lib/data/repository.dart.
 */
export async function setTaskDone(studentId: string, taskId: string, done: boolean, task?: TaskDoc): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(doc(tasksCol(), taskId), {
    done,
    completedAt: done ? now : null,
    updatedAt: now,
  });

  if (!done || !task || task.repeat === "none") return;

  await createTask(studentId, {
    title: task.title,
    notes: task.notes,
    kind: task.kind,
    dueDate: nextOccurrence(task.dueDate, task.repeat),
    dueTime: task.dueTime,
    subjectId: task.subjectId,
    subtasks: task.subtasks.map((s) => ({ ...s, done: false })),
    repeat: task.repeat,
    attachDay: task.attachDay,
    attachTime: task.attachTime,
    attachLabel: task.attachLabel,
    leadDays: task.leadDays,
  });
}

export async function deleteTask(taskId: string): Promise<void> {
  await deleteDoc(doc(tasksCol(), taskId));
}
