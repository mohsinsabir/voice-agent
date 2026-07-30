# Lead Qualification Rubric

Server-side scoring only — never trust an LLM-computed score. Used by `saveLeadQualification`.

## Questions (`question_key`)

| Key | Prompt (agent asks) | Valid answers (normalized) |
|---|---|---|
| `insurance_provider` | Do you have dental insurance, and with whom? | free text; empty → invalid |
| `has_insurance` | (derived or asked) Do you currently have coverage? | `yes` / `no` |
| `urgency_level` | How soon do you need to be seen? | `low` / `medium` / `high` / `emergency` |
| `reason_for_visit` | What brings you in? | free text; min 3 chars |
| `new_or_existing_patient` | Are you a new or existing patient? | `new` / `existing` |
| `preferred_callback` | If we can't book now, what's the best number/time to reach you? | free text or E.164 |

Unknown `question_key` values are rejected (`INVALID_QUESTION_KEY`). Partial sets are stored with `qualification_status = incomplete`.

## Scoring

| Condition | Points |
|---|---:|
| `urgency_level = high` | +3 |
| `urgency_level = emergency` | +4 (also triggers handoff path in prompts) |
| `urgency_level = medium` | +1 |
| `has_insurance = yes` | +2 |
| `new_or_existing_patient = existing` | +1 |
| `reason_for_visit` valid | +1 |

**Threshold:** `score >= 5` → `qualification_status = qualified`, else `unqualified` (if all required answered) or `incomplete`.

## `next_action` mapping

| Status / signals | `next_action` |
|---|---|
| Qualified and willing to book | `book` |
| Emergency urgency or explicit request for person | `transfer` |
| Qualified but no slot / not ready | `callback` |
| Incomplete or soft no | `follow_up` |
| Unqualified | `none` |

Required for a non-`incomplete` status: `urgency_level`, `reason_for_visit`, `new_or_existing_patient`, and either `has_insurance` or `insurance_provider`.
