import type { Scorer, ScoreResult } from "./Scorer.js";

export class ScorerNotEnabledError extends Error {
  constructor(message = "AI scoring is not enabled.") {
    super(message);
    this.name = "ScorerNotEnabledError";
  }
}

// The AI scorer slot exists, but it is OFF. It stays a stub until a tenant switches AI
// scoring on and buys tokens (a later ticket). Even with the tenant setting on, this
// stub still refuses to run.
export class AiScorer implements Scorer {
  readonly name = "ai" as const;

  async score(): Promise<ScoreResult> {
    throw new ScorerNotEnabledError("AI scoring is not enabled.");
  }
}