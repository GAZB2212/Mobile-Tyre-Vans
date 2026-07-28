import { QueryClient, dehydrate } from "@tanstack/react-query";

const SERVER_PORT = process.env.PORT || 5000;
const SERVER_BASE = `http://localhost:${SERVER_PORT}`;

function makeServerFetcher(baseUrl: string) {
  return async ({ queryKey }: { queryKey: readonly unknown[] }) => {
    const path = (queryKey as string[]).join("/");
    const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
    const res = await fetch(url);
    if (res.status === 401) return null;
    if (!res.ok) return null;
    return res.json();
  };
}

interface SlugParams {
  slug?: string;
}

export async function prefetchForRoute(
  urlPath: string,
  params: SlugParams = {}
): Promise<{ dehydratedState: unknown }> {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryFn: makeServerFetcher(SERVER_BASE),
        retry: false,
        staleTime: 60 * 1000,
      },
    },
  });

  const prefetchAll = (...keys: Array<readonly unknown[]>) =>
    Promise.allSettled(
      keys.map((queryKey) => queryClient.prefetchQuery({ queryKey }))
    );

  try {
    if (urlPath === "/stock") {
      await prefetchAll(["/api/vans"]);
    } else if (urlPath.startsWith("/stock/") && params.slug) {
      await prefetchAll(["/api/vans/slug", params.slug]);
    } else if (urlPath === "/finance" || urlPath.startsWith("/finance/")) {
      await prefetchAll(["/api/finance-plans"]);
    } else if (urlPath === "/gallery") {
      await prefetchAll(["/api/gallery-items"]);
    } else if (urlPath === "/blog") {
      await prefetchAll(["/api/blog-posts"]);
    } else if (urlPath.startsWith("/blog/") && params.slug) {
      await prefetchAll(["/api/blog-posts", params.slug]);
    } else if (
      urlPath === "/configurator" ||
      urlPath === "/configurator/van"
    ) {
      // SelectVan step: needs van list
      await prefetchAll(["/api/vans"]);
    } else if (urlPath === "/configurator/kit") {
      // SelectKit: needs kit list (van ID unknown server-side)
      await prefetchAll(["/api/kits"]);
    } else if (urlPath === "/configurator/upgrades") {
      // SelectUpgrades: needs full configurator data
      await prefetchAll(["/api/configurator/data"]);
    } else if (urlPath === "/configurator/finance") {
      // SelectFinance: needs upgrades + training options
      await prefetchAll(["/api/upgrades"], ["/api/training-options"]);
    }
  } catch {
    // Prefetch errors are non-fatal — SSR renders from dehydrated state
  }

  const dehydratedState = dehydrate(queryClient);
  queryClient.clear();

  return { dehydratedState };
}

export function extractSlug(urlPath: string): SlugParams {
  const stockMatch = urlPath.match(/^\/stock\/([^/]+)/);
  if (stockMatch) return { slug: stockMatch[1] };
  const blogMatch = urlPath.match(/^\/blog\/([^/]+)/);
  if (blogMatch) return { slug: blogMatch[1] };
  return {};
}

/**
 * Returns the canonical SSR path for a given URL path.
 * For /configurator, the SSR target is /configurator/van so
 * wouter renders SelectVan content instead of an empty redirect.
 */
export function resolveSSRPath(urlPath: string): string {
  if (urlPath === "/configurator") {
    return "/configurator/van";
  }
  return urlPath;
}
