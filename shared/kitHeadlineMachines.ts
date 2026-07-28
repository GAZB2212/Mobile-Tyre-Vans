import type { SkuComponent } from "./schema";

// Headline machines shown as an "Includes:" sub-line under the equipment
// pack name on the build sheet and on each kiosk card. The workshop needs to
// know at a glance which headline machines a pack contains without scanning
// the full BOM.
//
// Resolution rules:
//   1. If the kit has a non-empty `headlineMachines` override, use that
//      verbatim (admin-curated). This wins because BOM descriptions can drift
//      and an admin override is the most reliable signal.
//   2. Otherwise fall back to deriving up to 3 headline machines from
//      `skuComponents` by matching the description against a small set of
//      strict keyword regexes. Strict matching means noise like wire/crimps
//      in the BOM is ignored — only the three headline machine categories
//      (tyre changer/machine, wheel balancer, compressor) are surfaced.
//   3. If neither source produces anything, return an empty array — the UI
//      renders nothing rather than an empty "Includes:" label.

type HeadlineCategory = { pattern: RegExp };

// Order matters — output is rendered in this order so every pack reads in the
// same sequence (tyre machine first, then balancer, then compressor).
// We return the ACTUAL BOM description for the matched component (truncated
// for the kiosk) rather than a generic label, so the workshop can see exactly
// which model is in this pack — e.g. "Super Spin auto spin wheel balancer"
// instead of just "Wheel Balancer".
const HEADLINE_CATEGORIES: HeadlineCategory[] = [
  { pattern: /tyre[\s-]?(changer|machine)/i },
  { pattern: /\bbalancer\b/i },
  { pattern: /\bcompressor\b/i },
];

const MAX_HEADLINE_MACHINES = 3;

export interface KitForHeadline {
  headlineMachines?: string[] | null;
  skuComponents?: SkuComponent[] | null;
}

export function deriveHeadlineMachines(kit: KitForHeadline | null | undefined): string[] {
  if (!kit) return [];

  // Manual override wins. Trim and drop empties so an array of [""] doesn't
  // produce a phantom bullet, but anything non-empty short-circuits the
  // BOM-based fallback.
  const override = (kit.headlineMachines ?? [])
    .map((s) => (s ?? "").trim())
    .filter(Boolean);
  if (override.length > 0) return override.slice(0, MAX_HEADLINE_MACHINES);

  // BOM-based fallback. Walk the components and pick the FIRST match per
  // category — packs sometimes list a machine twice (e.g. two compressor
  // line items for spare parts), and we only want one entry per category.
  const components = kit.skuComponents ?? [];
  if (components.length === 0) return [];

  const matched: string[] = [];
  const seen = new Set<string>();
  for (const cat of HEADLINE_CATEGORIES) {
    if (matched.length >= MAX_HEADLINE_MACHINES) break;
    const hit = components.find((c) => cat.pattern.test(c?.description ?? ""));
    if (!hit) continue;
    const desc = (hit.description ?? "").trim();
    if (!desc) continue;
    // Dedupe in case a single component description matches two categories
    // (rare, but e.g. a combined "tyre machine and balancer" line).
    const key = desc.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    matched.push(desc);
  }
  return matched;
}
