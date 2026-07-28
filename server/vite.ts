import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";
import { resolveStaticMeta, injectMetaIntoHtml } from "./seo";
import { prefetchForRoute, extractSlug, resolveSSRPath } from "./ssr-prefetch";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

function applyMetaInjection(html: string, urlPath: string): string {
  const meta = resolveStaticMeta(urlPath);
  if (meta) {
    return injectMetaIntoHtml(html, meta);
  }
  return html;
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );

      if (req.__seoMeta) {
        template = injectMetaIntoHtml(template, req.__seoMeta);
      } else {
        template = applyMetaInjection(template, url);
      }

      const page = await vite.transformIndexHtml(url, template);

      // Skip SSR for admin routes — serve plain SPA shell
      if (url.startsWith("/admin")) {
        res.status(200).set({ "Content-Type": "text/html" }).end(page);
        return;
      }

      // Skip SSR in development — hydration mismatches from SSR-incompatible
      // components (useLayoutEffect, sessionStorage, etc.) break the dev preview.
      // SSR is only used in production for search-engine crawlability.
      if (process.env.NODE_ENV !== "production") {
        res.status(200).set({ "Content-Type": "text/html" }).end(page);
        return;
      }

      // Perform SSR for all other routes
      try {
        const { render } = await vite.ssrLoadModule("/src/entry-server.tsx");
        const urlPath = url.split("?")[0];
        const ssrPath = resolveSSRPath(urlPath);
        const params = extractSlug(ssrPath);
        const { dehydratedState } = await prefetchForRoute(ssrPath, params);

        // Render using the resolved SSR path (e.g. /configurator -> /configurator/van)
        const ssrUrl = ssrPath + (url.includes("?") ? url.slice(url.indexOf("?")) : "");
        const appHtml = render(ssrUrl, dehydratedState);
        const dehydratedJson = JSON.stringify(dehydratedState)
          .replace(/</g, "\\u003c")
          .replace(/>/g, "\\u003e")
          .replace(/&/g, "\\u0026");

        const ssrPage = page
          .replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`)
          .replace(
            "</body>",
            `<script>window.__TANSTACK_QUERY_STATE__=${dehydratedJson};</script></body>`,
          );

        res.status(200).set({ "Content-Type": "text/html" }).end(ssrPage);
      } catch (ssrErr) {
        // If SSR fails, fall back to plain SPA shell so the app still works
        vite.ssrFixStacktrace(ssrErr as Error);
        log(`SSR render failed for ${url}, falling back to SPA: ${(ssrErr as Error).message}`, "ssr");
        res.status(200).set({ "Content-Type": "text/html" }).end(page);
      }
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

// Build SSR bundle for production using esbuild
async function buildSsrBundle(distPath: string): Promise<string | null> {
  const ssrBundlePath = path.resolve(distPath, "entry-server.mjs");
  if (fs.existsSync(ssrBundlePath)) {
    return ssrBundlePath;
  }
  try {
    const esbuild = await import("esbuild");
    const clientSrcPath = path.resolve(import.meta.dirname, "..", "client", "src");
    const sharedPath = path.resolve(import.meta.dirname, "..", "shared");
    const assetsPath = path.resolve(import.meta.dirname, "..", "attached_assets");
    await esbuild.build({
      entryPoints: [path.resolve(clientSrcPath, "entry-server.tsx")],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: ssrBundlePath,
      packages: "external",
      alias: {
        "@": clientSrcPath,
        "@shared": sharedPath,
        "@assets": assetsPath,
      },
      jsx: "automatic",
      loader: {
        ".tsx": "tsx",
        ".ts": "ts",
        ".png": "dataurl",
        ".jpg": "dataurl",
        ".jpeg": "dataurl",
        ".svg": "dataurl",
        ".gif": "dataurl",
        ".webp": "dataurl",
        ".mp4": "empty",
        ".webm": "empty",
      },
    });
    log("SSR bundle built for production", "ssr");
    return ssrBundlePath;
  } catch (err) {
    log(`Failed to build SSR bundle: ${(err as Error).message}`, "ssr");
    return null;
  }
}

let ssrRenderFn: ((url: string, dehydratedState?: unknown) => string) | null = null;
let ssrBuildAttempted = false;

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Lazily build and load the SSR bundle on first request
  app.use("*", async (req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    let html = fs.readFileSync(indexPath, "utf-8");

    if (req.__seoMeta) {
      html = injectMetaIntoHtml(html, req.__seoMeta);
    } else {
      html = applyMetaInjection(html, req.originalUrl);
    }

    // Skip SSR for admin routes
    const url = req.originalUrl;
    if (url.startsWith("/admin")) {
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
      return;
    }

    // Attempt to load/build SSR bundle and perform SSR
    if (!ssrBuildAttempted) {
      ssrBuildAttempted = true;
      const bundlePath = await buildSsrBundle(distPath);
      if (bundlePath) {
        try {
          // Dynamic ESM import of the pre-built bundle
          const mod = await import(bundlePath);
          ssrRenderFn = mod.render || null;
        } catch (err) {
          log(`Failed to load SSR bundle: ${(err as Error).message}`, "ssr");
        }
      }
    }

    if (ssrRenderFn) {
      try {
        const urlPath = url.split("?")[0];
        const ssrPath = resolveSSRPath(urlPath);
        const params = extractSlug(ssrPath);
        const { dehydratedState } = await prefetchForRoute(ssrPath, params);
        const ssrUrl = ssrPath + (url.includes("?") ? url.slice(url.indexOf("?")) : "");
        const appHtml = ssrRenderFn(ssrUrl, dehydratedState);
        const dehydratedJson = JSON.stringify(dehydratedState)
          .replace(/</g, "\\u003c")
          .replace(/>/g, "\\u003e")
          .replace(/&/g, "\\u0026");

        html = html
          .replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`)
          .replace(
            "</body>",
            `<script>window.__TANSTACK_QUERY_STATE__=${dehydratedJson};</script></body>`,
          );
      } catch (err) {
        log(`SSR render failed for ${url}, falling back to SPA: ${(err as Error).message}`, "ssr");
      }
    }

    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  });
}
