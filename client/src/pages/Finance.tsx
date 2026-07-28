import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO, { createServiceStructuredData } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, TrendingUp, FileText, ArrowRight, Calculator, PoundSterling } from "lucide-react";
import type { FinancePlan } from "@shared/schema";

export default function Finance() {
  const { data: financePlans = [] } = useQuery<FinancePlan[]>({
    queryKey: ['/api/finance-plans'],
  });

  const [purchasePrice, setPurchasePrice] = useState<string>("35000");
  const [customDeposit, setCustomDeposit] = useState<string>("3500");
  const [customTerm, setCustomTerm] = useState<string>("36");

  const formatAPR = (aprBps: number) => {
    return (aprBps / 100).toFixed(2) + '%';
  };

  const formatPrice = (pence: number) => {
    return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const calculateFinance = (plan: FinancePlan, purchasePricePence: number) => {
    const depositAmount = Math.round(purchasePricePence * (plan.depositPercent / 100));
    const balloonAmount = plan.balloonPercent 
      ? Math.round(purchasePricePence * (plan.balloonPercent / 100))
      : 0;
    const amountToFinance = purchasePricePence - depositAmount;
    const principal = amountToFinance - balloonAmount;
    const termMonths = plan.termMonths;
    
    let monthlyPayment: number;
    
    if (plan.aprBps === 0) {
      monthlyPayment = Math.round((amountToFinance - balloonAmount) / termMonths);
    } else {
      const monthlyRate = (plan.aprBps / 10000) / 12;
      const numberOfPayments = termMonths;
      
      monthlyPayment = Math.round(
        principal * 
        (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
        (Math.pow(1 + monthlyRate, numberOfPayments) - 1)
      );
    }
    
    const totalRepayable = (monthlyPayment * termMonths) + depositAmount + balloonAmount;
    
    return {
      depositAmount,
      monthlyPayment,
      balloonAmount,
      totalRepayable,
      termMonths
    };
  };

  const calculateCustomFinance = (
    purchasePricePence: number,
    depositPence: number,
    termMonths: number,
    balloonPence: number,
    aprBps: number
  ) => {
    const amountToFinance = purchasePricePence - depositPence;
    const principal = amountToFinance - balloonPence;
    
    let monthlyPayment: number;
    
    if (aprBps === 0) {
      monthlyPayment = Math.round(principal / termMonths);
    } else {
      const monthlyRate = (aprBps / 10000) / 12;
      const numberOfPayments = termMonths;
      
      monthlyPayment = Math.round(
        principal * 
        (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
        (Math.pow(1 + monthlyRate, numberOfPayments) - 1)
      );
    }
    
    const totalRepayable = (monthlyPayment * termMonths) + depositPence + balloonPence;
    
    return {
      depositAmount: depositPence,
      monthlyPayment,
      balloonAmount: balloonPence,
      totalRepayable,
      termMonths
    };
  };

  const purchasePricePence = Math.round(parseFloat(purchasePrice || "0") * 100);
  const isValidPrice = purchasePricePence > 0;
  
  const customDepositPence = Math.round(parseFloat(customDeposit || "0") * 100);
  const customTermMonths = parseInt(customTerm || "0");
  
  const isValidCustom = purchasePricePence > 0 && customDepositPence >= 0 && customTermMonths > 0 && customDepositPence < purchasePricePence;
  
  const customCalc = isValidCustom 
    ? calculateCustomFinance(purchasePricePence, customDepositPence, customTermMonths, 0, 1200)
    : null;

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Mobile Tyre Van Finance | Flexible Payment Plans UK"
        description="Finance your mobile tyre van with our flexible, competitive payment plans. Use our free finance calculator to see monthly payments. FCA authorised credit broker. Apply online or call 0800 000 0000."
        canonical="/finance"
        keywords="mobile tyre van finance, van finance UK, tyre van hire purchase, mobile tyre van payment plans, van conversion finance, FCA authorised credit broker"
        structuredData={[
          createServiceStructuredData({
            name: "Mobile Tyre Van Finance",
            description: "Flexible finance options for mobile tyre van purchases. Hire purchase and leasing available through our FCA authorised credit broker service. Competitive rates with various term lengths.",
            url: "/finance",
          })
        ]}
      />
      <Header />

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-card to-background border-b py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-4 bg-accent/10 text-accent border-accent/20">
              FCA Authorised
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4" data-testid="text-finance-title">
              Flexible Finance Options
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground">
              Spread the cost of your mobile tyre van with our competitive finance packages. Get on the road faster with affordable monthly payments.
            </p>
          </div>
        </div>
      </section>

      {/* Finance Calculator */}
      <section className="py-16 md:py-24 bg-card">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <Badge className="mb-4 bg-accent/10 text-accent border-accent/20">
                <Calculator className="w-3 h-3 mr-1" />
                Calculator
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">Custom Finance Calculator</h2>
              <p className="text-muted-foreground">
                Calculate your payments with your own price and deposit at 12% APR
              </p>
            </div>

            <Card className="border-2">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                    <Calculator className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Finance Calculator</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Calculate your payments at 12% APR
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* Total Amount Input */}
                  <div className="space-y-2">
                    <Label htmlFor="custom-total" className="text-sm font-medium">
                      Total Amount
                    </Label>
                    <div className="relative">
                      <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="custom-total"
                        type="number"
                        placeholder="35000"
                        value={purchasePrice}
                        onChange={(e) => setPurchasePrice(e.target.value)}
                        className="pl-9"
                        min="0"
                        data-testid="input-custom-total"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enter the total price
                    </p>
                  </div>

                  {/* Deposit Input */}
                  <div className="space-y-2">
                    <Label htmlFor="custom-deposit" className="text-sm font-medium">
                      Deposit Amount
                    </Label>
                    <div className="relative">
                      <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="custom-deposit"
                        type="number"
                        placeholder="0"
                        value={customDeposit}
                        onChange={(e) => setCustomDeposit(e.target.value)}
                        className="pl-9"
                        min="0"
                        data-testid="input-custom-deposit"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enter your deposit amount
                    </p>
                  </div>

                  {/* Term Length Selector */}
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="custom-term" className="text-sm font-medium">
                      Finance Term
                    </Label>
                    <Select
                      value={customTerm}
                      onValueChange={setCustomTerm}
                    >
                      <SelectTrigger id="custom-term" data-testid="select-custom-term">
                        <SelectValue placeholder="Select term length" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12">1 Year (12 months)</SelectItem>
                        <SelectItem value="24">2 Years (24 months)</SelectItem>
                        <SelectItem value="36">3 Years (36 months)</SelectItem>
                        <SelectItem value="48">4 Years (48 months)</SelectItem>
                        <SelectItem value="60">5 Years (60 months)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Results */}
                {customCalc ? (
                  <div className="mt-6 pt-6 border-t space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Monthly Payment */}
                      <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
                        <p className="text-sm text-muted-foreground mb-1">Monthly Payment</p>
                        <p className="text-2xl sm:text-3xl font-bold text-accent" data-testid="text-custom-monthly">
                          {formatPrice(customCalc.monthlyPayment)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          for {customCalc.termMonths} months
                        </p>
                      </div>

                      {/* Weekly Payment */}
                      <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
                        <p className="text-sm text-muted-foreground mb-1">Weekly Payment</p>
                        <p className="text-2xl sm:text-3xl font-bold text-accent" data-testid="text-custom-weekly">
                          {formatPrice(Math.round((customCalc.monthlyPayment * 12) / 52))}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          approximate weekly cost
                        </p>
                      </div>
                    </div>

                    {/* Additional Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">Amount Financed</p>
                        <p className="font-semibold" data-testid="text-custom-financed">
                          {formatPrice(purchasePricePence - customDepositPence)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total Interest</p>
                        <p className="font-semibold" data-testid="text-custom-interest">
                          {formatPrice(customCalc.totalRepayable - (purchasePricePence - customDepositPence))}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total Repayable</p>
                        <p className="font-semibold" data-testid="text-custom-repayable">
                          {formatPrice(customCalc.totalRepayable)}
                        </p>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-3 mt-4">
                      <p className="text-xs text-muted-foreground">
                        <strong>Representative Example:</strong> {formatPrice(purchasePricePence)} cash price, {formatPrice(customDepositPence)} deposit, 
                        amount of credit {formatPrice(purchasePricePence - customDepositPence)}, {customCalc.termMonths} monthly payments of {formatPrice(customCalc.monthlyPayment)}, 
                        total amount payable {formatPrice(customCalc.totalRepayable + customDepositPence)}, 12% APR representative.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 pt-6 border-t text-center">
                    <p className="text-sm text-muted-foreground">
                      Enter a valid price and deposit to calculate your payments
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">Why Finance Your Van?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-accent" />
                    </div>
                    <CardTitle className="text-lg">Preserve Cash Flow</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Keep your working capital for day-to-day operations while getting the van you need to grow your business.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <Calculator className="w-5 h-5 text-accent" />
                    </div>
                    <CardTitle className="text-lg">Fixed Monthly Payments</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Budget accurately with predictable monthly costs. No surprises, just straightforward payments.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-accent" />
                    </div>
                    <CardTitle className="text-lg">Quick Approval</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Fast decision process so you can get your mobile tyre van on the road without delays.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-accent" />
                    </div>
                    <CardTitle className="text-lg">Flexible Terms</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Choose the plan that works for you with various term lengths and deposit options available.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Finance Plans */}
      <section className="py-16 md:py-24 bg-card">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">Available Finance Plans</h2>
              <p className="text-muted-foreground">
                Compare our finance options and choose the plan that best suits your business needs
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
              {financePlans.map((plan) => (
                <Card key={plan.id} className="hover-elevate" data-testid={`card-finance-${plan.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant={plan.type === 'HP' ? 'default' : 'secondary'}>
                        {plan.type === 'HP' ? 'Hire Purchase' : 'Lease'}
                      </Badge>
                      <Badge variant="outline" className="text-accent">
                        {formatAPR(plan.aprBps)} APR
                      </Badge>
                    </div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.notes}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Term Length</span>
                        <span className="font-medium">{plan.termMonths} months</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Deposit</span>
                        <span className="font-medium">{plan.depositPercent}%</span>
                      </div>
                      {plan.balloonPercent && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Balloon Payment</span>
                          <span className="font-medium">{plan.balloonPercent}%</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="text-center">
              <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground" asChild data-testid="button-get-quote">
                <Link href="/configurator/van">
                  Get a Finance Quote
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Cross-links */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg mb-2">Browse Van Stock</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    View our selection of ready-to-go mobile tyre vans available for purchase with finance.
                  </p>
                  <Button variant="outline" className="!border-2 !border-accent text-accent" asChild data-testid="link-stock-from-finance">
                    <Link href="/stock">
                      View Available Vans
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg mb-2">Configure Your Van</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Build your perfect mobile tyre van and see finance options during the process.
                  </p>
                  <Button variant="outline" className="!border-2 !border-accent text-accent" asChild data-testid="link-configurator-from-finance">
                    <Link href="/configurator/van">
                      Open Configurator
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Important Information */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Finance is subject to status. Terms and conditions apply. We are a credit broker and not a lender. 
              We can introduce you to a limited number of lenders who may be able to offer you finance facilities for your purchase.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
