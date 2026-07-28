import { describe, it, expect } from "vitest";
import { computeQuoteTotals, vanNetPrice, computeFinancePayments } from "@shared/pricing";

describe("computeQuoteTotals", () => {
  it("adds 20% VAT with no discount", () => {
    const t = computeQuoteTotals({ subtotal: 10_000_00 });
    expect(t.vat).toBe(2_000_00);
    expect(t.totalPreDiscount).toBe(12_000_00);
    expect(t.discountAmount).toBe(0);
    expect(t.totalAfterDiscount).toBe(12_000_00);
    expect(t.finalSubtotal + t.finalVAT).toBe(t.totalAfterDiscount);
  });

  it("charges no VAT when deferred", () => {
    const t = computeQuoteTotals({ subtotal: 10_000_00, vatDeferred: true });
    expect(t.vat).toBe(0);
    expect(t.finalVAT).toBe(0);
    expect(t.totalAfterDiscount).toBe(10_000_00);
    expect(t.finalSubtotal).toBe(10_000_00);
  });

  it("applies a fixed discount to the VAT-inclusive total and back-calculates VAT", () => {
    const t = computeQuoteTotals({ subtotal: 10_000_00, discountType: "fixed", discountValue: 1_200_00 });
    expect(t.discountAmount).toBe(1_200_00);
    expect(t.totalAfterDiscount).toBe(10_800_00);
    // VAT share of an inclusive amount at 20% is 1/6
    expect(t.finalVAT).toBe(1_800_00);
    expect(t.finalSubtotal).toBe(9_000_00);
  });

  it("applies a percentage discount", () => {
    const t = computeQuoteTotals({ subtotal: 10_000_00, discountType: "percentage", discountValue: 10 });
    expect(t.discountAmount).toBe(1_200_00);
    expect(t.totalAfterDiscount).toBe(10_800_00);
  });

  it("clamps the discount so totals never go negative", () => {
    const t = computeQuoteTotals({ subtotal: 100_00, discountType: "fixed", discountValue: 999_999_99 });
    expect(t.totalAfterDiscount).toBe(0);
    expect(t.discountAmount).toBe(120_00);
  });

  it("combines deferral and discount without re-adding VAT", () => {
    const t = computeQuoteTotals({ subtotal: 10_000_00, vatDeferred: true, discountType: "fixed", discountValue: 1_000_00 });
    expect(t.totalAfterDiscount).toBe(9_000_00);
    expect(t.finalVAT).toBe(0);
    expect(t.finalSubtotal).toBe(9_000_00);
  });
});

describe("vanNetPrice", () => {
  it("returns the sticker price for VAT-exclusive vans", () => {
    expect(vanNetPrice({ price: 30_000_00, vatIncluded: false })).toBe(30_000_00);
  });

  it("extracts the net share for VAT-inclusive vans (no VAT-on-VAT)", () => {
    expect(vanNetPrice({ price: 36_000_00, vatIncluded: true })).toBe(30_000_00);
  });

  it("falls back to the custom van value when no van is selected", () => {
    expect(vanNetPrice(null, 15_000_00)).toBe(15_000_00);
    expect(vanNetPrice(undefined)).toBe(0);
  });
});

describe("computeFinancePayments", () => {
  it("computes a standard amortised monthly payment", () => {
    const p = computeFinancePayments(12_000_00, 2_000_00, 60, 1090);
    expect(p).not.toBeNull();
    // £10,000 over 60 months at 10.9% APR ≈ £216.97/month
    expect(p!.monthlyPayment).toBeGreaterThan(210_00);
    expect(p!.monthlyPayment).toBeLessThan(225_00);
  });

  it("handles zero APR as simple division", () => {
    const p = computeFinancePayments(12_000_00, 0, 12, 0);
    expect(p!.monthlyPayment).toBe(1_000_00);
  });

  it("returns null when nothing is financed", () => {
    expect(computeFinancePayments(1_000_00, 1_000_00, 12, 1090)).toBeNull();
    expect(computeFinancePayments(0, 0, 12, 1090)).toBeNull();
  });
});
