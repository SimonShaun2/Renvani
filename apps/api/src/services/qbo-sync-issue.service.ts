import {
  listOpenQboSyncIssues,
  resolveQboSyncIssueRecord
} from "@fsm/db";

export { listOpenQboSyncIssues };

export async function resolveQboSyncIssue(input: {
  issueId: string;
  resolvedById: string;
}): Promise<void> {
  await resolveQboSyncIssueRecord(input);
}
