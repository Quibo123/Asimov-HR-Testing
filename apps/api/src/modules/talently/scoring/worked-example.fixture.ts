import type { ScoringApplication, ScoringOption, ScoringQuestion, ScoringTemplate } from "./Scorer.js";

export const opt = (
  id: string,
  scorePercent: number,
  minValue: number | null = null,
  maxValue: number | null = null,
): ScoringOption => ({ id, label: id, scorePercent, minValue, maxValue });

// Weights of scored questions: 30 + 20 + 25 + 25 = 100.
export const workedExampleQuestions: ScoringQuestion[] = [
  {
    id: "q1", type: "SINGLE_CHOICE", text: "Highest education?", weight: 30, mustHave: false,
    options: [opt("q1-a", 100), opt("q1-b", 80), opt("q1-c", 0)],
  },
  {
    id: "q2", type: "YES_NO", text: "Authorised to work in India?", weight: 20, mustHave: true,
    options: [opt("q2-yes", 100), opt("q2-no", 0)],
  },
  {
    id: "q3", type: "NUMBER_BANDS", text: "Years of experience", weight: 25, mustHave: false,
    options: [opt("q3-a", 20, 0, 2), opt("q3-b", 60, 3, 5), opt("q3-c", 100, 6, null)],
  },
  {
    id: "q4", type: "MULTIPLE_CHOICE", text: "Which tools do you know?", weight: 25, mustHave: false,
    options: [opt("q4-a", 40), opt("q4-b", 36), opt("q4-c", 24)],
  },
  { id: "q5", type: "SHORT_TEXT", text: "Why do you want this job?", weight: 0, mustHave: false, options: [] },
  { id: "q6", type: "FILE", text: "Upload your resume", weight: 0, mustHave: false, options: [] },
];

export const workedExampleTemplate: ScoringTemplate = {
  version: 1,
  questions: workedExampleQuestions,
};

// Expected points: q1 = 30 x 80% = 24, q2 = 20 x 100% = 20, q3 = 25 x 60% = 15,
// q4 = 25 x (40% + 36%) = 19. Total = 78.
export const workedExampleApplication: ScoringApplication = {
  id: "app-1",
  answers: [
    { questionId: "q1", value: "q1-b" },
    { questionId: "q2", value: "q2-yes" },
    { questionId: "q3", value: 4 },
    { questionId: "q4", value: ["q4-a", "q4-b"] },
    { questionId: "q5", value: "I enjoy helping people." },
    { questionId: "q6", value: "resumes/job/file.pdf" },
  ],
};