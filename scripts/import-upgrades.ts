import { db } from "../server/db";
import * as schema from "../shared/schema";
import { readFileSync } from "fs";
import { join } from "path";

interface UpgradeImport {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  created_at: string;
  updated_at: string;
  published: boolean;
  images: string[];
  parent_id: string | null;
  variant_name: string | null;
  allow_quantity: boolean;
  sort_order: number;
}

async function importUpgrades() {
  try {
    console.log("🚀 Starting upgrade import...");
    
    // Read the JSON file
    const jsonPath = join(process.cwd(), "attached_assets", "upgrades_1761834186690.json");
    const jsonData = readFileSync(jsonPath, "utf-8");
    const upgrades: UpgradeImport[] = JSON.parse(jsonData);
    
    console.log(`📦 Found ${upgrades.length} upgrades to import`);
    
    // Delete existing upgrades (optional - comment out if you want to keep existing data)
    console.log("🗑️  Clearing existing upgrades...");
    await db.delete(schema.upgrades);
    
    // Sort upgrades: parents first, then children
    console.log("🔄 Sorting upgrades (parents first)...");
    const parentUpgrades = upgrades.filter(u => !u.parent_id);
    const childUpgrades = upgrades.filter(u => u.parent_id);
    
    console.log(`   Parents: ${parentUpgrades.length}`);
    console.log(`   Children: ${childUpgrades.length}`);
    
    // Insert parents first
    console.log("📥 Inserting parent upgrades...");
    for (const upgrade of parentUpgrades) {
      await db.insert(schema.upgrades).values({
        id: upgrade.id,
        name: upgrade.name,
        category: upgrade.category,
        description: upgrade.description,
        price: upgrade.price,
        images: upgrade.images,
        parentId: upgrade.parent_id,
        variantName: upgrade.variant_name,
        allowQuantity: upgrade.allow_quantity,
        sortOrder: upgrade.sort_order,
        published: upgrade.published,
        createdAt: new Date(upgrade.created_at),
        updatedAt: new Date(upgrade.updated_at),
      });
    }
    
    // Then insert children
    console.log("📥 Inserting child upgrades...");
    for (const upgrade of childUpgrades) {
      await db.insert(schema.upgrades).values({
        id: upgrade.id,
        name: upgrade.name,
        category: upgrade.category,
        description: upgrade.description,
        price: upgrade.price,
        images: upgrade.images,
        parentId: upgrade.parent_id,
        variantName: upgrade.variant_name,
        allowQuantity: upgrade.allow_quantity,
        sortOrder: upgrade.sort_order,
        published: upgrade.published,
        createdAt: new Date(upgrade.created_at),
        updatedAt: new Date(upgrade.updated_at),
      });
    }
    
    console.log("✅ Import completed successfully!");
    console.log(`📊 Total upgrades imported: ${upgrades.length}`);
    
    // Show summary by category
    const byCategory = upgrades.reduce((acc, u) => {
      acc[u.category] = (acc[u.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log("\n📋 Summary by category:");
    Object.entries(byCategory).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} items`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Import failed:", error);
    process.exit(1);
  }
}

importUpgrades();
