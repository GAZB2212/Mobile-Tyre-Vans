import { QueryClient, QueryFunction } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Bearer token helpers — stored in localStorage so they survive page navigation
// inside Replit's cross-origin iframe (where session cookies are blocked).
// ---------------------------------------------------------------------------
export function getAuthToken(): string | null {
  try { return localStorage.getItem("_authToken"); } catch { return null; }
}
export function setAuthToken(token: string): void {
  try { localStorage.setItem("_authToken", token); } catch {}
}
export function clearAuthToken(): void {
  try { localStorage.removeItem("_authToken"); } catch {}
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...authHeaders(),
  };
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: authHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/**
 * Shared data-fetching helper for admin queryFns.
 * Uses apiRequest (which already adds auth headers and throws on non-ok
 * responses) then parses JSON, surfacing a clear error on parse failures
 * rather than silently returning broken data.
 */
export async function fetchJson<T>(url: string): Promise<T> {
  const res = await apiRequest("GET", url);
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(`Server returned invalid data from ${url}`);
  }
}

/**
 * Parses the JSON body from a mutation Response, surfacing a clear error
 * on parse failures rather than letting an untyped runtime error propagate.
 * Use this instead of `.then(r => r.json())` in mutation functions.
 */
export async function parseMutationJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error("Server returned an unexpected response format.");
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
