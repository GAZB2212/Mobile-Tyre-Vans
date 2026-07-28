import { getSetting, setSetting } from "./settings.js";
import { sageProvider } from "./sage.js";
import { xeroProvider } from "./xero.js";
import { quickbooksProvider } from "./quickbooks.js";
import type { AccountingProvider, AccountingProviderKey } from "./types.js";

export { buildInvoiceFromQuote, recordInvoicePush } from "./quoteInvoice.js";
export type { AccountingProvider, AccountingProviderKey, InvoiceData, PushResult } from "./types.js";

export const accountingProviders: Record<AccountingProviderKey, AccountingProvider> = {
  sage: sageProvider,
  xero: xeroProvider,
  quickbooks: quickbooksProvider,
};

export function getProvider(key: string): AccountingProvider | null {
  return (accountingProviders as Record<string, AccountingProvider>)[key] ?? null;
}

const ACTIVE_PROVIDER_KEY = "accounting_provider";

/** The provider this deployment pushes invoices to. Defaults to Sage. */
export async function getActiveProvider(): Promise<AccountingProvider> {
  const key = (await getSetting(ACTIVE_PROVIDER_KEY)) ?? "sage";
  return getProvider(key) ?? sageProvider;
}

export async function setActiveProvider(key: AccountingProviderKey): Promise<void> {
  if (!accountingProviders[key]) throw new Error(`Unknown accounting provider: ${key}`);
  await setSetting(ACTIVE_PROVIDER_KEY, key);
}

export async function getAccountingStatus() {
  const activeKey = (await getSetting(ACTIVE_PROVIDER_KEY)) ?? "sage";
  const providers = await Promise.all(
    Object.values(accountingProviders).map(async (p) => ({
      key: p.key,
      label: p.label,
      configured: p.isConfigured(),
      connected: p.isConfigured() ? await p.isConnected() : false,
    }))
  );
  return { active: activeKey, providers };
}
