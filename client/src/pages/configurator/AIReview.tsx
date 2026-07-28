import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useConfigurator } from "@/lib/ConfiguratorContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Check,
  Zap,
  Package,
  Layers,
  CreditCard,
  Car,
  Star,
  ReceiptText,
  Info,
} from "lucide-react";
import type { Kit, Upgrade, FinancePlan } from "@shared/schema";
import type { AIConfig, AITrackers } from "@/lib/aiConfiguratorMapping";

const AI_CHAT_KEY = "ai-chat:v1";

const formatPrice = (pence: number): string =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(pence / 100);

const CATEGORY_LABELS: Record<string, string> = {
  "air-systems": "Air Systems",
  "air-system": "Air Systems",
  "equipment": "Equipment",
  "equipment-options": "Equipment Options",
  "branding": "Branding",
  "security": "Security",
  "lighting": "Lighting",
  "business": "Business",
  "technology": "Technology",
  "comfort": "Comfort",
  "storage": "Storage",
  "safety": "Safety",
  "power": "Power",
  "accessories": "Accessories",
  "commercial": "Commercial / Hybrid",
  "profit-makers": "Profit Makers",
};

interface AIChatState {
  sessionId: string;
  messages: Array<{ role: string; content: string }>;
  config: AIConfig;
  stage: string;
  trackers: AITrackers;
  savedAt: string;
}

interface UpgradeGroup {
  parent: Upgrade;
  variants: Upgrade[];
}

interface UpgradeCategoryItems {
  groups: UpgradeGroup[];
  standalones: Upgrade[];
}

function buildUpgradeGroups(upgrades: Upgrade[]): Record<string, UpgradeCategoryItems> {
  const parentIds = new Set<string>();
  for (const u of upgrades) {
    if (u.parentId) parentIds.add(u.parentId);
  }

  const categoryMap: Record<string, UpgradeCategoryItems> = {};

  const ensureCat = (cat: string) => {
    if (!categoryMap[cat]) categoryMap[cat] = { groups: [], standalones: [] };
  };

  // Build variant groups
  const groupMap = new Map<string, UpgradeGroup>();
  for (const u of upgrades) {
    if (u.parentId) {
      const parent = upgrades.find(p => p.id === u.parentId);
      if (parent) {
        let group = groupMap.get(u.parentId);
        if (!group) {
          group = { parent, variants: [] };
          groupMap.set(u.parentId, group);
        }
        group.variants.push(u);
      }
    }
  }

  // Distribute into categories
  groupMap.forEach(group => {
    const cat = group.parent.category ?? "Other";
    ensureCat(cat);
    categoryMap[cat].groups.push(group);
  });

  // Standalones: no parentId and not a parent of variants
  for (const u of upgrades) {
    if (!u.parentId && !parentIds.has(u.id)) {
      const cat = u.category ?? "Other";
      ensureCat(cat);
      categoryMap[cat].standalones.push(u);
    }
  }

  return categoryMap;
}

function useAIChatState(): AIChatState | null {
  const [state, setState] = useState<AIChatState | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(AI_CHAT_KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);
  return state;
}

// Collapsible section wrapper
function Section({
  title,
  icon,
  badge,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <CardHeader
        className="cursor-pointer flex flex-row items-center justify-between gap-2 pb-3"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <CardTitle className="text-base">{title}</CardTitle>
          {badge && <Badge variant="outline" className="text-xs">{badge}</Badge>}
        </div>
        <Button variant="ghost" size="icon" tabIndex={-1} className="shrink-0" data-testid={`button-toggle-section-${title}`}>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </CardHeader>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

function calcMonthly(totalPence: number, plan: FinancePlan): {
  deposit: number; loan: number; monthly: number; totalRepayable: number; balloon: number;
} {
  const deposit = Math.round(totalPence * (plan.depositPercent ?? 10) / 100);
  const balloonAmt = plan.balloonPercent ? Math.round(totalPence * plan.balloonPercent / 100) : 0;
  const loan = totalPence - deposit;
  const annualRate = (plan.aprBps ?? 1090) / 10000;
  const r = annualRate / 12;
  const n = plan.termMonths;
  // Reduce PV by balloon discounted back
  const effectiveLoan = loan - balloonAmt / Math.pow(1 + r, n);
  const monthly = r === 0
    ? effectiveLoan / n
    : effectiveLoan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const totalRepayable = deposit + Math.round(monthly) * n + balloonAmt;
  return { deposit, loan, monthly: Math.round(monthly), totalRepayable, balloon: balloonAmt };
}

export default function AIReview() {
  const [, navigate] = useLocation();
  const { state, setKit, addUpgrade, removeUpgrade, setFinancePlan } = useConfigurator();
  const aiState = useAIChatState();
  const aiConfig = aiState?.config ?? null;
  const [paymentMethod, setPaymentMethod] = useState<"outright" | "finance" | "lease">(
    () => {
      if (aiConfig?.financePreference === "lease") return "lease";
      if (aiConfig?.financePreference === "finance") return "finance";
      return "outright";
    }
  );

  const { data: kits = [] } = useQuery<Kit[]>({ queryKey: ["/api/kits"] });
  const { data: allUpgrades = [] } = useQuery<Upgrade[]>({ queryKey: ["/api/upgrades"] });
  const { data: financePlans = [] } = useQuery<FinancePlan[]>({ queryKey: ["/api/finance-plans"] });

  const selectedKit = kits.find(k => k.id === state.kitId);
  const selectedUpgrades = allUpgrades.filter(u => state.upgradeIds.includes(u.id));

  // Build grouped upgrade structure
  const upgradesByCategory = buildUpgradeGroups(allUpgrades);

  // ── Exclusive group helpers (mirrors SelectUpgrades.tsx) ──────────────────
  const getExclusiveGroup = (upgrade: Upgrade): string | null => {
    if ((upgrade as any).exclusiveGroup) return (upgrade as any).exclusiveGroup;
    if (upgrade.parentId) {
      const parent = allUpgrades.find(u => u.id === upgrade.parentId);
      if (parent && (parent as any).exclusiveGroup) return (parent as any).exclusiveGroup;
    }
    return null;
  };

  const enforceExclusiveGroup = (newUpgradeId: string) => {
    const upgrade = allUpgrades.find(u => u.id === newUpgradeId);
    if (!upgrade) return;
    const group = getExclusiveGroup(upgrade);
    if (!group) return;
    // Remove any other upgrade in the same exclusive group
    allUpgrades
      .filter(u => getExclusiveGroup(u) === group && u.id !== newUpgradeId && state.upgradeIds.includes(u.id))
      .forEach(u => removeUpgrade(u.id));
  };

  // ── Auto-enforce exclusive groups on every state change ───────────────────
  useEffect(() => {
    if (!allUpgrades.length) return;
    const groupMap = new Map<string, string[]>();
    state.upgradeIds.forEach(id => {
      const u = allUpgrades.find(x => x.id === id);
      if (!u) return;
      const group = getExclusiveGroup(u);
      if (group) {
        if (!groupMap.has(group)) groupMap.set(group, []);
        groupMap.get(group)!.push(id);
      }
    });
    groupMap.forEach(ids => {
      if (ids.length > 1) {
        ids.slice(1).forEach(id => removeUpgrade(id));
      }
    });
  }, [state.upgradeIds, allUpgrades]);

  // ── Auto-select 48V upgrade when AI indicated customer wants it ───────────
  const has48vAutoAdded = useRef(false);
  useEffect(() => {
    if (!aiConfig?.includes48v || !allUpgrades.length || has48vAutoAdded.current) return;
    const is48v = (u: Upgrade) => /silent|48v/i.test(u.name) || /48v/i.test(u.description ?? "");
    // Already have one selected?
    const already = allUpgrades.filter(u => is48v(u) || (u.parentId && is48v(allUpgrades.find(p => p.id === u.parentId) ?? u)))
      .some(u => state.upgradeIds.includes(u.id));
    if (already) { has48vAutoAdded.current = true; return; }
    // Find a parent with variants
    const parent48v = allUpgrades.find(u => !u.parentId && is48v(u));
    if (parent48v) {
      const variants = allUpgrades.filter(u => u.parentId === parent48v.id);
      if (variants.length > 0) {
        addUpgrade(variants[0].id);
      } else {
        // Standalone (no variants yet)
        addUpgrade(parent48v.id);
      }
    } else {
      // No parent match — look for standalone
      const standalone = allUpgrades.find(u => !u.parentId && is48v(u) && !allUpgrades.some(v => v.parentId === u.id));
      if (standalone) addUpgrade(standalone.id);
    }
    has48vAutoAdded.current = true;
  }, [allUpgrades.length, aiConfig?.includes48v]);

  // Toggle a variant group on/off — selects first variant when enabling, enforces exclusive groups
  const handleToggleGroup = (parentId: string, variants: Upgrade[]) => {
    const selectedVariant = variants.find(v => state.upgradeIds.includes(v.id));
    if (selectedVariant) {
      removeUpgrade(selectedVariant.id);
    } else if (variants.length > 0) {
      enforceExclusiveGroup(variants[0].id);
      addUpgrade(variants[0].id);
    }
  };

  // Swap to a different variant within the same group
  const handleVariantChange = (parentId: string, newVariantId: string) => {
    const allVariantsForGroup = allUpgrades.filter(u => u.parentId === parentId);
    const currentlySelected = allVariantsForGroup.find(v => state.upgradeIds.includes(v.id));
    if (currentlySelected) removeUpgrade(currentlySelected.id);
    enforceExclusiveGroup(newVariantId);
    addUpgrade(newVariantId);
  };

  const packageLabel: Record<string, string> = {
    bronze: "Bronze",
    silver: "Silver",
    gold: "Gold",
  };

  const vanLabel = aiConfig?.ownVan === false
    ? `${aiConfig.vanSize ?? "Panel van"} — supplied by us`
    : aiConfig?.ownVan === true
    ? "Customer's own van"
    : state.customVanDescription ?? "Not specified";

  const handleToggleUpgrade = (upgradeId: string) => {
    if (state.upgradeIds.includes(upgradeId)) {
      removeUpgrade(upgradeId);
    } else {
      enforceExclusiveGroup(upgradeId);
      addUpgrade(upgradeId);
    }
  };

  const handleProceed = () => {
    navigate("/configurator/quote");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      {/* Page heading — intentionally no stepper */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 bg-[#8bc440]/15 rounded-full p-2 shrink-0">
              <Zap className="w-5 h-5 text-[#8bc440]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Your AI-built configuration</h1>
              <p className="text-muted-foreground mt-1">
                We've put this spec together based on your answers. Review everything below and make any
                adjustments before getting your quote — this is your starting point, not the final word.
              </p>
              {aiConfig?.packageId && (
                <Badge className="mt-2 bg-[#8bc440]/20 text-[#8bc440] border-[#8bc440]/30" variant="outline">
                  <Layers className="w-3 h-3 mr-1" />
                  {packageLabel[aiConfig.packageId]} package
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-5">

          {/* Van */}
          <Section title="Van" icon={<Car className="w-4 h-4" />}>
            <div className="py-1">
              <span className="text-sm">{vanLabel}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              To change the van, use the full configurator from the beginning.
            </p>
          </Section>

          {/* Kit */}
          <Section title="Tyre Equipment Kit" icon={<Package className="w-4 h-4" />} badge={selectedKit?.name}>
            <div className="space-y-2">
              {kits.map(kit => (
                <button
                  key={kit.id}
                  onClick={() => setKit(kit.id)}
                  data-testid={`button-select-kit-${kit.id}`}
                  className={`w-full flex items-start gap-3 rounded-md border p-3 text-left transition-colors ${
                    state.kitId === kit.id
                      ? "border-[#8bc440] bg-[#8bc440]/10"
                      : "border-border hover-elevate"
                  }`}
                >
                  <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    state.kitId === kit.id ? "border-[#8bc440]" : "border-muted-foreground/40"
                  }`}>
                    {state.kitId === kit.id && <div className="w-2 h-2 rounded-full bg-[#8bc440]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{kit.name}</span>
                      {kit.id === state.kitId && (
                        <Badge variant="outline" className="text-[10px] text-[#8bc440] border-[#8bc440]/30 py-0">
                          Selected by AI
                        </Badge>
                      )}
                    </div>
                    {kit.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{kit.description}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </Section>

          {/* Upgrades */}
          <Section
            title="Extras & Upgrades"
            icon={<Star className="w-4 h-4" />}
            badge={`${selectedUpgrades.length} selected`}
          >
            {selectedUpgrades.length > 0 && (
              <div className="mb-4 p-3 bg-muted/40 rounded-md">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Currently in your build
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedUpgrades.map(u => {
                    const parentName = u.parentId
                      ? allUpgrades.find(p => p.id === u.parentId)?.name
                      : null;
                    const label = parentName
                      ? `${parentName} (${u.variantName ?? u.name})`
                      : u.name;
                    return (
                      <button
                        key={u.id}
                        onClick={() => removeUpgrade(u.id)}
                        data-testid={`button-remove-upgrade-${u.id}`}
                        className="flex items-center gap-1.5 text-xs bg-[#8bc440]/15 text-[#8bc440] border border-[#8bc440]/30 rounded-md px-2 py-1 hover:bg-red-500/15 hover:text-red-400 hover:border-red-400/30 transition-colors"
                      >
                        <Check className="w-3 h-3" />
                        {label}
                        <span className="opacity-60 ml-0.5">✕</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">Click any item to remove it</p>
              </div>
            )}

            <div className="space-y-5">
              {Object.entries(upgradesByCategory).sort().map(([category, { groups, standalones }]) => {
                const hasSelected =
                  groups.some(g => g.variants.some(v => state.upgradeIds.includes(v.id))) ||
                  standalones.some(u => state.upgradeIds.includes(u.id));
                if (groups.length === 0 && standalones.length === 0) return null;
                return (
                  <div key={category}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                      {CATEGORY_LABELS[category] ?? category}
                      {hasSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#8bc440] inline-block" />}
                    </p>
                    <div className="space-y-2">
                      {/* Variant groups — one row per parent, with dropdown when selected */}
                      {groups.map(({ parent, variants }) => {
                        const selectedVariant = variants.find(v => state.upgradeIds.includes(v.id));
                        const groupSelected = !!selectedVariant;
                        const minPrice = variants.length > 0
                          ? Math.min(...variants.map(v => v.price).filter(p => p > 0))
                          : 0;
                        return (
                          <div
                            key={parent.id}
                            className={`rounded-md border p-2.5 transition-colors ${
                              groupSelected ? "border-[#8bc440]/50 bg-[#8bc440]/5" : "border-border"
                            }`}
                          >
                            <div
                              className="flex items-start gap-3 cursor-pointer"
                              onClick={() => handleToggleGroup(parent.id, variants)}
                              data-testid={`checkbox-upgrade-group-${parent.id}`}
                            >
                              <Checkbox
                                checked={groupSelected}
                                onCheckedChange={() => handleToggleGroup(parent.id, variants)}
                                className="mt-0.5 data-[state=checked]:bg-[#8bc440] data-[state=checked]:border-[#8bc440]"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-sm font-medium">{parent.name}</span>
                                    {parent.popular && (
                                      <Badge variant="outline" className="text-[10px] py-0">Popular</Badge>
                                    )}
                                  </div>
                                  <span className="text-sm font-semibold text-muted-foreground shrink-0">
                                    {groupSelected && selectedVariant && selectedVariant.price > 0
                                      ? formatPrice(selectedVariant.price)
                                      : minPrice > 0
                                      ? `From ${formatPrice(minPrice)}`
                                      : ""}
                                  </span>
                                </div>
                                {parent.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{parent.description}</p>
                                )}
                              </div>
                            </div>
                            {/* Variant selector — only visible when group is checked */}
                            {groupSelected && variants.length > 1 && (
                              <div className="mt-2 ml-7" onClick={e => e.stopPropagation()}>
                                <Select
                                  value={selectedVariant?.id ?? ""}
                                  onValueChange={val => handleVariantChange(parent.id, val)}
                                >
                                  <SelectTrigger
                                    className="h-8 text-xs"
                                    data-testid={`select-variant-${parent.id}`}
                                  >
                                    <SelectValue placeholder="Choose option…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {variants.map(v => (
                                      <SelectItem key={v.id} value={v.id} className="text-xs">
                                        {v.variantName ?? v.name}
                                        {v.price > 0 ? ` — ${formatPrice(v.price)}` : ""}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {/* Standalone upgrades (no variants) */}
                      {standalones.map(u => {
                        const selected = state.upgradeIds.includes(u.id);
                        return (
                          <div
                            key={u.id}
                            className={`flex items-start gap-3 rounded-md border p-2.5 cursor-pointer transition-colors ${
                              selected ? "border-[#8bc440]/50 bg-[#8bc440]/5" : "border-border hover-elevate"
                            }`}
                            onClick={() => handleToggleUpgrade(u.id)}
                            data-testid={`checkbox-upgrade-${u.id}`}
                          >
                            <Checkbox
                              checked={selected}
                              onCheckedChange={() => handleToggleUpgrade(u.id)}
                              className="mt-0.5 data-[state=checked]:bg-[#8bc440] data-[state=checked]:border-[#8bc440]"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm font-medium">{u.name}</span>
                                  {u.popular && (
                                    <Badge variant="outline" className="text-[10px] py-0">Popular</Badge>
                                  )}
                                </div>
                                {u.price > 1 && (
                                  <span className="text-sm font-semibold text-muted-foreground shrink-0">
                                    {formatPrice(u.price)}
                                  </span>
                                )}
                              </div>
                              {u.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{u.description}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Finance */}
          {(() => {
            const kitPrice = selectedKit?.price ?? 0;
            const upgradesSubtotal = selectedUpgrades.reduce((sum, u) => sum + (u.price > 1 ? u.price : 0), 0);
            const subtotal = kitPrice + upgradesSubtotal;
            const totalIncVat = subtotal + Math.round(subtotal * 0.2);

            const financeOptions = [
              { value: "outright" as const, label: "Buy outright", description: "Full payment upfront, no interest." },
              { value: "finance" as const, label: "Spread the cost", description: "Hire purchase over an agreed term." },
              { value: "lease" as const, label: "Business lease", description: "Monthly payments, off the balance sheet." },
            ];

            const plansForMethod = financePlans.filter(p => {
              const t = p.type?.toUpperCase();
              if (paymentMethod === "finance") return t === "HP" || t === "HIRE_PURCHASE" || t === "FINANCE";
              if (paymentMethod === "lease") return t === "LEASE";
              return false;
            });

            const selectedPlan = financePlans.find(p => p.id === state.financePlanId);
            const activePlan = selectedPlan ?? plansForMethod[0] ?? null;
            const calc = activePlan && totalIncVat > 0 ? calcMonthly(totalIncVat, activePlan) : null;

            return (
              <Section title="Payment Method" icon={<CreditCard className="w-4 h-4" />}>
                <div className="space-y-2">
                  {financeOptions.map(option => {
                    const isSelected = paymentMethod === option.value;
                    return (
                      <div key={option.value}>
                        <button
                          onClick={() => {
                            setPaymentMethod(option.value);
                            if (option.value === "outright") {
                              setFinancePlan(null);
                            } else {
                              const plans = financePlans.filter(p => {
                                const t = p.type?.toUpperCase();
                                if (option.value === "finance") return t === "HP" || t === "HIRE_PURCHASE" || t === "FINANCE";
                                if (option.value === "lease") return t === "LEASE";
                                return false;
                              });
                              if (plans[0]) setFinancePlan(plans[0].id);
                            }
                          }}
                          data-testid={`button-finance-${option.value}`}
                          className={`w-full flex items-start gap-3 rounded-md border p-3 text-left transition-colors ${
                            isSelected ? "border-[#8bc440] bg-[#8bc440]/10" : "border-border hover-elevate"
                          }`}
                        >
                          <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? "border-[#8bc440]" : "border-muted-foreground/40"
                          }`}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-[#8bc440]" />}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{option.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                          </div>
                        </button>

                        {/* Finance plan picker + calculator — shown inline below the selected option */}
                        {isSelected && option.value !== "outright" && totalIncVat > 0 && (
                          <div className="mt-2 ml-7 space-y-3">
                            {plansForMethod.length > 1 && (
                              <div className="space-y-1.5">
                                {plansForMethod.map(plan => (
                                  <button
                                    key={plan.id}
                                    onClick={() => setFinancePlan(plan.id)}
                                    data-testid={`button-plan-${plan.id}`}
                                    className={`w-full flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                                      (state.financePlanId === plan.id || (!state.financePlanId && plan === plansForMethod[0]))
                                        ? "border-[#8bc440] bg-[#8bc440]/10 font-medium"
                                        : "border-border hover-elevate"
                                    }`}
                                  >
                                    <div className={`flex-shrink-0 w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                                      (state.financePlanId === plan.id || (!state.financePlanId && plan === plansForMethod[0]))
                                        ? "border-[#8bc440]" : "border-muted-foreground/40"
                                    }`}>
                                      {(state.financePlanId === plan.id || (!state.financePlanId && plan === plansForMethod[0])) && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#8bc440]" />
                                      )}
                                    </div>
                                    {plan.name}
                                  </button>
                                ))}
                              </div>
                            )}

                            {calc && activePlan && (
                              <div className="rounded-md bg-muted/40 border border-border p-3 space-y-2 text-sm">
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Deposit ({activePlan.depositPercent ?? 10}%)</span>
                                  <span className="font-medium">{formatPrice(calc.deposit)}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Amount financed</span>
                                  <span className="font-medium">{formatPrice(calc.loan)}</span>
                                </div>
                                {calc.balloon > 0 && (
                                  <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">Balloon payment ({activePlan.balloonPercent}%)</span>
                                    <span className="font-medium">{formatPrice(calc.balloon)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between gap-4 border-t pt-2 mt-1">
                                  <span className="text-muted-foreground">Term</span>
                                  <span className="font-medium">{activePlan.termMonths} months</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">APR</span>
                                  <span className="font-medium">{((activePlan.aprBps ?? 0) / 100).toFixed(2)}%</span>
                                </div>
                                <div className="flex justify-between gap-4 border-t pt-2 mt-1 font-bold text-base">
                                  <span>Monthly payment</span>
                                  <span className="text-[#8bc440]" data-testid="text-monthly-payment">{formatPrice(calc.monthly)}/mo</span>
                                </div>
                                <div className="flex justify-between gap-4 text-xs text-muted-foreground">
                                  <span>Total repayable</span>
                                  <span>{formatPrice(calc.totalRepayable)}</span>
                                </div>
                                <p className="text-xs text-muted-foreground pt-1">
                                  Finance subject to status. Indicative figures only — confirmed on application.
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Section>
            );
          })()}

          {/* Price Summary */}
          {(() => {
            const kitPrice = selectedKit?.price ?? 0;
            const upgradesSubtotal = selectedUpgrades.reduce((sum, u) => sum + (u.price > 1 ? u.price : 0), 0);
            const subtotal = kitPrice + upgradesSubtotal;
            const vat = Math.round(subtotal * 0.2);
            const total = subtotal + vat;
            if (subtotal === 0) return null;
            return (
              <Card data-testid="card-price-summary">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ReceiptText className="w-4 h-4 text-muted-foreground" />
                    Build Estimate
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {/* Line items */}
                  <div className="space-y-1.5 text-sm">
                    {selectedKit && kitPrice > 0 && (
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground truncate">{selectedKit.name}</span>
                        <span className="shrink-0 font-medium">{formatPrice(kitPrice)}</span>
                      </div>
                    )}
                    {selectedUpgrades.filter(u => u.price > 1).map(u => {
                      const parentName = u.parentId
                        ? allUpgrades.find(p => p.id === u.parentId)?.name
                        : null;
                      const label = parentName
                        ? `${parentName}${u.variantName ? ` (${u.variantName})` : ""}`
                        : u.name;
                      return (
                        <div key={u.id} className="flex justify-between gap-4">
                          <span className="text-muted-foreground truncate">{label}</span>
                          <span className="shrink-0 font-medium">{formatPrice(u.price)}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Subtotal + VAT + Total */}
                  <div className="border-t pt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between gap-4 text-muted-foreground">
                      <span>Subtotal (ex VAT)</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex justify-between gap-4 text-muted-foreground">
                      <span>VAT (20%)</span>
                      <span>{formatPrice(vat)}</span>
                    </div>
                    <div className="flex justify-between gap-4 font-bold text-base border-t pt-2 mt-1">
                      <span>Total inc VAT</span>
                      <span className="text-[#8bc440]" data-testid="text-build-total">{formatPrice(total)}</span>
                    </div>
                  </div>

                  {/* Disclaimer */}
                  <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md p-2.5">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>This is an estimate based on your selections. Final pricing is confirmed when you get your quote — there are no hidden costs.</span>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Proceed CTA */}
          <div className="pt-2 pb-10">
            <Button
              onClick={handleProceed}
              data-testid="button-get-quote"
              className="w-full bg-[#8bc440e6] text-[#191919] hover:bg-[#8bc440] font-semibold text-base h-12"
            >
              Get my quote
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-3">
              Your configuration is saved. You can also{" "}
              <button
                className="underline hover:text-foreground"
                onClick={() => navigate("/configurator/van")}
                data-testid="button-use-full-configurator"
              >
                use the full configurator
              </button>{" "}
              if you prefer.
            </p>
          </div>

        </div>
      </div>

      <Footer />
    </div>
  );
}
