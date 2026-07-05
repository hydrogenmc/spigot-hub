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

export type CreditSettings = {
  signup_bonus?: number;
  daily_login?: number;
};

export type SiteSettings = {
  hero?: { title?: string; subtitle?: string; description?: string; primaryCta?: string; secondaryCta?: string };
  about?: { title?: string; body?: string };
  contact?: { email?: string; discord?: string; twitter?: string; github?: string };
  footer?: { tagline?: string };
  payment?: PaymentSettings;
  limits?: LimitSettings;
  credits?: CreditSettings;
};

export const defaultSettings: Required<Omit<SiteSettings, "payment" | "limits" | "credits">> = {
  hero: {
    title: "CubynDev",
    subtitle: "The Ultimate Minecraft Resource Library",
    description:
      "A modern platform where Minecraft server owners and developers can discover and download plugins, skripts, configurations, maps, setups, and more.",
    primaryCta: "Browse Resources",
    secondaryCta: "Latest Uploads",
  },
  about: {
    title: "About CubynDev",
    body: "CubynDev is a community-driven hub for Minecraft creators.",
  },
  contact: { email: "contact@cubyndev.dev", discord: "", twitter: "", github: "" },
  footer: { tagline: "Premium Minecraft resources for the community." },
};
