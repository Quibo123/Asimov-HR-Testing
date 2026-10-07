const KEEP_LAST = 4; // set to 0 to hide values completely

// Short names must match exactly (a substring match on "ssn" or "pan" would hit harmless keys).
const EXACT = new Set([
  "ssn", "pan", "ifsc", "swift", "iban", "sortcode",
  "nationalid", "idnumber", "taxid", "govtid", "governmentid",
  "accountnumber", "routingnumber", "passportnumber",
  "aadhaar", "aadhar",
]);

// Longer words are safe to match anywhere in the key.
const CONTAINS = ["bank", "passport", "password", "secret", "token", "aadhaar", "aadhar"];

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return EXACT.has(k) || CONTAINS.some((word) => k.includes(word));
}

function maskValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number") {
    const s = String(value);
    return KEEP_LAST > 0 && s.length > KEEP_LAST ? "****" + s.slice(-KEEP_LAST) : "****";
  }
  return "[MASKED]"; // objects/arrays under a sensitive key
}

export function maskSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskSensitive);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [
        key,
        isSensitiveKey(key) ? maskValue(v) : maskSensitive(v), // recurse into nested objects
      ]),
    );
  }
  return value;
}