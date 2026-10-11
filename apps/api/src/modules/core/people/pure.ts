// Small pure helpers (no database), so they are easy to test.

export function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// JSON with sorted keys, so two objects with the same content compare equal.
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, v]) => `${JSON.stringify(key)}:${stableJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export type Changes = Record<string, { from: unknown; to: unknown }>;

// Which fields differ between the current values and the new values.
export function computeChanges(before: Record<string, unknown>, next: Record<string, unknown>): Changes {
  const changes: Changes = {};
  for (const key of Object.keys(next)) {
    if (stableJson(before[key]) !== stableJson(next[key])) {
      changes[key] = { from: before[key], to: next[key] };
    }
  }
  return changes;
}