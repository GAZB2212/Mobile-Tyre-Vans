import { getSetting, setSetting, getPublicBaseUrl } from "./settings.js";
import type { AccountingProvider, InvoiceData, PushResult } from "./types.js";

// Xero accounting integration (standard OAuth2 code flow).
// Configure a Xero app at developer.xero.com with redirect URI
//   <site>/api/accounting/xero/callback
// and set XERO_CLIENT_ID / XERO_CLIENT_SECRET.

const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID ?? "";
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET ?? "";
const XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize";
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_API_BASE = "https://api.xero.com";

function getRedirectUri(): string {
  return `${getPublicBaseUrl()}/api/accounting/xero/callback`;
}

function basicAuthHeader(): string {
  return `Basic ${Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString("base64")}`;
}

async function tokenRequest(body: URLSearchParams, action: string): Promise<any> {
  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Xero ${action} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function storeTokens(data: any): Promise<void> {
  await setSetting("xero_access_token", data.access_token);
  await setSetting("xero_refresh_token", data.refresh_token);
  const expiresAt = Date.now() + (parseInt(data.expires_in, 10) - 60) * 1000;
  await setSetting("xero_token_expires_at", String(expiresAt));
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = await getSetting("xero_refresh_token");
  if (!refreshToken) throw new Error("Xero not connected — no refresh token stored.");
  const data = await tokenRequest(new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  }), "token refresh");
  await storeTokens(data);
  return data.access_token;
}

async function getValidAccessToken(): Promise<string> {
  const expiresAtStr = await getSetting("xero_token_expires_at");
  const accessToken = await getSetting("xero_access_token");
  if (!accessToken) throw new Error("Xero is not connected. Please connect via Settings.");
  const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0;
  if (Date.now() >= expiresAt) {
    return refreshAccessToken();
  }
  return accessToken;
}

/** The Xero organisation ("tenant") this connection is scoped to. */
async function resolveTenantId(token: string): Promise<string> {
  const stored = await getSetting("xero_tenant_id");
  if (stored) return stored;
  const res = await fetch(`${XERO_API_BASE}/connections`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Xero connections lookup failed (${res.status}): ${await res.text()}`);
  }
  const connections: any[] = await res.json();
  const tenantId = connections?.[0]?.tenantId;
  if (!tenantId) throw new Error("No Xero organisation is linked to this connection.");
  await setSetting("xero_tenant_id", tenantId);
  return tenantId;
}

async function xeroApi<T = any>(token: string, tenantId: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${XERO_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Xero-tenant-id": tenantId,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Xero API ${method} ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

async function pushInvoice(invoice: InvoiceData): Promise<PushResult> {
  const token = await getValidAccessToken();
  const tenantId = await resolveTenantId(token);

  // UK tax types: OUTPUT2 = 20% standard rate on income; ZERORATEDOUTPUT for
  // VAT-deferred quotes so Xero adds no VAT on top of the net lines.
  const taxType = invoice.vatDeferred ? "ZERORATEDOUTPUT" : "OUTPUT2";

  const payload = {
    Invoices: [
      {
        Type: "ACCREC",
        Contact: {
          Name: invoice.contact.name,
          EmailAddress: invoice.contact.email || undefined,
        },
        Date: new Date().toISOString().split("T")[0],
        Reference: invoice.reference,
        Status: "DRAFT",
        LineAmountTypes: "Exclusive",
        LineItems: invoice.lines.map((line) => ({
          Description: line.description,
          Quantity: line.quantity,
          UnitAmount: Number((line.unitPricePence / 100).toFixed(2)),
          TaxType: taxType,
        })),
      },
    ],
  };

  const res = await xeroApi<any>(token, tenantId, "POST", "/api.xro/2.0/Invoices", payload);
  const created = res?.Invoices?.[0];
  if (!created?.InvoiceID) {
    throw new Error(`Xero invoice creation returned no invoice: ${JSON.stringify(res).slice(0, 500)}`);
  }
  return {
    invoiceId: created.InvoiceID,
    invoiceNumber: created.InvoiceNumber ?? invoice.reference,
  };
}

export const xeroProvider: AccountingProvider = {
  key: "xero",
  label: "Xero",
  isConfigured: () => !!(XERO_CLIENT_ID && XERO_CLIENT_SECRET),
  isConnected: async () => {
    const token = await getSetting("xero_access_token");
    return !!token && token.length > 0;
  },
  getAuthUrl: () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: XERO_CLIENT_ID,
      redirect_uri: getRedirectUri(),
      scope: "openid offline_access accounting.transactions accounting.contacts",
      state: "xero-connect",
    });
    return `${XERO_AUTH_URL}?${params.toString()}`;
  },
  handleCallback: async (query) => {
    const code = query.code;
    if (!code) throw new Error("Missing authorization code from Xero.");
    const data = await tokenRequest(new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
    }), "token exchange");
    await storeTokens(data);
    // Resolve and cache the tenant immediately so the first push is fast and
    // connection problems surface at connect time.
    await setSetting("xero_tenant_id", "");
    await resolveTenantId(data.access_token);
  },
  disconnect: async () => {
    await setSetting("xero_access_token", "");
    await setSetting("xero_refresh_token", "");
    await setSetting("xero_token_expires_at", "");
    await setSetting("xero_tenant_id", "");
  },
  pushInvoice,
};
