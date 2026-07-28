import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Brand/vertical env vars forwarded into the client bundle (see
// shared/brand.ts). Accepts either the plain or VITE_-prefixed name so a
// deployment only has to set one. Statically replaced in dev and build alike.
const BRAND_ENV_KEYS = [
  "VERTICAL", "BRAND_NAME", "BRAND_SHORT_NAME", "BRAND_INITIALS",
  "BRAND_DOMAIN", "BRAND_PHONE", "BRAND_PHONE_HREF", "BRAND_PHONE_INTL",
  "BRAND_SALES_EMAIL", "BRAND_INFO_EMAIL", "BRAND_PRIVACY_EMAIL",
  "BRAND_TWITTER", "BRAND_ASSISTANT_NAME", "SITE_URL", "THEME",
] as const;
const brandDefine = Object.fromEntries(
  BRAND_ENV_KEYS.map((key) => [
    `import.meta.env.VITE_${key}`,
    JSON.stringify(process.env[`VITE_${key}`] ?? process.env[key] ?? ""),
  ]),
);

export default defineConfig({
  define: brandDefine,
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
