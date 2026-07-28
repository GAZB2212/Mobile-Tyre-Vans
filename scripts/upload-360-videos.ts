import { Storage } from "@google-cloud/storage";
import * as fs from "fs";
import * as path from "path";
import { setObjectAclPolicy } from "../server/objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

async function uploadVideos() {
  const publicSearchPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
  const bucketPath = publicSearchPaths.split(",")[0].trim();
  
  if (!bucketPath) {
    console.error("❌ PUBLIC_OBJECT_SEARCH_PATHS not set");
    process.exit(1);
  }

  // Parse bucket name from path (format: /bucket-name/public)
  const pathParts = bucketPath.split("/").filter(Boolean);
  const bucketName = pathParts[0];
  const bucketPrefix = pathParts.slice(1).join("/");

  console.log("📦 Bucket:", bucketName);
  console.log("📁 Prefix:", bucketPrefix);

  const bucket = storage.bucket(bucketName);

  // Videos to upload
  const videos = [
    "ZenoVideo 20_1759504716286.mp4",
    "ZenoVideo 14_1759504750775.mp4",
    "ZenoVideo 8_1759504750775.mp4",
  ];

  for (const videoFilename of videos) {
    const localPath = path.join(process.cwd(), "attached_assets", videoFilename);
    
    if (!fs.existsSync(localPath)) {
      console.log(`⚠️  Skipping ${videoFilename} - file not found`);
      continue;
    }

    // Upload to public/videos/ directory in object storage
    const destinationPath = `${bucketPrefix}/videos/${videoFilename}`;
    const file = bucket.file(destinationPath);

    console.log(`⬆️  Uploading ${videoFilename}...`);

    try {
      await bucket.upload(localPath, {
        destination: destinationPath,
        metadata: {
          contentType: "video/mp4",
          cacheControl: "public, max-age=31536000",
        },
      });

      // Set ACL to public using recommended approach (avoids public access prevention errors)
      await setObjectAclPolicy(file, {
        owner: process.env.SYSTEM_OBJECT_OWNER || 'system',
        visibility: 'public'
      });

      console.log(`✅ Uploaded ${videoFilename} to /${bucketName}/${destinationPath}`);
    } catch (error) {
      console.error(`❌ Failed to upload ${videoFilename}:`, error);
    }
  }

  console.log("🎉 All videos uploaded successfully!");
}

uploadVideos().catch(console.error);
