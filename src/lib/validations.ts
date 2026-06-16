import { z } from "zod";

export const LanguageSchema = z.enum(["en", "es"]);

export const SessionCreateSchema = z.object({
  language: LanguageSchema.default("en"),
  source_product_id: z.string().optional(),
  profile_id: z.string().uuid().optional(),
});

export const NextQuestionSchema = z.object({
  profile_id: z.string().uuid(),
  answers_so_far: z.record(z.string(), z.unknown()),
  questions_shown: z.array(z.string()),
  language: LanguageSchema,
});

export const AnswerSchema = z.object({
  profile_id: z.string().uuid(),
  field: z.enum([
    "industry",
    "team_size",
    "revenue_range",
    "core_ops",
    "top_time_cost",
    "existing_tools",
    "bottleneck",
    "decision_speed",
    "risk_areas",
    "budget_comfort",
    "success_definition",
    "data_situation",
    "urgency_flag",
    "prior_ai_experience",
    "website_url",
  ]),
  value: z.unknown(),
  question_id: z.string().optional(),
});

export const ProfileSubmitSchema = z.object({
  profile_id: z.string().uuid(),
  contact: z
    .object({
      email: z.string().email(),
      first_name: z.string().min(1).max(100),
      consent_marketing: z.boolean(),
    })
    .optional(),
  language: LanguageSchema,
});

export const RedoAnalysisSchema = z.object({
  profile_id: z.string().uuid(),
});
