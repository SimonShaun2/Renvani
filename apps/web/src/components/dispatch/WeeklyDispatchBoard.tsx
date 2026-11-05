"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { DispatchWeekJob, DispatchWeekResponse } from "@fsm/types";
import { useDispatchWeek } from "@/src/hooks/dispatch-week.hooks";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { ApiError } from "@/src/lib/api";
import {
  formatWeekDate,
  formatWeeklyJobTime,
  weeklyJobContinuation,
} from "./weekly-dispatch.utils";
import styles from "./weekly-dispatch.module.css";

function WeeklyJobCard({
  job,
  day,
  timezone,
}: {
  job: DispatchWeekJob;
  day: DispatchWeekResponse["days"][number];
  timezone: string;
}) {
  const assignment =
    job.assignmentState === "inactive"
      ? `${job.technicianName ?? "Technician"} (inactive)`
      : job.assignmentState === "unassigned"
        ? "Unassigned"
        : job.assignmentState === "unavailable"
          ? "Assignment unavailable"
          : (job.technicianName ?? "Technician unavailable");
  return (
    <Link
      href={`/jobs/${job.id}`}
      className={styles.job}
      aria-label={`View ${job.jobNumber}: ${job.title}, ${formatWeekDate(day.date)}`}
    >
      <span className={styles.time}>{formatWeeklyJobTime(job, timezone)}</span>
      <span className={styles.jobTitle}>{job.title}</span>
      <span className={styles.customer}>
        {job.customerName ?? "Customer unavailable"}
      </span>
      <span className={styles.assignment}>
        {assignment} · {job.status.replaceAll("_", " ")}
      </span>
      <span className={styles.continuation}>
        {weeklyJobContinuation(job, day)}
      </span>
    </Link>
  );
}

/** Figma 604:10228 desktop, 604:10293 tablet, 604:10361 mobile; read-only. */
export function WeeklyDispatchBoard({ onDayView }: { onDayView: () => void }) {
  const [date, setDate] = useState<string | undefined>();
  const [technician, setTechnician] = useState("all");
  const [options, setOptions] = useState<DispatchWeekResponse["technicians"]>(
    [],
  );
  const query = useDispatchWeek({ technician, ...(date ? { date } : {}) });
  const data = query.isError ? undefined : query.data;
  const unavailable = query.isError || (!query.isLoading && !data);
  useEffect(() => {
    if (data) setOptions(data.technicians);
  }, [data]);
  const jobsById = useMemo(
    () => new Map(data?.jobs.map((job) => [job.id, job]) ?? []),
    [data],
  );
  const spanning = useMemo(() => {
    const occurrences = new Map<string, number>();
    for (const day of data?.days ?? [])
      for (const id of day.jobIds)
        occurrences.set(id, (occurrences.get(id) ?? 0) + 1);
    return [...occurrences.values()].filter((count) => count > 1).length;
  }, [data]);
  const errorHint =
    query.error instanceof ApiError && query.error.status === 400
      ? query.error.message
      : "Retry to check the current schedule. Old results are not shown.";
  return (
    <section
      className={styles.root}
      aria-label="Weekly dispatch"
      data-testid="weekly-dispatch"
    >
      <header className={styles.heading}>
        <h1>Weekly dispatch</h1>
        <p>
          {data
            ? `${formatWeekDate(data.weekStart, { month: "short", day: "numeric" })}–${formatWeekDate(data.weekEnd, { month: "short", day: "numeric", year: "numeric" })} · ${data.timezone}`
            : query.isLoading
              ? "Loading the weekly schedule…"
              : "Schedule unavailable"}
        </p>
      </header>
      <div className={styles.controls}>
        <div className={styles.navigation} aria-label="Week navigation">
          <button
            type="button"
            className={styles.button}
            disabled={!data || query.isFetching}
            onClick={() => data && setDate(data.previousWeek)}
          >
            Previous
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              if (date === undefined) void query.refetch();
              else setDate(undefined);
            }}
          >
            Today
          </button>
          <button
            type="button"
            className={styles.button}
            disabled={!data || query.isFetching}
            onClick={() => data && setDate(data.nextWeek)}
          >
            Next
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.desktopDay}`}
            onClick={onDayView}
          >
            Day view
          </button>
        </div>
        <div className={styles.filters}>
          <label className="sr-only" htmlFor="weekly-technician">
            Technician
          </label>
          <select
            id="weekly-technician"
            className={styles.select}
            value={technician}
            onChange={(event) => setTechnician(event.target.value)}
          >
            <option value="all">All technicians</option>
            <option value="unassigned">Unassigned</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
                {option.status === "inactive" ? " (inactive)" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.button}
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {query.isFetching && !query.isLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <button
          type="button"
          className={`${styles.button} ${styles.mobileDay}`}
          onClick={onDayView}
        >
          Day view
        </button>
      </div>
      <p className={styles.notice}>
        Read-only weekly view. Open a job to review its details.
      </p>
      {query.isLoading ? (
        <div
          className={styles.grid}
          role="status"
          aria-label="Loading weekly schedule"
        >
          {Array.from({ length: 7 }, (_, i) => (
            <SkeletonCard key={i} className="h-[180px]" />
          ))}
        </div>
      ) : unavailable ? (
        <div className={styles.error} role="alert">
          <h2>Weekly schedule could not be loaded</h2>
          <p>{errorHint}</p>
          <button
            type="button"
            className={styles.button}
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Retry
          </button>
        </div>
      ) : data ? (
        <>
          <p className={styles.count} role="status">
            {data.uniqueJobCount} {data.uniqueJobCount === 1 ? "job" : "jobs"}{" "}
            this week
            {spanning
              ? ` · ${spanning} ${spanning === 1 ? "spans" : "span"} multiple days`
              : ""}
          </p>
          <div className={styles.grid}>
            {data.days.map((day) => (
              <section
                key={day.date}
                className={styles.day}
                aria-label={formatWeekDate(day.date, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              >
                <h2 className={styles.dayHeading}>
                  <time dateTime={day.date}>{formatWeekDate(day.date)}</time>
                </h2>
                {day.jobIds.length ? (
                  day.jobIds.map((id) => {
                    const job = jobsById.get(id);
                    return job ? (
                      <WeeklyJobCard
                        key={id}
                        job={job}
                        day={day}
                        timezone={data.timezone}
                      />
                    ) : (
                      <p key={id} className={styles.empty}>
                        Job unavailable. Refresh the schedule.
                      </p>
                    );
                  })
                ) : (
                  <p className={styles.empty}>No scheduled jobs</p>
                )}
              </section>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
