import { z } from "zod";

const VALID_KEYS = new Set([
  "insurance_provider",
  "has_insurance",
  "urgency_level",
  "reason_for_visit",
  "new_or_existing_patient",
  "preferred_callback",
]);

const AnswerSchema = z.object({
  question_key: z.string(),
  answer_value: z.string(),
});

export type LeadAnswer = z.infer<typeof AnswerSchema>;

export type LeadScoreResult = {
  score: number;
  qualification_status: "qualified" | "unqualified" | "incomplete" | "needs_review";
  next_action: "book" | "transfer" | "callback" | "follow_up" | "none";
  answers: Array<LeadAnswer & { valid: boolean }>;
  invalid_keys: string[];
};

function norm(value: string): string {
  return value.trim().toLowerCase();
}

export function scoreLeadAnswers(rawAnswers: unknown): LeadScoreResult {
  const parsed = z.array(AnswerSchema).safeParse(rawAnswers);
  if (!parsed.success) {
    return {
      score: 0,
      qualification_status: "incomplete",
      next_action: "follow_up",
      answers: [],
      invalid_keys: ["_payload"],
    };
  }

  const invalid_keys: string[] = [];
  const answers: Array<LeadAnswer & { valid: boolean }> = [];
  const map = new Map<string, string>();

  for (const a of parsed.data) {
    if (!VALID_KEYS.has(a.question_key)) {
      invalid_keys.push(a.question_key);
      answers.push({ ...a, valid: false });
      continue;
    }
    const valid = a.answer_value.trim().length > 0;
    answers.push({ ...a, valid });
    if (valid) map.set(a.question_key, a.answer_value);
  }

  if (invalid_keys.length > 0 && map.size === 0) {
    return {
      score: 0,
      qualification_status: "incomplete",
      next_action: "follow_up",
      answers,
      invalid_keys,
    };
  }

  let score = 0;
  const urgency = norm(map.get("urgency_level") ?? "");
  if (urgency === "emergency") score += 4;
  else if (urgency === "high") score += 3;
  else if (urgency === "medium") score += 1;

  const hasInsurance = norm(map.get("has_insurance") ?? "");
  const insuranceProvider = map.get("insurance_provider");
  if (hasInsurance === "yes" || (insuranceProvider && insuranceProvider.trim().length > 0)) {
    score += 2;
  }

  const patient = norm(map.get("new_or_existing_patient") ?? "");
  if (patient === "existing") score += 1;

  const reason = map.get("reason_for_visit") ?? "";
  if (reason.trim().length >= 3) score += 1;

  const requiredPresent =
    map.has("urgency_level") &&
    map.has("reason_for_visit") &&
    map.has("new_or_existing_patient") &&
    (map.has("has_insurance") || map.has("insurance_provider"));

  let qualification_status: LeadScoreResult["qualification_status"] = "incomplete";
  if (requiredPresent) {
    qualification_status = score >= 5 ? "qualified" : "unqualified";
  }

  let next_action: LeadScoreResult["next_action"] = "follow_up";
  if (urgency === "emergency") next_action = "transfer";
  else if (qualification_status === "qualified") next_action = "book";
  else if (qualification_status === "unqualified") next_action = "none";
  else if (!requiredPresent) next_action = "follow_up";

  return { score, qualification_status, next_action, answers, invalid_keys };
}
