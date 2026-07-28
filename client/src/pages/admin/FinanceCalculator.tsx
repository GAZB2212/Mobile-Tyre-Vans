import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Calculator,
  PoundSterling,
  TrendingUp,
  Calendar,
  Percent,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

const TERM_OPTIONS = [
  { label: "12 months (1 year)", value: 12 },
  { label: "24 months (2 years)", value: 24 },
  { label: "36 months (3 years)", value: 36 },
  { label: "48 months (4 years)", value: 48 },
  { label: "60 months (5 years)", value: 60 },
];

const VAT_RATE = 0.2;

function fmt(pence: number) {
  return "£" + (pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPounds(pounds: number) {
  return "£" + pounds.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface CalcResult {
  principal: number;
  monthlyPayment: number;
  weeklyPayment: number;
  totalPayable: number;
  totalInterest: number;
  balloon: number;
  termMonths: number;
  deferredVat: number;
  priceExVat: number;
}

function calculate(
  priceIncVat: number,
  deposit: number,
  termMonths: number,
  apr: number,
  balloonPct: number,
  vatDeferred: boolean,
): CalcResult | null {
  const priceExVat = Math.round((priceIncVat / (1 + VAT_RATE)) * 100) / 100;
  const deferredVat = vatDeferred ? Math.round((priceIncVat - priceExVat) * 100) / 100 : 0;

  // Base for repayments: ex-VAT price if deferred, else full inc-VAT price
  const financeBase = vatDeferred ? priceExVat : priceIncVat;

  const principal = financeBase - deposit;
  if (principal <= 0 || termMonths <= 0 || apr <= 0) return null;

  const balloon = Math.round(financeBase * (balloonPct / 100));
  const financedAmount = principal - balloon;
  if (financedAmount <= 0) return null;

  const monthlyRate = apr / 100 / 12;
  const pv = Math.pow(1 + monthlyRate, termMonths);
  const monthlyPayment = Math.round((financedAmount * monthlyRate * pv) / (pv - 1));
  const weeklyPayment = Math.round((monthlyPayment * 12) / 52);
  const totalPayable = monthlyPayment * termMonths + balloon + deposit + deferredVat;
  const totalInterest = totalPayable - priceIncVat;

  return { principal, monthlyPayment, weeklyPayment, totalPayable, totalInterest, balloon, termMonths, deferredVat, priceExVat };
}

export default function AdminFinanceCalculator() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth() as {
    user: User | undefined;
    isAuthenticated: boolean;
    isLoading: boolean;
  };

  const [priceStr, setPriceStr] = useState("");
  const [depositStr, setDepositStr] = useState("");
  const [depositMode, setDepositMode] = useState<"amount" | "percent">("amount");
  const [termMonths, setTermMonths] = useState(36);
  const [aprStr, setAprStr] = useState("12");
  const [balloonPctStr, setBalloonPctStr] = useState("0");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [vatDeferred, setVatDeferred] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({ title: "Unauthorized", variant: "destructive" });
      setTimeout(() => { window.location.href = "/login"; }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  const priceIncVat = parseFloat(priceStr.replace(/,/g, "")) || 0;
  const apr = parseFloat(aprStr) || 0;
  const balloonPct = Math.min(parseFloat(balloonPctStr) || 0, 50);

  const priceExVat = priceIncVat > 0 ? Math.round((priceIncVat / (1 + VAT_RATE)) * 100) / 100 : 0;
  const vatAmount = priceIncVat > 0 ? Math.round((priceIncVat - priceExVat) * 100) / 100 : 0;

  const depositAmount = useMemo(() => {
    if (depositMode === "percent") {
      const pct = parseFloat(depositStr) || 0;
      const base = vatDeferred ? priceExVat : priceIncVat;
      return Math.round(base * (pct / 100) * 100) / 100;
    }
    return parseFloat(depositStr.replace(/,/g, "")) || 0;
  }, [depositMode, depositStr, priceIncVat, priceExVat, vatDeferred]);

  const depositPercent = priceIncVat > 0 ? (depositAmount / (vatDeferred ? priceExVat : priceIncVat)) * 100 : 0;

  const result = useMemo(() => {
    if (priceIncVat <= 0) return null;
    return calculate(priceIncVat, depositAmount, termMonths, apr, balloonPct, vatDeferred);
  }, [priceIncVat, depositAmount, termMonths, apr, balloonPct, vatDeferred]);

  const handleReset = () => {
    setPriceStr("");
    setDepositStr("");
    setTermMonths(36);
    setAprStr("12");
    setBalloonPctStr("0");
    setDepositMode("amount");
    setVatDeferred(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AdminPageHeader
          title="Finance Calculator"
          badge={<Badge variant="outline">Sales Tool</Badge>}
          actions={
            <Button variant="ghost" size="sm" asChild data-testid="button-back-admin">
              <Link href="/admin">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Admin
              </Link>
            </Button>
          }
        />
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      <AdminPageHeader
        title="Finance Calculator"
        badge={<Badge variant="outline">Sales Tool</Badge>}
        actions={
          <>
            <Button variant="ghost" size="sm" asChild data-testid="button-back-admin">
              <Link href="/admin">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Admin
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              data-testid="button-reset-calculator"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </>
        }
      />

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Inputs ── */}
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <PoundSterling className="w-4 h-4 text-accent" />
                  Finance Details
                </CardTitle>
                <CardDescription>Enter the deal details to calculate repayments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Price inc VAT */}
                <div className="space-y-1.5">
                  <Label htmlFor="price-input" className="text-sm font-medium">
                    Total Price (inc VAT) — £
                  </Label>
                  <Input
                    id="price-input"
                    type="number"
                    inputMode="decimal"
                    placeholder="e.g. 28500"
                    value={priceStr}
                    onChange={e => setPriceStr(e.target.value)}
                    data-testid="input-price"
                  />
                  {priceIncVat > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Ex VAT: {fmtPounds(priceExVat)} &nbsp;|&nbsp; VAT: {fmtPounds(vatAmount)}
                    </p>
                  )}
                </div>

                {/* VAT Deferred checkbox */}
                <label
                  htmlFor="vat-deferred-checkbox"
                  className="flex items-center gap-3 rounded-md border px-3 py-2.5 cursor-pointer hover-elevate"
                  data-testid="label-vat-deferred"
                >
                  <input
                    id="vat-deferred-checkbox"
                    type="checkbox"
                    checked={vatDeferred}
                    onChange={e => setVatDeferred(e.target.checked)}
                    data-testid="checkbox-vat-deferred"
                    className="h-4 w-4 rounded accent-accent cursor-pointer shrink-0"
                  />
                  <div className="flex items-center gap-2">
                    <PoundSterling className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium leading-tight">VAT Deferred</p>
                      <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                        Finance ex-VAT price; VAT paid separately
                      </p>
                    </div>
                  </div>
                </label>

                {vatDeferred && priceIncVat > 0 && (
                  <div className="rounded-md bg-accent/10 border border-accent/20 px-3 py-2.5 text-xs space-y-1">
                    <p className="font-medium text-accent">VAT Deferred active</p>
                    <p className="text-muted-foreground">
                      Repayments based on ex-VAT price of <span className="font-medium text-foreground">{fmtPounds(priceExVat)}</span>.
                      Deferred VAT of <span className="font-medium text-foreground">{fmtPounds(vatAmount)}</span> is payable separately.
                    </p>
                  </div>
                )}

                {/* Deposit */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Deposit</Label>
                    <div className="flex items-center rounded-md border overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setDepositMode("amount")}
                        className={`px-3 py-1 text-xs transition-colors ${depositMode === "amount" ? "bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover-elevate"}`}
                        data-testid="button-deposit-amount"
                      >
                        £
                      </button>
                      <button
                        type="button"
                        onClick={() => setDepositMode("percent")}
                        className={`px-3 py-1 text-xs transition-colors ${depositMode === "percent" ? "bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover-elevate"}`}
                        data-testid="button-deposit-percent"
                      >
                        %
                      </button>
                    </div>
                  </div>
                  <Input
                    id="deposit-input"
                    type="number"
                    inputMode="decimal"
                    placeholder={depositMode === "amount" ? "e.g. 2850" : "e.g. 10"}
                    value={depositStr}
                    onChange={e => setDepositStr(e.target.value)}
                    data-testid="input-deposit"
                  />
                  {(vatDeferred ? priceExVat : priceIncVat) > 0 && depositAmount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {depositMode === "amount"
                        ? `${depositPercent.toFixed(1)}% of ${vatDeferred ? "ex-VAT" : "total"} price`
                        : `${fmtPounds(depositAmount)} deposit`}
                    </p>
                  )}
                </div>

                {/* Term */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    Term
                  </Label>
                  <Select
                    value={String(termMonths)}
                    onValueChange={v => setTermMonths(Number(v))}
                  >
                    <SelectTrigger data-testid="select-term">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TERM_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* APR */}
                <div className="space-y-1.5">
                  <Label htmlFor="apr-input" className="text-sm font-medium flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-muted-foreground" />
                    APR (%)
                  </Label>
                  <Input
                    id="apr-input"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    placeholder="12"
                    value={aprStr}
                    onChange={e => setAprStr(e.target.value)}
                    data-testid="input-apr"
                  />
                </div>

                {/* Advanced: Balloon */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(p => !p)}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-toggle-advanced"
                  >
                    {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    Balloon Payment (optional)
                  </button>
                  {showAdvanced && (
                    <div className="mt-3 space-y-1.5">
                      <Label htmlFor="balloon-input" className="text-sm font-medium">
                        Balloon Payment — % of {vatDeferred ? "ex-VAT" : "total"} price
                      </Label>
                      <Input
                        id="balloon-input"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="50"
                        step="1"
                        placeholder="0"
                        value={balloonPctStr}
                        onChange={e => setBalloonPctStr(e.target.value)}
                        data-testid="input-balloon"
                      />
                      {priceIncVat > 0 && balloonPct > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Balloon payment: {fmtPounds((vatDeferred ? priceExVat : priceIncVat) * (balloonPct / 100))}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Results ── */}
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-accent" />
                  Repayment Summary
                </CardTitle>
                <CardDescription>
                  Based on {apr}% APR over {termMonths} months
                  {vatDeferred && " · VAT deferred"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!result ? (
                  <div className="py-10 text-center text-muted-foreground">
                    <Calculator className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Enter a price above to see repayments</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Primary monthly/weekly */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-md bg-accent/10 border border-accent/20 p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Monthly Payment</p>
                        <p className="text-2xl font-bold text-accent" data-testid="text-monthly-payment">
                          {fmtPounds(result.monthlyPayment)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">per month</p>
                      </div>
                      <div className="rounded-md bg-muted/40 border p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Weekly Payment</p>
                        <p className="text-2xl font-bold" data-testid="text-weekly-payment">
                          {fmtPounds(result.weeklyPayment)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">per week</p>
                      </div>
                    </div>

                    {vatDeferred && (
                      <div className="rounded-md bg-accent/10 border border-accent/20 px-3 py-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <PoundSterling className="w-3.5 h-3.5" />
                          Deferred VAT (due separately)
                        </span>
                        <span className="font-semibold text-accent" data-testid="text-deferred-vat">
                          {fmtPounds(result.deferredVat)}
                        </span>
                      </div>
                    )}

                    <Separator />

                    {/* Breakdown */}
                    <div className="space-y-2.5 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Total price (inc VAT)</span>
                        <span className="font-medium" data-testid="text-total-price">{fmtPounds(priceIncVat)}</span>
                      </div>
                      {vatDeferred && (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Price (ex VAT)</span>
                            <span className="font-medium" data-testid="text-price-ex-vat">{fmtPounds(result.priceExVat)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">VAT deferred</span>
                            <span className="font-medium">{fmtPounds(result.deferredVat)}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Deposit</span>
                        <span className="font-medium" data-testid="text-deposit">{fmtPounds(depositAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Amount financed</span>
                        <span className="font-medium" data-testid="text-amount-financed">{fmtPounds(result.principal)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Term</span>
                        <span className="font-medium">{result.termMonths} months</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">APR</span>
                        <span className="font-medium">{apr}%</span>
                      </div>
                      {result.balloon > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Balloon payment</span>
                          <span className="font-medium" data-testid="text-balloon">{fmtPounds(result.balloon)}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Total repayable</span>
                        <span className="font-semibold" data-testid="text-total-payable">{fmtPounds(result.totalPayable)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Total interest</span>
                        <span className="font-semibold text-muted-foreground" data-testid="text-total-interest">{fmtPounds(result.totalInterest)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick scenarios */}
            {priceIncVat > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Quick Scenarios — {apr}% APR{vatDeferred ? " · VAT Deferred" : ""}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { label: "10% deposit, 36 months", depositPct: 0.1, term: 36 },
                      { label: "10% deposit, 48 months", depositPct: 0.1, term: 48 },
                      { label: "20% deposit, 36 months", depositPct: 0.2, term: 36 },
                      { label: "20% deposit, 60 months", depositPct: 0.2, term: 60 },
                    ].map(scenario => {
                      const base = vatDeferred ? priceExVat : priceIncVat;
                      const dep = base * scenario.depositPct;
                      const r = calculate(priceIncVat, dep, scenario.term, apr, 0, vatDeferred);
                      if (!r) return null;
                      return (
                        <button
                          key={scenario.label}
                          type="button"
                          className="w-full flex items-center justify-between text-sm p-2.5 rounded-md hover-elevate text-left"
                          onClick={() => {
                            setDepositMode("amount");
                            setDepositStr(String(Math.round(dep)));
                            setTermMonths(scenario.term);
                            setBalloonPctStr("0");
                          }}
                          data-testid={`button-scenario-${scenario.term}`}
                        >
                          <span className="text-muted-foreground">{scenario.label}</span>
                          <span className="font-semibold text-accent">
                            {fmtPounds(r.monthlyPayment)}<span className="text-muted-foreground font-normal">/mo</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
