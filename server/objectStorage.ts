// Referenced from blueprint: javascript_object_storage
import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// The object storage client is used to interact with the object storage service.
export const objectStorageClient = new Storage({
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

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service is used to interact with the object storage service.
export class ObjectStorageService {
  constructor() {}

  // Gets the public object search paths.
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  // Gets the private object directory.
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  // Search for a public object from the search paths.
  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      // Full path format: /<bucket_name>/<object_name>
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      // Check if file exists
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  // Downloads an object to the response.
  async downloadObject(file: File, res: Response, cacheTtlSec: number = 3600) {
    try {
      // Get file metadata
      const [metadata] = await file.getMetadata();
      // Get the ACL policy for the object.
      const aclPolicy = await getObjectAclPolicy(file);
      const isPublic = aclPolicy?.visibility === "public";
      // Set appropriate headers
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `${
          isPublic ? "public" : "private"
        }, max-age=${cacheTtlSec}`,
      });

      // Stream the file to the response
      const stream = file.createReadStream();

      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Gets the upload URL for an object entity.
  async getObjectEntityUploadURL(filename?: string): Promise<{ uploadURL: string; objectPath: string }> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }

    const objectId = randomUUID();
    const safeFilename = filename 
      ? filename.replace(/[^a-zA-Z0-9._-]/g, '_')
      : objectId;
    const fullPath = `${privateObjectDir}/uploads/${objectId}-${safeFilename}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    // Sign URL for PUT method with TTL
    const uploadURL = await signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
    
    // Return both the presigned upload URL and the stable object path
    // The objectPath will be used to retrieve the file after upload
    const objectPath = `/objects/uploads/${objectId}-${safeFilename}`;
    
    return { uploadURL, objectPath };
  }

  // Gets the upload URL for a PUBLIC object (no ACL needed) - van images
  async getPublicObjectUploadURL(filename: string): Promise<{ uploadURL: string; publicURL: string }> {
    const publicPaths = this.getPublicObjectSearchPaths();
    if (!publicPaths || publicPaths.length === 0) {
      throw new Error("No public object paths configured");
    }

    // Use the first public path
    const publicPath = publicPaths[0];
    
    const objectId = randomUUID();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fullPath = `${publicPath}/van-images/${objectId}-${safeFilename}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    // Sign URL for PUT method with TTL
    const uploadURL = await signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
    
    // Return the upload URL and the public URL that can be used directly
    const publicURL = `https://storage.googleapis.com/${bucketName}/${objectName}`;
    
    return { uploadURL, publicURL };
  }

  // Gets the upload URL for PUBLIC product images (kits, upgrades - no ACL needed)
  async getPublicProductUploadURL(filename: string): Promise<{ uploadURL: string; publicURL: string }> {
    const publicPaths = this.getPublicObjectSearchPaths();
    if (!publicPaths || publicPaths.length === 0) {
      throw new Error("No public object paths configured");
    }

    // Use the first public path
    const publicPath = publicPaths[0];
    
    const objectId = randomUUID();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fullPath = `${publicPath}/product-images/${objectId}-${safeFilename}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    // Sign URL for PUT method with TTL
    const uploadURL = await signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
    
    // Return the full public GCS URL that works in production
    const publicURL = `https://storage.googleapis.com/${bucketName}/${objectName}`;
    
    return { uploadURL, publicURL };
  }

  // Gets the upload URL for PUBLIC upgrade images (no ACL needed)
  async getPublicUpgradeUploadURL(filename: string): Promise<{ uploadURL: string; publicURL: string }> {
    const publicPaths = this.getPublicObjectSearchPaths();
    if (!publicPaths || publicPaths.length === 0) {
      throw new Error("No public object paths configured");
    }

    // Use the first public path
    const publicPath = publicPaths[0];
    
    const objectId = randomUUID();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fullPath = `${publicPath}/upgrade-images/${objectId}-${safeFilename}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    // Sign URL for PUT method with TTL
    const uploadURL = await signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
    
    // Return the full public GCS URL that works in production
    const publicURL = `https://storage.googleapis.com/${bucketName}/${objectName}`;
    
    return { uploadURL, publicURL };
  }

  // Upload avatar image directly to public storage
  async uploadAvatarToPublicStorage(
    fileBuffer: Buffer,
    filename: string,
    contentType: string
  ): Promise<string> {
    const publicPaths = this.getPublicObjectSearchPaths();
    if (!publicPaths || publicPaths.length === 0) {
      throw new Error("No public object paths configured");
    }
    const publicPath = publicPaths[0];
    const objectId = randomUUID();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fullPath = `${publicPath}/avatars/${objectId}-${safeFilename}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    await file.save(fileBuffer, { contentType, metadata: { contentType } });
    const pathParts = objectName.split('/');
    const uploadedFilename = pathParts[pathParts.length - 1];
    return `/objects/avatars/${uploadedFilename}`;
  }

  // Upload artwork proof image directly to public storage (server-side buffer upload)
  async uploadArtworkProofToPublicStorage(
    fileBuffer: Buffer,
    filename: string,
    contentType: string
  ): Promise<string> {
    const publicPaths = this.getPublicObjectSearchPaths();
    if (!publicPaths || publicPaths.length === 0) {
      throw new Error("No public object paths configured");
    }
    const publicPath = publicPaths[0];
    const objectId = randomUUID();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fullPath = `${publicPath}/artwork-proofs/${objectId}-${safeFilename}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    await file.save(fileBuffer, { contentType, metadata: { contentType } });
    const pathParts = objectName.split('/');
    const uploadedFilename = pathParts[pathParts.length - 1];
    return `/objects/artwork-proofs/${uploadedFilename}`;
  }

  // Gets a presigned 7-day GET URL for an artwork proof file so email clients can load it.
  // Accepts the stored URL in any format (full GCS URL or /objects/... proxy path).
  async getArtworkProofSignedReadUrl(storedUrl: string, ttlSec = 7 * 24 * 3600): Promise<string> {
    let bucketName: string;
    let objectName: string;

    if (storedUrl.startsWith('https://storage.googleapis.com/')) {
      // Full GCS URL: https://storage.googleapis.com/<bucket>/<objectName>
      const parsed = new URL(storedUrl);
      const parts = parsed.pathname.split('/').filter(Boolean);
      bucketName = parts[0];
      objectName = parts.slice(1).join('/');
    } else {
      // Proxy path: /objects/<objectName> — look up using public search path
      const publicPaths = this.getPublicObjectSearchPaths();
      if (!publicPaths || publicPaths.length === 0) throw new Error("No public object paths configured");
      // Strip /objects/ prefix, then strip leading public/ if present
      let key = storedUrl.replace(/^\/objects\//, '');
      if (key.startsWith('public/')) key = key.slice('public/'.length);
      const fullPath = `${publicPaths[0]}/${key}`;
      const parsed = parseObjectPath(fullPath);
      bucketName = parsed.bucketName;
      objectName = parsed.objectName;
    }

    return signObjectURL({ bucketName, objectName, method: 'GET', ttlSec });
  }

  // Gets a presigned upload URL for artwork proof images (client-side direct upload)
  async getArtworkProofUploadURL(filename: string): Promise<{ uploadURL: string; publicURL: string }> {
    const publicPaths = this.getPublicObjectSearchPaths();
    if (!publicPaths || publicPaths.length === 0) {
      throw new Error("No public object paths configured");
    }
    const publicPath = publicPaths[0];
    const objectId = randomUUID();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fullPath = `${publicPath}/artwork-proofs/${objectId}-${safeFilename}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    const uploadURL = await signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
    const publicURL = `https://storage.googleapis.com/${bucketName}/${objectName}`;
    return { uploadURL, publicURL };
  }

  // Upload file buffer directly to public storage (backend proxy - no CORS)
  async uploadFileToPublicStorage(
    fileBuffer: Buffer,
    filename: string,
    contentType: string
  ): Promise<string> {
    const publicPaths = this.getPublicObjectSearchPaths();
    if (!publicPaths || publicPaths.length === 0) {
      throw new Error("No public object paths configured");
    }

    // Use the first public path
    const publicPath = publicPaths[0];
    
    const objectId = randomUUID();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fullPath = `${publicPath}/van-images/${objectId}-${safeFilename}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    // Upload directly from backend
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
    await file.save(fileBuffer, {
      contentType,
      metadata: {
        contentType,
      },
    });
    
    // Return the object path (will be served through backend proxy)
    // Format: /objects/van-images/filename (matches the storage location)
    const pathParts = objectName.split('/');
    const uploadedFilename = pathParts[pathParts.length - 1];
    return `/objects/van-images/${uploadedFilename}`;
  }

  // Upload upgrade images directly to public storage (backend proxy - no CORS)
  async uploadUpgradeImageToPublicStorage(
    fileBuffer: Buffer,
    filename: string,
    contentType: string
  ): Promise<string> {
    const publicPaths = this.getPublicObjectSearchPaths();
    if (!publicPaths || publicPaths.length === 0) {
      throw new Error("No public object paths configured");
    }

    // Use the first public path
    const publicPath = publicPaths[0];
    
    const objectId = randomUUID();
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fullPath = `${publicPath}/upgrade-images/${objectId}-${safeFilename}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    // Upload directly from backend
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
    await file.save(fileBuffer, {
      contentType,
      metadata: {
        contentType,
      },
    });
    
    // Return the backend proxy path (will be served through /objects/ endpoint)
    // Format: /objects/upgrade-images/filename (matches the storage location)
    const pathParts = objectName.split('/');
    const uploadedFilename = pathParts[pathParts.length - 1];
    return `/objects/upgrade-images/${uploadedFilename}`;
  }

  // Upload video directly to public storage (backend proxy - no CORS)
  async uploadVideoToPublicStorage(
    fileBuffer: Buffer,
    filename: string,
    contentType: string
  ): Promise<string> {
    const publicPaths = this.getPublicObjectSearchPaths();
    if (!publicPaths || publicPaths.length === 0) {
      throw new Error("No public object paths configured");
    }

    // Use the first public path
    const publicPath = publicPaths[0];
    
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fullPath = `${publicPath}/videos/${safeFilename}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    // Upload directly from backend
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
    await file.save(fileBuffer, {
      contentType,
      metadata: {
        contentType,
      },
    });
    
    // Set ACL to public (system-owned for marketing assets)
    await setObjectAclPolicy(file, { 
      owner: process.env.SYSTEM_OBJECT_OWNER || 'system',
      visibility: 'public' 
    });
    
    // Return the backend proxy path (will be served through /objects/ endpoint)
    // Format: /objects/videos/filename (matches the storage location)
    const pathParts = objectName.split('/');
    const uploadedFilename = pathParts[pathParts.length - 1];
    return `/objects/videos/${uploadedFilename}`;
  }

  // Gets the object entity file from the object path.
  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    // URL-decode the path to handle filenames with spaces
    const decodedPath = decodeURIComponent(objectPath);
    
    const parts = decodedPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    
    // Check if this is a public resource (van-images, product-images, upgrade-images, videos, or artwork-proofs)
    if (entityId.startsWith("van-images/") || entityId.startsWith("product-images/") || entityId.startsWith("upgrade-images/") || entityId.startsWith("videos/") || entityId.startsWith("avatars/") || entityId.startsWith("artwork-proofs/")) {
      const publicPaths = this.getPublicObjectSearchPaths();
      if (publicPaths && publicPaths.length > 0) {
        const publicPath = publicPaths[0];
        const objectEntityPath = `${publicPath}/${entityId}`;
        const { bucketName, objectName } = parseObjectPath(objectEntityPath);
        const bucket = objectStorageClient.bucket(bucketName);
        const objectFile = bucket.file(objectName);
        const [exists] = await objectFile.exists();
        if (exists) {
          return objectFile;
        }
      }
    }
    
    // Otherwise, look in private directory
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  normalizeObjectEntityPath(
    rawPath: string,
  ): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }
  
    // Extract the path from the URL by removing query parameters and domain
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;
  
    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }
  
    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }
  
    // Extract the entity ID from the path
    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  // Tries to set the ACL policy for the object entity and return the normalized path.
  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  // Checks if the user can access the object entity.
  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}
