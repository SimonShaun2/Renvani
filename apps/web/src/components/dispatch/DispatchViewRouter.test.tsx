// @vitest-environment happy-dom
import { useEffect } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useDispatchStore } from "@/src/stores/dispatch.store";
const calls = vi.hoisted(() => ({ dayStart: vi.fn(), dayStop: vi.fn(), weekStart: vi.fn(), weekStop: vi.fn() }));
vi.mock("./DispatchBoardClient", () => ({ DispatchBoardClient: () => {
  useEffect(() => { calls.dayStart(); return calls.dayStop; }, []);
  return <div>Day board</div>;
} }));
vi.mock("./WeeklyDispatchBoard", () => ({ WeeklyDispatchBoard: ({ onDayView }: { onDayView: () => void }) => {
  useEffect(() => { calls.weekStart(); return calls.weekStop; }, []);
  return <button type="button" onClick={onDayView}>Day view</button>;
} }));
import { DispatchViewRouter } from "./DispatchViewRouter";
beforeEach(() => { vi.clearAllMocks(); useDispatchStore.setState({ viewMode: "day" }); });
afterEach(cleanup);
it("unmounts the daily stream owner before mounting the weekly read, and reverses cleanly", () => {
  render(<DispatchViewRouter />);
  expect(calls.dayStart).toHaveBeenCalledOnce();
  expect(calls.weekStart).not.toHaveBeenCalled();
  act(() => useDispatchStore.getState().setViewMode("week"));
  expect(calls.dayStop).toHaveBeenCalledOnce();
  expect(screen.queryByText("Day board")).toBeNull();
  expect(calls.weekStart).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Day view" }));
  expect(calls.weekStop).toHaveBeenCalledOnce();
  expect(calls.dayStart).toHaveBeenCalledTimes(2);
});
it("does not mount a day board when opening directly in week mode", () => {
  useDispatchStore.setState({ viewMode: "week" });
  render(<DispatchViewRouter />);
  expect(calls.dayStart).not.toHaveBeenCalled();
  expect(calls.weekStart).toHaveBeenCalledOnce();
});
