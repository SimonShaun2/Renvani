import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";

import {
  JOB_SERVICE_BRIEF_CONTRACT_VERSION,
  type JobServiceBriefV1,
  ServiceJobBriefProposeParamsV1Schema
} from "@fsm/types";

import { db } from "./client.js";
import {
  jobNotes,
  jobTasks,
  jobs,
  properties
} from "./schema.js";

export async function assembleJobServiceBriefDraft(
  companyId: string,
  jobId: string
): Promise<JobServiceBriefV1 | null> {
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.companyId, companyId), eq(jobs.id, jobId), isNull(jobs.deletedAt)))
    .limit(1);

  if (!job) {
    return null;
  }

  const sections: JobServiceBriefV1["sections"] = [];

  if (job.description?.trim()) {
    sections.push({
      id: randomUUID(),
      title: "Job description",
      body: job.description.trim(),
      sourceKind: "customer_supplied"
    });
  }

  if (job.propertyId) {
    const [property] = await db
      .select({
        accessNotes: properties.accessNotes,
        notes: properties.notes,
        addressLine1: properties.addressLine1,
        city: properties.city
      })
      .from(properties)
      .where(
        and(
          eq(properties.companyId, companyId),
          eq(properties.id, job.propertyId),
          isNull(properties.deletedAt)
        )
      )
      .limit(1);

    if (property?.accessNotes?.trim()) {
      sections.push({
        id: randomUUID(),
        title: "Site access instructions",
        body: property.accessNotes.trim(),
        sourceKind: "customer_supplied"
      });
    }

    if (property?.notes?.trim()) {
      sections.push({
        id: randomUUID(),
        title: "Property notes",
        body: property.notes.trim(),
        sourceKind: "customer_supplied"
      });
    }
  }

  const tasks = await db
    .select()
    .from(jobTasks)
    .where(
      and(eq(jobTasks.companyId, companyId), eq(jobTasks.jobId, jobId), isNull(jobTasks.deletedAt))
    )
    .orderBy(asc(jobTasks.sortOrder));

  if (tasks.length > 0) {
    const lines = tasks.map((task) => {
      const required = task.isRequired ? " (required)" : "";
      const status = task.status === "completed" ? "done" : task.status;
      return `- ${task.title}${required} — ${status}`;
    });
    sections.push({
      id: randomUUID(),
      title: "Checklist",
      body: lines.join("\n"),
      sourceKind: "business_policy",
      policyRef: "job_tasks"
    });
  }

  const notes = await db
    .select()
    .from(jobNotes)
    .where(
      and(eq(jobNotes.companyId, companyId), eq(jobNotes.jobId, jobId), isNull(jobNotes.deletedAt))
    )
    .orderBy(desc(jobNotes.createdAt))
    .limit(20);

  const importedNotes = notes.filter((note) => note.importSessionId !== null);
  if (importedNotes.length > 0) {
    sections.push({
      id: randomUUID(),
      title: "Imported notes",
      body: importedNotes.map((note) => note.content.trim()).join("\n\n---\n\n"),
      sourceKind: "imported_history"
    });
  }

  const priorImportedJobs = await db
    .select({
      jobNumber: jobs.jobNumber,
      title: jobs.title,
      completionNotes: jobs.completionNotes
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.companyId, companyId),
        eq(jobs.customerId, job.customerId),
        isNotNull(jobs.importSessionId),
        isNull(jobs.deletedAt)
      )
    )
    .orderBy(desc(jobs.actualEnd), desc(jobs.scheduledStart))
    .limit(5);

  const historyLines = priorImportedJobs
    .filter((row) => row.completionNotes?.trim())
    .map((row) => `${row.jobNumber}: ${row.title} — ${row.completionNotes?.trim()}`);

  if (historyLines.length > 0) {
    sections.push({
      id: randomUUID(),
      title: "Imported job history",
      body: historyLines.join("\n"),
      sourceKind: "imported_history"
    });
  }

  const requiredPending = tasks.filter(
    (task) => task.isRequired && task.status !== "completed"
  ).length;

  const brief: JobServiceBriefV1 = {
    contractVersion: JOB_SERVICE_BRIEF_CONTRACT_VERSION,
    jobId: job.id,
    companyId: job.companyId,
    resourceVersion: job.updatedAt.toISOString(),
    sections,
    checklistSummary: {
      total: tasks.length,
      requiredPending
    }
  };

  return brief;
}

export function buildServiceJobBriefProposalParameters(
  brief: JobServiceBriefV1
): { summary: string; brief: JobServiceBriefV1 } {
  const summary =
    brief.sections.length === 0
      ? "Empty job brief — review before field dispatch"
      : `Job brief with ${brief.sections.length} section(s); ${brief.checklistSummary.requiredPending} required task(s) pending`;

  return ServiceJobBriefProposeParamsV1Schema.parse({ brief, summary });
}
