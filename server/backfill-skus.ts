import { db } from './db';
import { kits, upgrades } from '@shared/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { log } from './vite';
import { kitCatalog } from './seed-data/kit-catalog';
import { upgradeCatalog } from './seed-data/upgrade-catalog';

export async function backfillSkus(): Promise<void> {
  let kitsUpdated = 0;
  let upgradesUpdated = 0;
  let failed = 0;

  for (const kit of kitCatalog) {
    try {
      // Only set sku if it hasn't been set yet — preserves any custom SKU the user has entered
      if (kit.sku) {
        await db
          .update(kits)
          .set({ sku: kit.sku })
          .where(and(eq(kits.id, kit.id), isNull(kits.sku)));
      }
      // Only set skuComponents if not already populated — preserves user-edited BOMs
      if (kit.skuComponents && kit.skuComponents.length > 0) {
        const rows = await db
          .update(kits)
          .set({ skuComponents: kit.skuComponents })
          .where(and(eq(kits.id, kit.id), isNull(kits.skuComponents)))
          .returning({ id: kits.id });
        if (rows.length > 0) kitsUpdated++;
      } else {
        // Count as processed even if no BOM to seed
        const existing = await db.select({ id: kits.id }).from(kits).where(eq(kits.id, kit.id));
        if (existing.length > 0) kitsUpdated++;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[SKU backfill] Failed to update kit ${kit.id}:`, message);
      failed++;
    }
  }

  for (const upgrade of upgradeCatalog) {
    try {
      // Only set sku if it hasn't been set yet — preserves any custom SKU the user has entered
      if (upgrade.sku) {
        await db
          .update(upgrades)
          .set({ sku: upgrade.sku })
          .where(and(eq(upgrades.id, upgrade.id), isNull(upgrades.sku)));
      }
      // Only set skuComponents if not already populated — preserves user-edited BOMs
      if (upgrade.skuComponents && upgrade.skuComponents.length > 0) {
        const rows = await db
          .update(upgrades)
          .set({ skuComponents: upgrade.skuComponents })
          .where(and(eq(upgrades.id, upgrade.id), isNull(upgrades.skuComponents)))
          .returning({ id: upgrades.id });
        if (rows.length > 0) upgradesUpdated++;
      } else {
        const existing = await db.select({ id: upgrades.id }).from(upgrades).where(eq(upgrades.id, upgrade.id));
        if (existing.length > 0) upgradesUpdated++;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[SKU backfill] Failed to update upgrade ${upgrade.id}:`, message);
      failed++;
    }
  }

  const failNote = failed > 0 ? `, ${failed} failed` : '';
  log(`✅ SKU backfill complete: ${kitsUpdated} kit(s) and ${upgradesUpdated} upgrade(s) updated${failNote}`);
}
