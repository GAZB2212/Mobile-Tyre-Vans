import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useConfigurator } from "@/lib/ConfiguratorContext";
import { ConfiguratorSummary } from "@/components/ConfiguratorSummary";
import { apiRequest, queryClient, fetchJson } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User, Van, Kit, Upgrade } from "@shared/schema";
import type { KitServiceType } from "@shared/schema";
import { vanNetPrice } from "@shared/pricing";

import { AdminPageHeader } from "@/components/AdminPageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious,
} from "@/components/ui/carousel";
import { Separator } from "@/components/ui/separator";
import { CompareSlotToggle } from "@/components/CompareSlotToggle";
import {
  ArrowLeft, ArrowRight, Car, Gauge, Settings, Info, SlidersHorizontal,
  X, Truck, Shuffle, Package, Zap, CheckCircle, AlertTriangle, AlertCircle,
  Star, Calculator, PoundSterling, CheckCircle2, Loader2, UserRound, RotateCcw, GitCompare,
  Plus, Trash2,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const FINANCE_APR = 0.109;

const SERVICE_OPTIONS: {
  value: KitServiceType;
  label: string;
  description: string;
  detail: string;
  Icon: React.ComponentType<{ className?: string }>;
  nextPath: string;
}[] = [
  {
    value: "car",
    label: "Car & Van Tyres",
    description: "Passenger cars, vans & SUVs",
    detail:
      "Your conversion will be set up for fitting standard car and light-van tyres. Choose from our range of equipment packs in the next step.",
    Icon: Car,
    nextPath: "kit",
  },
  {
    value: "commercial",
    label: "Commercial Only",
    description: "HGVs, lorries & heavy commercial fleet",
    detail:
      "For heavy goods vehicles and large commercial fleets only. No equipment pack required — select your commercial extras and equipment in the next step.",
    Icon: Truck,
    nextPath: "upgrades",
  },
  {
    value: "hybrid",
    label: "Car & Commercial",
    description: "Mixed fleet — car tyres and commercial",
    detail:
      "Your van will handle both standard car/van tyres and commercial vehicles. You'll choose an equipment pack first, then select your commercial extras on top.",
    Icon: Shuffle,
    nextPath: "kit",
  },
];

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

const FALLBACK_CATEGORY_ORDER = [
  "commercial", "air-systems", "air-system", "equipment", "equipment-options",
  "branding", "lighting", "comfort", "power", "technology", "security",
];

function getFallbackCategoryOrder(cat: string) {
  const i = FALLBACK_CATEGORY_ORDER.indexOf(cat);
  return i === -1 ? 999 : i;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0 }).format(pence / 100);
}
function fmtDec(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2 }).format(pence / 100);
}

function calcFinance(totalGbp: number, depositGbp: number, years: number) {
  if (totalGbp <= 0 || depositGbp >= totalGbp) return null;
  const principal = totalGbp - depositGbp;
  const r = FINANCE_APR / 12;
  const n = years * 12;
  const monthly = principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const weekly = (monthly * 12) / 52;
  return { principal, monthly, weekly, totalRepayable: monthly * n, totalInterest: monthly * n - principal, deposit: depositGbp, total: totalGbp };
}

function groupUpgrades(upgrades: Upgrade[]) {
  const parentIds = new Set(upgrades.filter(u => u.parentId).map(u => u.parentId!));
  const parentMap = new Map<string, { parent: Upgrade; variants: Upgrade[] }>();
  upgrades.filter(u => u.parentId).forEach(u => {
    if (!parentMap.has(u.parentId!)) {
      const parent = upgrades.find(p => p.id === u.parentId);
      if (parent) parentMap.set(u.parentId!, { parent, variants: [] });
    }
    parentMap.get(u.parentId!)?.variants.push(u);
  });
  const standalone = upgrades.filter(u => !u.parentId && !parentIds.has(u.id));
  return { groups: Array.from(parentMap.values()), standalone };
}

interface SaveForm { userName: string; email: string; phone: string; company: string; notes: string; staffName: string; }
interface DiscountState { type: 'none' | 'percentage' | 'fixed'; value: string; }
interface ConfiguratorData { kits: any[]; upgrades: Record<string, Upgrade[]>; categories: { id: string; label: string; sortOrder: number }[]; financePlans: any[]; }

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminConfigurator() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth() as {
    user: User | undefined; isAuthenticated: boolean; isLoading: boolean;
  };

  const {
    state, setVan, setVanOnly, setVanReg, setCustomVanValue,
    setServiceTypeOnly, setKitOnly, setUpgrades,
    addUpgrade, removeUpgrade, replaceUpgrades, clearAll,
    compareMode, activeSlot, enableCompareMode, slotA, slotB,
  } = useConfigurator();

  // ── Van section state
  const [modalVan, setModalVan] = useState<Van | null>(null);
  const [filterMake, setFilterMake] = useState("all");
  const [filterModel, setFilterModel] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [filterFuel, setFilterFuel] = useState("all");
  const [ownVanReg, setOwnVanReg] = useState(state.vanReg ?? "");
  const [ownVanPrice, setOwnVanPrice] = useState(state.customVanValue ? (state.customVanValue / 100).toFixed(0) : "");

  // ── Kit section state
  const [modalKit, setModalKit] = useState<Kit | null>(null);
  const [warnKit, setWarnKit] = useState<Kit | null>(null);

  // ── Upgrades section state
  const [upgradeQuantities, setUpgradeQuantities] = useState<Record<string, number>>({});
  const [modalUpgrade, setModalUpgrade] = useState<{ upgrade: Upgrade; variants: Upgrade[] } | null>(null);
  const [quantityPrompt, setQuantityPrompt] = useState<{ upgrade: Upgrade; pendingQty: number } | null>(null);

  // ── Custom extras state (bespoke items not in standard configurator)
  const [customExtras, setCustomExtras] = useState<Array<{id: string; description: string; pricePence: number}>>([]);
  const [newExtraDescription, setNewExtraDescription] = useState('');
  const [newExtraPrice, setNewExtraPrice] = useState('');

  // ── Finance section state
  const [termYears, setTermYears] = useState(3);
  const [depositAmount, setDepositAmount] = useState("");
  const [vatRegistered, setVatRegistered] = useState(false);
  const [deferVat, setDeferVat] = useState(false);

  // ── Commercial-with-kit confirmation dialog
  const [pendingCommercialType, setPendingCommercialType] = useState<KitServiceType | null>(null);

  // ── Save as quote dialog
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveForm, setSaveForm] = useState<SaveForm>({ userName: "", email: "", phone: "", company: "", notes: "", staffName: "" });
  const [discount, setDiscount] = useState<DiscountState>({ type: 'none', value: '' });

  // ── Auth guard
  useEffect(() => { if (!isLoading && !isAuthenticated) window.location.href = "/login"; }, [isLoading, isAuthenticated]);
  useEffect(() => { if (user && (!user.adminRole || user.adminRole === "none")) navigate("/"); }, [user, navigate]);

  // ── Stale session detection
  const sessionCheckDone = useRef(false);
  const [showSessionModal, setShowSessionModal] = useState(false);

  useEffect(() => {
    if (sessionCheckDone.current || isLoading || !isAuthenticated) return;
    sessionCheckDone.current = true;
    const hasProgress =
      slotA.vanId !== null ||
      slotA.customVanDescription !== null ||
      slotA.customVanValue !== null ||
      slotA.serviceType !== null ||
      slotA.kitId !== null ||
      slotA.upgradeIds.length > 0 ||
      compareMode;
    if (hasProgress) setShowSessionModal(true);
  }, [isLoading, isAuthenticated, slotA, compareMode]);

  // ── Sync own-van inputs when context changes (e.g. edited via ConfiguratorSummary)
  useEffect(() => { setOwnVanReg(state.vanReg ?? ""); }, [state.vanReg]);
  useEffect(() => { setOwnVanPrice(state.customVanValue ? (state.customVanValue / 100).toFixed(0) : ""); }, [state.customVanValue]);

  // ── Data
  const { data: allVans = [], isLoading: vansLoading } = useQuery<Van[]>({ queryKey: ["/api/vans"] });
  const { data: configData, isLoading: configLoading } = useQuery<ConfiguratorData>({ queryKey: ["/api/configurator/data"] });

  const { data: selectedVanData } = useQuery<Van>({
    queryKey: ["/api/vans", state.vanId],
    queryFn: () => fetchJson(`/api/vans/${state.vanId}`),
    enabled: !!state.vanId,
  });

  // ── Van filters
  const filterOptions = useMemo(() => ({
    makes: Array.from(new Set(allVans.map(v => v.make))).sort(),
    models: Array.from(new Set(allVans.map(v => v.model))).sort(),
    years: Array.from(new Set(allVans.map(v => v.year))).sort((a, b) => b - a),
    fuels: Array.from(new Set(allVans.map(v => v.specs.fuel).filter(Boolean))).sort(),
  }), [allVans]);

  const filteredVans = useMemo(() => allVans.filter(v => {
    if (filterMake !== "all" && v.make !== filterMake) return false;
    if (filterModel !== "all" && v.model !== filterModel) return false;
    if (filterYear !== "all" && v.year.toString() !== filterYear) return false;
    if (filterFuel !== "all" && v.specs.fuel !== filterFuel) return false;
    return true;
  }), [allVans, filterMake, filterModel, filterYear, filterFuel]);

  const hasActiveFilters = filterMake !== "all" || filterModel !== "all" || filterYear !== "all" || filterFuel !== "all";

  // ── Euro 6
  const isEuro6Van = useMemo(() => {
    if (!selectedVanData?.euroStatus) return null;
    const s = selectedVanData.euroStatus.toLowerCase();
    if (s.includes("euro 6") || s.includes("euro6")) return true;
    return false;
  }, [selectedVanData]);

  const kitNeedsWarning = (kit: Kit) => {
    if (isEuro6Van === null) return false;
    if (isEuro6Van && !kit.euroSixCompatible) return true;
    if (!isEuro6Van && kit.euroSixCompatible) return true;
    return false;
  };

  // ── Kit filtering
  const kits = useMemo(() => {
    if (!configData) return [];
    return configData.kits
      .filter(kit => {
        const types: string[] = Array.isArray(kit.serviceType) ? kit.serviceType : ["car", "commercial", "hybrid"];
        if (types.length === 0 || types.length === 3) {
          if (!state.serviceType) return true;
          return true;
        }
        if (!state.serviceType) return true;
        if (state.serviceType === "hybrid") return types.includes("hybrid") || types.includes("car");
        return types.includes(state.serviceType);
      })
      .sort((a: any, b: any) => a.sortOrder - b.sortOrder);
  }, [configData, state.serviceType]);

  // ── Upgrade filtering
  const isCommercial = state.serviceType === "commercial" || state.serviceType === "hybrid";
  const isHybrid = state.serviceType === "hybrid";

  const filteredUpgrades = useMemo<Record<string, Upgrade[]>>(() => {
    if (!configData) return {};
    if (isCommercial) {
      const result: Record<string, Upgrade[]> = {};
      for (const [cat, ups] of Object.entries(configData.upgrades)) {
        const visible = ups.filter((u: any) => !u.carOnly && !(isHybrid && u.hideForHybrid));
        if (visible.length > 0) result[cat] = visible;
      }
      return result;
    }
    const result: Record<string, Upgrade[]> = {};
    for (const [cat, ups] of Object.entries(configData.upgrades)) {
      const visible = ups.filter((u: any) => !u.forCommercial);
      if (visible.length > 0) result[cat] = visible;
    }
    return result;
  }, [configData, isCommercial, isHybrid]);

  // Exclusive group helper
  const getExclusiveGroup = (upgrade: Upgrade, all: Upgrade[]): string | null => {
    if ((upgrade as any).exclusiveGroup) return (upgrade as any).exclusiveGroup;
    if (upgrade.parentId) {
      const parent = all.find(u => u.id === upgrade.parentId);
      if ((parent as any)?.exclusiveGroup) return (parent as any).exclusiveGroup;
    }
    return null;
  };

  const purgeQuantities = (ids: string[]) => {
    if (ids.length === 0) return;
    setUpgradeQuantities(prev => {
      const next = { ...prev };
      ids.forEach(id => { delete next[id]; });
      return next;
    });
  };

  // Change service type while stripping upgrades / kit that are incompatible with the new type
  const applyServiceTypeChange = (newType: KitServiceType, removeKit: boolean) => {
    if (!configData) { setServiceTypeOnly(newType); return; }
    const allUpgrades = Object.values(configData.upgrades).flat() as Upgrade[];
    const newIsCommercial = newType === "commercial" || newType === "hybrid";
    const newIsHybrid = newType === "hybrid";
    const incompatibleIds = state.upgradeIds.filter(id => {
      const u = allUpgrades.find(x => x.id === id);
      if (!u) return false;
      if (newIsCommercial) return u.carOnly || (newIsHybrid && u.hideForHybrid);
      return u.forCommercial;
    });
    if (incompatibleIds.length > 0) {
      setUpgrades(state.upgradeIds.filter(id => !incompatibleIds.includes(id)));
      purgeQuantities(incompatibleIds);
    }
    if (removeKit) {
      setKitOnly(null);
    } else if (state.kitId) {
      // For non-commercial switches, still clear kit if it's incompatible by serviceType flags
      const kit = configData.kits.find((k: any) => k.id === state.kitId);
      if (kit) {
        const types: string[] = Array.isArray(kit.serviceType) ? kit.serviceType : ["car", "commercial", "hybrid"];
        const compatible = types.length === 0 || types.length === 3
          ? true
          : newType === "hybrid"
            ? types.includes("hybrid") || types.includes("car")
            : types.includes(newType);
        if (!compatible) setKitOnly(null);
      }
    }
    setServiceTypeOnly(newType);
  };

  const handleServiceTypeChange = (newType: KitServiceType) => {
    // Switching to commercial-only with a kit already selected — ask staff what to do
    if (newType === "commercial" && state.kitId) {
      setPendingCommercialType(newType);
      return;
    }
    applyServiceTypeChange(newType, false);
  };

  // Auto-remove duplicate exclusive groups
  useEffect(() => {
    if (!configData) return;
    const all = Object.values(filteredUpgrades).flat();
    const selected = all.filter(u => state.upgradeIds.includes(u.id));
    const groupMap = new Map<string, string[]>();
    selected.forEach(u => {
      const g = getExclusiveGroup(u, all);
      if (g) { if (!groupMap.has(g)) groupMap.set(g, []); groupMap.get(g)!.push(u.id); }
    });
    groupMap.forEach(ids => {
      if (ids.length > 1) {
        const [keep, ...rem] = ids;
        replaceUpgrades(rem, keep);
        purgeQuantities(rem);
      }
    });
  }, [configData, state.upgradeIds, replaceUpgrades, filteredUpgrades]);

  const handleUpgradeToggle = (upgradeId: string) => {
    const all = Object.values(filteredUpgrades).flat();
    const upgrade = all.find(u => u.id === upgradeId);
    if (state.upgradeIds.includes(upgradeId)) {
      removeUpgrade(upgradeId);
      purgeQuantities([upgradeId]);
    } else {
      // For quantity upgrades being newly selected, prompt for quantity first
      if (upgrade && (upgrade as any).allowQuantity) {
        setQuantityPrompt({ upgrade, pendingQty: 1 });
        return;
      }
      const toRemove: string[] = [];
      if (upgrade) {
        const g = getExclusiveGroup(upgrade, all);
        if (g) {
          state.upgradeIds.forEach(id => {
            const u = all.find(x => x.id === id);
            if (u && getExclusiveGroup(u, all) === g && id !== upgradeId) toRemove.push(id);
          });
        }
      }
      if (toRemove.length > 0) {
        replaceUpgrades(toRemove, upgradeId);
        purgeQuantities(toRemove);
      } else addUpgrade(upgradeId);
    }
  };

  const confirmQuantityPrompt = () => {
    if (!quantityPrompt) return;
    const { upgrade, pendingQty } = quantityPrompt;
    const all = Object.values(filteredUpgrades).flat();
    const toRemove: string[] = [];
    const g = getExclusiveGroup(upgrade, all);
    if (g) {
      state.upgradeIds.forEach(id => {
        const u = all.find(x => x.id === id);
        if (u && getExclusiveGroup(u, all) === g && id !== upgrade.id) toRemove.push(id);
      });
    }
    if (toRemove.length > 0) {
      replaceUpgrades(toRemove, upgrade.id);
      purgeQuantities(toRemove);
    } else {
      addUpgrade(upgrade.id);
    }
    setUpgradeQuantities(prev => ({ ...prev, [upgrade.id]: Math.max(1, pendingQty) }));
    setQuantityPrompt(null);
  };

  const handleVariantSelect = (parentId: string, variantId: string | null, variantItems?: Upgrade[]) => {
    const all = Object.values(filteredUpgrades).flat();
    // Use provided variantItems if available (more reliable than filtering all),
    // falling back to searching the flat list.
    const siblingIds: string[] = variantItems
      ? variantItems.map(v => v.id)
      : all.filter(u => u.parentId === parentId).map(u => u.id);
    const toRemove: string[] = siblingIds.filter(id => state.upgradeIds.includes(id));
    if (variantId) {
      const v = all.find(u => u.id === variantId);
      if (v) {
        const g = getExclusiveGroup(v, all);
        if (g) {
          state.upgradeIds.forEach(id => {
            const u = all.find(x => x.id === id);
            if (u && getExclusiveGroup(u, all) === g && !toRemove.includes(id)) toRemove.push(id);
          });
        }
      }
      replaceUpgrades(toRemove, variantId);
      purgeQuantities(toRemove);
    } else {
      toRemove.forEach(id => removeUpgrade(id));
      purgeQuantities(toRemove);
    }
  };

  // ── Pricing (in pence) — computed directly, no useMemo, always fresh
  const allUpgradesList = useMemo(() => Object.values(filteredUpgrades).flat(), [filteredUpgrades]);

  // Current-slot pricing (follows activeSlot)
  const _pricingVanPrice = vanNetPrice(selectedVanData, state.customVanValue);
  const _pricingKit = configData?.kits.find((k: any) => k.id === state.kitId);
  const _pricingUpgradesTotal = state.upgradeIds.reduce((sum, id) => {
    const u = allUpgradesList.find(x => x.id === id);
    return sum + (u?.price ?? 0) * (upgradeQuantities[id] ?? 1);
  }, 0);
  const _customExtrasTotal = customExtras.reduce((sum, e) => sum + e.pricePence, 0);
  const _pricingSubtotal = _pricingVanPrice + (_pricingKit?.price ?? 0) + _pricingUpgradesTotal + _customExtrasTotal;
  const _pricingVat = Math.round(_pricingSubtotal * 0.2);
  const pricing = {
    subtotal: _pricingSubtotal / 100,
    vat: _pricingVat / 100,
    total: (_pricingSubtotal + _pricingVat) / 100,
    subtotalPence: _pricingSubtotal,
    vatPence: _pricingVat,
    totalPence: _pricingSubtotal + _pricingVat,
  };

  // SlotA pricing — always slotA regardless of active slot
  const _slotAVanPrice = vanNetPrice(allVans.find(v => v.id === slotA.vanId), slotA.customVanValue);
  const _slotAKit = configData?.kits.find((k: any) => k.id === slotA.kitId);
  const _slotAUpgradesTotal = slotA.upgradeIds.reduce((sum, id) => {
    const u = allUpgradesList.find(x => x.id === id);
    return sum + (u?.price ?? 0) * (upgradeQuantities[id] ?? 1);
  }, 0);
  const _slotASubtotal = _slotAVanPrice + (_slotAKit?.price ?? 0) + _slotAUpgradesTotal + _customExtrasTotal;
  const _slotAVat = Math.round(_slotASubtotal * 0.2);
  const slotAPricing = { subtotalPence: _slotASubtotal, vatPence: _slotAVat, totalPence: _slotASubtotal + _slotAVat };

  // SlotB pricing — always uses slotA's kit/upgrades, only slotB's van differs
  const _slotBVan = allVans.find(v => v.id === slotB.vanId);
  const _slotBVanPrice = vanNetPrice(_slotBVan, slotB.customVanValue);
  const _slotBHasVan = !!slotB.vanId || !!slotB.customVanValue;
  const slotBPricing = compareMode && (_slotBVanPrice > 0 || _slotBHasVan) ? (() => {
    const kitPrice = _slotAKit?.price ?? 0;
    const upgradesTotal = slotA.upgradeIds.reduce((sum, id) => {
      const u = allUpgradesList.find(x => x.id === id);
      return sum + (u?.price ?? 0) * (upgradeQuantities[id] ?? 1);
    }, 0);
    const subtotalPence = _slotBVanPrice + kitPrice + upgradesTotal + _customExtrasTotal;
    const vatPence = Math.round(subtotalPence * 0.2);
    return { subtotalPence, vatPence, totalPence: subtotalPence + vatPence };
  })() : null;

  // ── Discount preview (for the Save dialog UI only — server recalculates definitively via PATCH)
  const discountedPricing = useMemo(() => {
    const totalWithVat = slotAPricing.totalPence;
    let discountAmount = 0;
    if (discount.type === 'percentage') {
      const pct = parseFloat(discount.value) || 0;
      if (pct > 0 && pct <= 100) discountAmount = Math.round(totalWithVat * pct / 100);
    } else if (discount.type === 'fixed') {
      const fixedPence = Math.round((parseFloat(discount.value) || 0) * 100);
      if (fixedPence > 0 && fixedPence < totalWithVat) discountAmount = fixedPence;
    }
    return { discountAmount, finalTotal: totalWithVat - discountAmount };
  }, [slotAPricing.totalPence, discount]);

  const financeBase = deferVat
    ? (discountedPricing.finalTotal / 1.2) / 100
    : discountedPricing.finalTotal / 100;

  const financeBaseB = slotBPricing
    ? (deferVat ? (slotBPricing.totalPence / 1.2) / 100 : slotBPricing.totalPence / 100)
    : null;

  const financeCalc = useMemo(() => {
    const deposit = parseFloat(depositAmount) || 0;
    return calcFinance(financeBase, deposit, termYears);
  }, [financeBase, depositAmount, termYears]);

  const financeCalcB = useMemo(() => {
    if (!financeBaseB) return null;
    const deposit = parseFloat(depositAmount) || 0;
    return calcFinance(financeBaseB, deposit, termYears);
  }, [financeBaseB, depositAmount, termYears]);

  // ── Save as quote
  const saveMutation = useMutation({
    mutationFn: async (form: SaveForm) => {
      const upgradesMap: Record<string, number> = {};
      state.upgradeIds.forEach(id => { upgradesMap[id] = upgradeQuantities[id] ?? 1; });
      // In compare mode, slot B only needs a van to be a valid comparison
      const slotBHasData = !!(slotB.vanId || slotB.vanReg || slotB.customVanValue);

      const body: Record<string, unknown> = {
        userName: form.userName, email: form.email, phone: form.phone,
        company: form.company || undefined, notes: form.notes || undefined,
        staffName: form.staffName || undefined,
        serviceType: slotA.serviceType,
        vanId: slotA.vanId || undefined,
        customVanDescription: slotA.customVanDescription || undefined,
        customVanValue: slotA.customVanValue || undefined,
        kitId: slotA.kitId || undefined,
        selectedUpgradeIds: slotA.upgradeIds,
        selectedUpgrades: upgradesMap,
        trainingOptionIds: slotA.trainingOptionIds,
        customExtras,
        financeInputs: depositAmount || termYears ? {
          deposit: Math.round((parseFloat(depositAmount) || 0) * 100),
          term: termYears * 12,
        } : undefined,
        // est* must match the server's pre-discount calculation, which charges
        // no VAT when the quote is saved VAT-deferred.
        estSubtotal: slotAPricing.subtotalPence,
        estVAT: deferVat ? 0 : slotAPricing.vatPence,
        estTotal: deferVat ? slotAPricing.subtotalPence : slotAPricing.totalPence,
        estDiscount: 0, // server recalculates from discountType/discountValue below
        vatDeferred: deferVat,
        discountType: discount.type !== 'none' && discount.value ? discount.type : undefined,
        discountValue: discount.type !== 'none' && discount.value
          ? discount.type === 'percentage'
            ? Math.round(parseFloat(discount.value) || 0)
            : Math.round((parseFloat(discount.value) || 0) * 100)
          : undefined,
        status: "new",
        comparisonConfig: (compareMode && slotBHasData)
          ? {
              slotA: {
                vanId: slotA.vanId,
                customVanDescription: slotA.customVanDescription ?? undefined,
                customVanValue: slotA.customVanValue ?? undefined,
                vanRegistration: slotA.vanReg ?? undefined,
                serviceType: slotA.serviceType,
                kitId: slotA.kitId,
                upgradeIds: slotA.upgradeIds,
                trainingOptionIds: slotA.trainingOptionIds,
                financePlanId: slotA.financePlanId,
                financeInputs: slotA.financeInputs,
              },
              slotB: {
                vanId: slotB.vanId,
                customVanDescription: slotB.customVanDescription ?? undefined,
                customVanValue: slotB.customVanValue ?? undefined,
                vanRegistration: slotB.vanReg ?? undefined,
                // Config is shared from slot A — only the van differs in compare mode
                serviceType: slotA.serviceType,
                kitId: slotA.kitId,
                upgradeIds: slotA.upgradeIds,
                trainingOptionIds: slotA.trainingOptionIds,
                financePlanId: slotA.financePlanId,
                financeInputs: slotA.financeInputs,
              },
            }
          : undefined,
      };
      const res = await apiRequest("POST", "/api/quotes", body);
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: (quote) => {
      const hasDiscount = discount.type !== 'none' && discount.value;
      toast({ title: "Quote saved", description: `Quote created for ${saveForm.userName}${hasDiscount ? ' with discount applied' : ''}` });
      setSaveOpen(false);
      setSaveForm({ userName: "", email: "", phone: "", company: "", notes: "", staffName: "" });
      setDiscount({ type: 'none', value: '' });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      navigate(`/admin/quotes/${quote.id}`);
    },
    onError: (err: Error) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );
  if (!isAuthenticated || !user?.adminRole || user.adminRole === "none") return null;

  const skippedKit = state.serviceType === "commercial";

  return (
    <div className="min-h-screen bg-background">
      {/* Admin header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <AdminPageHeader
          title="Admin Configurator"
          description="Build and price a conversion for a customer"
          actions={
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin"><ArrowLeft className="w-4 h-4 mr-1" />Admin</Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => {
                clearAll();
                setFilterMake("all"); setFilterModel("all"); setFilterYear("all"); setFilterFuel("all");
                setOwnVanReg(""); setOwnVanPrice("");
                setUpgradeQuantities({}); setTermYears(3); setDepositAmount(""); setVatRegistered(false); setDeferVat(false);
              }} data-testid="button-reset-configurator">
                <RotateCcw className="w-4 h-4 mr-1" />Reset
              </Button>
              <Button
                size="sm"
                className="bg-[#8bc440e6] text-[#191919] hover:bg-[#8bc440]"
                disabled={pricing.totalPence === 0}
                onClick={() => setSaveOpen(true)}
                data-testid="button-save-as-quote"
              >
                Save as Quote<ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </>
          }
        />
      </div>
      <div className="container mx-auto px-4 py-8 max-w-[1600px]">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 md:gap-8">
          {/* Left column — steps */}
          <div className="xl:col-span-2 space-y-10">

            {/* ── STEP 1: VAN SELECTION ─────────────────────────── */}
            <section>
              <div className="flex items-start justify-between gap-4 mb-2">
                <h2 className="text-lg font-semibold tracking-tight">
                  {compareMode ? `1. Select Van — Option ${activeSlot}` : '1. Select Your Van'}
                </h2>
                {!compareMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={enableCompareMode}
                    className="flex-shrink-0 !border-2 !border-accent text-accent"
                    data-testid="button-enable-compare"
                  >
                    <GitCompare className="w-4 h-4 mr-1.5" />
                    Compare two vans
                  </Button>
                )}
              </div>
              <p className="text-muted-foreground mb-5">
                Browse our ready-to-convert stock, or scroll down to use an existing van.
              </p>
              <CompareSlotToggle />

              {vansLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  {/* Filters */}
                  <Card className="mb-6">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <div className="flex items-center gap-2">
                          <SlidersHorizontal className="w-5 h-5 text-accent" />
                          <CardTitle className="text-lg">Filter Vans</CardTitle>
                        </div>
                        {hasActiveFilters && (
                          <Button variant="ghost" size="sm" onClick={() => { setFilterMake("all"); setFilterModel("all"); setFilterYear("all"); setFilterFuel("all"); }}>
                            <X className="w-4 h-4 mr-1" />Clear Filters
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                          { label: "Make", value: filterMake, set: setFilterMake, options: filterOptions.makes },
                          { label: "Model", value: filterModel, set: setFilterModel, options: filterOptions.models },
                          { label: "Year", value: filterYear, set: setFilterYear, options: filterOptions.years.map(String) },
                          { label: "Fuel Type", value: filterFuel, set: setFilterFuel, options: filterOptions.fuels },
                        ].map(({ label, value, set, options }) => (
                          <div key={label} className="space-y-2">
                            <label className="text-sm font-medium">{label}</label>
                            <Select value={value} onValueChange={set}>
                              <SelectTrigger><SelectValue placeholder={`All ${label}s`} /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All {label}s</SelectItem>
                                {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground mt-4">Showing {filteredVans.length} of {allVans.length} vans</p>
                    </CardContent>
                  </Card>

                  {/* Van grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                    {filteredVans.length === 0 ? (
                      <div className="col-span-full text-center py-12">
                        <p className="text-muted-foreground">No vans match your filters.</p>
                      </div>
                    ) : filteredVans.map(van => {
                      const firstImage = van.heroImage || van.images?.[0];
                      const isSelected = state.vanId === van.id;
                      return (
                        <Card
                          key={van.id}
                          className={`hover-elevate cursor-pointer overflow-visible flex flex-col ${isSelected ? "ring-2 ring-accent" : ""}`}
                          onClick={() => setVanOnly(isSelected ? null : van.id)}
                          data-testid={`card-van-${van.id}`}
                        >
                          <div className="relative w-full h-28 overflow-hidden rounded-t-md bg-muted">
                            {firstImage
                              ? <img src={firstImage} alt={`${van.make} ${van.model}`} className="w-full h-full object-cover" loading="lazy" />
                              : <div className="w-full h-full flex items-center justify-center"><Car className="w-8 h-8 text-muted-foreground/40" /></div>
                            }
                          </div>
                          <CardContent className="px-2 py-2 flex flex-col gap-1.5">
                            <p className="text-xs font-mono font-semibold leading-tight">{van.reg || `${van.year} ${van.make}`}</p>
                            <p className="text-xs font-bold text-accent leading-tight">{fmt(van.price)}</p>
                            <Button
                              size="sm"
                              className={`w-full h-7 text-xs ${isSelected ? "bg-accent text-accent-foreground" : "!border !border-accent text-accent"}`}
                              variant={isSelected ? "default" : "outline"}
                              onClick={e => { e.stopPropagation(); setVanOnly(isSelected ? null : van.id); }}
                              data-testid={`button-select-van-${van.id}`}
                            >
                              {isSelected ? "Deselect" : "Select"}
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Own van */}
                  <Card className="border-dashed" id="own-van-section">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Car className="w-5 h-5 text-muted-foreground" />
                        <CardTitle className="text-lg">Not On Stock Van Details</CardTitle>
                      </div>
                      <p className="text-sm text-muted-foreground">Enter the customer's registration and optionally the van value.</p>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 max-w-md">
                        <div className="space-y-1.5">
                          <Label>Registration Plate</Label>
                          <Input placeholder="e.g. AB12 CDE" value={ownVanReg}
                            onChange={e => { const v = e.target.value.toUpperCase(); setOwnVanReg(v); setVanReg(v.trim() || null); }}
                            data-testid="input-own-van-reg" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Van Value (optional)</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">£</span>
                            <Input className="pl-7" placeholder="Optional" value={ownVanPrice}
                              onChange={e => {
                                const raw = e.target.value.replace(/[^0-9.]/g, "");
                                setOwnVanPrice(raw);
                                const n = parseFloat(raw);
                                setCustomVanValue(!isNaN(n) && n > 0 ? Math.round(n * 100) : null);
                              }}
                              data-testid="input-own-van-price" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </section>

            {/* ── COMPARE MODE: shared config notice shown when on slot B ── */}
            {compareMode && activeSlot === 'B' && (
              <div className="p-4 rounded-md bg-accent/10 border border-accent/20 flex items-start gap-3">
                <GitCompare className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Service type, kit &amp; upgrades are shared from Option A</p>
                  <p className="text-sm text-muted-foreground mt-1">Switch back to Option A to change the configuration. Option B only differs by van.</p>
                </div>
              </div>
            )}

            {/* ── STEPS 2–4: only shown when editing slot A (config is shared) ── */}
            {(!compareMode || activeSlot === 'A') && (<>

            {/* ── STEP 2: SERVICE TYPE ──────────────────────────── */}
            <section>
              <h2 className="text-lg font-semibold tracking-tight mb-2">2. What Will You Be Fitting?</h2>
              <p className="text-muted-foreground mb-5">Tell us what type of vehicles the mobile tyre service will cover.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {SERVICE_OPTIONS.map(({ value, label, description, detail, Icon }) => {
                  const isSelected = state.serviceType === value;
                  return (
                    <Card
                      key={value}
                      className={`cursor-pointer hover-elevate transition-all ${isSelected ? "ring-2 ring-accent" : ""}`}
                      onClick={() => handleServiceTypeChange(value)}
                      data-testid={`card-service-type-${value}`}
                    >
                      <CardContent className="p-6 flex flex-col gap-4 h-full">
                        <div className={`w-12 h-12 rounded-md flex items-center justify-center ${isSelected ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-1">{label}</h3>
                          <p className="text-sm font-medium text-muted-foreground mb-3">{description}</p>
                          <p className="text-sm text-muted-foreground leading-relaxed">{detail}</p>
                        </div>
                        <Button
                          className={`w-full mt-2 ${isSelected ? "bg-accent text-accent-foreground" : "!border-2 !border-accent text-accent hover:bg-accent/10"}`}
                          variant={isSelected ? "default" : "outline"}
                          onClick={e => { e.stopPropagation(); handleServiceTypeChange(value); }}
                          data-testid={`button-select-service-type-${value}`}
                        >
                          {isSelected ? <>Selected<ArrowRight className="w-4 h-4 ml-2" /></> : "Select"}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>

            {/* ── STEP 3: EQUIPMENT KIT ─────────────────────────── */}
            {!skippedKit && (
              <section>
                <h2 className="text-lg font-semibold tracking-tight mb-2">3. Choose Your Equipment Kit</h2>
                <p className="text-muted-foreground mb-5">Select the perfect equipment package.</p>

                {configLoading ? (
                  <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                ) : (
                  <>
                    {isEuro6Van !== null && selectedVanData && (
                      <div className="mb-6 p-4 rounded-md flex items-start gap-3 bg-accent/10 border border-accent/20">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-accent" />
                        <div>
                          <p className="font-medium text-sm">{isEuro6Van ? "Your van has a Euro 6 engine" : "Your van has a non-Euro 6 engine"}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {isEuro6Van
                              ? `Your ${selectedVanData.make} ${selectedVanData.model} has a Euro 6 engine. Packs marked Euro 6 are fully compatible.`
                              : `Your ${selectedVanData.make} ${selectedVanData.model} has a non-Euro 6 engine. Packs not marked Euro 6 are fully compatible.`}
                          </p>
                        </div>
                      </div>
                    )}

                    {kits.length === 0 ? (
                      <div className="py-12 text-center rounded-md border border-dashed">
                        <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                        <p className="font-medium mb-1">No kits available</p>
                        <p className="text-sm text-muted-foreground">No equipment kits for the selected service type.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {kits.map((kit: any) => {
                          const incompatible = kitNeedsWarning(kit);
                          const isSelected = state.kitId === kit.id;
                          return (
                            <Card
                              key={kit.id}
                              className={`hover-elevate cursor-pointer ${isSelected ? "ring-2 ring-accent" : ""} ${incompatible ? "opacity-75" : ""}`}
                              onClick={() => incompatible ? setWarnKit(kit) : setKitOnly(kit.id)}
                              data-testid={`card-kit-${kit.id}`}
                            >
                              {kit.images?.[0] && (
                                <div className="w-full h-44 overflow-hidden rounded-t-md">
                                  <img
                                    src={kit.images[0]}
                                    alt={kit.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <CardHeader>
                                <div className="flex items-start justify-between mb-2 gap-1 flex-wrap">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="secondary" className="flex items-center gap-1">
                                      <Zap className="w-3 h-3" />{kit.powerKw}kW
                                    </Badge>
                                    {kit.euroSixCompatible && <Badge className="bg-accent/20 text-accent border-accent/30">Euro 6</Badge>}
                                    {incompatible && <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30">Non Euro 6</Badge>}
                                  </div>
                                  <p className="text-2xl font-bold text-accent">{fmt(kit.price)}</p>
                                </div>
                                <CardTitle className="text-xl">{kit.name}</CardTitle>
                                <CardDescription>{kit.description}</CardDescription>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-2 mb-4">
                                  <div className="flex items-center gap-2 text-sm font-medium">
                                    <Package className="w-4 h-4 text-accent" /><span>Includes:</span>
                                  </div>
                                  <ul className="space-y-1 ml-6">
                                    {kit.includes?.map((item: string, idx: number) => (
                                      <li key={idx} className="text-sm text-muted-foreground list-disc">{item}</li>
                                    ))}
                                  </ul>
                                </div>
                                <Button type="button" variant="ghost" className="w-full mb-2"
                                  onClick={e => { e.stopPropagation(); setModalKit(kit); }}>
                                  <Info className="w-4 h-4 mr-2" />More Info
                                </Button>
                                <Button
                                  className={`w-full ${isSelected ? "bg-accent text-accent-foreground" : "!border-2 !border-accent text-accent hover:bg-accent/10"}`}
                                  variant={isSelected ? "default" : "outline"}
                                  onClick={e => { e.stopPropagation(); incompatible ? setWarnKit(kit) : setKitOnly(kit.id); }}
                                  data-testid={`button-select-kit-${kit.id}`}
                                >
                                  {isSelected ? "Selected" : "Select Kit"}<ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </section>
            )}

            {/* ── STEP 4: UPGRADES ──────────────────────────────── */}
            <section>
                <h2 className="text-lg font-semibold tracking-tight mb-2">
                  {skippedKit ? "3." : "4."}{" "}
                  {state.serviceType === "hybrid" ? "Add Commercial & Extra Equipment"
                    : state.serviceType === "commercial" ? "Configure Your Commercial Setup"
                    : "Add Upgrades & Extras"}
                </h2>
                <p className="text-muted-foreground mb-5">
                  {state.serviceType === "hybrid" ? "Select the commercial equipment and any additional extras for your hybrid setup"
                    : state.serviceType === "commercial" ? "Select the commercial equipment and extras for your van conversion"
                    : "Enhance your van with additional features and equipment upgrades"}
                </p>

                {configLoading ? (
                  <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(filteredUpgrades)
                      .sort(([a], [b]) => {
                        const cats = configData?.categories ?? [];
                        const idxA = cats.findIndex(c => c.id === a);
                        const idxB = cats.findIndex(c => c.id === b);
                        const orderA = idxA === -1 ? getFallbackCategoryOrder(a) + 1000 : idxA;
                        const orderB = idxB === -1 ? getFallbackCategoryOrder(b) + 1000 : idxB;
                        return orderA - orderB;
                      })
                      .map(([category, upgrades]) => {
                        const sorted = [...upgrades].sort((a: any, b: any) => a.sortOrder - b.sortOrder);
                        const { groups, standalone } = groupUpgrades(sorted);
                        const allItems = [
                          ...groups.map(g => ({ type: "group" as const, sortOrder: (g.parent as any).sortOrder ?? 0, data: g })),
                          ...standalone.map(u => ({ type: "standalone" as const, sortOrder: (u as any).sortOrder ?? 0, data: u })),
                        ].sort((a, b) => a.sortOrder - b.sortOrder);
                        if (allItems.length === 0) return null;
                        return (
                          <Card key={category}>
                            <CardHeader>
                              <CardTitle className="text-lg">
                                {configData?.categories?.find(c => c.id === category)?.label ?? CATEGORY_LABELS[category] ?? category.replace(/-/g, " ")} Options
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid gap-3">
                                {allItems.map(item => {
                                  if (item.type === "standalone") {
                                    const upgrade = item.data as Upgrade;
                                    const isSelected = state.upgradeIds.includes(upgrade.id);
                                    const qty = upgradeQuantities[upgrade.id] ?? 1;
                                    return (
                                      <div key={upgrade.id} className="p-3 rounded-lg border hover-elevate">
                                        <div className="flex items-center gap-3">
                                          <Checkbox
                                            id={upgrade.id}
                                            checked={isSelected}
                                            onCheckedChange={() => handleUpgradeToggle(upgrade.id)}
                                            data-testid={`checkbox-upgrade-${upgrade.id}`}
                                          />
                                          {upgrade.images?.[0] && (
                                            <img
                                              src={upgrade.images[0]}
                                              alt={upgrade.name}
                                              className="w-14 h-14 object-cover rounded-md flex-shrink-0"
                                            />
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 gap-2">
                                              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                                <label htmlFor={upgrade.id} className="font-medium cursor-pointer leading-tight">
                                                  {upgrade.name}
                                                </label>
                                                <Button variant="outline" size="sm" className="h-7 text-xs w-fit"
                                                  onClick={() => setModalUpgrade({ upgrade, variants: [] })}
                                                  data-testid={`button-info-${upgrade.id}`}>
                                                  <Info className="w-3 h-3 mr-1" />More Info
                                                </Button>
                                              </div>
                                              <div className="flex items-center gap-2 flex-wrap">
                                                {isSelected && (upgrade as any).allowQuantity && (
                                                  <div className="flex items-center gap-1">
                                                    <label className="text-xs text-muted-foreground">Qty:</label>
                                                    <Input type="number" min="1" max="10" value={qty}
                                                      onChange={e => setUpgradeQuantities(p => ({ ...p, [upgrade.id]: parseInt(e.target.value) || 1 }))}
                                                      className="w-16 h-8 text-center" />
                                                  </div>
                                                )}
                                                <Badge variant="secondary">
                                                  {fmt(upgrade.price * ((upgrade as any).allowQuantity && isSelected ? qty : 1))}
                                                </Badge>
                                              </div>
                                            </div>
                                            {upgrade.description && <p className="text-sm text-muted-foreground mb-2">{upgrade.description}</p>}
                                            {(upgrade as any).popular && (
                                              <span className="text-green-600 dark:text-green-400 flex items-center gap-1 text-sm font-medium">
                                                <Star className="w-3 h-3 fill-current" />Popular Upgrade
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  } else {
                                    const { parent, variants } = item.data as { parent: Upgrade; variants: Upgrade[] };
                                    const selectedVariantId = state.upgradeIds.find(id => variants.some(v => v.id === id));
                                    const selectedVariant = variants.find(v => v.id === selectedVariantId);
                                    const isSelected = !!selectedVariantId;
                                    const minPrice = variants.length ? Math.min(...variants.map(v => v.price)) : null;
                                    return (
                                      <div key={parent.id} className="p-3 rounded-lg border hover-elevate">
                                        <div className="flex items-center gap-3">
                                          <Checkbox
                                            id={`variant-group-${parent.id}`}
                                            checked={isSelected}
                                            onCheckedChange={checked => {
                                              if (checked && variants.length > 0) handleVariantSelect(parent.id, variants[0].id, variants);
                                              else handleVariantSelect(parent.id, null, variants);
                                            }}
                                            data-testid={`checkbox-variant-${parent.id}`}
                                          />
                                          {(parent.images?.[0] || variants[0]?.images?.[0]) && (
                                            <img
                                              src={parent.images?.[0] || variants[0].images[0]}
                                              alt={parent.name}
                                              className="w-14 h-14 object-cover rounded-md flex-shrink-0"
                                            />
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 gap-2">
                                              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                                <label htmlFor={`variant-group-${parent.id}`} className="font-medium cursor-pointer">
                                                  {parent.name}
                                                </label>
                                                <Button variant="outline" size="sm" className="h-7 text-xs w-fit"
                                                  onClick={() => setModalUpgrade({ upgrade: parent, variants })}
                                                  data-testid={`button-info-${parent.id}`}>
                                                  <Info className="w-3 h-3 mr-1" />More Info
                                                </Button>
                                              </div>
                                              {selectedVariant
                                                ? <Badge variant="secondary">{fmt(selectedVariant.price)}</Badge>
                                                : minPrice !== null && <Badge variant="secondary">From {fmt(minPrice)}</Badge>}
                                            </div>
                                            {parent.description && <p className="text-sm text-muted-foreground mb-2">{parent.description}</p>}
                                            {(parent as any).popular && (
                                              <span className="text-green-600 dark:text-green-400 flex items-center gap-1 text-sm font-medium mb-2">
                                                <Star className="w-3 h-3 fill-current" />Popular Upgrade
                                              </span>
                                            )}
                                            {isSelected && (
                                              <Select value={selectedVariantId ?? ""} onValueChange={v => v && handleVariantSelect(parent.id, v, variants)}>
                                                <SelectTrigger data-testid={`select-variant-${parent.id}`}>
                                                  <span>
                                                    {selectedVariant
                                                      ? `${selectedVariant.variantName || selectedVariant.name} — ${fmt(selectedVariant.price)}`
                                                      : "Select option..."}
                                                  </span>
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {variants.map(v => (
                                                    <SelectItem key={v.id} value={v.id}>
                                                      {v.variantName || v.name} — {fmt(v.price)}
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                })}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                  </div>
                )}
              </section>

            {/* ── Custom Extras ───────────────────────────────────────── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Bespoke Extras</h3>
                <span className="text-xs text-muted-foreground">(not in standard configurator)</span>
              </div>
              <Card>
                <CardContent className="pt-4 space-y-3">
                  {customExtras.length > 0 && (
                    <div className="space-y-2">
                      {customExtras.map((extra) => (
                        <div key={extra.id} className="flex items-center gap-2 text-sm p-2 rounded bg-muted/40">
                          <span className="flex-1 font-medium">{extra.description}</span>
                          <span className="text-muted-foreground shrink-0">£{(extra.pricePence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setCustomExtras(prev => prev.filter(e => e.id !== extra.id))}
                            data-testid={`button-remove-extra-${extra.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="flex-1 min-w-[160px]">
                      <Label className="text-xs text-muted-foreground mb-1 block">Description</Label>
                      <Input
                        value={newExtraDescription}
                        onChange={e => setNewExtraDescription(e.target.value)}
                        placeholder="e.g. Custom roof bar"
                        className="text-sm"
                        data-testid="input-extra-description"
                      />
                    </div>
                    <div className="w-28">
                      <Label className="text-xs text-muted-foreground mb-1 block">Price (£ ex. VAT)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newExtraPrice}
                        onChange={e => setNewExtraPrice(e.target.value)}
                        placeholder="0.00"
                        className="text-sm"
                        data-testid="input-extra-price"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const desc = newExtraDescription.trim();
                        const price = parseFloat(newExtraPrice);
                        if (!desc || isNaN(price) || price < 0) return;
                        setCustomExtras(prev => [...prev, {
                          id: crypto.randomUUID(),
                          description: desc,
                          pricePence: Math.round(price * 100),
                        }]);
                        setNewExtraDescription('');
                        setNewExtraPrice('');
                      }}
                      disabled={!newExtraDescription.trim() || !newExtraPrice || parseFloat(newExtraPrice) < 0}
                      data-testid="button-add-extra"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />Add
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>

            </>)}

          </div>

          {/* Middle column — configurator summary */}
          <div className="xl:col-span-1">
            <div className="sticky top-[56px] z-10">
              <ConfiguratorSummary
                discountAmount={discountedPricing.discountAmount}
                discountedTotal={discountedPricing.finalTotal}
                discountType={discount.type}
                discountValue={discount.value}
                discountSection={
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Discount</Label>
                    <div className="flex gap-2">
                      <Select value={discount.type} onValueChange={(v) => setDiscount({ type: v as DiscountState['type'], value: '' })}>
                        <SelectTrigger className="w-36" data-testid="select-discount-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No discount</SelectItem>
                          <SelectItem value="percentage">% off</SelectItem>
                          <SelectItem value="fixed">£ off</SelectItem>
                        </SelectContent>
                      </Select>
                      {discount.type !== 'none' && (
                        <div className="relative flex-1">
                          {discount.type === 'percentage'
                            ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">%</span>
                            : <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">£</span>
                          }
                          <Input
                            type="number" min="0"
                            max={discount.type === 'percentage' ? "100" : undefined}
                            step={discount.type === 'percentage' ? "1" : "0.01"}
                            value={discount.value}
                            onChange={e => setDiscount(d => ({ ...d, value: e.target.value }))}
                            className={discount.type === 'percentage' ? 'pr-8' : 'pl-7'}
                            placeholder={discount.type === 'percentage' ? "e.g. 10" : "e.g. 500"}
                            data-testid="input-discount-value"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                }
              />
            </div>
          </div>

          {/* Right column — finance calculator */}
          <div className="xl:col-span-1">
            <div className="sticky top-[56px] z-10">

            {/* Finance Calculator */}
            <Card className="border-2">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Calculator className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Finance Calculator</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">10.9% APR representative</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* VAT registration */}
                <div className="space-y-3 pb-4 border-b">
                  <div className="flex items-center gap-2">
                    <Checkbox id="vat-reg" checked={vatRegistered}
                      onCheckedChange={c => { setVatRegistered(!!c); if (!c) setDeferVat(false); }}
                      data-testid="checkbox-vat-registered" />
                    <Label htmlFor="vat-reg" className="text-sm cursor-pointer">VAT registered?</Label>
                  </div>
                  {vatRegistered && (
                    <div className="ml-6 space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox id="defer-vat" checked={deferVat} onCheckedChange={c => setDeferVat(!!c)} data-testid="checkbox-defer-vat" />
                        <Label htmlFor="defer-vat" className="text-sm cursor-pointer">Defer VAT 3 months?</Label>
                      </div>
                      {deferVat && (
                        <div className="flex items-start gap-2 bg-accent/5 border border-accent/20 rounded-md p-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
                          <p className="text-xs text-muted-foreground">
                            Finance on ex-VAT amount: <strong>{fmt(pricing.subtotalPence)}</strong>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Total display */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {deferVat ? "Finance Amount (ex-VAT)" : "Total (inc. VAT)"}
                  </Label>
                  {compareMode && slotBPricing ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Option A</p>
                        <div className="relative">
                          <PoundSterling className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground" />
                          <Input type="text" value={fmt(deferVat ? Math.round(discountedPricing.finalTotal / 1.2) : discountedPricing.finalTotal).replace("£", "")} disabled className="pl-7 bg-muted/50 font-bold text-sm text-foreground" />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Option B</p>
                        <div className="relative">
                          <PoundSterling className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground" />
                          <Input type="text" value={fmt(deferVat ? Math.round(slotBPricing.totalPence / 1.2) : slotBPricing.totalPence).replace("£", "")} disabled className="pl-7 bg-muted/50 font-bold text-sm text-foreground" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground" />
                      <Input
                        type="text"
                        value={fmt(deferVat
                          ? Math.round(discountedPricing.finalTotal / 1.2)
                          : discountedPricing.finalTotal
                        ).replace("£", "")}
                        disabled
                        className="pl-9 bg-muted/50 font-bold text-base text-foreground"
                      />
                    </div>
                  )}
                </div>

                {/* Deposit */}
                <div className="space-y-1.5">
                  <Label htmlFor="finance-deposit" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Deposit</Label>
                  <div className="relative">
                    <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="finance-deposit" type="number" placeholder="0" value={depositAmount}
                      onChange={e => setDepositAmount(e.target.value)} className="pl-9" min="0"
                      data-testid="input-deposit" />
                  </div>
                </div>

                {/* Term */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Term</Label>
                  <Select value={termYears.toString()} onValueChange={v => setTermYears(parseInt(v))}>
                    <SelectTrigger data-testid="select-term"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map(y => (
                        <SelectItem key={y} value={y.toString()}>{y} Year{y > 1 ? "s" : ""} ({y * 12} months)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Results */}
                {(financeCalc || (compareMode && financeCalcB)) ? (
                  <div className="pt-4 border-t space-y-3">
                    {compareMode && slotBPricing ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          {/* Option A */}
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-center text-muted-foreground">Option A</p>
                            <div className="bg-accent/5 border border-accent/20 rounded-md p-2 text-center">
                              <p className="text-xs text-muted-foreground mb-0.5">Monthly</p>
                              <p className="text-base font-bold text-accent" data-testid="text-monthly-payment">
                                {financeCalc ? fmtDec(financeCalc.monthly * 100) : "—"}
                              </p>
                            </div>
                            <div className="bg-accent/5 border border-accent/20 rounded-md p-2 text-center">
                              <p className="text-xs text-muted-foreground mb-0.5">Weekly</p>
                              <p className="text-base font-bold text-accent" data-testid="text-weekly-payment">
                                {financeCalc ? fmtDec(financeCalc.weekly * 100) : "—"}
                              </p>
                            </div>
                          </div>
                          {/* Option B */}
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-center text-muted-foreground">Option B</p>
                            <div className="bg-accent/5 border border-accent/20 rounded-md p-2 text-center">
                              <p className="text-xs text-muted-foreground mb-0.5">Monthly</p>
                              <p className="text-base font-bold text-accent" data-testid="text-monthly-payment-b">
                                {financeCalcB ? fmtDec(financeCalcB.monthly * 100) : "—"}
                              </p>
                            </div>
                            <div className="bg-accent/5 border border-accent/20 rounded-md p-2 text-center">
                              <p className="text-xs text-muted-foreground mb-0.5">Weekly</p>
                              <p className="text-base font-bold text-accent" data-testid="text-weekly-payment-b">
                                {financeCalcB ? fmtDec(financeCalcB.weekly * 100) : "—"}
                              </p>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground text-center">{termYears * 12} months • 10.9% APR</p>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-accent/5 border border-accent/20 rounded-md p-3 text-center">
                            <p className="text-xs text-muted-foreground mb-1">Monthly</p>
                            <p className="text-lg font-bold text-accent" data-testid="text-monthly-payment">
                              {fmtDec(financeCalc!.monthly * 100)}
                            </p>
                            <p className="text-xs text-muted-foreground">{termYears * 12} months</p>
                          </div>
                          <div className="bg-accent/5 border border-accent/20 rounded-md p-3 text-center">
                            <p className="text-xs text-muted-foreground mb-1">Weekly</p>
                            <p className="text-lg font-bold text-accent" data-testid="text-weekly-payment">
                              {fmtDec(financeCalc!.weekly * 100)}
                            </p>
                            <p className="text-xs text-muted-foreground">approx.</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div><p className="text-muted-foreground">Financed</p><p className="font-semibold">{fmt(financeCalc!.principal * 100)}</p></div>
                          <div><p className="text-muted-foreground">Interest</p><p className="font-semibold">{fmt(financeCalc!.totalInterest * 100)}</p></div>
                          <div><p className="text-muted-foreground">Repayable</p><p className="font-semibold">{fmt(financeCalc!.totalRepayable * 100)}</p></div>
                        </div>
                        <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2 leading-relaxed">
                          <strong>Rep. example:</strong> {fmt(financeCalc!.total * 100)} cash, {fmt(financeCalc!.deposit * 100)} deposit, {termYears * 12} × {fmtDec(financeCalc!.monthly * 100)}, total {fmt((financeCalc!.totalRepayable + financeCalc!.deposit) * 100)}, 10.9% APR.
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">Enter a deposit to calculate payments</p>
                )}

                {/* Save button */}
                <div className="pt-2">
                  <Button
                    className="w-full bg-[#8bc440e6] text-[#191919] hover:bg-[#8bc440]"
                    disabled={pricing.totalPence === 0}
                    onClick={() => setSaveOpen(true)}
                    data-testid="button-save-quote-bottom"
                  >
                    Save as Quote<ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
            </div>
          </div>
        </div>
      </div>
      {/* ── Van Details Modal ─────────────────────────────────── */}
      <Dialog open={!!modalVan} onOpenChange={o => !o && setModalVan(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {modalVan && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{modalVan.make} {modalVan.model}</DialogTitle>
                <DialogDescription>{modalVan.year} • {fmt(modalVan.price)}</DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                {(() => {
                  const imgs = [...(modalVan.heroImage ? [modalVan.heroImage] : []), ...(modalVan.images || []).filter(i => i !== modalVan.heroImage)];
                  return imgs.length > 0 ? (
                    <Carousel className="w-full">
                      <CarouselContent>
                        {imgs.map((img, i) => (
                          <CarouselItem key={i}>
                            <div className="relative aspect-video overflow-hidden rounded-md border bg-muted">
                              <img src={img} alt={`${modalVan.make} ${modalVan.model} - ${i + 1}`} className="w-full h-full object-cover" />
                            </div>
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                      {imgs.length > 1 && <><CarouselPrevious className="left-2" /><CarouselNext className="right-2" /></>}
                    </Carousel>
                  ) : null;
                })()}
                {modalVan.description && (
                  <div><h3 className="font-semibold text-lg mb-2">Description</h3><p className="text-muted-foreground">{modalVan.description}</p></div>
                )}
                <div>
                  <h3 className="font-semibold text-lg mb-3">Specifications</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {[
                      { Icon: Gauge, label: "Mileage", val: `${modalVan.mileage.toLocaleString()} miles` },
                      { Icon: Settings, label: "Transmission", val: modalVan.specs.transmission },
                      { Icon: Fuel, label: "Fuel", val: modalVan.specs.fuel },
                      { Icon: Car, label: "Size", val: modalVan.specs.size },
                      { Icon: Car, label: "Euro Status", val: modalVan.euroStatus },
                    ].filter(r => r.val).map(({ Icon, label, val }) => (
                      <div key={label} className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{label}:</span>
                        <span className="font-medium">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <Button className="w-full bg-accent text-accent-foreground" onClick={() => { setVanOnly(modalVan.id); setModalVan(null); }}>
                    Select This Van<ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {/* ── Kit Details Modal ─────────────────────────────────── */}
      <Dialog open={!!modalKit} onOpenChange={o => !o && setModalKit(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {modalKit && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{modalKit.name}</DialogTitle>
                <DialogDescription>{modalKit.powerKw}kW • {fmt(modalKit.price)}</DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                {modalKit.images && modalKit.images.length > 0 && (
                  <Carousel className="w-full">
                    <CarouselContent>
                      {modalKit.images.map((img: string, i: number) => (
                        <CarouselItem key={i}>
                          <div className="relative aspect-video overflow-hidden rounded-md border bg-muted">
                            <img src={img} alt={`${modalKit.name} - ${i + 1}`} className="w-full h-full object-cover" />
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    {modalKit.images.length > 1 && <><CarouselPrevious className="left-2" /><CarouselNext className="right-2" /></>}
                  </Carousel>
                )}
                <div><p className="text-muted-foreground">{modalKit.description}</p></div>
                <div>
                  <h3 className="font-semibold text-lg flex items-center gap-2 mb-3"><Package className="w-5 h-5 text-accent" />Complete Equipment List</h3>
                  <div className="grid gap-2">
                    {modalKit.includes?.map((item: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" /><span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <Button className="w-full bg-accent text-accent-foreground" onClick={() => {
                    if (kitNeedsWarning(modalKit)) { setWarnKit(modalKit); setModalKit(null); }
                    else { setKitOnly(modalKit.id); setModalKit(null); }
                  }}>
                    {state.kitId === modalKit.id ? "Selected — Continue" : "Select This Kit"}<ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {/* ── Euro 6 Warning Dialog ─────────────────────────────── */}
      <Dialog open={!!warnKit} onOpenChange={o => !o && setWarnKit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <DialogTitle className="text-xl">Compatibility Notice</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground pt-1 leading-relaxed">
              {isEuro6Van
                ? <>Your selected vehicle has a <strong className="text-foreground">Euro 6 engine</strong>. The <strong className="text-foreground">{warnKit?.name}</strong> pack is not designed for Euro 6 vehicles. We recommend a Euro 6 compatible pack.</>
                : <>Your selected vehicle has a <strong className="text-foreground">non-Euro 6 engine</strong>. The <strong className="text-foreground">{warnKit?.name}</strong> pack is designed for Euro 6 vehicles. We recommend a non-Euro 6 pack.</>}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-2">
            <Button className="w-full bg-accent text-accent-foreground" onClick={() => setWarnKit(null)}>Choose a Different Pack</Button>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => { if (warnKit) setKitOnly(warnKit.id); setWarnKit(null); }}>
              I know what I'm doing — proceed anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* ── Upgrade Details Modal ─────────────────────────────── */}
      <Dialog open={!!modalUpgrade} onOpenChange={o => !o && setModalUpgrade(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {modalUpgrade && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{modalUpgrade.upgrade.name}</DialogTitle>
                {modalUpgrade.variants.length === 0 && <DialogDescription>{fmt(modalUpgrade.upgrade.price)}</DialogDescription>}
              </DialogHeader>
              <div className="space-y-4">
                {modalUpgrade.upgrade.images && modalUpgrade.upgrade.images.length > 0 && (
                  <Carousel className="w-full">
                    <CarouselContent>
                      {modalUpgrade.upgrade.images.map((img, i) => (
                        <CarouselItem key={i}>
                          <div className="aspect-video overflow-hidden rounded-md border bg-muted">
                            <img src={img} alt={`${modalUpgrade.upgrade.name} - ${i + 1}`} className="w-full h-full object-cover" />
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    {modalUpgrade.upgrade.images.length > 1 && <><CarouselPrevious className="left-2" /><CarouselNext className="right-2" /></>}
                  </Carousel>
                )}
                {modalUpgrade.upgrade.description && <p className="text-muted-foreground">{modalUpgrade.upgrade.description}</p>}
                {(modalUpgrade.upgrade as any).detailedInfo && <p className="text-sm text-muted-foreground">{(modalUpgrade.upgrade as any).detailedInfo}</p>}
                {modalUpgrade.variants.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Available Options</h3>
                    <div className="space-y-2">
                      {modalUpgrade.variants.map(v => (
                        <div key={v.id} className="flex justify-between items-center p-3 rounded-md border text-sm">
                          <span>{v.variantName || v.name}</span>
                          <Badge variant="secondary">{fmt(v.price)}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Quantity Prompt Dialog ─────────────────────────────── */}
      <Dialog open={!!quantityPrompt} onOpenChange={o => { if (!o) setQuantityPrompt(null); }}>
        <DialogContent className="sm:max-w-sm" data-testid="dialog-quantity-prompt">
          {quantityPrompt && (
            <>
              <DialogHeader>
                <DialogTitle>How many do you need?</DialogTitle>
                <DialogDescription>
                  <strong>{quantityPrompt.upgrade.name}</strong> supports multiple quantities.
                  Set the number required — the price will update automatically.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium flex-1">Quantity</label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantityPrompt(p => p ? { ...p, pendingQty: Math.max(1, p.pendingQty - 1) } : p)}
                      disabled={quantityPrompt.pendingQty <= 1}
                      data-testid="button-qty-decrease"
                    >
                      <span className="text-lg leading-none">−</span>
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={quantityPrompt.pendingQty}
                      onChange={e => setQuantityPrompt(p => p ? { ...p, pendingQty: Math.max(1, parseInt(e.target.value) || 1) } : p)}
                      className="w-16 text-center"
                      data-testid="input-qty-prompt"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantityPrompt(p => p ? { ...p, pendingQty: Math.min(20, p.pendingQty + 1) } : p)}
                      disabled={quantityPrompt.pendingQty >= 20}
                      data-testid="button-qty-increase"
                    >
                      <span className="text-lg leading-none">+</span>
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Total: <strong>{fmt(quantityPrompt.upgrade.price * quantityPrompt.pendingQty)}</strong>
                </p>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setQuantityPrompt(null)} data-testid="button-qty-cancel">
                  Cancel
                </Button>
                <Button onClick={confirmQuantityPrompt} data-testid="button-qty-confirm">
                  Add to Configuration
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Commercial-with-kit Confirmation Dialog ────────────── */}
      {pendingCommercialType && (() => {
        const kitName = configData?.kits.find((k: any) => k.id === state.kitId)?.name ?? "the current pack";
        return (
          <Dialog open={true} onOpenChange={(open) => { if (!open) setPendingCommercialType(null); }}>
            <DialogContent className="sm:max-w-md" data-testid="dialog-commercial-kit-warning">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Switch to Commercial Only?
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="space-y-2 text-sm pt-1">
                    <p>
                      Commercial Only doesn't normally require an equipment pack — the customer would go straight to selecting commercial extras.
                    </p>
                    <p>
                      This configuration currently has <strong>{kitName}</strong> selected. Would you like to remove it or keep it?
                    </p>
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
                <Button
                  variant="outline"
                  className="sm:flex-1"
                  onClick={() => {
                    applyServiceTypeChange(pendingCommercialType, false);
                    setPendingCommercialType(null);
                  }}
                  data-testid="button-keep-kit-on-commercial"
                >
                  Keep Pack
                </Button>
                <Button
                  className="sm:flex-1"
                  onClick={() => {
                    applyServiceTypeChange(pendingCommercialType, true);
                    setPendingCommercialType(null);
                  }}
                  data-testid="button-remove-kit-on-commercial"
                >
                  Remove Pack
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ── Stale Session Dialog ─────────────────────────────── */}
      <Dialog open={showSessionModal} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-sm"
          onPointerDownOutside={e => e.preventDefault()}
          onEscapeKeyDown={e => e.preventDefault()}
          data-testid="dialog-stale-session"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-muted-foreground" />
              Previous configuration found
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm pt-1">
                <p>You have a configuration in progress from a previous session:</p>
                <ul className="space-y-1 text-muted-foreground pl-2">
                  {(slotA.vanId || slotA.customVanDescription) && (
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                      {slotA.customVanDescription ? `Custom van: ${slotA.customVanDescription}` : "Van selected"}
                    </li>
                  )}
                  {slotA.serviceType && (
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                      Service type: {SERVICE_OPTIONS.find(s => s.value === slotA.serviceType)?.label ?? slotA.serviceType}
                    </li>
                  )}
                  {slotA.kitId && (
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                      Kit selected
                    </li>
                  )}
                  {slotA.upgradeIds.length > 0 && (
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                      {slotA.upgradeIds.length} upgrade{slotA.upgradeIds.length !== 1 ? "s" : ""} selected
                    </li>
                  )}
                  {compareMode && (
                    <li className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                      Compare mode active
                    </li>
                  )}
                </ul>
                <p>Would you like to continue where you left off, or start fresh?</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-1">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                clearAll();
                setFilterMake("all"); setFilterModel("all"); setFilterYear("all"); setFilterFuel("all");
                setOwnVanReg(""); setOwnVanPrice("");
                setUpgradeQuantities({}); setTermYears(3); setDepositAmount(""); setVatRegistered(false); setDeferVat(false);
                setShowSessionModal(false);
              }}
              data-testid="button-session-start-fresh"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Start fresh
            </Button>
            <Button
              className="w-full sm:w-auto bg-[#8bc440e6] text-[#191919] hover:bg-[#8bc440]"
              onClick={() => setShowSessionModal(false)}
              data-testid="button-session-continue"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Save as Quote Dialog ──────────────────────────────── */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-md flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0"><DialogTitle>Save as Quote</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2 overflow-y-auto flex-1 pr-1">
            <div className="bg-muted/40 rounded-md px-3 py-2.5 flex items-center gap-2">
              <UserRound className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <Label htmlFor="sq-staff" className="text-xs text-muted-foreground mb-1 block">Quoted by (your name)</Label>
                <Input id="sq-staff" value={saveForm.staffName} onChange={e => setSaveForm(f => ({ ...f, staffName: e.target.value }))} placeholder="e.g. Carl" className="h-7 text-sm border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60" data-testid="input-quote-staff-name" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sq-name" className="text-sm mb-1.5 block">Customer full name <span className="text-destructive">*</span></Label>
                <Input id="sq-name" value={saveForm.userName} onChange={e => setSaveForm(f => ({ ...f, userName: e.target.value }))} placeholder="John Smith" data-testid="input-quote-name" />
              </div>
              <div>
                <Label htmlFor="sq-phone" className="text-sm mb-1.5 block">Phone <span className="text-destructive">*</span></Label>
                <Input id="sq-phone" type="tel" value={saveForm.phone} onChange={e => setSaveForm(f => ({ ...f, phone: e.target.value }))} placeholder="07700 900000" data-testid="input-quote-phone" />
              </div>
            </div>
            <div>
              <Label htmlFor="sq-email" className="text-sm mb-1.5 block">Email <span className="text-destructive">*</span></Label>
              <Input id="sq-email" type="email" value={saveForm.email} onChange={e => setSaveForm(f => ({ ...f, email: e.target.value }))} placeholder="john@example.com" data-testid="input-quote-email" />
            </div>
            <div>
              <Label htmlFor="sq-company" className="text-sm mb-1.5 block">Company (optional)</Label>
              <Input id="sq-company" value={saveForm.company} onChange={e => setSaveForm(f => ({ ...f, company: e.target.value }))} placeholder="Acme Tyres Ltd" data-testid="input-quote-company" />
            </div>
            <div>
              <Label htmlFor="sq-notes" className="text-sm mb-1.5 block">Notes (optional)</Label>
              <textarea id="sq-notes" value={saveForm.notes} onChange={e => setSaveForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any additional notes from the call…" rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                data-testid="input-quote-notes" />
            </div>
            {/* ── Pricing summary ─────────────────────────────── */}
            <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal (ex. VAT)</span><span>{fmt(slotAPricing.subtotalPence)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">VAT (20%)</span><span>{fmt(slotAPricing.vatPence)}</span></div>
              {discountedPricing.discountAmount > 0 && (
                <>
                  <div className="flex justify-between text-muted-foreground"><span>Total before discount</span><span>{fmt(slotAPricing.totalPence)}</span></div>
                  <div className="flex justify-between text-destructive font-medium"><span>Discount</span><span>-{fmt(discountedPricing.discountAmount)}</span></div>
                  <Separator className="my-1" />
                  <div className="flex justify-between font-semibold text-accent text-base"><span>Total (inc. VAT)</span><span>{fmt(discountedPricing.finalTotal)}</span></div>
                </>
              )}
              {discountedPricing.discountAmount === 0 && (
                <div className="flex justify-between font-semibold text-accent"><span>Total (inc. VAT)</span><span>{fmt(slotAPricing.totalPence)}</span></div>
              )}
              {financeCalc && (
                <div className="flex justify-between"><span className="text-muted-foreground">Monthly ({termYears * 12}mo)</span><span className="font-semibold">{fmtDec(financeCalc.monthly * 100)}/mo</span></div>
              )}
            </div>
          </div>
          <DialogFooter className="shrink-0 pt-2 border-t">
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button
              className="bg-[#8bc440e6] text-[#191919] hover:bg-[#8bc440]"
              disabled={!saveForm.userName.trim() || !saveForm.email.trim() || !saveForm.phone.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate(saveForm)}
              data-testid="button-confirm-save-quote"
            >
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Save Quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

