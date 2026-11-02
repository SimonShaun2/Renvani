"use server";

import { runIntake, type IntakeResult } from "@/src/lib/marketing-intake";

export async function submitDemoRequest(_prev: IntakeResult | null, fd: FormData): Promise<IntakeResult> {
  return runIntake("demo-requests", fd);
}
