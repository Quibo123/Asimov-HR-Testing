import type { QuestionType } from "@prisma/client";

// ---------- What a scorer receives ----------

export interface ScoringOption {
  id: string;
  label: string;
  scorePercent: number; // 0 to 100
  minValue: number | null; // number bands and rating
  maxValue: number | null;
}

export interface ScoringQuestion {
  id: string;
  type: QuestionType;
  text: string;
  weight: number;
  mustHave: boolean;
  options: ScoringOption[];
}

// The frozen template version a job was published with.
export interface ScoringTemplate {
  version: number;
  questions: ScoringQuestion[];
}

export interface ScoringApplication {
  id: string;
  answers: { questionId: string; value: unknown }[];
}

// ---------- What a scorer returns ----------

export interface BreakdownItem {
  questionId: string;
  text: string;
  type: QuestionType;
  weight: number;
  percent: number; // 0 to 100
  points: number; // weight x percent / 100
  mustHave: boolean;
  flagForHr: boolean; // true when a person should read this answer
  note?: string;
}

export interface MustHaveFailure {
  questionId: string;
  text: string;
  reason: string;
}

export interface ScoreResult {
  total: number; // 0 to 100 when the weights add up to 100
  breakdown: BreakdownItem[];
  mustHavesFailed: MustHaveFailure[]; // flags only: a failed must-have NEVER rejects anyone
}

// ---------- The one interface every scoring provider implements ----------

export interface Scorer {
  readonly name: "form" | "ai";
  score(application: ScoringApplication, templateVersion: ScoringTemplate): Promise<ScoreResult>;
}