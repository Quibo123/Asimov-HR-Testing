import { prisma } from "./prisma.js";
import { forTenant } from "./for-tenant.js";

export const SETTING_KEYS = {
  aiEnabled: "scoring.aiEnabled",
  approvalFallbackHours: "approvals.fallbackHours",
  approvalFallbackUserId: "approvals.fallbackUserId",
} as const;

async function getSettingValue(tenantId: string, key: string) {
  const row = await prisma.tenantSetting.findFirst({
    where: { ...forTenant(tenantId), key },
  });
  return row?.value;
}

export async function getBooleanSetting(tenantId: string, key: string, fallback: boolean) {
  const value = await getSettingValue(tenantId, key);
  return typeof value === "boolean" ? value : fallback;
}

// Must be a positive number, otherwise the fallback is used.
export async function getNumberSetting(tenantId: string, key: string, fallback: number) {
  const value = await getSettingValue(tenantId, key);
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

export async function getStringSetting(tenantId: string, key: string): Promise<string | null> {
  const value = await getSettingValue(tenantId, key);
  return typeof value === "string" && value.length > 0 ? value : null;
}