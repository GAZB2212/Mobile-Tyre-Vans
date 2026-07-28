// Common contract for accounting integrations (Sage, Xero, QuickBooks).
// Each deployment picks its provider via the `accounting_provider` site
// setting; everything above this layer is provider-agnostic.

export interface InvoiceLine {
  description: string;
  /** Net (ex-VAT) unit price in pence. Negative for discount lines. */
  unitPricePence: number;
  quantity: number;
}

export interface InvoiceData {
  quoteId: string;
  /** Human reference, e.g. MTV-1A2B3C4D. */
  reference: string;
  contact: {
    name: string;
    email: string;
    phone?: string | null;
  };
  notes: string;
  /** When true the sale was VAT-deferred — providers must not add VAT. */
  vatDeferred: boolean;
  lines: InvoiceLine[];
}

export interface PushResult {
  invoiceId: string;
  invoiceNumber: string;
}

export type AccountingProviderKey = "sage" | "xero" | "quickbooks";

export interface AccountingProvider {
  key: AccountingProviderKey;
  label: string;
  /** True when the deployment has API credentials configured (env vars). */
  isConfigured(): boolean;
  /** True when an admin has completed the OAuth connection. */
  isConnected(): Promise<boolean>;
  getAuthUrl(): string;
  /** Handle the OAuth redirect. Receives the full query string params. */
  handleCallback(query: Record<string, string | undefined>): Promise<void>;
  disconnect(): Promise<void>;
  pushInvoice(invoice: InvoiceData): Promise<PushResult>;
}
