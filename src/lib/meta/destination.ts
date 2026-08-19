export type DestinationType = "WEBSITE" | "MESSAGING";
export type MessagingApp = "MESSENGER" | "INSTAGRAM" | "WHATSAPP";

const MESSAGING_GOALS = new Set([
  "CONVERSATIONS",
  "REPLIES",
  "LEAD_GENERATION",
  "QUALITY_LEAD",
  "MESSAGING_PURCHASE_CONVERSION",
]);

export function metaAdSetDestinationType(destinationType: string | undefined, apps: string[] = []): string | undefined {
  if (destinationType !== "MESSAGING") return undefined;
  const set = new Set(apps);
  const messenger = set.has("MESSENGER");
  const instagram = set.has("INSTAGRAM");
  const whatsapp = set.has("WHATSAPP");
  if (messenger && instagram && whatsapp) return "MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP";
  if (messenger && instagram) return "MESSAGING_INSTAGRAM_DIRECT_MESSENGER";
  if (messenger && whatsapp) return "MESSAGING_MESSENGER_WHATSAPP";
  if (instagram && whatsapp) return "MESSAGING_INSTAGRAM_DIRECT_WHATSAPP";
  if (messenger) return "MESSENGER";
  if (instagram) return "INSTAGRAM_DIRECT";
  if (whatsapp) return "WHATSAPP";
  return "MESSENGER";
}

export function metaMessagingCta(apps: string[] = [], whatsappNumber?: string): { type: string; value?: Record<string, string> } {
  const set = new Set(apps);
  if (set.size === 1 && set.has("WHATSAPP")) {
    return {
      type: "WHATSAPP_MESSAGE",
      value: {
        app_destination: "WHATSAPP",
        ...(whatsappNumber ? { whatsapp_number: whatsappNumber } : {}),
      },
    };
  }
  if (set.size === 1 && set.has("INSTAGRAM")) {
    return { type: "INSTAGRAM_MESSAGE" };
  }
  return { type: "MESSAGE_PAGE" };
}

export function messagingOptimizationGoal(currentGoal: string | undefined): string {
  if (currentGoal && MESSAGING_GOALS.has(currentGoal)) return currentGoal;
  return "CONVERSATIONS";
}
