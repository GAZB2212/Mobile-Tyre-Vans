import { renderToString } from "react-dom/server";
import { Router } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HydrationBoundary } from "@tanstack/react-query";
import AppServer from "./AppServer";

const SERVER_PORT = (typeof process !== "undefined" && process.env?.PORT) || 5000;
const SERVER_BASE = `http://localhost:${SERVER_PORT}`;

function makeServerQueryFn() {
  return async ({ queryKey }: { queryKey: readonly unknown[] }) => {
    const path = (queryKey as string[]).join("/");
    const url = path.startsWith("http") ? path : `${SERVER_BASE}${path}`;
    const res = await fetch(url);
    if (res.status === 401) return null;
    if (!res.ok) throw new Error(`${res.status}: ${path}`);
    return res.json();
  };
}

export function render(url: string, dehydratedState?: unknown): string {
  const ssrPath = url.split("?")[0];
  const ssrSearch = url.includes("?") ? url.slice(url.indexOf("?")) : "";

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryFn: makeServerQueryFn(),
        retry: false,
        staleTime: Infinity,
      },
    },
  });

  try {
    return renderToString(
      <QueryClientProvider client={queryClient}>
        <HydrationBoundary state={dehydratedState}>
          <Router ssrPath={ssrPath} ssrSearch={ssrSearch}>
            <AppServer />
          </Router>
        </HydrationBoundary>
      </QueryClientProvider>
    );
  } finally {
    queryClient.clear();
  }
}
