import type {
  BreakdownItem,
  MustHaveFailure,
  Scorer,
  ScoreResult,
  ScoringApplication,
  ScoringQuestion,
  ScoringTemplate,
} from "./Scorer.js";

const round2 = (n: number) => Math.round(n * 100) / 100;

type Rated = { percent: number; note?: string };

const isBlank = (v: unknown) =>
  v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

// Turn one answer into a percentage (0 to 100) using the question's options.
function rate(q: ScoringQuestion, value: unknown): Rated {
  if (isBlank(value)) return { percent: 0, note: "Not answered." };

  switch (q.type) {
    case "SINGLE_CHOICE":
    case "YES_NO": {
      const option = q.options.find((o) => o.id === value);
      return option
        ? { percent: option.scorePercent }
        : { percent: 0, note: "The answer does not match any option." };
    }

    case "MULTIPLE_CHOICE": {
      if (!Array.isArray(value)) return { percent: 0, note: "Expected a list of options." };
      const chosen = new Set(value);
      const sum = q.options
        .filter((o) => chosen.has(o.id))
        .reduce((total, o) => total + o.scorePercent, 0);
      return { percent: Math.min(100, sum) }; // the selected options add up, capped at 100%
    }

    case "NUMBER_BANDS": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return { percent: 0, note: "Expected a number." };
      }
      // A missing min or max means open-ended ("6 or more").
      const band = q.options.find(
        (o) => value >= (o.minValue ?? -Infinity) && value <= (o.maxValue ?? Infinity),
      );
      return band
        ? { percent: band.scorePercent }
        : { percent: 0, note: `${value} is outside every band.` };
    }

    case "RATING": {
      const option = q.options.find((o) => o.minValue === value && o.maxValue === value);
      return option
        ? { percent: option.scorePercent }
        : { percent: 0, note: "The rating does not match any option." };
    }

    case "SHORT_TEXT":
    case "FILE":
      return { percent: 0 }; // never scored (handled before this function is called)
  }
}

export class FormScorer implements Scorer {
  readonly name = "form" as const;

  async score(
    application: ScoringApplication,
    templateVersion: ScoringTemplate,
  ): Promise<ScoreResult> {
    const answers = new Map(application.answers.map((a) => [a.questionId, a.value]));
    const breakdown: BreakdownItem[] = [];
    const mustHavesFailed: MustHaveFailure[] = [];
    let sum = 0;

    for (const q of templateVersion.questions) {
      // Short text and file questions are not scored. Short text is flagged so HR reads it.
      if (q.type === "SHORT_TEXT" || q.type === "FILE") {
        breakdown.push({
          questionId: q.id,
          text: q.text,
          type: q.type,
          weight: 0,
          percent: 0,
          points: 0,
          mustHave: false,
          flagForHr: q.type === "SHORT_TEXT",
          note: q.type === "SHORT_TEXT" ? "Short text: HR to read the answer." : "File: HR to open the resume.",
        });
        continue;
      }

      const { percent, note } = rate(q, answers.get(q.id));
      const points = (q.weight * percent) / 100; // points = weight x option percent
      sum += points;

      breakdown.push({
        questionId: q.id,
        text: q.text,
        type: q.type,
        weight: q.weight,
        percent,
        points: round2(points),
        mustHave: q.mustHave,
        flagForHr: false,
        ...(note ? { note } : {}),
      });

      // Step 3: a failed must-have is only LISTED here. It never rejects anyone.
      if (q.mustHave && percent === 0) {
        mustHavesFailed.push({
          questionId: q.id,
          text: q.text,
          reason: note ?? "Scored 0% on a must-have question.",
        });
      }
    }

    return { total: round2(sum), breakdown, mustHavesFailed };
  }
}