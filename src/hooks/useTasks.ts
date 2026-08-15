import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  createTask,
  deleteTask,
  getTasks,
  setTaskDone,
  updateTask,
  type NewTask,
  type TaskEdits,
} from "@/services/tasks/taskService";
import type { TaskDoc } from "@/types/task";

const KEY = ["tasks"];

export function useTasks() {
  const { student } = useAuth();
  return useQuery({
    queryKey: [...KEY, student?.id],
    queryFn: () => getTasks(student!.id),
    enabled: Boolean(student),
  });
}

/** All mutations invalidate the same key, so every screen showing tasks stays in step. */
function useTaskMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCreateTask() {
  const { student } = useAuth();
  return useTaskMutation((task: NewTask) => createTask(student!.id, task));
}

export function useUpdateTask() {
  return useTaskMutation(({ taskId, edits }: { taskId: string; edits: TaskEdits }) => updateTask(taskId, edits));
}

/** `task` is the full doc when known — required to roll a repeating task forward on completion. */
export function useSetTaskDone() {
  const { student } = useAuth();
  return useTaskMutation(({ taskId, done, task }: { taskId: string; done: boolean; task?: TaskDoc }) =>
    setTaskDone(student!.id, taskId, done, task),
  );
}

export function useDeleteTask() {
  return useTaskMutation((taskId: string) => deleteTask(taskId));
}
