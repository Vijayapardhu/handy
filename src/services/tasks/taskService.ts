import { addDoc, deleteDoc, doc, getDocs, orderBy, query, updateDoc, where } from "firebase/firestore";
import { tasksCol } from "@/services/firebase/collections";
import type { TaskDoc, TaskKind } from "@/types/task";

export interface NewTask {
  title: string;
  notes?: string;
  kind: TaskKind;
  dueDate: string;
  dueTime?: string | null;
  subjectId?: string | null;
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
  } as TaskDoc);
  return ref.id;
}

export async function setTaskDone(taskId: string, done: boolean): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(doc(tasksCol(), taskId), {
    done,
    completedAt: done ? now : null,
    updatedAt: now,
  });
}

export async function deleteTask(taskId: string): Promise<void> {
  await deleteDoc(doc(tasksCol(), taskId));
}
