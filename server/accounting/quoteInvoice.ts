import { pool } from "../db.js";
import type { InvoiceData, InvoiceLine } from "./types.js";

/**
 * Builds a provider-agnostic invoice from a quote. All line amounts are net
 * pence — each provider applies the correct tax treatment (standard or zero
 * rate for VAT-deferred quotes) when mapping to its own API.
 */
export async function buildInvoiceFromQuote(quoteId: string): Promise<InvoiceData> {
  const quoteRes = await pool.query(
    `SELECT q.*,
       v.title AS van_title, v.make AS van_make, v.model AS van_model, v.year AS van_year,
       v.price AS van_price, v.vat_included AS van_vat_included,
       k.name AS kit_name, k.price AS kit_price
     FROM quotes q
     LEFT JOIN vans v ON v.id = q.van_id
     LEFT JOIN kits k ON k.id = q.kit_id
     WHERE q.id = $1`,
    [quoteId]
  );

  if (!quoteRes.rows.length) throw new Error("Quote not found");
  const q = quoteRes.rows[0];

  const selectedUpgradeIds: string[] = Array.isArray(q.selected_upgrade_ids)
    ? q.selected_upgrade_ids
    : JSON.parse(q.selected_upgrade_ids ?? "[]");

  const selectedUpgrades: Record<string, number> =
    q.selected_upgrades && typeof q.selected_upgrades === "object"
      ? q.selected_upgrades
      : JSON.parse(q.selected_upgrades ?? "{}");

  const customExtras: Array<{ id: string; description: string; pricePence: number }> =
    Array.isArray(q.custom_extras)
      ? q.custom_extras
      : JSON.parse(q.custom_extras ?? "[]");

  let upgradeRows: Array<{ id: string; name: string; price: number }> = [];
  if (selectedUpgradeIds.length > 0) {
    const ur = await pool.query(
      "SELECT id, name, price FROM upgrades WHERE id = ANY($1::text[])",
      [selectedUpgradeIds]
    );
    upgradeRows = ur.rows;
  }

  const vatDeferred = q.vat_deferred === true;
  const lines: InvoiceLine[] = [];

  // The van itself is part of the quote total and must appear on the invoice.
  // Line amounts are net, so a VAT-inclusive van sticker price contributes its
  // net share.
  const vanLinePence = q.van_id
    ? (q.van_vat_included ? Math.round((q.van_price ?? 0) / 1.2) : (q.van_price ?? 0))
    : (q.custom_van_value ?? 0);
  if (vanLinePence > 0) {
    const vanLineDesc = q.van_title
      ? `${q.van_year ?? ""} ${q.van_make ?? ""} ${q.van_model ?? ""}`.trim() || q.van_title
      : (q.custom_van_description ?? "Customer vehicle");
    lines.push({ description: vanLineDesc, unitPricePence: vanLinePence, quantity: 1 });
  }

  if (q.kit_name && q.kit_price) {
    lines.push({ description: q.kit_name, unitPricePence: q.kit_price, quantity: 1 });
  }

  for (const upg of upgradeRows) {
    const qty = selectedUpgrades[upg.id] ?? 1;
    lines.push({ description: upg.name, unitPricePence: upg.price, quantity: qty });
  }

  for (const extra of customExtras) {
    if (extra.pricePence > 0) {
      lines.push({ description: extra.description, unitPricePence: extra.pricePence, quantity: 1 });
    }
  }

  // est_discount is the VAT-inclusive discount taken off what the customer
  // pays. Lines are net, so push the net share and let the provider's tax
  // rate gross it back up to exactly est_discount (deferred quotes have no
  // VAT share, so the net discount is the full amount).
  const discountPence = q.est_discount ?? 0;
  if (discountPence > 0) {
    const netDiscountPence = vatDeferred ? discountPence : Math.round(discountPence / 1.2);
    lines.push({ description: "Discount", unitPricePence: -netDiscountPence, quantity: 1 });
  }

  if (lines.length === 0) {
    lines.push({ description: "Mobile Tyre Van Conversion", unitPricePence: q.est_subtotal ?? 0, quantity: 1 });
  }

  const vanDesc = q.van_title
    ? `${q.van_year} ${q.van_make} ${q.van_model} – ${q.van_title}`
    : q.custom_van_description ?? null;

  const notes = [
    vanDesc ? `Vehicle: ${vanDesc}` : null,
    q.company ? `Company: ${q.company}` : null,
    q.phone ? `Phone: ${q.phone}` : null,
    q.notes ?? null,
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    quoteId,
    reference: `MTV-${quoteId.slice(0, 8).toUpperCase()}`,
    contact: { name: q.user_name, email: q.email, phone: q.phone },
    notes,
    vatDeferred,
    lines,
  };
}

/** Record a successful push on the quote (provider-agnostic columns). */
export async function recordInvoicePush(quoteId: string, provider: string, invoiceId: string, invoiceNumber: string): Promise<void> {
  // sage_invoice_id predates the multi-provider layer; it now stores the
  // active provider's invoice id for whichever provider pushed the quote.
  await pool.query(
    "UPDATE quotes SET sage_invoice_id = $1, sage_pushed_at = NOW() WHERE id = $2",
    [`${provider}:${invoiceId}`, quoteId]
  );
  await pool.query(
    `UPDATE quotes SET admin_notes_history = COALESCE(admin_notes_history, '[]'::json)::jsonb || $1::jsonb WHERE id = $2`,
    [JSON.stringify([{ text: `Invoice ${invoiceNumber} pushed to ${provider}`, timestamp: new Date().toISOString(), author: "System" }]), quoteId]
  );
}
