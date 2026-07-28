import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState, useMemo, useEffect } from "react";
import { useConfigurator } from "@/lib/ConfiguratorContext";
import { vanNetPrice } from "@shared/pricing";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ConfiguratorStepper from "@/components/ConfiguratorStepper";
import { ConfiguratorSummary } from "@/components/ConfiguratorSummary";
import { ConfiguratorTutorial } from "@/components/ConfiguratorTutorial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, ArrowLeft, Calculator, PoundSterling, CheckCircle2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { Van, Kit, Upgrade, TrainingOption } from "@shared/schema";

export default function SelectFinance() {
  const [, setLocation] = useLocation();
  const { state, slotA, slotB, compareMode, setFinanceInputs } = useConfigurator();
  const [termYears, setTermYears] = useState<number>(
    state.financeInputs?.term ? Math.round(state.financeInputs.term / 12) : 3
  );
  const [depositAmount, setDepositAmount] = useState<string>(
    state.financeInputs?.deposit ? String((state.financeInputs.deposit / 100).toFixed(0)) : ""
  );
  const [vatRegistered, setVatRegistered] = useState<boolean>(false);
  const [deferVat, setDeferVat] = useState<boolean>(false);

  // Persist deposit/term (and the customer's VAT-deferral request) to context
  // so they carry through to the quote submission
  useEffect(() => {
    const deposit = parseFloat(depositAmount) || 0;
    setFinanceInputs({
      deposit: Math.round(deposit * 100), // stored in pence
      term: termYears * 12,               // stored in months
      vatDeferredRequested: deferVat,     // admin confirms via the quote's vatDeferred flag
    });
  }, [depositAmount, termYears, deferVat]);

  // Fetch selected items to get their prices (slot A / active slot)
  const { data: van } = useQuery<Van>({
    queryKey: ['/api/vans', state.vanId],
    enabled: !!state.vanId,
  });

  const { data: kit } = useQuery<Kit>({
    queryKey: ['/api/kits', state.kitId],
    enabled: !!state.kitId,
  });

  const { data: upgrades = [] } = useQuery<Upgrade[]>({
    queryKey: ['/api/upgrades'],
    select: (data) => data.filter(u => state.upgradeIds.includes(u.id)),
    enabled: state.upgradeIds.length > 0,
  });

  const { data: trainingOptions = [] } = useQuery<TrainingOption[]>({
    queryKey: ['/api/training-options'],
    select: (data) => data.filter(t => state.trainingOptionIds.includes(t.id)),
    enabled: state.trainingOptionIds.length > 0,
  });

  // In compare mode, also fetch Option B's van (kit/upgrades/training are shared from slot A)
  const { data: vanB } = useQuery<Van>({
    queryKey: ['/api/vans', slotB.vanId],
    enabled: compareMode && !!slotB.vanId,
  });

  const handleContinue = () => {
    setLocation('/configurator/quote');
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  
  const formatPriceDecimal = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };
  
  // Calculate total from configurator (prices are in pence). Must mirror the
  // quote step: quantities applied, VAT-inclusive vans contribute net price.
  const pricing = useMemo(() => {
    const vanPrice = vanNetPrice(van, state.customVanValue);
    const kitPrice = kit?.price || 0;
    const upgradesTotal = upgrades.reduce((sum, upgrade) => sum + upgrade.price * (state.upgradeQuantities[upgrade.id] ?? 1), 0);
    const trainingTotal = trainingOptions.reduce((sum, option) => sum + option.price, 0);
    const subtotalPence = vanPrice + kitPrice + upgradesTotal + trainingTotal;
    const vatPence = Math.round(subtotalPence * 0.2);
    return {
      subtotal: subtotalPence / 100,
      vat: vatPence / 100,
      total: (subtotalPence + vatPence) / 100,
    };
  }, [van, state.customVanValue, kit, upgrades, trainingOptions, state.upgradeQuantities]);

  // Option B pricing (compare mode only): shares kit/upgrades/training from slot A, only van differs
  const pricingB = useMemo(() => {
    if (!compareMode) return null;
    const vanPrice = vanNetPrice(vanB, slotB.customVanValue);
    const kitPrice = kit?.price || 0;
    const upgradesTotal = upgrades.reduce((sum, upgrade) => sum + upgrade.price * (state.upgradeQuantities[upgrade.id] ?? 1), 0);
    const trainingTotal = trainingOptions.reduce((sum, option) => sum + option.price, 0);
    const subtotalPence = vanPrice + kitPrice + upgradesTotal + trainingTotal;
    const vatPence = Math.round(subtotalPence * 0.2);
    return {
      subtotal: subtotalPence / 100,
      vat: vatPence / 100,
      total: (subtotalPence + vatPence) / 100,
    };
  }, [compareMode, vanB, slotB.customVanValue, kit, upgrades, trainingOptions, state.upgradeQuantities]);

  // The amount used for finance depends on whether the customer is deferring VAT
  const financeBaseTotal = deferVat ? pricing.subtotal : pricing.total;
  const financeBaseTotalB = pricingB ? (deferVat ? pricingB.subtotal : pricingB.total) : null;

  function calcFinance(total: number, deposit: number, term: number) {
    if (total <= 0 || deposit >= total) return null;
    const principal = total - deposit;
    const annualRate = 0.109;
    const monthlyRate = annualRate / 12;
    const n = term * 12;
    const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
    const weeklyPayment = (monthlyPayment * 12) / 52;
    const totalRepayable = monthlyPayment * n;
    const totalInterest = totalRepayable - principal;
    return { principal, monthlyPayment, weeklyPayment, totalRepayable, totalInterest, deposit, total };
  }

  // Calculate finance figures
  const financeCalculation = useMemo(() => {
    const deposit = parseFloat(depositAmount) || 0;
    return calcFinance(financeBaseTotal || 0, deposit, termYears);
  }, [financeBaseTotal, depositAmount, termYears]);

  const financeCalculationB = useMemo(() => {
    if (financeBaseTotalB == null) return null;
    const deposit = parseFloat(depositAmount) || 0;
    return calcFinance(financeBaseTotalB, deposit, termYears);
  }, [financeBaseTotalB, depositAmount, termYears]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <Button 
              variant="ghost" 
              onClick={() => setLocation('/configurator/upgrades')}
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Upgrades
            </Button>
            
            <ConfiguratorStepper currentPath="/configurator/finance" />

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 mt-4" data-testid="text-page-title">
              Finance Options
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mb-4">
              Choose a finance plan or pay outright
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
            <div className="xl:col-span-2 space-y-6">
              {/* Finance Calculator Card */}
              <Card className="border-2">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <Calculator className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Finance Calculator</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Calculate your payments at 10.9% APR
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* VAT Registration */}
                  <div className="mb-6 pb-6 border-b space-y-4">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="vat-registered"
                        checked={vatRegistered}
                        onCheckedChange={(checked) => {
                          setVatRegistered(!!checked);
                          if (!checked) setDeferVat(false);
                        }}
                        data-testid="checkbox-vat-registered"
                      />
                      <Label htmlFor="vat-registered" className="text-sm font-medium cursor-pointer">
                        Are you VAT registered?
                      </Label>
                    </div>

                    {vatRegistered && (
                      <div className="ml-7 space-y-3">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id="defer-vat"
                            checked={deferVat}
                            onCheckedChange={(checked) => setDeferVat(!!checked)}
                            data-testid="checkbox-defer-vat"
                          />
                          <Label htmlFor="defer-vat" className="text-sm font-medium cursor-pointer">
                            Do you want to defer VAT for 3 months?
                          </Label>
                        </div>
                        {deferVat && (
                          <div className="flex items-start gap-2 bg-accent/5 border border-accent/20 rounded-md p-3">
                            <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                            <p className="text-xs text-muted-foreground">
                              VAT of <strong>{formatPrice(pricing.vat)}</strong> will be deferred and paid separately after 3 months. Your finance is calculated on the ex-VAT amount of <strong>{formatPrice(pricing.subtotal)}</strong>.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Total from Configurator — in compare mode show both totals */}
                    {compareMode ? (
                      <div className="md:col-span-2 grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs font-bold uppercase tracking-wide text-accent">Option A Total</Label>
                          <div className="relative">
                            <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground" />
                            <Input type="text" value={formatPrice(financeBaseTotal)} disabled className="pl-9 bg-muted/50 font-bold text-foreground" data-testid="input-total-a" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Option B Total</Label>
                          <div className="relative">
                            <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground" />
                            <Input type="text" value={financeBaseTotalB != null ? formatPrice(financeBaseTotalB) : "—"} disabled className="pl-9 bg-muted/50 font-bold text-foreground" data-testid="input-total-b" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="total" className="text-sm font-medium">
                          {deferVat ? "Finance Amount (ex-VAT)" : "Total Amount (inc-VAT)"}
                        </Label>
                        <div className="relative">
                          <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground" />
                          <Input
                            id="total"
                            type="text"
                            value={formatPrice(financeBaseTotal)}
                            disabled
                            className="pl-9 bg-muted/50 font-bold text-lg text-foreground"
                            data-testid="input-total"
                          />
                        </div>
                        {deferVat && (
                          <p className="text-xs text-muted-foreground">
                            VAT ({formatPrice(pricing.vat)}) deferred — payable after 3 months
                          </p>
                        )}
                      </div>
                    )}

                    {/* Deposit Input */}
                    <div className="space-y-2">
                      <Label htmlFor="deposit" className="text-sm font-medium">
                        Deposit Amount
                      </Label>
                      <div className="relative">
                        <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="deposit"
                          type="number"
                          placeholder="0"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          className="pl-9"
                          min="0"
                          max={financeBaseTotal}
                          data-testid="input-deposit"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Enter your deposit amount
                      </p>
                    </div>

                    {/* Term Length Selector */}
                    <div className="space-y-2">
                      <Label htmlFor="term" className="text-sm font-medium">
                        Finance Term
                      </Label>
                      <Select
                        value={termYears.toString()}
                        onValueChange={(value) => setTermYears(parseInt(value))}
                      >
                        <SelectTrigger id="term" data-testid="select-term">
                          <SelectValue placeholder="Select term length" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 Year (12 months)</SelectItem>
                          <SelectItem value="2">2 Years (24 months)</SelectItem>
                          <SelectItem value="3">3 Years (36 months)</SelectItem>
                          <SelectItem value="4">4 Years (48 months)</SelectItem>
                          <SelectItem value="5">5 Years (60 months)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Results */}
                  {(financeCalculation || financeCalculationB) ? (
                    <div className="mt-6 pt-6 border-t space-y-4">
                      {compareMode ? (
                        /* Compare mode: Option A and B side by side */
                        <div className="grid grid-cols-2 gap-4">
                          {/* Option A */}
                          <div className="space-y-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-accent">Option A</p>
                            {financeCalculation ? (
                              <>
                                <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
                                  <p className="text-xs text-muted-foreground mb-1">Monthly</p>
                                  <p className="text-xl font-bold text-accent" data-testid="text-monthly-payment-a">{formatPriceDecimal(financeCalculation.monthlyPayment)}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{termYears * 12} months</p>
                                </div>
                                <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
                                  <p className="text-xs text-muted-foreground mb-1">Weekly</p>
                                  <p className="text-xl font-bold text-accent" data-testid="text-weekly-payment-a">{formatPriceDecimal(financeCalculation.weeklyPayment)}</p>
                                  <p className="text-xs text-muted-foreground mt-1">approx.</p>
                                </div>
                                <div className="text-xs space-y-1 text-muted-foreground">
                                  <div className="flex justify-between"><span>Financed</span><span className="font-medium text-foreground">{formatPrice(financeCalculation.principal)}</span></div>
                                  <div className="flex justify-between"><span>Interest</span><span className="font-medium text-foreground">{formatPrice(financeCalculation.totalInterest)}</span></div>
                                  <div className="flex justify-between"><span>Repayable</span><span className="font-medium text-foreground">{formatPrice(financeCalculation.totalRepayable)}</span></div>
                                </div>
                              </>
                            ) : <p className="text-sm text-muted-foreground">Enter a deposit to calculate</p>}
                          </div>

                          {/* Option B */}
                          <div className="space-y-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Option B</p>
                            {financeCalculationB ? (
                              <>
                                <div className="bg-muted/40 border border-border rounded-lg p-4">
                                  <p className="text-xs text-muted-foreground mb-1">Monthly</p>
                                  <p className="text-xl font-bold" data-testid="text-monthly-payment-b">{formatPriceDecimal(financeCalculationB.monthlyPayment)}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{termYears * 12} months</p>
                                </div>
                                <div className="bg-muted/40 border border-border rounded-lg p-4">
                                  <p className="text-xs text-muted-foreground mb-1">Weekly</p>
                                  <p className="text-xl font-bold" data-testid="text-weekly-payment-b">{formatPriceDecimal(financeCalculationB.weeklyPayment)}</p>
                                  <p className="text-xs text-muted-foreground mt-1">approx.</p>
                                </div>
                                <div className="text-xs space-y-1 text-muted-foreground">
                                  <div className="flex justify-between"><span>Financed</span><span className="font-medium text-foreground">{formatPrice(financeCalculationB.principal)}</span></div>
                                  <div className="flex justify-between"><span>Interest</span><span className="font-medium text-foreground">{formatPrice(financeCalculationB.totalInterest)}</span></div>
                                  <div className="flex justify-between"><span>Repayable</span><span className="font-medium text-foreground">{formatPrice(financeCalculationB.totalRepayable)}</span></div>
                                </div>
                              </>
                            ) : pricingB == null || pricingB.total === 0 ? (
                              <p className="text-sm text-muted-foreground">Option B not configured</p>
                            ) : (
                              <p className="text-sm text-muted-foreground">Enter a deposit to calculate</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Standard single-option results */
                        financeCalculation && (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
                                <p className="text-sm text-muted-foreground mb-1">Monthly Payment</p>
                                <p className="text-2xl sm:text-3xl font-bold text-accent" data-testid="text-monthly-payment">
                                  {formatPriceDecimal(financeCalculation.monthlyPayment)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">for {termYears * 12} months</p>
                              </div>
                              <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
                                <p className="text-sm text-muted-foreground mb-1">Weekly Payment</p>
                                <p className="text-2xl sm:text-3xl font-bold text-accent" data-testid="text-weekly-payment">
                                  {formatPriceDecimal(financeCalculation.weeklyPayment)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">approximate weekly cost</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t">
                              <div>
                                <p className="text-xs text-muted-foreground">Amount Financed</p>
                                <p className="font-semibold" data-testid="text-amount-financed">{formatPrice(financeCalculation.principal)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Total Interest</p>
                                <p className="font-semibold" data-testid="text-total-interest">{formatPrice(financeCalculation.totalInterest)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Total Repayable</p>
                                <p className="font-semibold" data-testid="text-total-repayable">{formatPrice(financeCalculation.totalRepayable)}</p>
                              </div>
                            </div>
                            <div className="bg-muted/50 rounded-lg p-3 mt-4">
                              <p className="text-xs text-muted-foreground">
                                <strong>Representative Example:</strong> {formatPrice(financeCalculation.total)} cash price, {formatPrice(financeCalculation.deposit)} deposit,
                                amount of credit {formatPrice(financeCalculation.principal)}, {termYears * 12} monthly payments of {formatPriceDecimal(financeCalculation.monthlyPayment)},
                                total amount payable {formatPrice(financeCalculation.totalRepayable + financeCalculation.deposit)}, 10.9% APR representative.
                              </p>
                            </div>
                          </>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="mt-6 pt-6 border-t text-center">
                      <p className="text-sm text-muted-foreground">
                        Enter a deposit amount to calculate your payments
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Navigation Buttons */}
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setLocation('/configurator/upgrades')}
                  data-testid="button-back-bottom"
                  className="w-full sm:w-auto !border-2 !border-accent text-accent hover:bg-accent/10"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button 
                  onClick={handleContinue}
                  className="bg-accent text-accent-foreground w-full sm:w-auto"
                  data-testid="button-continue"
                >
                  Continue to Quote
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>

            <div className="xl:col-span-1">
              <ConfiguratorSummary />
            </div>
          </div>
        </div>
      </div>

      <Footer />
      
      <ConfiguratorTutorial page="finance" />
    </div>
  );
}
