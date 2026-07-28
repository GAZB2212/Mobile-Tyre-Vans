import { useState, useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useConfigurator } from "@/lib/ConfiguratorContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ConfiguratorStepper from "@/components/ConfiguratorStepper";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, Package, Truck, CreditCard, Phone, Mail, Clock, FileText, MessageSquare } from "lucide-react";
import type { Van, Kit, FinancePlan, Upgrade, TrainingOption } from "@shared/schema";
import { vanNetPrice } from "@shared/pricing";
const quoteFormSchema = z.object({
  userName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 characters"),
  company: z.string().optional(),
  notes: z.string().optional(),
});

type QuoteFormData = z.infer<typeof quoteFormSchema>;

export default function RequestQuote() {
  const [, setLocation] = useLocation();
  const { state, slotA, slotB, compareMode, clearAll } = useConfigurator();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const ownVanPricePence = (!state.vanId && state.customVanValue) ? state.customVanValue : 0;

  const { data: van, isLoading: isLoadingVan } = useQuery<Van>({
    queryKey: ['/api/vans', state.vanId],
    enabled: !!state.vanId,
  });

  // In compare mode, also fetch Option B's van for pricing
  const { data: vanB } = useQuery<Van>({
    queryKey: ['/api/vans', slotB.vanId],
    enabled: compareMode && !!slotB.vanId,
  });

  const { data: kit, isLoading: isLoadingKit } = useQuery<Kit>({
    queryKey: ['/api/kits', state.kitId],
    enabled: !!state.kitId,
  });

  const { data: financePlan } = useQuery<FinancePlan>({
    queryKey: ['/api/finance-plans', state.financePlanId],
    enabled: !!state.financePlanId,
  });

  const { data: upgrades = [], isLoading: isLoadingUpgrades } = useQuery<Upgrade[]>({
    queryKey: ['/api/upgrades'],
    select: (data) => data.filter(u => state.upgradeIds.includes(u.id)),
    enabled: state.upgradeIds.length > 0,
  });

  const { data: trainingOptions = [], isLoading: isLoadingTraining } = useQuery<TrainingOption[]>({
    queryKey: ['/api/training-options'],
    select: (data) => data.filter(t => state.trainingOptionIds.includes(t.id)),
    enabled: state.trainingOptionIds.length > 0,
  });

  const isLoadingData = isLoadingVan || isLoadingKit || (state.upgradeIds.length > 0 && isLoadingUpgrades) || (state.trainingOptionIds.length > 0 && isLoadingTraining);

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      userName: "",
      email: "",
      phone: "",
      company: "",
      notes: "",
    },
  });

  // Pre-fill name and phone from AI chat session if available
  useEffect(() => {
    try {
      const aiRaw = localStorage.getItem("ai-chat:v1");
      if (aiRaw) {
        const aiSession = JSON.parse(aiRaw);
        const name = aiSession?.config?.contactName;
        const phone = aiSession?.config?.contactPhone;
        if (name) form.setValue("userName", name);
        if (phone) form.setValue("phone", phone);
      }
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submitQuoteMutation = useMutation({
    mutationFn: async (formData: QuoteFormData) => {
      // Build selectedUpgrades using actual quantities from state
      const selectedUpgrades: Record<string, number> = {};
      state.upgradeIds.forEach(id => {
        selectedUpgrades[id] = state.upgradeQuantities[id] ?? 1;
      });

      // Option A pricing
      let subtotal = 0;
      if (van) subtotal += van.price;
      else subtotal += ownVanPricePence;
      if (kit) subtotal += kit.price;
      upgrades.forEach(upgrade => {
        subtotal += upgrade.price * (selectedUpgrades[upgrade.id] ?? 1);
      });
      trainingOptions.forEach(option => {
        subtotal += option.price;
      });
      const vat = Math.round(subtotal * 0.2);
      const total = subtotal + vat;

      // Option B pricing (compare mode — only van differs; kit/upgrades/training are shared from slot A)
      let subtotalB = 0;
      if (compareMode) {
        const vanBPrice = vanB?.price ?? slotB.customVanValue ?? 0;
        subtotalB = vanBPrice;
        if (kit) subtotalB += kit.price;
        upgrades.forEach(upgrade => { subtotalB += upgrade.price * (selectedUpgrades[upgrade.id] ?? 1); });
        trainingOptions.forEach(option => { subtotalB += option.price; });
      }
      const vatB = Math.round(subtotalB * 0.2);
      const totalB = subtotalB + vatB;

      const sharedFinanceInputs = state.financeInputs ?? undefined;
      const slotBHasData = compareMode && !!(slotB.vanId || slotB.vanReg || slotB.customVanValue);

      // Include AI session ID so the server can back-fill contact details into the AI conversation
      let aiSessionId: string | undefined;
      try {
        const aiRaw = localStorage.getItem("ai-chat:v1");
        if (aiRaw) aiSessionId = JSON.parse(aiRaw)?.sessionId;
      } catch { /* ignore */ }

      const quoteData: Record<string, unknown> = {
        ...formData,
        ...(aiSessionId ? { aiSessionId } : {}),
        serviceType: state.serviceType ?? undefined,
        vanId: state.vanId,
        customVanValue: ownVanPricePence > 0 ? ownVanPricePence : undefined,
        vanRegistration: state.vanReg ?? undefined,
        kitId: state.kitId ?? undefined,
        selectedUpgradeIds: state.upgradeIds,
        selectedUpgrades: selectedUpgrades,
        trainingOptionIds: state.trainingOptionIds,
        financePlanId: state.financePlanId,
        financeInputs: sharedFinanceInputs,
        estSubtotal: subtotal,
        estVAT: vat,
        estTotal: total,
        ...(slotBHasData ? {
          comparisonConfig: {
            slotA: {
              vanId: slotA.vanId,
              customVanValue: slotA.customVanValue ?? undefined,
              vanRegistration: slotA.vanReg ?? undefined,
              serviceType: slotA.serviceType,
              kitId: slotA.kitId,
              upgradeIds: slotA.upgradeIds,
              trainingOptionIds: slotA.trainingOptionIds,
              financePlanId: slotA.financePlanId,
              financeInputs: sharedFinanceInputs,
              estSubtotal: subtotal,
              estVAT: vat,
              estTotal: total,
            },
            slotB: {
              vanId: slotB.vanId,
              customVanValue: slotB.customVanValue ?? undefined,
              vanRegistration: slotB.vanReg ?? undefined,
              serviceType: slotA.serviceType,
              kitId: slotA.kitId,
              upgradeIds: slotA.upgradeIds,
              trainingOptionIds: slotA.trainingOptionIds,
              financePlanId: slotA.financePlanId,
              financeInputs: sharedFinanceInputs,
              estSubtotal: subtotalB,
              estVAT: vatB,
              estTotal: totalB,
            },
          },
        } : {}),
      };

      return apiRequest('POST', '/api/quotes', quoteData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      setSubmitted(true);
      clearAll();
      trackEvent("quote_submitted");
      toast({
        title: "Quote Requested!",
        description: "We'll contact you shortly with your custom quote.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit quote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: QuoteFormData) => {
    submitQuoteMutation.mutate(data);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
    }).format(price / 100);
  };

  const calculateTotal = () => {
    let subtotal = 0;
    if (van) subtotal += vanNetPrice(van);
    if (!van) subtotal += ownVanPricePence;
    if (kit) subtotal += kit.price;
    upgrades.forEach(upgrade => {
      subtotal += upgrade.price * (state.upgradeQuantities[upgrade.id] ?? 1);
    });
    trainingOptions.forEach(option => {
      subtotal += option.price;
    });
    
    const vat = Math.round(subtotal * 0.2);
    const total = subtotal + vat;
    
    return { subtotal, vat, total };
  };

  const pricing = calculateTotal();

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        
        <div className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto py-12">
            <div className="text-center mb-8">
              <div className="w-20 h-20 rounded-full bg-accent/15 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-12 h-12 text-accent" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-3" data-testid="text-success-title">
                Quote Request Submitted
              </h1>
              <p className="text-lg text-muted-foreground">
                Thank you — your custom configuration has been received and our team is on it.
              </p>
            </div>

            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-lg">What Happens Next</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3" data-testid="next-step-review">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileText className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">We review your configuration</p>
                    <p className="text-sm text-muted-foreground">Our team checks every detail of your spec to prepare an accurate, no-obligation quote.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3" data-testid="next-step-call">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Phone className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">We call you within 1 working day</p>
                    <p className="text-sm text-muted-foreground">A specialist will walk through your quote, answer questions, and discuss any adjustments.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3" data-testid="next-step-quote">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Mail className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Your detailed quote arrives by email</p>
                    <p className="text-sm text-muted-foreground">You'll receive a full breakdown including pricing, lead times, and finance options.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3" data-testid="next-step-build">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Approve and we start your build</p>
                    <p className="text-sm text-muted-foreground">Once you're happy, we schedule your conversion — most builds complete within 2-3 weeks.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mb-8">
              <CardContent className="pt-5">
                <div className="flex items-start gap-3">
                  <MessageSquare className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm mb-1">Need to reach us sooner?</p>
                    <p className="text-sm text-muted-foreground">
                      Call us on <a href="tel:08000000000" className="text-accent font-medium" data-testid="link-phone">0800 000 0000</a> or email{" "}
                      <a href="mailto:sales@mobiletyrevans.co.uk" className="text-accent font-medium" data-testid="link-email">sales@mobiletyrevans.co.uk</a>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-4 justify-center">
              <Button onClick={() => setLocation('/')} data-testid="button-home">
                Back to Home
              </Button>
              <Button variant="outline" onClick={() => setLocation('/stock')} data-testid="button-browse-stock">
                Browse More Vans
              </Button>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    );
  }

  // Commercial customers skip kit selection — only block car/van customers without a kit
  if (!state.kitId && state.serviceType !== "commercial") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        
        <div className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center py-20">
            <Package className="w-20 h-20 text-muted-foreground mx-auto mb-6" />
            <h1 className="text-2xl font-bold mb-4">No Kit Selected</h1>
            <p className="text-muted-foreground mb-8">
              Please select an equipment kit to continue
            </p>
            <Button onClick={() => setLocation('/configurator/kit')} data-testid="button-select-kit">
              Select Kit
            </Button>
          </div>
        </div>

        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <Button 
              variant="ghost" 
              onClick={() => setLocation('/configurator/finance')}
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Finance Options
            </Button>
            
            <ConfiguratorStepper currentPath="/configurator/quote" />

            <h1 className="text-3xl md:text-4xl font-bold mb-2 mt-4" data-testid="text-page-title">
              Request Your Quote
            </h1>
            <p className="text-muted-foreground mb-4">
              Review your configuration and enter your details
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Your Details</CardTitle>
                  <CardDescription>
                    We'll use this information to send you a detailed quote
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="userName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John Smith" {...field} data-testid="input-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="john@example.com" {...field} data-testid="input-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input placeholder="07700 900000" {...field} data-testid="input-phone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="company"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Your Company Ltd" {...field} data-testid="input-company" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Additional Notes (Optional)</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Any specific requirements or questions..." 
                                className="min-h-[100px]"
                                {...field} 
                                data-testid="input-notes"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button 
                        type="submit" 
                        size="lg" 
                        className="w-full bg-accent text-accent-foreground"
                        disabled={submitQuoteMutation.isPending || isLoadingData}
                        data-testid="button-submit-quote"
                      >
                        {submitQuoteMutation.isPending ? (
                          <>
                            <LoadingSpinner className="mr-2" />
                            Submitting...
                          </>
                        ) : isLoadingData ? (
                          <>
                            <LoadingSpinner className="mr-2" />
                            Loading...
                          </>
                        ) : (
                          'Request Quote'
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card className="sticky top-4" data-testid="card-config-summary">
                <CardHeader>
                  <CardTitle>Configuration Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {compareMode && (slotB.vanId || slotB.customVanValue) ? (
                    /* ── Compare mode: show Option A + Option B side by side ── */
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        {/* Option A */}
                        <div className="rounded-md border border-accent/30 bg-accent/5 p-3 space-y-1.5" data-testid="compare-summary-option-a">
                          <p className="text-xs font-bold uppercase tracking-wide text-accent">Option A</p>
                          {van ? (
                            <div>
                              <p className="text-xs font-medium">{van.make} {van.model}</p>
                              <p className="text-xs text-muted-foreground">{van.year} · {formatPrice(van.price)}</p>
                            </div>
                          ) : ownVanPricePence > 0 ? (
                            <div>
                              <p className="text-xs font-medium">Own van</p>
                              <p className="text-xs text-muted-foreground">{formatPrice(ownVanPricePence)}{state.vanReg ? ` · ${state.vanReg}` : ''}</p>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">No van selected</p>
                          )}
                          {kit && <p className="text-xs text-muted-foreground">{kit.name}</p>}
                          {upgrades.length > 0 && <p className="text-xs text-muted-foreground">{upgrades.length} upgrade{upgrades.length !== 1 ? 's' : ''}</p>}
                          <p className="text-sm font-bold text-accent border-t pt-1.5" data-testid="text-summary-total-a">{formatPrice(pricing.total)}</p>
                        </div>
                        {/* Option B */}
                        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5" data-testid="compare-summary-option-b">
                          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Option B</p>
                          {vanB ? (
                            <div>
                              <p className="text-xs font-medium">{vanB.make} {vanB.model}</p>
                              <p className="text-xs text-muted-foreground">{vanB.year} · {formatPrice(vanB.price)}</p>
                            </div>
                          ) : slotB.customVanValue ? (
                            <div>
                              <p className="text-xs font-medium">Own van</p>
                              <p className="text-xs text-muted-foreground">{formatPrice(slotB.customVanValue)}{slotB.vanReg ? ` · ${slotB.vanReg}` : ''}</p>
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">No van selected</p>
                          )}
                          {kit && <p className="text-xs text-muted-foreground">{kit.name}</p>}
                          {upgrades.length > 0 && <p className="text-xs text-muted-foreground">{upgrades.length} upgrade{upgrades.length !== 1 ? 's' : ''}</p>}
                          {(() => {
                            const vanBPrice = vanB?.price ?? slotB.customVanValue ?? 0;
                            const kitPrice = kit?.price ?? 0;
                            const upgsTotal = upgrades.reduce((s, u) => s + u.price * (state.upgradeQuantities[u.id] ?? 1), 0);
                            const trainTotal = trainingOptions.reduce((s, t) => s + t.price, 0);
                            const subB = vanBPrice + kitPrice + upgsTotal + trainTotal;
                            const totalB = subB + Math.round(subB * 0.2);
                            return <p className="text-sm font-bold text-foreground border-t pt-1.5" data-testid="text-summary-total-b">{formatPrice(totalB)}</p>;
                          })()}
                        </div>
                      </div>
                      {/* Shared kit / upgrades */}
                      {(kit || upgrades.length > 0 || trainingOptions.length > 0) && (
                        <div className="text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2 space-y-0.5">
                          <p className="font-medium text-foreground mb-1">Shared configuration (both options)</p>
                          {kit && <p>Pack: {kit.name} · {formatPrice(kit.price)}</p>}
                          {upgrades.map(u => {
                            const qty = state.upgradeQuantities[u.id] ?? 1;
                            return <p key={u.id}>{((u as any).variantName && (u as any).variantName.trim()) || u.name}{qty > 1 ? ` ×${qty}` : ''} · {formatPrice(u.price * qty)}</p>;
                          })}
                          {trainingOptions.map(t => <p key={t.id}>{t.name} · {formatPrice(t.price)}</p>)}
                        </div>
                      )}
                    </>
                  ) : (
                    /* ── Single option summary ── */
                    <>
                      {van && (
                        <div className="flex items-start gap-3">
                          <Truck className="w-5 h-5 text-accent mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium text-sm">Van</p>
                            <p className="text-sm text-muted-foreground" data-testid="text-summary-van">
                              {van.make} {van.model} ({van.year})
                            </p>
                            <p className="text-sm font-medium" data-testid="text-summary-van-price">
                              {formatPrice(van.price)}
                            </p>
                          </div>
                        </div>
                      )}

                      {!van && ownVanPricePence > 0 && (
                        <div className="flex items-start gap-3">
                          <Truck className="w-5 h-5 text-accent mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium text-sm">Own van</p>
                            <p className="text-sm text-muted-foreground" data-testid="text-summary-own-van">
                              {formatPrice(ownVanPricePence)}
                              {state.vanReg && <span className="ml-2 font-medium">{state.vanReg}</span>}
                            </p>
                          </div>
                        </div>
                      )}

                      {kit && (
                        <div className="flex items-start gap-3">
                          <Package className="w-5 h-5 text-accent mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium text-sm">Equipment Kit</p>
                            <p className="text-sm text-muted-foreground" data-testid="text-summary-kit">
                              {kit.name}
                            </p>
                            <p className="text-sm font-medium" data-testid="text-summary-kit-price">
                              {formatPrice(kit.price)}
                            </p>
                          </div>
                        </div>
                      )}

                      {upgrades.length > 0 && (
                        <div className="border-t pt-3 space-y-2">
                          <p className="font-medium text-sm mb-2">Selected Upgrades</p>
                          {upgrades.map((upgrade) => {
                            const qty = state.upgradeQuantities[upgrade.id] ?? 1;
                            return (
                              <div key={upgrade.id} className="flex justify-between text-sm pl-8">
                                <span className="text-muted-foreground" data-testid={`text-summary-upgrade-${upgrade.id}`}>
                                  {((upgrade as any).variantName && (upgrade as any).variantName.trim()) || upgrade.name}{qty > 1 ? ` ×${qty}` : ''}
                                </span>
                                <span className="font-medium" data-testid={`text-summary-upgrade-price-${upgrade.id}`}>
                                  {formatPrice(upgrade.price * qty)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {financePlan && (
                        <div className="flex items-start gap-3">
                          <CreditCard className="w-5 h-5 text-accent mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium text-sm">Finance</p>
                            <p className="text-sm text-muted-foreground" data-testid="text-summary-finance">
                              {financePlan.name}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="border-t pt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span className="font-medium" data-testid="text-summary-subtotal">
                            {formatPrice(pricing.subtotal)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">VAT (20%)</span>
                          <span className="font-medium" data-testid="text-summary-vat">
                            {formatPrice(pricing.vat)}
                          </span>
                        </div>
                        <div className="flex justify-between text-lg font-bold border-t pt-2">
                          <span>Total</span>
                          <span className="text-accent" data-testid="text-summary-total">
                            {formatPrice(pricing.total)}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
