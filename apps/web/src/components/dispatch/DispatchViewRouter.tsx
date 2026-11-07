"use client";

import { useDispatchStore } from "@/src/stores/dispatch.store";
import { DispatchBoardClient } from "./DispatchBoardClient";
import { WeeklyDispatchBoard } from "./WeeklyDispatchBoard";

/** Keep the day board and its stream unmounted while the weekly read is active. */
export function DispatchViewRouter() {
  const viewMode = useDispatchStore((state) => state.viewMode);
  const setViewMode = useDispatchStore((state) => state.setViewMode);
  return viewMode === "week"
    ? <WeeklyDispatchBoard onDayView={() => setViewMode("day")} />
    : <DispatchBoardClient />;
}
