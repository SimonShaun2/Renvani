import { AppError, ErrorCode } from "@fsm/types";

/**
 * Agent-action type registry (FS-25 follow-up). New action types and agent products are added by
 * registering them here (or from an add-on module), not by editing policy/service if-chains.
 * Pure data + small callbacks: no DB, queue, or env imports so policy checks stay cheap to load.
 */
export type AgentActorType = "user" | "system" | "ai" | "customer";

export interface AgentActionTypeDefinition {
  actionType: string;
  /** Agent product that may create this action type. */
  agentProduct: string;
  /** Executes without a human approval step (e.g. read-only context resolution, drafts). */
  autoApproved?: boolean;
  /** AI may create the proposal even though execution needs approval. */
  aiMayPropose?: boolean;
  /** Operators may edit parameters while awaiting approval. */
  editable?: boolean;
}

export interface AgentProductDefinition {
  agentProduct: string;
  /** Throws POLICY_DENIED when the actor may not create `definition` for this product. */
  assertActorAllowed: (definition: AgentActionTypeDefinition, actorType: AgentActorType) => void;
}

const actionTypes = new Map<string, AgentActionTypeDefinition>();
const products = new Map<string, AgentProductDefinition>();

export function registerAgentActionType(definition: AgentActionTypeDefinition): void {
  actionTypes.set(definition.actionType, definition);
}

export function registerAgentProduct(definition: AgentProductDefinition): void {
  products.set(definition.agentProduct, definition);
}

export function getAgentActionTypeDefinition(actionType: string): AgentActionTypeDefinition | undefined {
  return actionTypes.get(actionType);
}

export function getAgentProductDefinition(agentProduct: string): AgentProductDefinition | undefined {
  return products.get(agentProduct);
}

function deny(message: string): never {
  throw new AppError(ErrorCode.POLICY_DENIED, message);
}

// ── Built-in products (behavior identical to the previous if-chain in agent-action.policy.ts) ──

registerAgentProduct({
  agentProduct: "revenue",
  assertActorAllowed: (definition, actorType) => {
    if (actorType !== "ai" || definition.aiMayPropose || definition.autoApproved) return;
    deny("AI actor cannot perform this action without human approval");
  }
});

registerAgentProduct({
  agentProduct: "loyalty",
  assertActorAllowed: (_definition, actorType) => {
    if (actorType === "ai") return;
    deny("Only AI may propose loyalty reminder actions in v1");
  }
});

registerAgentProduct({
  agentProduct: "service",
  assertActorAllowed: (_definition, actorType) => {
    if (actorType === "ai" || actorType === "system") return;
    deny("Only automated service agents may propose job brief actions in v1");
  }
});

registerAgentProduct({
  agentProduct: "scheduling",
  assertActorAllowed: (_definition, actorType) => {
    if (actorType === "system" || actorType === "user") return;
    deny("Scheduling self-service notices require a system actor");
  }
});

// ── Built-in action types ──

for (const definition of [
  { actionType: "context.resolve", agentProduct: "revenue", autoApproved: true },
  { actionType: "message.draft", agentProduct: "revenue", autoApproved: true, editable: true },
  { actionType: "message.send_proposed", agentProduct: "revenue", aiMayPropose: true, editable: true },
  { actionType: "revenue.inquiry.qualify", agentProduct: "revenue", aiMayPropose: true },
  { actionType: "loyalty.reminder.propose", agentProduct: "loyalty", aiMayPropose: true },
  { actionType: "service.job_brief.propose", agentProduct: "service", aiMayPropose: true },
  { actionType: "scheduling.booking.self_service", agentProduct: "scheduling" }
] satisfies AgentActionTypeDefinition[]) {
  registerAgentActionType(definition);
}
