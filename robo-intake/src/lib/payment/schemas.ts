import { z } from "zod";

export const BillingModelSchema = z.enum([
  "usage_prepaid",
  "usage_postpaid",
  "usage_payg",
  "one_shot",
  "pool",
]);

export const ProcessorSchema = z.enum(["stripe", "mercadopago", "paypal", "bypass"]);

export const CreateOrderSchema = z.object({
  agentId: z.string().uuid(),
  productId: z.string().min(1),
  billingModel: BillingModelSchema,
  planDetails: z.record(z.string(), z.unknown()).optional().default({}),
  amountUsd: z.number().positive(),
  currency: z.string().length(3).default("USD"),
  billingCountry: z.string().length(2).optional(),
});

export const StripeSessionSchema = z.object({
  orderId: z.string().uuid(),
  agentId: z.string().uuid(),
  priceAmountCents: z.number().int().positive(),
  productName: z.string().min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export const StripeSubscriptionSchema = z.object({
  orderId: z.string().uuid(),
  customerId: z.string().min(1),
  stripePriceId: z.string().min(1),
});

export const MpPreferenceSchema = z.object({
  orderId: z.string().uuid(),
  agentId: z.string().uuid(),
  amount: z.number().positive(),
  productName: z.string().min(1),
  payerEmail: z.string().email(),
  billingCountry: z.string().length(2),
});

export const BraintreeSaleSchema = z.object({
  orderId: z.string().uuid(),
  nonce: z.string().min(1),
  amount: z.number().positive(),
});

export const BypassOrderSchema = z.object({
  orderId: z.string().uuid(),
  actorId: z.string().min(1),
});

export const PublishAgentSchema = z.object({
  actorId: z.string().min(1),
});
