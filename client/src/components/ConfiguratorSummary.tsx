import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConfigurator } from "@/lib/ConfiguratorContext";
import type { ConfiguratorSlotState } from "@/lib/ConfiguratorContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Car, Package, Wrench, GraduationCap, ChevronRight } from "lucide-react";
import type { Van, Kit, Upgrade, TrainingOption } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveVanReg } from "@/lib/vanDisplay";

function OwnVanDetails({
  vanPriceStr,
  vanRegStr,
  onPriceChange,
  onRegChange,
  open,
  onToggle,
}: {
  vanPriceStr: string;
  vanRegStr: string;
  onPriceChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRegChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="pt-1">
      <button
        type="button"
        className="w-full text-left text-xs font-semibold uppercase tracking-wide text-accent hover-elevate px-0 py-1"
        onClick={onToggle}
        data-testid="button-toggle-van-details"
      >
        {open ? 'Hide van details' : 'Want to add van details?'}
      </button>

      <div className={`overflow-hidden transition-all duration-200 ${open ? 'mt-3 space-y-3' : 'h-0'}`}>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Van price
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">£</span>
            <Input
              className="pl-7"
              placeholder="Optional"
              value={vanPriceStr}
              onChange={onPriceChange}
              data-testid="input-summary-van-price"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Van reg
          </label>
          <Input
            placeholder="e.g. AB12 CDE"
            value={vanRegStr}
            onChange={onRegChange}
            data-testid="input-summary-van-reg"
          />
        </div>
      </div>
    </div>
  );
}

const formatPrice = (pence: number): string => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
  }).format(pence / 100);
};

// Compute the discount for a given pre-discount total
function applyDiscount(
  totalPence: number,
  discountType?: 'none' | 'percentage' | 'fixed',
  discountValue?: string,
): { discountAmount: number; finalTotal: number } {
  if (!discountType || discountType === 'none' || !discountValue) {
    return { discountAmount: 0, finalTotal: totalPence };
  }
  const val = parseFloat(discountValue);
  if (isNaN(val) || val <= 0) return { discountAmount: 0, finalTotal: totalPence };
  if (discountType === 'percentage') {
    const amt = Math.round(totalPence * Math.min(val, 100) / 100);
    return { discountAmount: amt, finalTotal: totalPence - amt };
  }
  const amt = Math.min(Math.round(val * 100), totalPence);
  return { discountAmount: amt, finalTotal: totalPence - amt };
}

// Sub-component that renders a single slot's summary
function SlotSummary({
  slot,
  label,
  isActive,
  onClick,
  discountedTotal,
  discountAmount,
  externalTotal,
}: {
  slot: ConfiguratorSlotState;
  label?: string;
  isActive?: boolean;
  onClick?: () => void;
  discountedTotal?: number;
  discountAmount?: number;
  externalTotal?: number;
}) {
  const { data: van, isLoading: vanLoading } = useQuery<Van>({
    queryKey: ['/api/vans', slot.vanId],
    enabled: !!slot.vanId,
  });

  const { data: kit, isLoading: kitLoading } = useQuery<Kit>({
    queryKey: ['/api/kits', slot.kitId],
    enabled: !!slot.kitId,
  });

  const { data: allUpgradesForSlot = [], isLoading: upgradesLoading } = useQuery<Upgrade[]>({
    queryKey: ['/api/upgrades'],
  });
  const upgrades = allUpgradesForSlot.filter(u => slot.upgradeIds.includes(u.id));

  const { data: allTrainingForSlot = [], isLoading: trainingLoading } = useQuery<TrainingOption[]>({
    queryKey: ['/api/training-options'],
  });
  const trainingOptions = allTrainingForSlot.filter(t => slot.trainingOptionIds.includes(t.id));

  const isLoadingAny = (!!slot.vanId && vanLoading) || (!!slot.kitId && kitLoading) || (slot.upgradeIds.length > 0 && upgradesLoading) || (slot.trainingOptionIds.length > 0 && trainingLoading);

  const isOwnVan = !slot.vanId;
  const vanPrice = van?.price || slot.customVanValue || 0;
  const kitPrice = kit?.price || 0;
  const upgradesTotal = upgrades.reduce((sum, upgrade) => sum + upgrade.price * (slot.upgradeQuantities[upgrade.id] ?? 1), 0);
  const trainingTotal = trainingOptions.reduce((sum, option) => sum + option.price, 0);

  const subtotal = vanPrice + kitPrice + upgradesTotal + trainingTotal;
  const vat = Math.round(subtotal * 0.2);
  const total = subtotal + vat;

  const hasItems = van ? true : slot.customVanValue
    ? true
    : (kitPrice > 0 || upgradesTotal > 0 || trainingTotal > 0);

  const clickableClass = onClick ? 'cursor-pointer hover-elevate' : '';

  if (!hasItems && !isLoadingAny) {
    return (
      <div
        className={`rounded-md p-3 border ${isActive ? 'border-accent/40 bg-accent/5' : 'border-border bg-muted/30'} ${clickableClass}`}
        onClick={onClick}
        data-testid={label ? `slot-summary-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined}
      >
        {label && (
          <div className="flex items-center justify-between mb-1">
            <p className={`text-xs font-bold uppercase tracking-wide ${isActive ? 'text-accent' : 'text-muted-foreground'}`}>{label}</p>
            {onClick && !isActive && <span className="text-xs text-muted-foreground">Switch</span>}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Not yet configured</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-md p-3 border space-y-2 ${isActive ? 'border-accent/40 bg-accent/5' : 'border-border bg-muted/30'} ${clickableClass}`}
      onClick={onClick}
      data-testid={label ? `slot-summary-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined}
    >
      {label && (
        <div className="flex items-center justify-between mb-1">
          <p className={`text-xs font-bold uppercase tracking-wide ${isActive ? 'text-accent' : 'text-muted-foreground'}`}>{label}</p>
          {onClick && (
            isActive
              ? <ChevronRight className="w-3.5 h-3.5 text-accent" />
              : <span className="text-xs text-muted-foreground">Switch</span>
          )}
        </div>
      )}

      {slot.vanId && vanLoading ? (
        <div className="flex items-start gap-1.5">
          <Car className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ) : van ? (
        <div className="flex items-start gap-1.5">
          <Car className="w-3.5 h-3.5 text-accent mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{van.make} {van.model}</p>
            {resolveVanReg(van, slot.vanReg) && (
              <p className="text-[11px] font-mono font-semibold uppercase tracking-wide text-muted-foreground">{resolveVanReg(van, slot.vanReg)}</p>
            )}
            <p className="text-xs text-muted-foreground">{formatPrice(van.price)}</p>
          </div>
        </div>
      ) : null}

      {isOwnVan && slot.customVanValue && slot.customVanValue > 0 && (
        <div className="flex items-start gap-1.5">
          <Car className="w-3.5 h-3.5 text-accent mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">Own van</p>
            <p className="text-xs text-muted-foreground">{formatPrice(slot.customVanValue)}</p>
          </div>
        </div>
      )}

      {slot.kitId && kitLoading ? (
        <div className="flex items-start gap-1.5">
          <Package className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ) : kit ? (
        <div className="flex items-start gap-1.5">
          <Package className="w-3.5 h-3.5 text-accent mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{kit.name}</p>
            <p className="text-xs text-muted-foreground">{formatPrice(kit.price)}</p>
          </div>
        </div>
      ) : null}

      {slot.upgradeIds.length > 0 && upgradesLoading ? (
        <div className="flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5 text-accent shrink-0" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ) : upgrades.length > 0 ? (
        <div className="flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5 text-accent" />
          <p className="text-xs text-muted-foreground">{upgrades.length} upgrade{upgrades.length !== 1 ? 's' : ''}</p>
        </div>
      ) : null}

      {slot.trainingOptionIds.length > 0 && trainingLoading ? (
        <div className="flex items-center gap-1.5">
          <GraduationCap className="w-3.5 h-3.5 text-accent shrink-0" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ) : trainingOptions.length > 0 ? (
        <div className="flex items-center gap-1.5">
          <GraduationCap className="w-3.5 h-3.5 text-accent" />
          <p className="text-xs text-muted-foreground">{trainingOptions.length} training option{trainingOptions.length !== 1 ? 's' : ''}</p>
        </div>
      ) : null}

      <Separator />
      {isLoadingAny ? (
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold">Total</span>
          <Skeleton className="h-4 w-16" />
        </div>
      ) : discountAmount && discountAmount > 0 ? (
        <div className="space-y-0.5">
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>Before discount</span>
            <span className="line-through">{formatPrice(externalTotal ?? total)}</span>
          </div>
          <div className="flex justify-between items-center text-xs text-destructive font-medium">
            <span>Discount</span>
            <span>-{formatPrice(discountAmount)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold">Total</span>
            <span className="text-sm font-bold text-accent">{formatPrice(discountedTotal ?? externalTotal ?? total)}</span>
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold">Total</span>
          <span className="text-sm font-bold text-accent">{formatPrice(externalTotal ?? total)}</span>
        </div>
      )}
    </div>
  );
}

// Compare summary: shows both slots with totals and difference
function CompareSummary({
  discountType,
  discountValue,
}: {
  discountType?: 'none' | 'percentage' | 'fixed';
  discountValue?: string;
} = {}) {
  const { slotA, slotB, activeSlot, setActiveSlot } = useConfigurator();

  // In compare mode, kit/upgrades/training are always shared from slot A.
  // Only the van differs between the two options.
  // Build a merged slot B that has slot B's van but slot A's config for display.
  const mergedSlotB: ConfiguratorSlotState = {
    ...slotB,
    serviceType: slotA.serviceType,
    kitId: slotA.kitId,
    upgradeIds: slotA.upgradeIds,
    trainingOptionIds: slotA.trainingOptionIds,
    financePlanId: slotA.financePlanId,
    financeInputs: slotA.financeInputs,
  };

  const { data: vanA } = useQuery<Van>({
    queryKey: ['/api/vans', slotA.vanId],
    enabled: !!slotA.vanId,
  });
  const { data: kitA } = useQuery<Kit>({
    queryKey: ['/api/kits', slotA.kitId],
    enabled: !!slotA.kitId,
  });
  const { data: allUpgrades = [] } = useQuery<Upgrade[]>({
    queryKey: ['/api/upgrades'],
  });
  const upgradesA = allUpgrades.filter(u => slotA.upgradeIds.includes(u.id));

  const { data: allTraining = [] } = useQuery<TrainingOption[]>({
    queryKey: ['/api/training-options'],
  });
  const trainingA = allTraining.filter(t => slotA.trainingOptionIds.includes(t.id));

  const { data: vanB } = useQuery<Van>({
    queryKey: ['/api/vans', slotB.vanId],
    enabled: !!slotB.vanId,
  });

  const calcTotal = (
    slot: ConfiguratorSlotState,
    van?: Van,
    kit?: Kit,
    upgrades?: Upgrade[],
    training?: TrainingOption[],
  ) => {
    const vanPrice = van?.price || slot.customVanValue || 0;
    const kitPrice = kit?.price || 0;
    const upgradesTotal = (upgrades || []).reduce((s, u) => s + u.price * (slot.upgradeQuantities[u.id] ?? 1), 0);
    const trainingTotal = (training || []).reduce((s, t) => s + t.price, 0);
    const subtotal = vanPrice + kitPrice + upgradesTotal + trainingTotal;
    const vat = Math.round(subtotal * 0.2);
    return subtotal + vat;
  };

  const totalA = calcTotal(slotA, vanA, kitA, upgradesA, trainingA);
  // Slot B uses slot A's kit/upgrades/training — only the van differs
  const totalB = calcTotal(mergedSlotB, vanB, kitA, upgradesA, trainingA);

  // Apply the same discount to both slots
  const discA = applyDiscount(totalA, discountType, discountValue);
  const discB = applyDiscount(totalB, discountType, discountValue);
  const diff = discB.finalTotal - discA.finalTotal;

  return (
    <div className="space-y-3" data-testid="compare-summary">
      <SlotSummary
        slot={slotA}
        label="Option A"
        isActive={activeSlot === 'A'}
        onClick={() => setActiveSlot('A')}
        externalTotal={totalA}
        discountedTotal={discA.discountAmount > 0 ? discA.finalTotal : undefined}
        discountAmount={discA.discountAmount > 0 ? discA.discountAmount : undefined}
      />
      <SlotSummary
        slot={mergedSlotB}
        label="Option B"
        isActive={activeSlot === 'B'}
        onClick={() => setActiveSlot('B')}
        externalTotal={totalB}
        discountedTotal={discB.discountAmount > 0 ? discB.finalTotal : undefined}
        discountAmount={discB.discountAmount > 0 ? discB.discountAmount : undefined}
      />

      {(discA.finalTotal > 0 || discB.finalTotal > 0) && (
        <div className="text-center text-xs text-muted-foreground p-2 bg-muted/30 rounded-md border">
          {diff === 0 && <span>Both options are the same price</span>}
          {diff > 0 && (
            <span>Option B is <strong className="text-foreground">{formatPrice(Math.abs(diff))}</strong> more than Option A</span>
          )}
          {diff < 0 && (
            <span>Option B is <strong className="text-foreground">{formatPrice(Math.abs(diff))}</strong> less than Option A</span>
          )}
        </div>
      )}

    </div>
  );
}

export function ConfiguratorSummary({
  discountSection,
  discountedTotal,
  discountAmount,
  discountType,
  discountValue,
}: {
  discountSection?: ReactNode;
  discountedTotal?: number;
  discountAmount?: number;
  discountType?: 'none' | 'percentage' | 'fixed';
  discountValue?: string;
} = {}) {
  const { state, setCustomVanValue, setVanReg, compareMode } = useConfigurator();
  const [priceAnimKey, setPriceAnimKey] = useState(0);
  const prevTotalRef = useRef<number | null>(null);

  // Local input state for own van price and reg (synced to context)
  const [vanPriceStr, setVanPriceStr] = useState(
    state.customVanValue ? (state.customVanValue / 100).toFixed(0) : ""
  );
  const [vanRegStr, setVanRegStr] = useState(state.vanReg ?? "");

  // Controls "Want to add van details?" panel for own-van path
  const [vanDetailsOpen, setVanDetailsOpen] = useState(
    () => !!(state.customVanValue)
  );

  // Sync context → local when context changes externally (e.g. clearAll)
  useEffect(() => {
    setVanPriceStr(state.customVanValue ? (state.customVanValue / 100).toFixed(0) : "");
  }, [state.customVanValue]);

  useEffect(() => {
    setVanRegStr(state.vanReg ?? "");
  }, [state.vanReg]);

  const handleVanPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    setVanPriceStr(raw);
    const num = parseFloat(raw);
    setCustomVanValue(!isNaN(num) && num > 0 ? Math.round(num * 100) : null);
  };

  const handleVanRegChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setVanRegStr(val);
    setVanReg(val.trim() || null);
  };

  const { data: van, isLoading: vanLoading } = useQuery<Van>({
    queryKey: ['/api/vans', state.vanId],
    enabled: !!state.vanId,
  });

  const { data: kit, isLoading: kitLoading } = useQuery<Kit>({
    queryKey: ['/api/kits', state.kitId],
    enabled: !!state.kitId,
  });

  const { data: allUpgradesMain = [], isLoading: upgradesLoading } = useQuery<Upgrade[]>({
    queryKey: ['/api/upgrades'],
  });
  const upgrades = allUpgradesMain.filter(u => state.upgradeIds.includes(u.id));

  const { data: allTrainingMain = [], isLoading: trainingLoading } = useQuery<TrainingOption[]>({
    queryKey: ['/api/training-options'],
  });
  const trainingOptions = allTrainingMain.filter(t => state.trainingOptionIds.includes(t.id));

  const isLoadingAny = (!!state.vanId && vanLoading) || (!!state.kitId && kitLoading) || (state.upgradeIds.length > 0 && upgradesLoading) || (state.trainingOptionIds.length > 0 && trainingLoading);

  const isOwnVan = !state.vanId;
  const ownVanPrice = (vanDetailsOpen && state.customVanValue) ? state.customVanValue : 0;
  const vanPrice = van?.price || ownVanPrice;
  const kitPrice = kit?.price || 0;
  const upgradesTotal = upgrades.reduce((sum, upgrade) => sum + upgrade.price * (state.upgradeQuantities[upgrade.id] ?? 1), 0);
  const trainingTotal = trainingOptions.reduce((sum, option) => sum + option.price, 0);

  const subtotal = vanPrice + kitPrice + upgradesTotal + trainingTotal;
  const vat = Math.round(subtotal * 0.2);
  const total = subtotal + vat;

  const displayTotal = discountedTotal ?? total;

  useEffect(() => {
    if (prevTotalRef.current !== null && prevTotalRef.current !== displayTotal && displayTotal > 0) {
      setPriceAnimKey(k => k + 1);
    }
    prevTotalRef.current = displayTotal;
  }, [displayTotal]);

  const showPricing = true;
  const hasItems = van ? true : (kitPrice > 0 || upgradesTotal > 0 || trainingTotal > 0);

  return (
    <Card className="sticky top-[180px] sm:top-[200px] xl:top-[220px] z-10 max-h-[calc(100vh-200px)] overflow-y-auto" data-testid="summary-container">
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Configuration Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {compareMode ? (
          <>
            {discountSection && (
              <div className="pb-3 border-b">{discountSection}</div>
            )}
            <CompareSummary discountType={discountType} discountValue={discountValue} />
          </>
        ) : (
          <>
            {!hasItems && !isLoadingAny && !!state.vanId && (
              <p className="text-sm text-muted-foreground text-center py-2" data-testid="text-no-selections">
                Start configuring to see your total
              </p>
            )}

            {(hasItems || isLoadingAny) && (
              <>
                {state.vanId && vanLoading ? (
                  <div className="flex items-start gap-2">
                    <Car className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-3/4" data-testid="skeleton-van-name" />
                      <Skeleton className="h-3.5 w-1/3" data-testid="skeleton-van-price" />
                    </div>
                  </div>
                ) : van ? (
                  <div className="flex items-start gap-2">
                    <Car className="w-4 h-4 text-accent mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" data-testid="text-summary-van-name">
                        {van.make} {van.model}
                      </p>
                      {resolveVanReg(van, state.vanReg) && (
                        <p className="text-xs font-mono font-semibold uppercase tracking-wide text-muted-foreground" data-testid="text-summary-van-reg">
                          {resolveVanReg(van, state.vanReg)}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground" data-testid="text-summary-van-price">
                        {formatPrice(van.price)}
                      </p>
                    </div>
                  </div>
                ) : null}

                {isOwnVan && vanDetailsOpen && state.customVanValue && state.customVanValue > 0 && (
                  <div className="flex items-start gap-2">
                    <Car className="w-4 h-4 text-accent mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" data-testid="text-summary-own-van-label">
                        Own van
                      </p>
                      <p className="text-sm text-muted-foreground" data-testid="text-summary-own-van-price">
                        {formatPrice(state.customVanValue)}
                      </p>
                    </div>
                  </div>
                )}

                {state.kitId && kitLoading ? (
                  <div className="flex items-start gap-2">
                    <Package className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-2/3" data-testid="skeleton-kit-name" />
                      <Skeleton className="h-3.5 w-1/4" data-testid="skeleton-kit-price" />
                    </div>
                  </div>
                ) : kit ? (
                  <div className="flex items-start gap-2">
                    <Package className="w-4 h-4 text-accent mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" data-testid="text-summary-kit-name">
                        {kit.name}
                      </p>
                      {showPricing && (
                        <p className="text-sm text-muted-foreground" data-testid="text-summary-kit-price">
                          {formatPrice(kit.price)}
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}

                {state.upgradeIds.length > 0 && upgradesLoading ? (
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-accent shrink-0" />
                    <Skeleton className="h-4 w-1/2" data-testid="skeleton-upgrades" />
                  </div>
                ) : upgrades.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-accent" />
                      <p className="text-sm font-medium">
                        Upgrades ({upgrades.length})
                      </p>
                    </div>
                    <div className="pl-6 space-y-1">
                      {upgrades.map((upgrade) => {
                        const qty = state.upgradeQuantities[upgrade.id] ?? 1;
                        return (
                          <div key={upgrade.id} className="flex justify-between text-sm">
                            <span className="text-muted-foreground truncate pr-2" data-testid={`text-summary-upgrade-name-${upgrade.id}`}>
                              {((upgrade as any).variantName && (upgrade as any).variantName.trim()) || upgrade.name}{qty > 1 ? ` ×${qty}` : ''}
                            </span>
                            {showPricing && (
                              <span className="font-medium whitespace-nowrap" data-testid={`text-summary-upgrade-price-${upgrade.id}`}>
                                {formatPrice(upgrade.price * qty)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {state.trainingOptionIds.length > 0 && trainingLoading ? (
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-accent shrink-0" />
                    <Skeleton className="h-4 w-1/2" data-testid="skeleton-training" />
                  </div>
                ) : trainingOptions.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-accent" />
                      <p className="text-sm font-medium">
                        Training ({trainingOptions.length})
                      </p>
                    </div>
                    <div className="pl-6 space-y-1">
                      {trainingOptions.map((option) => (
                        <div key={option.id} className="flex justify-between text-sm">
                          <span className="text-muted-foreground truncate pr-2" data-testid={`text-summary-training-name-${option.id}`}>
                            {option.name}
                          </span>
                          {showPricing && (
                            <span className="font-medium whitespace-nowrap" data-testid={`text-summary-training-price-${option.id}`}>
                              {formatPrice(option.price)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {showPricing && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      {isLoadingAny ? (
                        <>
                          <div className="flex justify-between text-sm items-center">
                            <span className="text-muted-foreground">Subtotal</span>
                            <Skeleton className="h-4 w-16" data-testid="skeleton-subtotal" />
                          </div>
                          <div className="flex justify-between text-sm items-center">
                            <span className="text-muted-foreground">VAT (20%)</span>
                            <Skeleton className="h-4 w-12" data-testid="skeleton-vat" />
                          </div>
                          <Separator />
                          <div className="flex justify-between items-center">
                            <span className="font-bold">Total</span>
                            <Skeleton className="h-7 w-24" data-testid="skeleton-total" />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="font-medium" data-testid="text-summary-subtotal">
                              {formatPrice(subtotal)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">VAT (20%)</span>
                            <span className="font-medium" data-testid="text-summary-vat">
                              {formatPrice(vat)}
                            </span>
                          </div>
                          {discountSection && (
                            <div className="pt-1">{discountSection}</div>
                          )}
                          {discountAmount && discountAmount > 0 ? (
                            <>
                              <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Before discount</span>
                                <span className="line-through">{formatPrice(total)}</span>
                              </div>
                              <div className="flex justify-between text-sm text-destructive font-medium">
                                <span>Discount</span>
                                <span>-{formatPrice(discountAmount)}</span>
                              </div>
                            </>
                          ) : null}
                          <Separator />
                          <div className="flex justify-between items-center">
                            <span className="font-bold">Total</span>
                            <span
                              key={priceAnimKey}
                              className={`font-extrabold text-2xl text-accent ${priceAnimKey > 0 ? 'price-updated' : ''}`}
                              data-testid="text-summary-total"
                            >
                              {formatPrice(displayTotal)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}

                {state.vanId && !state.serviceType && (
                  <Badge variant="secondary" className="w-full justify-center" data-testid="badge-select-service-type">
                    Select your service type
                  </Badge>
                )}
                {state.vanId && state.serviceType === 'car' && !state.kitId && (
                  <Badge variant="secondary" className="w-full justify-center" data-testid="badge-select-kit">
                    Select an equipment kit
                  </Badge>
                )}
              </>
            )}

            {isOwnVan && (
              <OwnVanDetails
                vanPriceStr={vanPriceStr}
                vanRegStr={vanRegStr}
                onPriceChange={handleVanPriceChange}
                onRegChange={handleVanRegChange}
                open={vanDetailsOpen}
                onToggle={() => setVanDetailsOpen(v => !v)}
              />
            )}
          </>
        )}

      </CardContent>
    </Card>
  );
}
