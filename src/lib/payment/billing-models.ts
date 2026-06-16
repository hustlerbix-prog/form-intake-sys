export type BillingModelId =
  | "usage_prepaid"
  | "usage_postpaid"
  | "usage_payg"
  | "one_shot"
  | "pool";

export interface BillingModelOption {
  id: BillingModelId;
  label: string;
  description: string;
  bestFor: string;
  applicableTo: string[];
}

export const BILLING_MODEL_OPTIONS: BillingModelOption[] = [
  {
    id: "usage_prepaid",
    label: "Usage-Based · Prepaid",
    description: "Load credit in advance. Agent deducts per token or minute used.",
    bestFor: "SMBs wanting cost certainty",
    applicableTo: ["CB-01", "AVA-01", "CA-01"],
  },
  {
    id: "usage_postpaid",
    label: "Usage-Based · Postpaid",
    description: "Run now, invoice at end of billing cycle. Set a spending cap.",
    bestFor: "Agency-managed enterprise deployments",
    applicableTo: ["CB-01", "AVA-01", "CA-01"],
  },
  {
    id: "usage_payg",
    label: "Pay-as-You-Go",
    description: "No minimum. Charged per API call or voice minute in real time.",
    bestFor: "Pilots and low-volume deployments",
    applicableTo: ["CB-01", "AVA-01", "CA-01"],
  },
  {
    id: "one_shot",
    label: "One-Shot Payment",
    description: "Single payment at catalog price. No recurring commitment.",
    bestFor: "Fixed-scope implementations and consultancy",
    applicableTo: ["IS-001", "CS-001", "CB-01"],
  },
  {
    id: "pool",
    label: "Subscription Pool",
    description: "Monthly/annual bundle of tokens + minutes shared across all your agents.",
    bestFor: "Multi-agent deployments",
    applicableTo: ["CB-01", "AVA-01", "CA-01"],
  },
];

export function getModelsForProduct(productId: string): BillingModelOption[] {
  return BILLING_MODEL_OPTIONS.filter((m) => m.applicableTo.includes(productId));
}
