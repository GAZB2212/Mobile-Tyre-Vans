import { Storage } from "@google-cloud/storage";
import { setObjectAclPolicy, ObjectAclPolicy } from "../server/objectAcl";

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

async function setVideoAcls() {
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

  // Videos to set ACL for
  const videos = [
    "ZenoVideo 20_1759504716286.mp4",
    "ZenoVideo 14_1759504750775.mp4",
    "ZenoVideo 8_1759504750775.mp4",
  ];

  for (const videoFilename of videos) {
    const objectPath = `${bucketPrefix}/videos/${videoFilename}`;
    const file = bucket.file(objectPath);

    console.log(`🔓 Setting public ACL for ${videoFilename}...`);

    try {
      const aclPolicy: ObjectAclPolicy = {
        owner: "system",
        visibility: "public",
      };

      await setObjectAclPolicy(file, aclPolicy);

      console.log(`✅ Set ACL for ${videoFilename}`);
    } catch (error) {
      console.error(`❌ Failed to set ACL for ${videoFilename}:`, error);
    }
  }

  console.log("🎉 All video ACLs set successfully!");
}

setVideoAcls().catch(console.error);
