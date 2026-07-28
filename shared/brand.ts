// ─────────────────────────────────────────────────────────────────────────────
// Brand + vertical configuration layer
//
// This is the single place a white-label deployment configures WHO it is
// (brand identity) and WHAT INDUSTRY it serves (the vertical). Everything the
// platform renders — header, footer, hero, SEO metadata, emails, the AI
// assistant's framing, and which features are enabled — reads from here.
//
// To stand up a new deployment:
//   1. Pick a vertical: set ACTIVE_VERTICAL_KEY below (or the VERTICAL env
//      var on the server / VITE_VERTICAL at client build time).
//   2. Fill in BRAND_OVERRIDES with the business's real name and contact
//      details (or set the corresponding BRAND_* / VITE_BRAND_* env vars).
//   3. Load the vertical's product catalogue (vans, kits, upgrades) through
//      the admin panel — all product content is data, not code.
//
// Adding a NEW industry is additive: copy a preset in VERTICALS, adjust the
// copy and flags, and select it. No other code changes are required.
// ─────────────────────────────────────────────────────────────────────────────

import { THEMES, VERTICAL_DEFAULT_THEME, type ThemeConfig, type ThemeKey } from "./theme";

export type VerticalKey = "tyres" | "camper" | "horsebox" | "generic";

export interface VerticalConfig {
  key: VerticalKey;
  /** Human industry label, e.g. "Mobile Tyre Fitting". */
  industryName: string;
  /** What the finished vehicle is called, e.g. "mobile tyre van". */
  vehicleTerm: string;
  /** Plural of vehicleTerm. */
  vehicleTermPlural: string;
  /** What the work is called, e.g. "tyre van conversion". */
  conversionTerm: string;
  /** What the equipment bundle step is called in the configurator. */
  kitTerm: string;
  /** Homepage hero headline. */
  heroTitle: string;
  /** Homepage hero supporting line. */
  heroSubtitle: string;
  /** Default <title> suffix / SEO positioning line. */
  seoTitle: string;
  /** Default meta description (brand name + phone appended at render time). */
  seoDescription: string;
  /** One-paragraph business description used in structured data and About copy. */
  businessDescription: string;
  /**
   * Industry context injected into the AI assistant's system prompt so it
   * frames questions for this trade. The deep question flow (equipment
   * specifics) should still be tuned per vertical in Admin → Max Settings.
   */
  aiContext: string;
  features: {
    /** Industry training courses (REACT etc.) — tyre-specific offering. */
    training: boolean;
    /** Programmatic location/van-model SEO pages (copy is written per vertical). */
    seoPages: boolean;
    /** Customer-supplied vehicle ("bring your own van") flow. */
    ownVehicle: boolean;
  };
}

export const VERTICALS: Record<VerticalKey, VerticalConfig> = {
  tyres: {
    key: "tyres",
    industryName: "Mobile Tyre Fitting",
    vehicleTerm: "mobile tyre van",
    vehicleTermPlural: "mobile tyre vans",
    conversionTerm: "mobile tyre van conversion",
    kitTerm: "equipment pack",
    heroTitle: "Building Your Dream Mobile Tyre Business",
    heroSubtitle: "Custom-built mobile tyre vans, fully equipped and ready to earn from day one. Nationwide delivery and finance available.",
    seoTitle: "Mobile Tyre Van Conversions UK",
    seoDescription: "UK specialists in custom mobile tyre van conversions. Fully equipped builds, nationwide delivery, finance available.",
    businessDescription: "Custom-built mobile tyre vans fully equipped with professional tyre fitting equipment. Nationwide delivery and finance available.",
    aiContext: "The customer is starting or growing a mobile tyre fitting business. Vans are converted with tyre changing machines, wheel balancers, compressors and power systems.",
    features: { training: true, seoPages: true, ownVehicle: true },
  },
  camper: {
    key: "camper",
    industryName: "Camper Van Conversion",
    vehicleTerm: "camper van",
    vehicleTermPlural: "camper vans",
    conversionTerm: "camper van conversion",
    kitTerm: "conversion pack",
    heroTitle: "Building Your Dream Camper Van",
    heroSubtitle: "Bespoke camper van conversions built to your specification. Choose your base van, layout and upgrades — nationwide delivery and finance available.",
    seoTitle: "Camper Van Conversions UK",
    seoDescription: "UK specialists in bespoke camper van conversions. Configurable layouts and equipment, nationwide delivery, finance available.",
    businessDescription: "Bespoke camper van conversions built in-house to each customer's specification, with configurable layouts, off-grid power and heating options.",
    aiContext: "The customer wants a camper van conversion for leisure or van-life. Conversions cover layouts, beds, kitchens, heating, insulation, electrics and off-grid power.",
    features: { training: false, seoPages: false, ownVehicle: true },
  },
  horsebox: {
    key: "horsebox",
    industryName: "Horsebox Conversion",
    vehicleTerm: "horsebox",
    vehicleTermPlural: "horseboxes",
    conversionTerm: "horsebox conversion",
    kitTerm: "conversion pack",
    heroTitle: "Building Your Perfect Horsebox",
    heroSubtitle: "Professional horsebox builds and conversions to your specification. Stalls, tack lockers and living areas — nationwide delivery and finance available.",
    seoTitle: "Horsebox Conversions UK",
    seoDescription: "UK specialists in professional horsebox builds and conversions. Configurable stalls and living areas, nationwide delivery, finance available.",
    businessDescription: "Professional horsebox builds and conversions with configurable stall layouts, tack storage and optional living areas.",
    aiContext: "The customer needs a horsebox build or conversion. Builds cover stall configuration, partitions, ramps, tack storage, CCTV and optional living quarters.",
    features: { training: false, seoPages: false, ownVehicle: true },
  },
  generic: {
    key: "generic",
    industryName: "Vehicle Conversion",
    vehicleTerm: "conversion vehicle",
    vehicleTermPlural: "conversion vehicles",
    conversionTerm: "vehicle conversion",
    kitTerm: "equipment pack",
    heroTitle: "Building Your Perfect Working Vehicle",
    heroSubtitle: "Custom vehicle conversions built to your specification. Choose your base vehicle, equipment and upgrades — nationwide delivery and finance available.",
    seoTitle: "Custom Vehicle Conversions UK",
    seoDescription: "UK specialists in custom vehicle conversions. Configurable equipment and upgrades, nationwide delivery, finance available.",
    businessDescription: "Custom vehicle conversions built in-house to each customer's specification, with configurable equipment packages and upgrades.",
    aiContext: "The customer wants a custom vehicle conversion for their business. Builds are configured from a base vehicle, an equipment package and optional upgrades.",
    features: { training: false, seoPages: false, ownVehicle: true },
  },
};

export interface BrandConfig {
  /** Full trading name, e.g. "Mobile Tyre Vans". */
  name: string;
  /** Short form used in tight spaces. */
  shortName: string;
  /** 2–4 letter roundel/initials, e.g. "MTV". */
  initials: string;
  /** Bare domain, no protocol, e.g. "www.mobiletyrevans.co.uk". */
  domain: string;
  /** Display phone number. */
  phone: string;
  /** tel: href digits. */
  phoneHref: string;
  /** International format for structured data, e.g. "+448000000000". */
  phoneIntl: string;
  salesEmail: string;
  infoEmail: string;
  privacyEmail: string;
  /** Display address lines. */
  addressLines: string[];
  /** Twitter/X handle including @, or empty to omit. */
  twitterHandle: string;
  /** AI assistant persona name. */
  assistantName: string;
  vertical: VerticalConfig;
  /** Visual identity — palette, typography, shape (see shared/theme.ts). */
  theme: ThemeConfig;
}

// Env resolution that works in both runtimes.
//
// Client: vite.config.ts forwards each brand var into the bundle by statically
// replacing the literal `import.meta.env.VITE_*` expressions below (accepting
// either the plain or VITE_-prefixed name at build/dev-server start).
// Server: reads process.env directly, also accepting either spelling — so a
// deployment can set just VERTICAL / BRAND_NAME etc. once for both sides.
//
// NOTE: these MUST stay as literal member expressions (no dynamic key lookup)
// or the build-time substitution cannot happen.
const CLIENT_ENV: Record<string, string | undefined> = (() => {
  try {
    return {
      VERTICAL: import.meta.env?.VITE_VERTICAL,
      BRAND_NAME: import.meta.env?.VITE_BRAND_NAME,
      BRAND_SHORT_NAME: import.meta.env?.VITE_BRAND_SHORT_NAME,
      BRAND_INITIALS: import.meta.env?.VITE_BRAND_INITIALS,
      BRAND_DOMAIN: import.meta.env?.VITE_BRAND_DOMAIN,
      BRAND_PHONE: import.meta.env?.VITE_BRAND_PHONE,
      BRAND_PHONE_HREF: import.meta.env?.VITE_BRAND_PHONE_HREF,
      BRAND_PHONE_INTL: import.meta.env?.VITE_BRAND_PHONE_INTL,
      BRAND_SALES_EMAIL: import.meta.env?.VITE_BRAND_SALES_EMAIL,
      BRAND_INFO_EMAIL: import.meta.env?.VITE_BRAND_INFO_EMAIL,
      BRAND_PRIVACY_EMAIL: import.meta.env?.VITE_BRAND_PRIVACY_EMAIL,
      BRAND_TWITTER: import.meta.env?.VITE_BRAND_TWITTER,
      BRAND_ASSISTANT_NAME: import.meta.env?.VITE_BRAND_ASSISTANT_NAME,
      SITE_URL: import.meta.env?.VITE_SITE_URL,
      THEME: import.meta.env?.VITE_THEME,
    };
  } catch {
    return {};
  }
})();

function env(name: string): string | undefined {
  if (CLIENT_ENV[name]) return CLIENT_ENV[name];
  try {
    if (typeof process !== "undefined" && process.env) {
      if (process.env["VITE_" + name]) return process.env["VITE_" + name];
      if (process.env[name]) return process.env[name];
    }
  } catch { /* not in Node */ }
  return undefined;
}

const ACTIVE_VERTICAL_KEY: VerticalKey =
  (env("VERTICAL") as VerticalKey | undefined) && VERTICALS[env("VERTICAL") as VerticalKey]
    ? (env("VERTICAL") as VerticalKey)
    : "tyres";

// Per-deployment identity. Replace these placeholder contact details (or set
// BRAND_* env vars on the server) when standing up a real deployment.
const BRAND_OVERRIDES: Partial<Omit<BrandConfig, "vertical">> = {
  name: "Mobile Tyre Vans",
  shortName: "Mobile Tyre Vans",
  initials: "MTV",
  domain: "www.mobiletyrevans.co.uk",
  phone: "0800 000 0000",
  phoneHref: "08000000000",
  phoneIntl: "+448000000000",
  salesEmail: "sales@mobiletyrevans.co.uk",
  infoEmail: "info@mobiletyrevans.co.uk",
  privacyEmail: "privacy@mobiletyrevans.co.uk",
  addressLines: ["Unit 1, Example Business Park", "Your Town, AA1 1AA"],
  twitterHandle: "@mobiletyrevans",
  assistantName: "Max",
};

export const BRAND: BrandConfig = {
  name: env("BRAND_NAME") ?? BRAND_OVERRIDES.name ?? "Your Brand",
  shortName: env("BRAND_SHORT_NAME") ?? BRAND_OVERRIDES.shortName ?? BRAND_OVERRIDES.name ?? "Your Brand",
  initials: env("BRAND_INITIALS") ?? BRAND_OVERRIDES.initials ?? "YB",
  domain: env("BRAND_DOMAIN") ?? BRAND_OVERRIDES.domain ?? "www.example.co.uk",
  phone: env("BRAND_PHONE") ?? BRAND_OVERRIDES.phone ?? "0800 000 0000",
  phoneHref: env("BRAND_PHONE_HREF") ?? BRAND_OVERRIDES.phoneHref ?? "08000000000",
  phoneIntl: env("BRAND_PHONE_INTL") ?? BRAND_OVERRIDES.phoneIntl ?? "+448000000000",
  salesEmail: env("BRAND_SALES_EMAIL") ?? BRAND_OVERRIDES.salesEmail ?? "sales@example.co.uk",
  infoEmail: env("BRAND_INFO_EMAIL") ?? BRAND_OVERRIDES.infoEmail ?? "info@example.co.uk",
  privacyEmail: env("BRAND_PRIVACY_EMAIL") ?? BRAND_OVERRIDES.privacyEmail ?? "privacy@example.co.uk",
  addressLines: BRAND_OVERRIDES.addressLines ?? ["Your Address"],
  twitterHandle: env("BRAND_TWITTER") ?? BRAND_OVERRIDES.twitterHandle ?? "",
  assistantName: env("BRAND_ASSISTANT_NAME") ?? BRAND_OVERRIDES.assistantName ?? "Max",
  vertical: VERTICALS[ACTIVE_VERTICAL_KEY],
  // Theme: explicit THEME env wins, else the vertical's default pairing.
  theme:
    THEMES[(env("THEME") as ThemeKey | undefined) ?? ("" as ThemeKey)] ??
    THEMES[VERTICAL_DEFAULT_THEME[ACTIVE_VERTICAL_KEY] ?? "workhorse"],
};

/** Site base URL for links/SEO. Server-side SITE_URL env wins when set. */
export function siteUrl(): string {
  return env("SITE_URL") ?? `https://${BRAND.domain}`;
}
