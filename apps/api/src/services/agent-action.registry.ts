import { AppError, ErrorCode, type OperatorInboxRiskLevel } from "@fsm/types";

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
  /** Operator inbox risk badge (default "low"). */
  risk?: OperatorInboxRiskLevel;
  /** Operator inbox consequence lines (default: generic policy line). */
  consequences?: string[];
  /** ai_recommendations.type this kind is proposed from (Revenue Agent proposals). */
  fromRecommendationType?: string;
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
  {
    actionType: "message.draft",
    agentProduct: "revenue",
    autoApproved: true,
    editable: true,
    risk: "medium",
    consequences: ["Saves a draft proposal for later review; nothing is sent to the customer."]
  },
  {
    actionType: "message.send_proposed",
    agentProduct: "revenue",
    aiMayPropose: true,
    editable: true,
    risk: "high",
    consequences: [
      "Records an execution receipt in the audit trail (no live provider send in this slice).",
      "Uses the operator-approved message body only at execute time.",
      "Customer consent and policy checks remain enforced by the control plane."
    ]
  },
  {
    actionType: "revenue.inquiry.qualify",
    agentProduct: "revenue",
    aiMayPropose: true,
    risk: "medium",
    consequences: ["Updates inquiry qualification metadata for revenue workflows."]
  },
  { actionType: "loyalty.reminder.propose", agentProduct: "loyalty", aiMayPropose: true, risk: "medium" },
  { actionType: "service.job_brief.propose", agentProduct: "service", aiMayPropose: true },
  { actionType: "scheduling.booking.self_service", agentProduct: "scheduling", risk: "medium" }
] satisfies AgentActionTypeDefinition[]) {
  registerAgentActionType(definition);
}
