import { z } from "zod";

export const AGENT_TOOL_NAMES_V1 = [
  "context.resolve",
  "message.draft",
  "message.send_proposed",
  "loyalty.reminder.propose",
  "service.job_brief.propose"
] as const;

export const AgentToolNameV1Schema = z.enum(AGENT_TOOL_NAMES_V1);

export type AgentToolNameV1 = z.infer<typeof AgentToolNameV1Schema>;
