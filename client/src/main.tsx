import { createRoot, hydrateRoot } from "react-dom/client";
import { Router } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { HydrationBoundary } from "@tanstack/react-query";
import App from "./App";
import { queryClient } from "./lib/queryClient";
import "./index.css";

declare global {
  interface Window {
    __TANSTACK_QUERY_STATE__?: unknown;
  }
}

const rootEl = document.getElementById("root")!;

const app = (
  <QueryClientProvider client={queryClient}>
    <HydrationBoundary state={window.__TANSTACK_QUERY_STATE__}>
      <Router>
        <App />
      </Router>
    </HydrationBoundary>
  </QueryClientProvider>
);

// Use hydrateRoot only when the server has pre-rendered content into #root.
// Otherwise fall back to a normal createRoot render (dev mode, SSR disabled).
if (window.__TANSTACK_QUERY_STATE__ && rootEl.children.length > 0) {
  hydrateRoot(rootEl, app);
} else {
  createRoot(rootEl).render(app);
}
