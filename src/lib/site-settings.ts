export type SiteSettings = {
  hero?: {
    title?: string;
    subtitle?: string;
    description?: string;
    primaryCta?: string;
    secondaryCta?: string;
  };
  about?: { title?: string; body?: string };
  contact?: { email?: string; discord?: string; twitter?: string; github?: string };
  footer?: { tagline?: string };
};

export const defaultSettings: Required<SiteSettings> = {
  hero: {
    title: "Cubyn Spigot",
    subtitle: "The Ultimate Minecraft Resource Library",
    description:
      "A modern platform where Minecraft server owners and developers can discover and download plugins, skripts, configurations, maps, setups, and more.",
    primaryCta: "Browse Resources",
    secondaryCta: "Latest Uploads",
  },
  about: {
    title: "About Cubyn Spigot",
    body: "Cubyn Spigot is a community-driven hub for Minecraft creators.",
  },
  contact: { email: "contact@cubynspigot.dev", discord: "", twitter: "", github: "" },
  footer: { tagline: "Premium Minecraft resources, free for everyone." },
};
