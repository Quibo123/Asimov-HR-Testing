import { z } from "zod";

export const QUESTION_TYPES = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "YES_NO",
  "NUMBER_BANDS",
  "RATING",
  "SHORT_TEXT",
  "FILE",
] as const;

const SCORED = new Set<string>([
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "YES_NO",
  "NUMBER_BANDS",
  "RATING",
]);
export const isScored = (type: string) => SCORED.has(type);

const optionSchema = z.object({
  label: z.string().trim().min(1).max(200),
  scorePercent: z.number().int().min(0).max(100),
  minValue: z.number().nullable().optional(),
  maxValue: z.number().nullable().optional(),
});
type Opt = z.infer<typeof optionSchema>;
type Fail = (message: string, path?: (string | number)[]) => void;

function checkBands(options: Opt[], fail: Fail) {
  if (options.length < 1) {
    fail("Number questions need at least 1 band.", ["options"]);
    return;
  }
  options.forEach((o, i) => {
    const min = o.minValue ?? null;
    const max = o.maxValue ?? null;
    if (min === null && max === null) {
      fail("Each band needs a minValue, a maxValue, or both.", ["options", i]);
    } else if (min !== null && max !== null && min > max) {
      fail("A band's minValue cannot be greater than its maxValue.", ["options", i]);
    }
  });
  // Bands must not overlap. A missing min/max means open-ended.
  for (let a = 0; a < options.length; a++) {
    for (let b = a + 1; b < options.length; b++) {
      const aMin = options[a].minValue ?? -Infinity;
      const aMax = options[a].maxValue ?? Infinity;
      const bMin = options[b].minValue ?? -Infinity;
      const bMax = options[b].maxValue ?? Infinity;
      if (aMin <= bMax && bMin <= aMax) {
        fail(`Number bands "${options[a].label}" and "${options[b].label}" overlap.`, ["options"]);
      }
    }
  }
}

function checkRating(options: Opt[], fail: Fail) {
  const values = options.map((o) =>
    o.minValue != null && o.minValue === o.maxValue ? o.minValue : null,
  );
  const ok = options.length === 5 && [1, 2, 3, 4, 5].every((v) => values.includes(v));
  if (!ok) {
    fail(
      "Rating questions need exactly 5 options, one for each rating 1 to 5 (set minValue and maxValue to the same number).",
      ["options"],
    );
  }
}

const questionSchema = z
  .object({
    type: z.enum(QUESTION_TYPES),
    text: z.string().trim().min(1).max(500),
    weight: z.number().int().min(0).max(100).default(0),
    required: z.boolean().default(true),
    mustHave: z.boolean().default(false),
    options: z.array(optionSchema).max(50).default([]),
  })
  .superRefine((q, ctx) => {
    const fail: Fail = (message, path = []) => ctx.addIssue({ code: "custom", message, path });
    const n = q.options.length;
    const hasBandFields = q.options.some((o) => o.minValue != null || o.maxValue != null);

    if (!isScored(q.type)) {
      if (q.weight !== 0) fail("Short text and file questions are not scored, so weight must be 0.", ["weight"]);
      if (q.mustHave) fail("Short text and file questions cannot be must-have.", ["mustHave"]);
      if (n > 0) fail("Short text and file questions cannot have options.", ["options"]);
      return;
    }

    if (q.weight < 1) fail("Scored questions need a weight of at least 1.", ["weight"]);

    switch (q.type) {
      case "SINGLE_CHOICE":
      case "MULTIPLE_CHOICE":
        if (n < 2) fail("Choice questions need at least 2 options.", ["options"]);
        if (hasBandFields) fail("Choice options cannot have minValue or maxValue.", ["options"]);
        break;
      case "YES_NO":
        if (n !== 2) fail("Yes/no questions need exactly 2 options (Yes and No).", ["options"]);
        if (hasBandFields) fail("Yes/no options cannot have minValue or maxValue.", ["options"]);
        break;
      case "NUMBER_BANDS":
        checkBands(q.options, fail);
        break;
      case "RATING":
        checkRating(q.options, fail);
        break;
    }
  });

// Whole-template rule: scored weights add up to 100.
export const templateBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    questions: z.array(questionSchema).min(1).max(100),
  })
  .superRefine((t, ctx) => {
    const total = t.questions
      .filter((q) => isScored(q.type))
      .reduce((sum, q) => sum + q.weight, 0);
    if (total !== 100) {
      ctx.addIssue({
        code: "custom",
        path: ["questions"],
        message: `Weights of scored questions must add up to 100 (currently ${total}).`,
      });
    }
  });
export type TemplateBody = z.infer<typeof templateBodySchema>;

export const copyTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
});

export const createJobSchema = z.object({
  title: z.string().trim().min(1).max(200),
  location: z.string().trim().min(1).max(200),
  templateId: z.string().uuid(),
  scoringMethod: z.enum(["form", "ai", "both"]).default("form"),
});