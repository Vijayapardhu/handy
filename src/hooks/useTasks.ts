import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import { createTask, deleteTask, getTasks, setTaskDone, type NewTask } from "@/services/tasks/taskService";

const KEY = ["tasks"];

export function useTasks() {
  const { student } = useAuth();
  return useQuery({
    queryKey: [...KEY, student?.id],
    queryFn: () => getTasks(student!.id),
    enabled: Boolean(student),
  });
}

/** All three mutations invalidate the same key, so every screen showing tasks stays in step. */
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

export function useSetTaskDone() {
  return useTaskMutation(({ taskId, done }: { taskId: string; done: boolean }) =>
    setTaskDone(taskId, done),
  );
}

export function useDeleteTask() {
  return useTaskMutation((taskId: string) => deleteTask(taskId));
}
