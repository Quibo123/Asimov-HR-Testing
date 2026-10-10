import { prisma } from "../prisma.js";
import { getStringSetting, SETTING_KEYS } from "../settings.js";
import { safeColour, safeLogoUrl, safeSenderName, type Brand } from "./emailTemplate.js";

// Reads the tenant's logo, colour and sender name. Anything missing or unsafe falls back to a default.
export async function getBrand(tenantId: string): Promise<Brand> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
  const tenantName = tenant?.name.trim() || "Your organisation";

  const [logo, colour, sender] = await Promise.all([
    getStringSetting(tenantId, SETTING_KEYS.brandLogoUrl),
    getStringSetting(tenantId, SETTING_KEYS.brandColour),
    getStringSetting(tenantId, SETTING_KEYS.brandSenderName),
  ]);

  return {
    tenantName,
    senderName: safeSenderName(sender, tenantName),
    colour: safeColour(colour),
    logoUrl: safeLogoUrl(logo),
  };
}
