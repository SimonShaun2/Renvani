import { and, eq, isNull } from "drizzle-orm";

import {
  db,
  emitEventWithExecutor,
  jobs,
  jobTasks,
  technicians,
  users
} from "@fsm/db";
import {
  AppError,
  ErrorCode,
  type CreateTaskInput,
  type JobTask,
  type UpdateTaskInput
} from "@fsm/types";

const MAX_RESULT_WINDOW = 10_000;

type JobRow = typeof jobs.$inferSelect;
type JobTaskRow = typeof jobTasks.$inferSelect;
type TechnicianRow = typeof technicians.$inferSelect;
type UserRow = typeof users.$inferSelect;
type SelectExecutor = Pick<typeof db, "select">;
type TransactionExecutor = Pick<typeof db, "select" | "insert" | "update">;

function normalizeOptionalString(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function buildActorName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function toJobTask(row: JobTaskRow): JobTask {
  return row;
}

function normalizeCreateTaskInput(input: CreateTaskInput) {
  return {
    assignedToId: input.assignedToId,
    title: input.title.trim(),
    description: normalizeOptionalString(input.description) ?? null,
    isRequired: input.isRequired ?? false,
    estimatedMinutes: input.estimatedMinutes ?? null,
    actualMinutes: input.actualMinutes ?? null,
    sortOrder: input.sortOrder,
    notes: normalizeOptionalString(input.notes) ?? null
  };
}

function normalizeUpdateTaskInput(input: UpdateTaskInput) {
  return {
    assignedToId: input.assignedToId,
    title: input.title !== undefined ? input.title.trim() : undefined,
    description: input.description !== undefined ? normalizeOptionalString(input.description) ?? null : undefined,
    status: input.status,
    isRequired: input.isRequired,
    estimatedMinutes: input.estimatedMinutes,
    actualMinutes: input.actualMinutes,
    sortOrder: input.sortOrder,
    notes: input.notes !== undefined ? normalizeOptionalString(input.notes) ?? null : undefined
  };
}

async function getActor(companyId: string, actorId: string, executor: SelectExecutor): Promise<UserRow | null> {
  const [actor] = await executor
    .select()
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.id, actorId), isNull(users.deletedAt)))
    .limit(1);

  return actor ?? null;
}

async function getJobRow(companyId: string, jobId: string, executor: SelectExecutor): Promise<JobRow> {
  const [job] = await executor
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.id, jobId), isNull(jobs.deletedAt)))
    .limit(1);

  if (!job) {
    throw new AppError(ErrorCode.NOT_FOUND, "Job not found");
  }

  return job;
}

async function getTaskRow(companyId: string, jobId: string, taskId: string, executor: SelectExecutor): Promise<JobTaskRow> {
  const [task] = await executor
    .select()
    .from(jobTasks)
    .where(and(eq(jobTasks.companyId, companyId), eq(jobTasks.jobId, jobId), eq(jobTasks.id, taskId), isNull(jobTasks.deletedAt)))
    .limit(1);

  if (!task) {
    throw new AppError(ErrorCode.NOT_FOUND, "Task not found");
  }

  return task;
}

async function listTaskRows(companyId: string, jobId: string, executor: SelectExecutor): Promise<JobTaskRow[]> {
  return executor
    .select()
    .from(jobTasks)
    .where(and(eq(jobTasks.companyId, companyId), eq(jobTasks.jobId, jobId), isNull(jobTasks.deletedAt)))
    .limit(MAX_RESULT_WINDOW);
}

async function getTechnicianRow(
  companyId: string,
  technicianId: string,
  executor: SelectExecutor
): Promise<TechnicianRow> {
  const [technician] = await executor
    .select()
    .from(technicians)
    .where(and(eq(technicians.companyId, companyId), eq(technicians.id, technicianId), isNull(technicians.deletedAt)))
    .limit(1);

  if (!technician) {
    throw new AppError(ErrorCode.NOT_FOUND, "Technician not found");
  }

  return technician;
}

async function assertTechnicianBelongsToCompany(
  companyId: string,
  assignedToId: string | null | undefined,
  executor: SelectExecutor
): Promise<void> {
  if (!assignedToId) {
    return;
  }

  await getTechnicianRow(companyId, assignedToId, executor);
}

async function emitTaskCompletedEvent(
  executor: TransactionExecutor,
  job: JobRow,
  task: JobTaskRow,
  actorId?: string
): Promise<void> {
  const actor = actorId ? await getActor(job.companyId, actorId, executor) : null;

  await emitEventWithExecutor(executor, {
    companyId: job.companyId,
    eventType: "job.task_completed",
    ...(actorId ? { actorId } : {}),
    ...(actor ? { actorName: buildActorName(actor.firstName, actor.lastName) } : {}),
    entityType: "job",
    entityId: job.id,
    customerId: job.customerId,
    jobId: job.id,
    payload: {
      taskId: task.id,
      title: task.title
    },
    summary: `Completed task ${task.title}`
  });
}

function sortTasks(rows: JobTaskRow[]): JobTaskRow[] {
  return [...rows].sort((left, right) => {
    const leftSortOrder = left.sortOrder ?? 0;
    const rightSortOrder = right.sortOrder ?? 0;

    if (leftSortOrder !== rightSortOrder) {
      return leftSortOrder - rightSortOrder;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  });
}

export async function listTasks(companyId: string, jobId: string): Promise<JobTask[]> {
  await getJobRow(companyId, jobId, db);
  const rows = await listTaskRows(companyId, jobId, db);
  return sortTasks(rows).map((row) => toJobTask(row));
}

export async function createTask(companyId: string, jobId: string, input: CreateTaskInput): Promise<JobTask> {
  const normalizedInput = normalizeCreateTaskInput(input);

  return db.transaction(async (tx) => {
    await getJobRow(companyId, jobId, tx);
    await assertTechnicianBelongsToCompany(companyId, normalizedInput.assignedToId, tx);
    const existingTasks = await listTaskRows(companyId, jobId, tx);
    const nextSortOrder =
      normalizedInput.sortOrder ??
      existingTasks.reduce((highestSortOrder, task) => Math.max(highestSortOrder, task.sortOrder ?? 0), -1) + 1;
    const [task] = await tx
      .insert(jobTasks)
      .values({
        companyId,
        jobId,
        assignedToId: normalizedInput.assignedToId ?? null,
        title: normalizedInput.title,
        description: normalizedInput.description,
        status: "pending",
        isRequired: normalizedInput.isRequired,
        estimatedMinutes: normalizedInput.estimatedMinutes,
        actualMinutes: normalizedInput.actualMinutes,
        sortOrder: nextSortOrder,
        notes: normalizedInput.notes
      })
      .returning();

    if (!task) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create task");
    }

    return toJobTask(task);
  });
}

export async function updateTask(
  companyId: string,
  jobId: string,
  taskId: string,
  input: UpdateTaskInput
): Promise<JobTask> {
  return db.transaction((tx) => updateTaskInTransaction(tx, companyId, jobId, taskId, input));
}

export async function updateTaskInTransaction(
  executor: TransactionExecutor,
  companyId: string,
  jobId: string,
  taskId: string,
  input: UpdateTaskInput
): Promise<JobTask> {
  const normalizedInput = normalizeUpdateTaskInput(input);
  const job = await getJobRow(companyId, jobId, executor);
  const existingTask = await getTaskRow(companyId, jobId, taskId, executor);
  await assertTechnicianBelongsToCompany(companyId, normalizedInput.assignedToId, executor);

  const nextStatus = normalizedInput.status ?? existingTask.status;
  const shouldMarkCompleted = existingTask.status !== "completed" && nextStatus === "completed";
  const [task] = await executor
    .update(jobTasks)
    .set({
      ...(normalizedInput.assignedToId !== undefined ? { assignedToId: normalizedInput.assignedToId } : {}),
      ...(normalizedInput.title !== undefined ? { title: normalizedInput.title } : {}),
      ...(normalizedInput.description !== undefined ? { description: normalizedInput.description } : {}),
      ...(normalizedInput.status !== undefined ? { status: normalizedInput.status } : {}),
      ...(normalizedInput.isRequired !== undefined ? { isRequired: normalizedInput.isRequired } : {}),
      ...(normalizedInput.estimatedMinutes !== undefined ? { estimatedMinutes: normalizedInput.estimatedMinutes } : {}),
      ...(normalizedInput.actualMinutes !== undefined ? { actualMinutes: normalizedInput.actualMinutes } : {}),
      ...(normalizedInput.sortOrder !== undefined ? { sortOrder: normalizedInput.sortOrder } : {}),
      ...(normalizedInput.notes !== undefined ? { notes: normalizedInput.notes } : {}),
      ...(normalizedInput.status !== undefined
        ? normalizedInput.status === "completed"
          ? { completedAt: existingTask.completedAt ?? new Date() }
          : { completedAt: null, completedById: null }
        : {}),
      updatedAt: new Date()
    })
    .where(
      and(
        eq(jobTasks.companyId, companyId),
        eq(jobTasks.jobId, jobId),
        eq(jobTasks.id, taskId),
        isNull(jobTasks.deletedAt)
      )
    )
    .returning();

  if (!task) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to update task");
  }

  if (shouldMarkCompleted) {
    await emitTaskCompletedEvent(executor, job, task);
  }

  return toJobTask(task);
}

export async function completeTask(
  companyId: string,
  jobId: string,
  taskId: string,
  actorId: string
): Promise<JobTask> {
  return db.transaction(async (tx) => {
    const job = await getJobRow(companyId, jobId, tx);
    await getActor(companyId, actorId, tx);
    const existingTask = await getTaskRow(companyId, jobId, taskId, tx);
    const [task] = await tx
      .update(jobTasks)
      .set({
        status: "completed",
        completedAt: existingTask.completedAt ?? new Date(),
        completedById: actorId,
        updatedAt: new Date()
      })
      .where(and(eq(jobTasks.companyId, companyId), eq(jobTasks.jobId, jobId), eq(jobTasks.id, taskId), isNull(jobTasks.deletedAt)))
      .returning();

    if (!task) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to complete task");
    }

    await emitTaskCompletedEvent(tx, job, task, actorId);

    return toJobTask(task);
  });
}

export async function deleteTask(companyId: string, jobId: string, taskId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await getJobRow(companyId, jobId, tx);
    await getTaskRow(companyId, jobId, taskId, tx);
    await tx
      .update(jobTasks)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(jobTasks.companyId, companyId), eq(jobTasks.jobId, jobId), eq(jobTasks.id, taskId), isNull(jobTasks.deletedAt)));
  });
}

export async function reorderTasks(companyId: string, jobId: string, orderedIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    await getJobRow(companyId, jobId, tx);
    const tasks = await listTaskRows(companyId, jobId, tx);
    const activeTasks = sortTasks(tasks);

    if (activeTasks.length !== orderedIds.length) {
      throw new AppError(ErrorCode.CONFLICT, "Task reorder list does not match active tasks");
    }

    const activeTaskIds = new Set(activeTasks.map((task) => task.id));

    for (const orderedId of orderedIds) {
      if (!activeTaskIds.has(orderedId)) {
        throw new AppError(ErrorCode.CONFLICT, "Task reorder list contains unknown task ids");
      }
    }

    for (const [index, orderedId] of orderedIds.entries()) {
      await tx
        .update(jobTasks)
        .set({
          sortOrder: index,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(jobTasks.companyId, companyId),
            eq(jobTasks.jobId, jobId),
            eq(jobTasks.id, orderedId),
            isNull(jobTasks.deletedAt)
          )
        );
    }
  });
}
