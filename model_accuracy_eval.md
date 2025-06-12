# Model Accuracy Evaluation

## Purpose
Tracks how well the LLM agrees with human-labeled signals over time. This powers both training and trust in automated signal handling.

## Table: `ModelEvalResult`
```prisma
model ModelEvalResult {
  id             String   @id @default(uuid())
  date           DateTime @default(now())
  totalTested    Int
  truePositive   Int
  trueNegative   Int
  falsePositive  Int
  falseNegative  Int
  modelVersion   String   // e.g. mistral-7b-instruct-v0.2
  notes          String?
}
```

## Logic
Compare entries in:
- `ModelLog` (raw predictions)
- `ManualLabel` (ground truth labels)

...by matching `messageId`. Each message with both entries is considered a test case.

### Class Definitions
| Label      | Condition |
|------------|-----------|
| True Pos   | LLM says `BUY/SELL`, human agrees |
| True Neg   | LLM says not a trade, human agrees |
| False Pos  | LLM says trade, human says no |
| False Neg  | LLM says no trade, human says yes |

## Endpoint: `/api/analysis-metrics`
- Method: `GET`
- Response:
```json
{
  "date": "2025-06-11",
  "modelVersion": "mistral-7b-instruct-v0.2",
  "truePositive": 183,
  "falsePositive": 12,
  "trueNegative": 67,
  "falseNegative": 23,
  "accuracy": 0.88,
  "precision": 0.938,
  "recall": 0.888
}
```

## Nightly Job
Run this at midnight via your cron scheduler.
- Recompute daily metrics
- Store in `ModelEvalResult`
- Purge or archive old ones after 90 days

## Notes
- Only compare messages with both `ModelLog` and `ManualLabel`
- Add LLM version into the `ModelLog` table if not already present
- Use this to tune regex fallback, prompt templates, and model switching

