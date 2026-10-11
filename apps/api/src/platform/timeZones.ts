// Time zones are checked against the time-zone data of the runtime (IANA names).
const LISTED = new Set<string>([...Intl.supportedValuesOf("timeZone"), "UTC"]);

export function isValidTimeZone(zone: unknown): zone is string {
  if (typeof zone !== "string" || zone.length === 0 || zone !== zone.trim()) return false;
  if (LISTED.has(zone)) return true;

  // Some valid IANA names are older aliases that the list leaves out (for example Asia/Calcutta).
  // They are accepted only when the runtime knows the zone AND the capitalisation is the standard one.
  if (!zone.includes("/")) return false;
  if (!zone.split("/").every((part) => /^[A-Z]/.test(part))) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}