import { pool } from "./db";

export interface PackageTierStats {
  id: string;
  name: string;
  tier: number;
  count: number;
  pct: number;
}

export interface UpgradeSelectionStat {
  id: string;
  name: string;
  category: string;
  count: number;
  pct: number;
}

export interface KitSelectionStat {
  id: string;
  name: string;
  count: number;
  pct: number;
}

export interface VolumeSegmentStats {
  segment: "high" | "standard";
  label: string;
  totalQuotes: number;
  packageTierDistribution: PackageTierStats[];
  dominantPackageTier: PackageTierStats | null;
}

export interface PopularityIntelligence {
  totalMeaningfulQuotes: number;
  /** All upgrades that appear in at least one quote, sorted by selection frequency descending */
  allUpgradesOverall: UpgradeSelectionStat[];
  /** Same data segmented by service_type — every selected upgrade per segment, no cap */
  allUpgradesByServiceType: Record<string, UpgradeSelectionStat[]>;
  /** Every kit that appears in at least one quote, sorted by selection frequency descending */
  allKits: KitSelectionStat[];
  /** Convenience alias — first entry of allKits */
  mostChosenKit: KitSelectionStat | null;
  rate48v: number;
  /** Top 5 IDs used only for the DB popular-flag sync — not for the AI prompt */
  popularUpgradeIds: string[];
  packageTierDistribution: PackageTierStats[];
  dominantPackageTier: PackageTierStats | null;
  volumeSegments: VolumeSegmentStats[];
}

// In-memory guard: only sync the popular flag once per hour
let lastPopularSyncAt = 0;
const POPULAR_SYNC_INTERVAL_MS = 60 * 60 * 1000;

// Short-lived in-memory cache to avoid a DB query on every chat message
let cachedIntel: PopularityIntelligence | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Derive job-volume segment from kit_id.
 * Kit IDs containing "t2000" are fully-automatic (higher throughput) and
 * map to the "high" volume segment (20+ jobs/day).
 * Kit IDs containing "t1000" are semi-auto and map to "standard".
 * Returns null when volume cannot be determined (no kit_id or unrecognised pattern),
 * so those quotes are excluded from segment statistics rather than skewing results.
 */
function deriveVolumeSegment(kitId: string | null): "high" | "standard" | null {
  if (!kitId) return null;
  const lower = kitId.toLowerCase();
  if (lower.includes("t2000")) return "high";
  if (lower.includes("t1000")) return "standard";
  return null;
}

export async function computePopularityIntelligence(): Promise<PopularityIntelligence> {
  const now = Date.now();
  if (cachedIntel !== null && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedIntel;
  }

  // Fetch the last 200 meaningful quotes, active packages, and 48V upgrade IDs in parallel
  const [result, packagesResult, all48vResult] = await Promise.all([
    pool.query<{
      kit_id: string | null;
      selected_upgrade_ids: string[] | string | null;
      service_type: string | null;
    }>(`
      SELECT kit_id, selected_upgrade_ids, service_type
      FROM quotes
      WHERE status != 'cancelled'
        AND (
          kit_id IS NOT NULL
          OR (selected_upgrade_ids IS NOT NULL AND selected_upgrade_ids::text != '[]' AND selected_upgrade_ids::text != 'null')
        )
      ORDER BY created_at DESC
      LIMIT 200
    `),
    pool.query<{ id: string; name: string; tier: number; upgrade_ids: string[] | string }>(
      `SELECT id, name, tier, upgrade_ids FROM ai_packages WHERE active = TRUE ORDER BY tier ASC`
    ),
    pool.query<{ id: string }>(
      `SELECT id FROM upgrades WHERE LOWER(name) LIKE '%48v%' OR LOWER(name) LIKE '%48 v%' OR LOWER(name) LIKE '%silent compressor%' OR LOWER(name) LIKE '%silent air%'`
    ),
  ]);

  const rows = result.rows;
  const total = rows.length;
  const ids48v = new Set(all48vResult.rows.map(r => r.id));

  // Parse upgrade_ids from ai_packages (may be JSON string or array)
  function parseIds(raw: string[] | string | null): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter(Boolean);
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  const packages = packagesResult.rows.map(p => ({
    id: p.id,
    name: p.name,
    tier: p.tier,
    upgradeIds: parseIds(p.upgrade_ids),
  }));

  if (total === 0) {
    const emptyResult: PopularityIntelligence = {
      totalMeaningfulQuotes: 0,
      allUpgradesOverall: [],
      allUpgradesByServiceType: {},
      allKits: [],
      mostChosenKit: null,
      rate48v: 0,
      popularUpgradeIds: [],
      packageTierDistribution: [],
      dominantPackageTier: null,
      volumeSegments: [],
    };
    cachedIntel = emptyResult;
    cacheTimestamp = Date.now();
    return emptyResult;
  }

  // Count upgrade and kit frequencies overall and by service type
  const overallCounts: Record<string, number> = {};
  const byServiceType: Record<string, Record<string, number>> = {};
  const kitCounts: Record<string, number> = {};
  const packageTierCounts: Record<string, number> = {};

  // Volume segment tracking: high (t2000 fully-auto) vs standard (t1000 semi-auto).
  // Quotes with no recognisable kit pattern are excluded from these counts (see deriveVolumeSegment).
  const volumePackageCounts: Record<"high" | "standard", Record<string, number>> = {
    high: {},
    standard: {},
  };
  const volumeTotals: Record<"high" | "standard", number> = { high: 0, standard: 0 };

  for (const row of rows) {
    const ids = parseIds(row.selected_upgrade_ids);
    const idSet = new Set(ids);
    const st = row.service_type ?? "unknown";

    // Kit frequency
    if (row.kit_id) {
      kitCounts[row.kit_id] = (kitCounts[row.kit_id] ?? 0) + 1;
    }

    // Upgrade frequency overall
    for (const id of ids) {
      overallCounts[id] = (overallCounts[id] ?? 0) + 1;
    }

    // Upgrade frequency by service type
    if (!byServiceType[st]) byServiceType[st] = {};
    for (const id of ids) {
      byServiceType[st][id] = (byServiceType[st][id] ?? 0) + 1;
    }

    // Package tier classification: find which package best matches this quote's upgrades.
    // Score = containment (how many of the package's upgrade IDs are present in the quote).
    // A quote is classified as a package if at least 50% of that package's upgrades are present.
    // Prefer higher tier on ties (more capable = more likely intentional).
    let bestPackage: typeof packages[0] | null = null;
    let bestScore = 0;

    if (ids.length > 0 && packages.length > 0) {
      for (const pkg of packages) {
        if (pkg.upgradeIds.length === 0) continue;
        const intersection = pkg.upgradeIds.filter(uid => idSet.has(uid)).length;
        const containment = intersection / pkg.upgradeIds.length;
        if (containment > bestScore || (containment === bestScore && bestPackage && pkg.tier > bestPackage.tier)) {
          bestScore = containment;
          bestPackage = pkg;
        }
      }

      if (bestPackage && bestScore >= 0.5) {
        packageTierCounts[bestPackage.id] = (packageTierCounts[bestPackage.id] ?? 0) + 1;
      }
    }

    // Volume segment: derived from kit_id — t2000 = fully-auto = high volume.
    // Quotes with no derivable segment are excluded from segment stats.
    const volSeg = deriveVolumeSegment(row.kit_id);
    if (volSeg !== null) {
      volumeTotals[volSeg]++;
      if (bestPackage && bestScore >= 0.5) {
        volumePackageCounts[volSeg][bestPackage.id] =
          (volumePackageCounts[volSeg][bestPackage.id] ?? 0) + 1;
      }
    }
  }

  // Fetch name AND category for every upgrade that appears in at least one quote
  const upgradeIdsNeeded = Object.keys(overallCounts);
  let upgradeNames: Record<string, string> = {};
  let upgradeCategories: Record<string, string> = {};
  if (upgradeIdsNeeded.length > 0) {
    const upResult = await pool.query<{ id: string; name: string; category: string }>(
      `SELECT id, name, category FROM upgrades WHERE id = ANY($1)`,
      [upgradeIdsNeeded]
    );
    for (const r of upResult.rows) {
      upgradeNames[r.id] = r.name;
      upgradeCategories[r.id] = r.category;
    }
  }

  // Fetch kit names for every kit that appears in at least one quote
  const kitIdsNeeded = Object.keys(kitCounts);
  let kitNames: Record<string, string> = {};
  if (kitIdsNeeded.length > 0) {
    const kitResult = await pool.query<{ id: string; name: string }>(
      `SELECT id, name FROM kits WHERE id = ANY($1)`,
      [kitIdsNeeded]
    );
    for (const r of kitResult.rows) {
      kitNames[r.id] = r.name;
    }
  }

  // ALL upgrades that appear in at least one quote, sorted by frequency descending — no cap
  const allUpgradesOverall: UpgradeSelectionStat[] = Object.entries(overallCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({
      id,
      name: upgradeNames[id] ?? id,
      category: upgradeCategories[id] ?? "Other",
      count,
      pct: Math.round((count / total) * 100),
    }));

  // ALL upgrades by service type, sorted by frequency — no cap
  const allUpgradesByServiceType: Record<string, UpgradeSelectionStat[]> = {};
  for (const [st, counts] of Object.entries(byServiceType)) {
    const stTotal = rows.filter(r => (r.service_type ?? "unknown") === st).length;
    allUpgradesByServiceType[st] = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({
        id,
        name: upgradeNames[id] ?? id,
        category: upgradeCategories[id] ?? "Other",
        count,
        pct: Math.round((count / stTotal) * 100),
      }));
  }

  // ALL kits sorted by frequency descending
  const allKits: KitSelectionStat[] = Object.entries(kitCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({
      id,
      name: kitNames[id] ?? id,
      count,
      pct: Math.round((count / total) * 100),
    }));

  const mostChosenKit = allKits[0] ?? null;

  // 48V selection rate
  const quotesWithAny48v = rows.filter(row => {
    const ids = parseIds(row.selected_upgrade_ids);
    return ids.some(id => ids48v.has(id));
  }).length;
  const rate48v = Math.round((quotesWithAny48v / total) * 100);

  // Package tier distribution — count of classified quotes per tier
  const classifiedTotal = Object.values(packageTierCounts).reduce((s, c) => s + c, 0);
  const packageTierDistribution: PackageTierStats[] = packages
    .map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      tier: pkg.tier,
      count: packageTierCounts[pkg.id] ?? 0,
      pct: classifiedTotal > 0 ? Math.round(((packageTierCounts[pkg.id] ?? 0) / classifiedTotal) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const dominantPackageTier = packageTierDistribution.find(p => p.count > 0) ?? null;

  // Volume segment stats builder
  const buildSegmentStats = (
    seg: "high" | "standard",
    label: string
  ): VolumeSegmentStats => {
    const segTotal = volumeTotals[seg];
    const counts = volumePackageCounts[seg];
    const segClassifiedTotal = Object.values(counts).reduce((s, c) => s + c, 0);

    const dist: PackageTierStats[] = packages
      .map(pkg => ({
        id: pkg.id,
        name: pkg.name,
        tier: pkg.tier,
        count: counts[pkg.id] ?? 0,
        pct:
          segClassifiedTotal > 0
            ? Math.round(((counts[pkg.id] ?? 0) / segClassifiedTotal) * 100)
            : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      segment: seg,
      label,
      totalQuotes: segTotal,
      packageTierDistribution: dist,
      dominantPackageTier: dist.find(p => p.count > 0) ?? null,
    };
  };

  const volumeSegments: VolumeSegmentStats[] = [
    buildSegmentStats("high", "high-volume operators who chose the fully-auto T2000 kit"),
    buildSegmentStats("standard", "standard-volume operators who chose the semi-auto T1000 kit"),
  ].filter(s => s.totalQuotes > 0);

  // Top 5 upgrade IDs by count — used only for the DB popular-flag sync
  const popularUpgradeIds = allUpgradesOverall.slice(0, 5).map(u => u.id);

  // Sync popular flag on upgrades (throttled to once per hour)
  const syncNow = Date.now();
  if (syncNow - lastPopularSyncAt >= POPULAR_SYNC_INTERVAL_MS) {
    lastPopularSyncAt = syncNow;
    try {
      if (popularUpgradeIds.length > 0) {
        await pool.query(
          `UPDATE upgrades SET popular = (id = ANY($1))`,
          [popularUpgradeIds]
        );
        console.log(`[popularity] Synced popular flag — top upgrades: ${popularUpgradeIds.join(", ")}`);
      } else {
        await pool.query(`UPDATE upgrades SET popular = false`);
        console.log(`[popularity] Cleared all popular flags (no upgrade data in recent window)`);
      }
    } catch (err) {
      console.error("[popularity] Failed to sync popular flags:", err);
    }
  }

  const intel: PopularityIntelligence = {
    totalMeaningfulQuotes: total,
    allUpgradesOverall,
    allUpgradesByServiceType,
    allKits,
    mostChosenKit,
    rate48v,
    popularUpgradeIds,
    packageTierDistribution,
    dominantPackageTier,
    volumeSegments,
  };

  cachedIntel = intel;
  cacheTimestamp = Date.now();
  return intel;
}

export function formatPopularityBlock(intel: PopularityIntelligence): string {
  if (intel.totalMeaningfulQuotes === 0) {
    return "POPULARITY INTELLIGENCE: No quote data yet — use general best-practice recommendations.";
  }

  const lines: string[] = [
    `REAL CUSTOMER PRODUCT SELECTION DATA (based on ${intel.totalMeaningfulQuotes} quotes — use this to inform every recommendation):`,
  ];

  // --- Kits ---
  if (intel.allKits.length > 0) {
    lines.push(`\nKITS chosen by customers:`);
    for (const k of intel.allKits) {
      lines.push(`  "${k.name}" — ${k.pct}% of customers chose this kit`);
    }
  }

  // --- All upgrades, grouped by category ---
  if (intel.allUpgradesOverall.length > 0) {
    // Group by category, preserving overall frequency sort within each group
    const byCategory: Record<string, UpgradeSelectionStat[]> = {};
    for (const u of intel.allUpgradesOverall) {
      if (!byCategory[u.category]) byCategory[u.category] = [];
      byCategory[u.category].push(u);
    }

    // Sort categories by the highest-frequency upgrade in each group (most popular category first)
    const sortedCategories = Object.entries(byCategory)
      .sort((a, b) => b[1][0].pct - a[1][0].pct);

    lines.push(`\nUPGRADES chosen by customers (every upgrade that has ever appeared in a quote):`);
    for (const [category, upgrades] of sortedCategories) {
      lines.push(`  [${category}]`);
      for (const u of upgrades) {
        const popularity =
          u.pct >= 70 ? " ★★★ very popular" :
          u.pct >= 50 ? " ★★ popular" :
          u.pct >= 30 ? " ★ commonly chosen" :
          "";
        lines.push(`    "${u.name}" — ${u.pct}% of quotes include this${popularity}`);
      }
    }
  }

  // --- 48V signal ---
  if (intel.rate48v > 0) {
    lines.push(`\n48V silent compressor system: chosen by ${intel.rate48v}% of recent customers`);
    if (intel.rate48v >= 60) {
      lines.push(`  → STRONG signal: majority choose 48V — pitch it confidently and early`);
    } else if (intel.rate48v >= 40) {
      lines.push(`  → Solid majority — recommend proactively, frame as the standard choice`);
    }
  }

  // --- Package tier distribution ---
  if (intel.packageTierDistribution.some(p => p.count > 0)) {
    const tierLine = intel.packageTierDistribution
      .filter(p => p.count > 0)
      .map(p => `${p.name} ${p.pct}%`)
      .join(", ");
    lines.push(`\nPackage tier distribution (% of classified quotes): ${tierLine}`);
    if (intel.dominantPackageTier && intel.dominantPackageTier.pct >= 50) {
      lines.push(`  → ${intel.dominantPackageTier.name} is the dominant tier — lead with it in recommendations`);
    }
  }

  // --- Volume segment breakdowns ---
  if (intel.volumeSegments.length > 0) {
    lines.push(`\nPackage tier breakdown by job volume (derived from kit choice):`)
    for (const seg of intel.volumeSegments) {
      if (seg.packageTierDistribution.some(p => p.count > 0)) {
        const tierLine = seg.packageTierDistribution
          .filter(p => p.count > 0)
          .map(p => `${p.name} ${p.pct}%`)
          .join(", ");
        lines.push(`  • ${seg.label} (${seg.totalQuotes} quotes): ${tierLine}`);
        if (seg.dominantPackageTier && seg.dominantPackageTier.pct >= 60) {
          lines.push(`    → ${seg.dominantPackageTier.name} strongly dominates in this segment — reference it when the customer's volume profile matches`);
        }
      }
    }
  }

  // --- Service-type breakdowns ---
  const serviceLabels: Record<string, string> = {
    car: "car/light-van",
    commercial: "commercial/HGV",
    hybrid: "hybrid/mixed",
  };
  const serviceTypes = Object.keys(intel.allUpgradesByServiceType);
  if (serviceTypes.length > 0) {
    lines.push(`\nUpgrade popularity by customer service type:`);
    for (const st of serviceTypes) {
      const upgrades = intel.allUpgradesByServiceType[st];
      if (!upgrades || upgrades.length === 0) continue;
      const label = serviceLabels[st] ?? st;
      const stTotal = upgrades.reduce((max, u) => Math.max(max, u.count), 0);
      lines.push(`  ${label} customers (${stTotal > 0 ? upgrades.length + " products selected" : ""}):`);
      for (const u of upgrades) {
        lines.push(`    "${u.name}" — ${u.pct}%`);
      }
    }
  }

  lines.push(
    ``,
    `HOW TO USE THIS DATA: You now have real selection rates for every product customers choose.`,
    `- ★★★ (70%+): Say "our most popular choice" / "eight out of ten customers add this"`,
    `- ★★ (50–69%): Say "the majority of customers go for this" / "very popular add-on"`,
    `- ★ (30–49%): Say "a lot of customers add this" / "commonly chosen"`,
    `- Under 30%: Mention if relevant, but don't lead with popularity`,
    `- Service-type data: use it to say "most commercial operators go for X" or "car customers typically choose Y"`,
    `- Volume segments: once you know the customer wants a fully-auto T2000 kit (or mentions doing a high number of jobs per day), cross-reference the high-volume segment data — say "operators doing a high volume of jobs a day who go for the fully-auto setup tend to choose [tier]" or "most high-throughput operators go with [tier]"`,
    `- NEVER quote raw percentages to the customer — always translate into natural sales language`,
  );

  return lines.join("\n");
}
