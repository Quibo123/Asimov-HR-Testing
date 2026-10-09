import { describe, expect, it } from "vitest";
import { AiScorer } from "./AiScorer.js";
import { FormScorer } from "./FormScorer.js";
import { chooseScorers } from "./scorers.js";
import type { ScoringApplication, ScoringTemplate } from "./Scorer.js";
import {
  opt,
  workedExampleApplication,
  workedExampleQuestions,
  workedExampleTemplate,
} from "./worked-example.fixture.js";

const form = new FormScorer();

const withAnswer = (questionId: string, value: unknown): ScoringApplication => ({
  ...workedExampleApplication,
  answers: workedExampleApplication.answers.map((a) =>
    a.questionId === questionId ? { ...a, value } : a,
  ),
});

const withoutAnswer = (questionId: string): ScoringApplication => ({
  ...workedExampleApplication,
  answers: workedExampleApplication.answers.filter((a) => a.questionId !== questionId),
});

describe("FormScorer: worked example", () => {
  it("scores exactly 78", async () => {
    const result = await form.score(workedExampleApplication, workedExampleTemplate);
    expect(result.total).toBe(78);

    const scored = result.breakdown.filter((b) => b.type !== "SHORT_TEXT" && b.type !== "FILE");
    expect(scored.map((b) => b.points)).toEqual([24, 20, 15, 19]);
    expect(result.mustHavesFailed).toEqual([]);
  });

  it("flags short text for HR and gives it 0 points", async () => {
    const result = await form.score(workedExampleApplication, workedExampleTemplate);
    const text = result.breakdown.find((b) => b.type === "SHORT_TEXT");
    expect(text?.points).toBe(0);
    expect(text?.flagForHr).toBe(true);
  });
});

describe("FormScorer: must-haves flag but never reject", () => {
  it("lists a failed must-have and still returns a total", async () => {
    const result = await form.score(withAnswer("q2", "q2-no"), workedExampleTemplate);
    expect(result.mustHavesFailed).toHaveLength(1);
    expect(result.mustHavesFailed[0].questionId).toBe("q2");
    expect(result.total).toBe(58); // 24 + 0 + 15 + 19
    expect(result).not.toHaveProperty("rejected");
  });

  it("treats an unanswered must-have as failed", async () => {
    const result = await form.score(withoutAnswer("q2"), workedExampleTemplate);
    expect(result.mustHavesFailed).toHaveLength(1);
    expect(result.mustHavesFailed[0].reason).toBe("Not answered.");
    expect(result.total).toBe(58);
  });
});

describe("FormScorer: question types", () => {
  it("gives 0 points when a number is outside every band", async () => {
    const result = await form.score(withAnswer("q3", 2.5), workedExampleTemplate);
    const q3 = result.breakdown.find((b) => b.questionId === "q3");
    expect(q3?.points).toBe(0);
    expect(q3?.note).toContain("outside every band");
  });

  it("scores the open-ended band", async () => {
    const result = await form.score(withAnswer("q3", 10), workedExampleTemplate);
    expect(result.breakdown.find((b) => b.questionId === "q3")?.points).toBe(25);
  });

  it("caps multiple choice at 100%", async () => {
    const template: ScoringTemplate = {
      version: 1,
      questions: [
        {
          id: "m", type: "MULTIPLE_CHOICE", text: "Skills", weight: 100, mustHave: false,
          options: [opt("m1", 60), opt("m2", 60)],
        },
      ],
    };
    const result = await form.score(
      { id: "a", answers: [{ questionId: "m", value: ["m1", "m2"] }] },
      template,
    );
    expect(result.total).toBe(100);
  });

  it("scores a rating", async () => {
    const template: ScoringTemplate = {
      version: 1,
      questions: [
        {
          id: "r", type: "RATING", text: "English", weight: 100, mustHave: false,
          options: [opt("1", 0, 1, 1), opt("2", 25, 2, 2), opt("3", 50, 3, 3), opt("4", 75, 4, 4), opt("5", 100, 5, 5)],
        },
      ],
    };
    const result = await form.score({ id: "a", answers: [{ questionId: "r", value: 4 }] }, template);
    expect(result.total).toBe(75);
  });

  it("gives 0 for an answer that matches no option", async () => {
    const result = await form.score(withAnswer("q1", "not-an-option"), workedExampleTemplate);
    expect(result.breakdown.find((b) => b.questionId === "q1")?.points).toBe(0);
  });

  it("keeps the worked example weights at 100", () => {
    const sum = workedExampleQuestions.reduce((s, q) => s + q.weight, 0);
    expect(sum).toBe(100);
  });
});

describe("AI scorer stays off", () => {
  it("is never chosen while the tenant setting is off", () => {
    expect(chooseScorers("form", false).map((s) => s.name)).toEqual(["form"]);
    expect(chooseScorers("both", false).map((s) => s.name)).toEqual(["form"]);
    expect(() => chooseScorers("ai", false)).toThrow("not enabled");
  });

  it("still refuses to run even when the setting is on", async () => {
    const scorers = chooseScorers("ai", true);
    expect(scorers.map((s) => s.name)).toEqual(["ai"]);
    await expect(new AiScorer().score()).rejects.toThrow("not enabled");
  });
});