import { QUESTION_BANK, type InputType } from "@/lib/questions";

export type Language = "en" | "es";

export type QuestionResponse = {
  question_id: string;
  question_text: string;
  helper_text: string | null;
  layer_badge: string;
  step_current: number;
  step_total: number;
  field: string;
  input_type: InputType;
  options: { value: string; label: string }[] | null;
  offer_early_completion: boolean;
};

export function selectNextQuestionStatic(input: {
  answers_so_far: Record<string, unknown>;
  questions_shown: string[];
  language: Language;
}): QuestionResponse | { done: true } {
  const { answers_so_far, questions_shown, language } = input;

  const effectiveBank = QUESTION_BANK.filter((q) => shouldAsk(q, answers_so_far));
  const remaining = effectiveBank.filter((q) => !questions_shown.includes(q.id));
  if (remaining.length === 0) return { done: true };

  const next = remaining[0];
  if (!next) return { done: true };

  const industryRaw = String(answers_so_far.industry ?? "");
  const industryOtherDetails =
    typeof answers_so_far.industry_other_details === "string" ? answers_so_far.industry_other_details.trim() : "";
  const industry = industryRaw === "other" && industryOtherDetails ? industryOtherDetails : industryRaw;
  const vars = {
    industry,
    team_size: String(answers_so_far.team_size ?? ""),
    revenue_range: String(answers_so_far.revenue_range ?? ""),
  };
  const baseText = language === "en" ? next.en : next.es;
  const helperBase = language === "en" ? next.helperEn : next.helperEs;
  const questionText = personalize(baseText, vars);
  const helperText = helperBase ? personalize(helperBase, vars) : null;
  const stepTotal = effectiveBank.length;
  const stepCurrent = Math.max(1, effectiveBank.findIndex((q) => q.id === next.id) + 1);

  return {
    question_id: next.id,
    question_text: questionText,
    helper_text: helperText,
    layer_badge: language === "en" ? next.layerEn : next.layerEs,
    step_current: stepCurrent,
    step_total: stepTotal,
    field: next.field,
    input_type: next.inputType,
    options:
      next.options?.map((o) => ({ value: o.value, label: language === "en" ? o.labelEn : o.labelEs })) ??
      null,
    offer_early_completion: false,
  };
}

export async function selectNextQuestionAI(input: {
  answers_so_far: Record<string, unknown>;
  questions_shown: string[];
  language: Language;
}): Promise<QuestionResponse | { done: true }> {
  return selectNextQuestionStatic(input);
}

function shouldAsk(q: (typeof QUESTION_BANK)[number], answers: Record<string, unknown>): boolean {
  if (q.field === "industry_other_details") return String(answers.industry ?? "") === "other";
  return true;
}

function personalize(text: string, vars: { industry: string; team_size: string; revenue_range: string }): string {
  return text
    .replaceAll("{industry}", vars.industry || "your")
    .replaceAll("{team_size}", vars.team_size || "your")
    .replaceAll("{revenue_range}", vars.revenue_range || "your");
}
