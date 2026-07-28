import { getSetting, setSetting, getPublicBaseUrl } from "./settings.js";
import type { AccountingProvider, InvoiceData, PushResult } from "./types.js";

// QuickBooks Online integration (Intuit OAuth2 code flow).
// Configure an app at developer.intuit.com with redirect URI
//   <site>/api/accounting/quickbooks/callback
// and set QUICKBOOKS_CLIENT_ID / QUICKBOOKS_CLIENT_SECRET.
// Set QUICKBOOKS_ENVIRONMENT=sandbox to target the Intuit sandbox.

const QBO_CLIENT_ID = process.env.QUICKBOOKS_CLIENT_ID ?? "";
const QBO_CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET ?? "";
const QBO_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QBO_API_BASE = process.env.QUICKBOOKS_ENVIRONMENT === "sandbox"
  ? "https://sandbox-quickbooks.api.intuit.com"
  : "https://quickbooks.api.intuit.com";

function getRedirectUri(): string {
  return `${getPublicBaseUrl()}/api/accounting/quickbooks/callback`;
}

function basicAuthHeader(): string {
  return `Basic ${Buffer.from(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`).toString("base64")}`;
}

async function tokenRequest(body: URLSearchParams, action: string): Promise<any> {
  const res = await fetch(QBO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: basicAuthHeader(),
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QuickBooks ${action} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function storeTokens(data: any): Promise<void> {
  await setSetting("quickbooks_access_token", data.access_token);
  await setSetting("quickbooks_refresh_token", data.refresh_token);
  const expiresAt = Date.now() + (parseInt(data.expires_in, 10) - 60) * 1000;
  await setSetting("quickbooks_token_expires_at", String(expiresAt));
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = await getSetting("quickbooks_refresh_token");
  if (!refreshToken) throw new Error("QuickBooks not connected — no refresh token stored.");
  const data = await tokenRequest(new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  }), "token refresh");
  await storeTokens(data);
  return data.access_token;
}

async function getValidAccessToken(): Promise<string> {
  const expiresAtStr = await getSetting("quickbooks_token_expires_at");
  const accessToken = await getSetting("quickbooks_access_token");
  if (!accessToken) throw new Error("QuickBooks is not connected. Please connect via Settings.");
  const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0;
  if (Date.now() >= expiresAt) {
    return refreshAccessToken();
  }
  return accessToken;
}

async function getRealmId(): Promise<string> {
  const realmId = await getSetting("quickbooks_realm_id");
  if (!realmId) throw new Error("QuickBooks company (realm) is not set. Reconnect via Settings.");
  return realmId;
}

async function qboApi<T = any>(token: string, realmId: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${QBO_API_BASE}/v3/company/${realmId}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QuickBooks API ${method} ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

async function qboQuery<T = any>(token: string, realmId: string, query: string): Promise<T> {
  return qboApi<T>(token, realmId, "GET", `/query?query=${encodeURIComponent(query)}&minorversion=73`);
}

function escapeQboString(value: string): string {
  return value.replace(/'/g, "\\'");
}

async function findOrCreateCustomer(token: string, realmId: string, name: string, email: string, phone?: string | null): Promise<string> {
  if (email) {
    const found = await qboQuery<any>(token, realmId,
      `select Id from Customer where PrimaryEmailAddr = '${escapeQboString(email)}' maxresults 1`);
    const existing = found?.QueryResponse?.Customer?.[0]?.Id;
    if (existing) return existing;
  }
  const byName = await qboQuery<any>(token, realmId,
    `select Id from Customer where DisplayName = '${escapeQboString(name)}' maxresults 1`);
  const existingByName = byName?.QueryResponse?.Customer?.[0]?.Id;
  if (existingByName) return existingByName;

  const created = await qboApi<any>(token, realmId, "POST", "/customer?minorversion=73", {
    DisplayName: name,
    ...(email ? { PrimaryEmailAddr: { Address: email } } : {}),
    ...(phone ? { PrimaryPhone: { FreeFormNumber: phone } } : {}),
  });
  const id = created?.Customer?.Id;
  if (!id) throw new Error("QuickBooks customer creation returned no id.");
  return id;
}

/**
 * QuickBooks invoice lines require an Item reference. Reuse (or create once)
 * a generic "Van Conversion" service item wired to the first income account.
 */
async function getServiceItemId(token: string, realmId: string): Promise<string> {
  const cached = await getSetting("quickbooks_service_item_id");
  if (cached) return cached;

  const found = await qboQuery<any>(token, realmId,
    `select Id from Item where Name = 'Van Conversion' maxresults 1`);
  const existing = found?.QueryResponse?.Item?.[0]?.Id;
  if (existing) {
    await setSetting("quickbooks_service_item_id", existing);
    return existing;
  }

  const accounts = await qboQuery<any>(token, realmId,
    `select Id, Name from Account where AccountType = 'Income' maxresults 1`);
  const incomeAccountId = accounts?.QueryResponse?.Account?.[0]?.Id;
  if (!incomeAccountId) throw new Error("No income account found in QuickBooks to attach the service item to.");

  const created = await qboApi<any>(token, realmId, "POST", "/item?minorversion=73", {
    Name: "Van Conversion",
    Type: "Service",
    IncomeAccountRef: { value: incomeAccountId },
  });
  const id = created?.Item?.Id;
  if (!id) throw new Error("QuickBooks item creation returned no id.");
  await setSetting("quickbooks_service_item_id", id);
  return id;
}

async function pushInvoice(invoice: InvoiceData): Promise<PushResult> {
  const token = await getValidAccessToken();
  const realmId = await getRealmId();

  const [customerId, itemId] = await Promise.all([
    findOrCreateCustomer(token, realmId, invoice.contact.name, invoice.contact.email, invoice.contact.phone),
    getServiceItemId(token, realmId),
  ]);

  const payload = {
    CustomerRef: { value: customerId },
    DocNumber: invoice.reference.slice(0, 21),
    PrivateNote: invoice.notes.slice(0, 4000),
    // Line amounts are net; let QuickBooks apply tax on top. For VAT-deferred
    // quotes taxes are suppressed entirely.
    GlobalTaxCalculation: invoice.vatDeferred ? "NotApplicable" : "TaxExcluded",
    Line: invoice.lines.map((line) => ({
      Amount: Number(((line.unitPricePence * line.quantity) / 100).toFixed(2)),
      Description: line.description,
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        ItemRef: { value: itemId },
        Qty: line.quantity,
        UnitPrice: Number((line.unitPricePence / 100).toFixed(2)),
      },
    })),
  };

  const res = await qboApi<any>(token, realmId, "POST", "/invoice?minorversion=73", payload);
  const created = res?.Invoice;
  if (!created?.Id) {
    throw new Error(`QuickBooks invoice creation returned no invoice: ${JSON.stringify(res).slice(0, 500)}`);
  }
  return {
    invoiceId: created.Id,
    invoiceNumber: created.DocNumber ?? invoice.reference,
  };
}

export const quickbooksProvider: AccountingProvider = {
  key: "quickbooks",
  label: "QuickBooks Online",
  isConfigured: () => !!(QBO_CLIENT_ID && QBO_CLIENT_SECRET),
  isConnected: async () => {
    const token = await getSetting("quickbooks_access_token");
    return !!token && token.length > 0;
  },
  getAuthUrl: () => {
    const params = new URLSearchParams({
      client_id: QBO_CLIENT_ID,
      response_type: "code",
      scope: "com.intuit.quickbooks.accounting",
      redirect_uri: getRedirectUri(),
      state: "quickbooks-connect",
    });
    return `${QBO_AUTH_URL}?${params.toString()}`;
  },
  handleCallback: async (query) => {
    const code = query.code;
    if (!code) throw new Error("Missing authorization code from QuickBooks.");
    const data = await tokenRequest(new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
    }), "token exchange");
    await storeTokens(data);
    // Intuit sends the company id (realm) alongside the code.
    if (query.realmId) {
      await setSetting("quickbooks_realm_id", query.realmId);
    }
  },
  disconnect: async () => {
    await setSetting("quickbooks_access_token", "");
    await setSetting("quickbooks_refresh_token", "");
    await setSetting("quickbooks_token_expires_at", "");
    await setSetting("quickbooks_realm_id", "");
    await setSetting("quickbooks_service_item_id", "");
  },
  pushInvoice,
};
