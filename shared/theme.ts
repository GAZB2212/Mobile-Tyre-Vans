// ─────────────────────────────────────────────────────────────────────────────
// Theme layer — the visual identity of a deployment.
//
// Where shared/brand.ts controls WHAT the site says, this controls how it
// LOOKS: palette, typography and shape. Each vertical has a default theme so
// two deployments on different verticals never look like the same site, and
// any deployment can pick a different theme (THEME env var) or define its own
// preset here.
//
// Colours are HSL triples ("86 53% 51%") because the design system composes
// them with alpha (hsl(var(--accent) / 0.15)). Hex twins are provided for
// contexts that need literal colours (HTML emails, JSON-LD, meta tags).
// ─────────────────────────────────────────────────────────────────────────────

export type ThemeKey = "workhorse" | "wanderer" | "paddock" | "slate";

export interface ThemeConfig {
  key: ThemeKey;
  label: string;
  /** Overall scheme the public site renders in. */
  mode: "dark" | "light";
  /** Accent — buttons, highlights, links. HSL triple. */
  accent: string;
  accentForeground: string;
  /** Page background / foreground. */
  background: string;
  foreground: string;
  /** Cards and raised surfaces. */
  card: string;
  cardForeground: string;
  cardBorder: string;
  border: string;
  muted: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  /** Corner radius, CSS length. Sharp = utilitarian, round = friendly. */
  radius: string;
  /** Font stacks (must end in a safe fallback). */
  fontBody: string;
  fontHeading: string;
  /** Google Fonts stylesheet URL loading the families above ("" = none). */
  fontsUrl: string;
  /** Hex twins for emails and other literal-colour contexts. */
  accentHex: string;
  darkHex: string;
}

const INTER = "'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif";

export const THEMES: Record<ThemeKey, ThemeConfig> = {
  // The original identity: blacked-out workshop + safety-lime. Trade, tools,
  // torque. Default for the tyre vertical.
  workhorse: {
    key: "workhorse",
    label: "Workhorse (dark / lime)",
    mode: "dark",
    accent: "86 53% 51%",
    accentForeground: "0 0% 10%",
    background: "0 0% 10%",
    foreground: "0 0% 98%",
    card: "0 0% 15%",
    cardForeground: "0 0% 98%",
    cardBorder: "0 0% 25%",
    border: "0 0% 20%",
    muted: "0 0% 15%",
    mutedForeground: "0 0% 65%",
    primary: "0 0% 10%",
    primaryForeground: "0 0% 98%",
    secondary: "0 0% 20%",
    secondaryForeground: "0 0% 98%",
    radius: ".5rem",
    fontBody: INTER,
    fontHeading: INTER,
    fontsUrl: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
    accentHex: "#8bc440",
    darkHex: "#191919",
  },

  // Warm, editorial, lifestyle: bone-white pages, terracotta accent, serif
  // display. Default for the camper vertical.
  wanderer: {
    key: "wanderer",
    label: "Wanderer (light / terracotta)",
    mode: "light",
    accent: "16 68% 50%",
    accentForeground: "30 40% 98%",
    background: "36 33% 96%",
    foreground: "24 20% 12%",
    card: "36 30% 99%",
    cardForeground: "24 20% 12%",
    cardBorder: "30 20% 86%",
    border: "30 20% 87%",
    muted: "33 25% 91%",
    mutedForeground: "25 10% 40%",
    primary: "24 20% 12%",
    primaryForeground: "36 33% 96%",
    secondary: "33 25% 90%",
    secondaryForeground: "24 20% 12%",
    radius: "1rem",
    fontBody: "'Source Sans 3', ui-sans-serif, system-ui, sans-serif",
    fontHeading: "'Fraunces', 'Georgia', serif",
    fontsUrl: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Source+Sans+3:wght@400;600;700&display=swap",
    accentHex: "#d35a2b",
    darkHex: "#241b15",
  },

  // Heritage equestrian: deep hunter green, brass accent, classic serif.
  // Default for the horsebox vertical.
  paddock: {
    key: "paddock",
    label: "Paddock (dark green / brass)",
    mode: "dark",
    accent: "42 55% 55%",
    accentForeground: "150 30% 10%",
    background: "153 28% 11%",
    foreground: "45 25% 95%",
    card: "153 24% 15%",
    cardForeground: "45 25% 95%",
    cardBorder: "150 18% 26%",
    border: "150 18% 22%",
    muted: "153 24% 16%",
    mutedForeground: "45 12% 68%",
    primary: "153 28% 11%",
    primaryForeground: "45 25% 95%",
    secondary: "150 18% 20%",
    secondaryForeground: "45 25% 95%",
    radius: ".25rem",
    fontBody: "'Source Sans 3', ui-sans-serif, system-ui, sans-serif",
    fontHeading: "'Playfair Display', 'Georgia', serif",
    fontsUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Source+Sans+3:wght@400;600;700&display=swap",
    accentHex: "#cfa84a",
    darkHex: "#14261d",
  },

  // Neutral professional: near-white, ink text, cobalt accent. Default for
  // the generic vertical — a clean canvas for any trade.
  slate: {
    key: "slate",
    label: "Slate (light / cobalt)",
    mode: "light",
    accent: "221 71% 48%",
    accentForeground: "0 0% 100%",
    background: "220 20% 98%",
    foreground: "222 25% 13%",
    card: "0 0% 100%",
    cardForeground: "222 25% 13%",
    cardBorder: "220 15% 88%",
    border: "220 15% 89%",
    muted: "220 16% 94%",
    mutedForeground: "220 10% 42%",
    primary: "222 25% 13%",
    primaryForeground: "0 0% 100%",
    secondary: "220 16% 93%",
    secondaryForeground: "222 25% 13%",
    radius: ".5rem",
    fontBody: INTER,
    fontHeading: INTER,
    fontsUrl: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
    accentHex: "#2456ce",
    darkHex: "#12161f",
  },
};

/** Default theme per vertical — the pairing that makes each industry feel native. */
export const VERTICAL_DEFAULT_THEME: Record<string, ThemeKey> = {
  tyres: "workhorse",
  camper: "wanderer",
  horsebox: "paddock",
  generic: "slate",
};

/**
 * CSS custom properties for a theme, applied to :root at runtime (and usable
 * server-side for SSR style injection). Keys match client/src/index.css.
 */
export function themeCssVars(theme: ThemeConfig): Record<string, string> {
  return {
    "--accent": theme.accent,
    "--accent-foreground": theme.accentForeground,
    "--background": theme.background,
    "--foreground": theme.foreground,
    "--card": theme.card,
    "--card-foreground": theme.cardForeground,
    "--card-border": theme.cardBorder,
    "--border": theme.border,
    "--muted": theme.muted,
    "--muted-foreground": theme.mutedForeground,
    "--primary": theme.primary,
    "--primary-foreground": theme.primaryForeground,
    "--secondary": theme.secondary,
    "--secondary-foreground": theme.secondaryForeground,
    "--radius": theme.radius,
    "--font-sans": theme.fontBody,
    "--font-serif": theme.fontHeading,
    "--font-heading": theme.fontHeading,
  };
}
