import { pool } from "../db.js";

// Shared site_settings helpers for accounting providers (OAuth tokens etc.).

export async function getSetting(key: string): Promise<string | null> {
  const result = await pool.query(
    "SELECT value FROM site_settings WHERE key = $1",
    [key]
  );
  return result.rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await pool.query(
    `INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value]
  );
}

/** Resolve the public base URL for OAuth redirect URIs. */
export function getPublicBaseUrl(): string {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    const primary = domains.split(",")[0].trim();
    return `https://${primary}`;
  }
  return `http://localhost:${process.env.PORT ?? 5000}`;
}
