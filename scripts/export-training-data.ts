import { db } from "../server/db";
import { trainingOptions } from "@shared/schema";
import * as fs from "fs";

async function exportTrainingData() {
  try {
    console.log("📦 Exporting training data...");
    
    const data = await db.select().from(trainingOptions);
    
    // Remove auto-generated fields for clean import
    const exportData = data.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      type: item.type,
      durationDays: item.durationDays,
      includes: item.includes,
      price: item.price,
      published: item.published,
    }));
    
    const jsonData = JSON.stringify(exportData, null, 2);
    fs.writeFileSync("training-data-export.json", jsonData);
    
    console.log(`✅ Exported ${exportData.length} training options to training-data-export.json`);
    console.log("\nTo import to production:");
    console.log("1. Download training-data-export.json");
    console.log("2. Upload it to your production repl");
    console.log("3. Run: npm run import-training");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Export failed:", error);
    process.exit(1);
  }
}

exportTrainingData();
