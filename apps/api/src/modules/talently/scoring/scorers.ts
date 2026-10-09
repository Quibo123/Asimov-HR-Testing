import { AiScorer, ScorerNotEnabledError } from "./AiScorer.js";
import { FormScorer } from "./FormScorer.js";
import type { Scorer } from "./Scorer.js";

export type ScoringMethodName = "form" | "ai" | "both";

const formScorer = new FormScorer();
const aiScorer = new AiScorer();

// The AI scorer is only returned when the tenant has switched AI scoring on.
// With "both" and AI off, only the form scorer runs. With "ai" and AI off, nothing can run.
export function chooseScorers(method: ScoringMethodName, aiEnabled: boolean): Scorer[] {
  const scorers: Scorer[] = [];
  if (method === "form" || method === "both") scorers.push(formScorer);
  if ((method === "ai" || method === "both") && aiEnabled) scorers.push(aiScorer);

  if (scorers.length === 0) {
    throw new ScorerNotEnabledError("AI scoring is not enabled for this tenant.");
  }
  return scorers;
}