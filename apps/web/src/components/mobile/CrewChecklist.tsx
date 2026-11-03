"use client";

import type { JobTask } from "@fsm/types";

import { useCompleteTask } from "@/src/hooks/jobs.hooks";
import { cn } from "@/src/lib/utils";
import { showToast } from "@/src/stores/toast.store";
import "./crew-job-motion.css";

export function isTaskDone(task: Pick<JobTask, "status">): boolean {
  return task.status === "completed" || task.status === "skipped";
}

/** Checklist rows from frames 1:13 (Checklist) and 10:1917 (rooms). Backed by GET/POST /jobs/:id/tasks. */
export function CrewChecklist({
  jobId,
  tasks,
  label,
  emptyText
}: {
  jobId: string;
  tasks: JobTask[];
  label?: string;
  emptyText: string;
}) {
  const completeTask = useCompleteTask(jobId);

  return (
    <section className="rounded-[14px] border border-[#e6dccb] bg-white px-5 py-5">
      {label ? (
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#5e6684]">{label}</p>
      ) : null}
      {tasks.length === 0 ? (
        <p className="text-sm text-[#5e6684]">{emptyText}</p>
      ) : (
        <ul className="space-y-1">
          {tasks.map((task) => {
            const done = isTaskDone(task);
            return (
              <li key={task.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  disabled={done || completeTask.isPending}
                  onClick={() => {
                    completeTask.mutate(task.id, {
                      onError: (error) =>
                        showToast({
                          tone: "error",
                          title: "Could not update checklist",
                          description: error instanceof Error ? error.message : "Try again."
                        })
                    });
                  }}
                  className="flex min-h-11 w-full items-center gap-3 text-left text-[15px] disabled:cursor-default"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "h-[22px] w-[22px] shrink-0 rounded-[5px] border",
                      done ? "crew-check-done border-[#2d7a4a] bg-[#2d7a4a]" : "border-[#e6dccb] bg-white"
                    )}
                  />
                  <span className={done ? "text-[#5e6684]" : "text-[#0f1530]"}>{task.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
