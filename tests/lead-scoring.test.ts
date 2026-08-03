import { describe, expect, it } from "vitest";
import { scoreLeadAnswers } from "../src/services/lead-scoring.js";

describe("scoreLeadAnswers", () => {
  it("scores a qualified lead at or above threshold", () => {
    const result = scoreLeadAnswers([
      { question_key: "urgency_level", answer_value: "high" },
      { question_key: "has_insurance", answer_value: "yes" },
      { question_key: "reason_for_visit", answer_value: "Tooth pain" },
      { question_key: "new_or_existing_patient", answer_value: "existing" },
    ]);
    expect(result.score).toBeGreaterThanOrEqual(5);
    expect(result.qualification_status).toBe("qualified");
    expect(result.next_action).toBe("book");
  });

  it("marks incomplete when required fields missing", () => {
    const result = scoreLeadAnswers([
      { question_key: "urgency_level", answer_value: "low" },
    ]);
    expect(result.qualification_status).toBe("incomplete");
  });

  it("routes emergency to transfer", () => {
    const result = scoreLeadAnswers([
      { question_key: "urgency_level", answer_value: "emergency" },
      { question_key: "has_insurance", answer_value: "no" },
      { question_key: "reason_for_visit", answer_value: "Severe swelling" },
      { question_key: "new_or_existing_patient", answer_value: "new" },
    ]);
    expect(result.next_action).toBe("transfer");
  });
});
