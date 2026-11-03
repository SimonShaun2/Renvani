"use server";

import { runIntake, type IntakeResult } from "@/src/lib/marketing-intake";

export async function submitGrowthCheck(_prev: IntakeResult | null, fd: FormData): Promise<IntakeResult> {
  return runIntake("growth-checks", fd);
}
