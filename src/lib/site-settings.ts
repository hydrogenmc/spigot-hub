export type PaymentSettings = {
  gcash_number?: string;
  gcash_name?: string;
  maya_number?: string;
  maya_name?: string;
  instructions?: string;
  ocr_confidence_threshold?: number;
};

export type LimitSettings = {
  member_daily?: number;
  vip_daily?: number | null;
};

export type SiteSettings = {
  hero?: { title?: string; subtitle?: string; description?: string; primaryCta?: string; secondaryCta?: string };
  about?: { title?: string; body?: string };
  contact?: { email?: string; discord?: string; twitter?: string; github?: string };
  footer?: { tagline?: string };
  payment?: PaymentSettings;
  limits?: LimitSettings;
};

export const defaultSettings: Required<Omit<SiteSettings, "payment" | "limits">> = {
  hero: {
    title: "CubynDev",
    subtitle: "Premium Minecraft resources, priced for everyone",
    description:
      "A curated library of high-quality Minecraft plugins, skripts, configs, maps and server setups. Free tier for the community, and an affordable VIP membership starting at just ₱99/month for unlimited access to premium releases.",
    primaryCta: "Browse Free Resources",
    secondaryCta: "See VIP Membership",
  },
  about: {
    title: "About CubynDev",
    body: "CubynDev is a modern Minecraft resource platform built by developers for developers. Everything essential is free — plugins, skripts, configs, and setups. Our low-cost VIP membership unlocks premium, production-ready releases so studios and hobbyists can ship faster without breaking the bank.",
  },
  contact: { email: "contact@cubyndev.dev", discord: "", twitter: "", github: "" },
  footer: { tagline: "Premium Minecraft resources. Free for the community, affordable for pros." },
};
