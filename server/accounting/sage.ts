import { getSetting, setSetting, getPublicBaseUrl } from "./settings.js";
import type { AccountingProvider, InvoiceData, PushResult } from "./types.js";

// Sage Business Cloud Accounting integration.

const SAGE_CLIENT_ID = process.env.SAGE_CLIENT_ID ?? "";
const SAGE_CLIENT_SECRET = process.env.SAGE_CLIENT_SECRET ?? "";
const SAGE_AUTH_BASE = "https://www.sageone.com/oauth2/auth/central";
const SAGE_TOKEN_URL = "https://oauth.accounting.sage.com/token";
const SAGE_API_BASE = "https://api.accounting.sage.com/v3.1";

// Kept at the historical /api/sage/callback path so existing Sage developer
// app registrations keep working.
function getRedirectUri(): string {
  return `${getPublicBaseUrl()}/api/sage/callback`;
}

async function storeTokens(data: any): Promise<void> {
  await setSetting("sage_access_token", data.access_token);
  await setSetting("sage_refresh_token", data.refresh_token);
  const expiresAt = Date.now() + (parseInt(data.expires_in, 10) - 60) * 1000;
  await setSetting("sage_token_expires_at", String(expiresAt));
}

async function tokenRequest(body: URLSearchParams, action: string): Promise<any> {
  const res = await fetch(SAGE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sage ${action} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = await getSetting("sage_refresh_token");
  if (!refreshToken) throw new Error("Sage not connected — no refresh token stored.");
  const data = await tokenRequest(new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: SAGE_CLIENT_ID,
    client_secret: SAGE_CLIENT_SECRET,
  }), "token refresh");
  await storeTokens(data);
  return data.access_token;
}

export async function getValidAccessToken(): Promise<string> {
  const expiresAtStr = await getSetting("sage_token_expires_at");
  const accessToken = await getSetting("sage_access_token");
  if (!accessToken) throw new Error("Sage is not connected. Please connect via Settings.");
  const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0;
  if (Date.now() >= expiresAt) {
    return refreshAccessToken();
  }
  return accessToken;
}

async function sageRequest<T = any>(
  token: string,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${SAGE_API_BASE}${path}`, {
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
    throw new Error(`Sage API ${method} ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

async function findOrCreateContact(
  token: string,
  name: string,
  email: string,
  phone?: string | null
): Promise<string> {
  const search = await sageRequest<any>(
    token,
    "GET",
    `/contacts?email=${encodeURIComponent(email)}&items_per_page=1`
  );
  if (search?.$items?.length > 0) {
    return search.$items[0].id;
  }
  const created = await sageRequest<any>(token, "POST", "/contacts", {
    contact: {
      name,
      email,
      telephone: phone ?? undefined,
      contact_type_ids: ["CUSTOMER"],
    },
  });
  return created.id;
}

async function getUkStandardVatRateId(token: string): Promise<string | null> {
  try {
    const res = await sageRequest<any>(token, "GET", "/tax_rates?items_per_page=100");
    const items: any[] = res?.$items ?? [];
    const standard = items.find(
      (r: any) =>
        r.percentage === 20 ||
        r.name?.toLowerCase().includes("standard") ||
        r.id?.toLowerCase().includes("standard")
    );
    return standard?.id ?? null;
  } catch {
    return null;
  }
}

// Zero-rate lookup for VAT-deferred quotes — invoice lines must not have VAT
// added by Sage when the quote was sold with VAT deferred.
async function getUkZeroVatRateId(token: string): Promise<string | null> {
  try {
    const res = await sageRequest<any>(token, "GET", "/tax_rates?items_per_page=100");
    const items: any[] = res?.$items ?? [];
    const zero = items.find(
      (r: any) =>
        r.percentage === 0 ||
        r.name?.toLowerCase().includes("zero") ||
        r.id?.toLowerCase().includes("zero")
    );
    return zero?.id ?? null;
  } catch {
    return null;
  }
}

async function getDefaultSalesLedgerAccountId(token: string): Promise<string | null> {
  try {
    const res = await sageRequest<any>(
      token,
      "GET",
      "/ledger_accounts?visible_in=sales&items_per_page=50"
    );
    const items: any[] = res?.$items ?? [];
    const sales = items.find(
      (a: any) =>
        a.nominal_code === "4000" ||
        a.name?.toLowerCase() === "sales" ||
        a.name?.toLowerCase().includes("general sales")
    );
    return sales?.id ?? items[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function pushInvoice(invoice: InvoiceData): Promise<PushResult> {
  const token = await getValidAccessToken();

  const [contactId, standardVatRateId, zeroVatRateId, ledgerAccountId] = await Promise.all([
    findOrCreateContact(token, invoice.contact.name, invoice.contact.email, invoice.contact.phone),
    getUkStandardVatRateId(token),
    getUkZeroVatRateId(token),
    getDefaultSalesLedgerAccountId(token),
  ]);

  // VAT-deferred quotes must go across with the zero rate so Sage doesn't add
  // 20% on top of totals the customer was quoted without VAT.
  const vatRateId = invoice.vatDeferred ? zeroVatRateId : standardVatRateId;

  const invoiceLines = invoice.lines.map((line) => ({
    description: line.description,
    quantity: `${line.quantity}.0`,
    unit_price: (line.unitPricePence / 100).toFixed(2),
    ...(vatRateId ? { tax_rate_id: vatRateId } : {}),
    ...(ledgerAccountId ? { ledger_account_id: ledgerAccountId } : {}),
  }));

  const today = new Date().toISOString().split("T")[0];

  const invoiceRes = await sageRequest<any>(token, "POST", "/sales_invoices", {
    sales_invoice: {
      contact_id: contactId,
      date: today,
      reference: invoice.reference,
      notes: invoice.notes,
      invoice_lines: invoiceLines,
    },
  });

  const invoiceId: string = invoiceRes.id;
  const invoiceNumber: string =
    invoiceRes.displayed_as ?? invoiceRes.invoice_number ?? invoice.reference;

  return { invoiceId, invoiceNumber };
}

export const sageProvider: AccountingProvider = {
  key: "sage",
  label: "Sage Business Cloud",
  isConfigured: () => !!(SAGE_CLIENT_ID && SAGE_CLIENT_SECRET),
  isConnected: async () => {
    const token = await getSetting("sage_access_token");
    return !!token && token.length > 0;
  },
  getAuthUrl: () => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: SAGE_CLIENT_ID,
      redirect_uri: getRedirectUri(),
      scope: "full_access",
    });
    return `${SAGE_AUTH_BASE}?filter=apiv3.1&${params.toString()}`;
  },
  handleCallback: async (query) => {
    const code = query.code;
    if (!code) throw new Error("Missing authorization code from Sage.");
    const data = await tokenRequest(new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
      client_id: SAGE_CLIENT_ID,
      client_secret: SAGE_CLIENT_SECRET,
    }), "token exchange");
    await storeTokens(data);
  },
  disconnect: async () => {
    await setSetting("sage_access_token", "");
    await setSetting("sage_refresh_token", "");
    await setSetting("sage_token_expires_at", "");
  },
  pushInvoice,
};
