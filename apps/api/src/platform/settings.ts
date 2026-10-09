import { prisma } from "./prisma.js";
import { forTenant } from "./for-tenant.js";

export const SETTING_KEYS = {
  aiEnabled: "scoring.aiEnabled",
} as const;

export async function getBooleanSetting(tenantId: string, key: string, fallback: boolean) {
  const row = await prisma.tenantSetting.findFirst({
    where: { ...forTenant(tenantId), key },
  });
  return typeof row?.value === "boolean" ? row.value : fallback;
}