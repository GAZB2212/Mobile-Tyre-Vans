/**
 * Helpers for displaying a chosen van's registration plate consistently.
 *
 * A van's plate can come from two places:
 *  - the stock van record's own `reg`, or
 *  - a plate typed for an own-van / finance flow (passed in as `slotReg`,
 *    e.g. `quote.vanRegistration` or a comparison slot's `vanRegistration`).
 *
 * The typed reg always wins; otherwise we fall back to the stock van's plate so
 * a chosen stock van still shows its plate. Use these helpers everywhere a
 * chosen van is displayed so plates can never silently go missing.
 */

export type VanLike = {
  year?: number | string | null;
  make?: string | null;
  model?: string | null;
  reg?: string | null;
} | null | undefined;

/** Resolve the plate to show for a chosen van, or null if none is available. */
export function resolveVanReg(van: VanLike, slotReg?: string | null): string | null {
  return (slotReg && slotReg.trim()) || van?.reg || null;
}

/**
 * Format a chosen van as `year make model (REG)`, appending the plate in
 * parentheses when one is available. Returns an empty string when no van is
 * provided (callers should handle their own own-van fallback in that case).
 */
export function formatVanWithReg(van: VanLike, slotReg?: string | null): string {
  if (!van) return "";
  const base = `${van.year ?? ""} ${van.make ?? ""} ${van.model ?? ""}`
    .replace(/\s+/g, " ")
    .trim();
  const reg = resolveVanReg(van, slotReg);
  return reg ? `${base} (${reg})` : base;
}
