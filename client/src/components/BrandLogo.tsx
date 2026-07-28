import { BRAND } from "@shared/brand";

interface BrandLogoProps {
  /** Overall height in px; the wordmark scales from it. */
  size?: number;
  /** Stack the roundel above the name (used on the loading screen). */
  stacked?: boolean;
  className?: string;
}

/**
 * Theme-aware brand mark. Renders the deployment's initials roundel and
 * wordmark from BRAND + theme tokens, so every deployment carries a coherent
 * logo out of the box. Deployments with real artwork can still drop an image
 * in wherever they prefer — this is the zero-effort default.
 */
export default function BrandLogo({ size = 56, stacked = false, className = "" }: BrandLogoProps) {
  const [first, ...rest] = BRAND.name.split(" ");
  const remainder = rest.join(" ");

  const roundel = (
    <span
      aria-hidden
      className="flex items-center justify-center rounded-full bg-accent text-accent-foreground font-extrabold shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.32,
        letterSpacing: "0.02em",
        fontFamily: "var(--font-heading, var(--font-sans))",
      }}
    >
      {BRAND.initials}
    </span>
  );

  const wordmark = (
    <span
      className={`leading-none font-extrabold ${stacked ? "text-center" : ""}`}
      style={{ fontSize: size * 0.42, fontFamily: "var(--font-heading, var(--font-sans))" }}
    >
      <span className="text-accent uppercase block">{first}</span>
      {remainder && <span className="uppercase block mt-1">{remainder}</span>}
    </span>
  );

  return (
    <span
      className={`inline-flex items-center gap-3 ${stacked ? "flex-col" : ""} ${className}`}
      data-testid="brand-logo"
      aria-label={BRAND.name}
    >
      {roundel}
      {wordmark}
    </span>
  );
}
