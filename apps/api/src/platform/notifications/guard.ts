import { AppError } from "../errors.js";

// A notice that would contain salary, bank or ID numbers is refused (422) and never sent.
export class NotificationContentError extends AppError {
  constructor(message: string) {
    super(422, message);
  }
}

// ---------- Variable names ----------

// Short names must match exactly (a substring match on "pan" would hit "company").
const EXACT = new Set(["ssn", "pan", "ctc", "otp", "iban", "ifsc", "swift"]);

// Longer words are safe to match anywhere in the name.
const CONTAINS = [
  "salary", "wage", "compensation", "payslip", "bank", "account", "routing",
  "aadhaar", "aadhar", "passport", "nationalid", "idnumber", "taxid", "govtid",
  "governmentid", "creditcard", "debitcard", "cardnumber", "password", "secret", "token",
];

export function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return EXACT.has(k) || CONTAINS.some((word) => k.includes(word));
}

export function assertSafeKeys(keys: string[]) {
  for (const key of keys) {
    if (isSensitiveKey(key)) {
      throw new NotificationContentError(`"${key}" looks like sensitive data and cannot be used in a notification.`);
    }
  }
}

// ---------- Text ----------

const SENSITIVE_WORDS =
  /\b(salary|salaries|wages?|ctc|compensation|payslips?|bank\s+(?:account|details)|account\s+number|ifsc|iban|swift|routing\s+number|aadhaar|aadhar|passport|ssn|social\s+security|pan\s+card|national\s+id|tax\s+id|credit\s+card|debit\s+card|password|otp)\b/i;

const SENSITIVE_NUMBERS: RegExp[] = [
  /\b\d{9,}\b/,                      // a long run of digits (account, card, ID numbers)
  /\b(?:\d{4}[ -]){2,}\d{3,4}\b/,    // grouped digits, like "1234 5678 9012"
  /\b[A-Z]{5}\d{4}[A-Z]\b/,          // Indian PAN
  /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/, // IBAN
];

export function assertSafeText(text: string) {
  if (SENSITIVE_WORDS.test(text)) {
    throw new NotificationContentError("The notification mentions salary, bank or ID details, so it was not sent.");
  }
  if (SENSITIVE_NUMBERS.some((pattern) => pattern.test(text))) {
    throw new NotificationContentError("The notification contains a number that looks like an account or ID number, so it was not sent.");
  }
}

// Remove control characters, collapse spaces, and keep it short.
export function cleanText(value: string, max = 300): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}