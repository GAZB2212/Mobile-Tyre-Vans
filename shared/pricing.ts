// Single source of truth for quote money maths, shared by server routes and
// client calculators so the figures a customer sees, the figures we store,
// and the figures we email/invoice can never drift apart.
//
// All monetary values are integer pence.

export const VAT_RATE = 0.2;

/**
 * The amount a van contributes to a quote's ex-VAT subtotal.
 * Vans listed with `vatIncluded` have VAT inside their sticker price, so the
 * net contribution is price / 1.2 — otherwise quoting would charge VAT on VAT.
 */
export function vanNetPrice(
  van: { price: number; vatIncluded?: boolean | null } | null | undefined,
  customVanValue?: number | null,
): number {
  if (van) {
    return van.vatIncluded ? Math.round(van.price / (1 + VAT_RATE)) : van.price;
  }
  return customVanValue ?? 0;
}

export interface QuoteTotalsInput {
  /** Ex-VAT subtotal (van net + kit + upgrades×qty + training + extras). */
  subtotal: number;
  discountType?: "percentage" | "fixed" | null;
  discountValue?: number | null;
  /** When true, no VAT is charged on the quote (VAT-deferred sale). */
  vatDeferred?: boolean | null;
}

export interface QuoteTotals {
  /** VAT on the pre-discount subtotal (0 when deferred). */
  vat: number;
  /** Subtotal + VAT before any discount. */
  totalPreDiscount: number;
  /** Discount applied to the VAT-inclusive total, clamped to it. */
  discountAmount: number;
  /** What the customer pays: totalPreDiscount - discountAmount. */
  totalAfterDiscount: number;
  /** VAT portion of the post-discount total (stored as estVAT). */
  finalVAT: number;
  /** Ex-VAT portion of the post-discount total (stored as estSubtotal). */
  finalSubtotal: number;
}

/**
 * Canonical quote totals calculation. Discounts are applied to the
 * VAT-inclusive total; stored estSubtotal/estVAT are back-calculated from the
 * post-discount total so line items always reconcile with what is charged.
 */
export function computeQuoteTotals(input: QuoteTotalsInput): QuoteTotals {
  const subtotal = Math.max(0, Math.round(input.subtotal));
  const vatDeferred = input.vatDeferred === true;
  const vat = vatDeferred ? 0 : Math.round(subtotal * VAT_RATE);
  const totalPreDiscount = subtotal + vat;

  let discountAmount = 0;
  if (input.discountType && input.discountValue) {
    if (input.discountType === "percentage") {
      discountAmount = Math.round((totalPreDiscount * input.discountValue) / 100);
    } else if (input.discountType === "fixed") {
      discountAmount = input.discountValue;
    }
  }
  discountAmount = Math.min(Math.max(discountAmount, 0), totalPreDiscount);

  const totalAfterDiscount = totalPreDiscount - discountAmount;
  // When VAT is charged at 20%, the VAT share of any inclusive amount is 1/6.
  const finalVAT = vatDeferred ? 0 : Math.round(totalAfterDiscount / 6);
  const finalSubtotal = totalAfterDiscount - finalVAT;

  return { vat, totalPreDiscount, discountAmount, totalAfterDiscount, finalVAT, finalSubtotal };
}

/**
 * Standard monthly/weekly finance figures for a given financed amount.
 * `aprBps` is the plan's APR in basis points (e.g. 1090 = 10.9%).
 */
export function computeFinancePayments(
  totalPence: number,
  depositPence: number,
  termMonths: number,
  aprBps: number,
): { monthlyPayment: number; weeklyPayment: number } | null {
  if (!termMonths || termMonths <= 0 || totalPence <= 0) return null;
  const principal = (totalPence - depositPence) / 100;
  if (principal <= 0) return null;
  const r = aprBps / 10000 / 12;
  const n = termMonths;
  const monthly = r === 0
    ? principal / n
    : principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return {
    monthlyPayment: Math.round(monthly * 100),
    weeklyPayment: Math.round((monthly * 12 / 52) * 100),
  };
}
