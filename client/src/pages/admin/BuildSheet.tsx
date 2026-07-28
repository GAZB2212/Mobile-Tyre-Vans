import { useQuery, useMutation } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/queryClient";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Printer, FileDown, Loader2, Send, AlertTriangle, CheckCircle2, XCircle, X, History, ClipboardList, Check, ScanLine, QrCode } from "lucide-react";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import type { Quote, Van, Kit, Upgrade, FinancePlan } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { QRCodeCanvas } from "qrcode.react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { resolveVanReg } from "@/lib/vanDisplay";
import { QrScannerModal } from "@/components/QrScannerModal";
import { DueByCountdown } from "@/components/DueByCountdown";

import type { SkuComponent, StockItem } from "@shared/schema";
import { deriveHeadlineMachines } from "@shared/kitHeadlineMachines";

function StockBadge({ onHand, lowStockThreshold }: { onHand: number; lowStockThreshold?: number | null }) {
  let colorClass: string;
  let label: string;
  if (onHand === 0) {
    colorClass = "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
    label = "0";
  } else if (lowStockThreshold != null && onHand <= lowStockThreshold) {
    colorClass = "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400";
    label = String(onHand);
  } else {
    colorClass = "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400";
    label = String(onHand);
  }
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums leading-none ${colorClass}`}
      title={`${onHand} in stock`}
      data-testid="badge-stock-count"
    >
      {label}
    </span>
  );
}

function SkuBomInfo({ sku, skuComponents, bomId, onScanRow, pickedRows, stockMap }: {
  sku?: string | null;
  skuComponents?: SkuComponent[] | null;
  bomId?: string;
  onScanRow?: (sku: string, qty: number, rowKey: string) => void;
  pickedRows?: Set<string>;
  stockMap?: Map<string, StockItem>;
}) {
  const hasSku = !!sku;
  const hasBom = Array.isArray(skuComponents) && skuComponents.length > 0;
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Composite row key — unique per section + position so the same physical SKU
  // appearing in multiple BOM sections is tracked independently
  const rk = (i: number) => `${bomId ?? ""}:${i}`;

  // Parent-completion: every pickable row (has a sku) is in the pickedRows set
  const pickableCount = hasBom ? (skuComponents ?? []).filter((c, i) => !!c.sku && i >= 0).length : 0;
  const allPicked = hasBom && pickableCount > 0 &&
    (skuComponents ?? []).every((c, i) => !c.sku || pickedRows?.has(rk(i)));

  if (!hasSku && !hasBom) return null;

  const copyableSkus = hasBom ? (skuComponents ?? []).map(c => c.sku).filter(Boolean) : [];
  const hasCostData = false; // Cost prices not shown on build sheets — admin-only

  const handleCopyAllSkus = () => {
    if (copyableSkus.length === 0) return;
    navigator.clipboard.writeText(copyableSkus.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
      toast({ title: "Could not copy SKUs", description: "Please copy them manually.", variant: "destructive" });
    });
  };

  return (
    <div className="mt-0.5 space-y-0.5">
      {hasSku && (
        <p className="text-xs font-mono text-muted-foreground print:hidden">
          SKU: <span className="font-semibold">{sku}</span>
        </p>
      )}
      {hasBom && skuComponents && (
        <div className="print:hidden">
          {allPicked && (
            <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium mb-1">
              <Check className="w-3.5 h-3.5" />
              All parts picked
            </div>
          )}
          {copyableSkus.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={handleCopyAllSkus}
                data-testid={bomId ? `button-bom-copy-all-${bomId}` : "button-bom-copy-all"}
                title="Copy all part SKUs to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-green-600" />
                    <span className="text-green-600">Copied {copyableSkus.length} SKU{copyableSkus.length !== 1 ? "s" : ""}!</span>
                  </>
                ) : (
                  <>
                    <ClipboardList className="w-3 h-3" />
                    Copy all SKUs
                  </>
                )}
              </button>
            </div>
          )}
          <div className="rounded-md border bg-muted/40 overflow-hidden mt-1">
            <table className="w-full text-xs table-fixed">
              <thead>
                <tr className="border-b bg-muted/60">
                  <th className="text-left px-2 py-1.5 font-medium text-muted-foreground w-28">Part SKU</th>
                  <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Description</th>
                  <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-10">Qty</th>
                  {stockMap && <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-16">Stock</th>}
                  {hasCostData && <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-20">Unit cost</th>}
                  {hasCostData && <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-20">Row total</th>}
                  {onScanRow && <th className="w-16" />}
                </tr>
              </thead>
              <tbody>
                {skuComponents.map((c, i) => {
                  const rowTotal = hasCostData && c.costPrice != null ? c.costPrice * c.quantity : null;
                  const thisKey = rk(i);
                  const isPicked = !!pickedRows?.has(thisKey);
                  return (
                    <tr key={i} className={`border-b last:border-0 ${isPicked ? "bg-green-500/5" : ""}`}>
                      <td className="px-2 py-1.5 font-mono text-muted-foreground break-words min-w-0">{c.sku}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        <span className="break-words min-w-0">{c.description}</span>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{c.quantity}</td>
                      {stockMap && (
                        <td className="px-2 py-1.5 text-right">
                          {c.sku && stockMap.has(c.sku) ? (
                            <StockBadge
                              onHand={stockMap.get(c.sku)!.onHand}
                              lowStockThreshold={stockMap.get(c.sku)!.lowStockThreshold}
                            />
                          ) : (
                            <span className="text-muted-foreground/40 text-xs">—</span>
                          )}
                        </td>
                      )}
                      {hasCostData && (
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {c.costPrice != null ? `£${(c.costPrice / 100).toFixed(2)}` : "—"}
                        </td>
                      )}
                      {hasCostData && (
                        <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                          {rowTotal != null ? `£${(rowTotal / 100).toFixed(2)}` : "—"}
                        </td>
                      )}
                      {onScanRow && (
                        <td className="px-1 py-1 text-center">
                          {c.sku ? (
                            isPicked ? (
                              <span
                                className="inline-flex items-center justify-center w-6 h-6 rounded text-green-600"
                                title={`${c.sku} picked`}
                                data-testid={`icon-picked-bom-${bomId}-${i}`}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onScanRow(c.sku!, c.quantity, thisKey)}
                                title={`Scan to deduct ${c.quantity} × ${c.sku}`}
                                className="inline-flex items-center justify-center w-6 h-6 rounded text-blue-500 hover:bg-blue-500/10 transition-colors"
                                data-testid={`button-scan-bom-${bomId}-${i}`}
                              >
                                <ScanLine className="w-3.5 h-3.5" />
                              </button>
                            )
                          ) : null}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function PrintCheckbox({ checked, onChange, id }: { checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <label
      htmlFor={id}
      className="flex items-center gap-0 cursor-pointer select-none"
      style={{ minWidth: 0 }}
    >
      {/* Screen: real checkbox hidden, custom square shown */}
      <span className="print:hidden inline-flex items-center justify-center w-5 h-5 rounded border-2 border-foreground/50 flex-shrink-0 mr-3"
        style={{ background: checked ? 'currentColor' : 'transparent' }}
        onClick={() => onChange(!checked)}
        aria-hidden="true"
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="w-3 h-3 text-background" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2,6 5,9 10,3" />
          </svg>
        )}
      </span>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="sr-only"
      />
      {/* Print: always show an empty square the engineer can tick */}
      <span className="hidden print:inline-block w-5 h-5 border-2 border-black mr-3 flex-shrink-0 align-middle" aria-hidden="true" />
    </label>
  );
}

export default function BuildSheet() {
  const params = useParams();
  const quoteId = params.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // ── AutoTradeOS push state ──────────────────────────────────────────────
  type PushPhase = 'idle' | 'preflight' | 'pushing' | 'done' | 'error';
  const [pushPhase, setPushPhase] = useState<PushPhase>('idle');
  const [pushResult, setPushResult] = useState<{
    success: boolean;
    build_job_id?: string;
    parts_received?: number;
    parts_not_found?: string[];
    low_stock_warnings?: string[];
  } | null>(null);
  const [pushError, setPushError] = useState('');

  const { user, isAuthenticated, isLoading } = useAuth() as {
    user: User | undefined;
    isAuthenticated: boolean;
    isLoading: boolean;
  };

  // ── Print tips dismissal ────────────────────────────────────────────────────
  const PRINT_TIPS_KEY = "build-sheet-print-tips-dismissed";
  const [printTipsDismissed, setPrintTipsDismissed] = useState<boolean>(
    () => localStorage.getItem(PRINT_TIPS_KEY) === "true"
  );
  const dismissPrintTips = () => {
    localStorage.setItem(PRINT_TIPS_KEY, "true");
    setPrintTipsDismissed(true);
  };

  // Detect browser for targeted print tips
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isChrome = /chrome/i.test(navigator.userAgent) && !/edge|opr\//i.test(navigator.userAgent);

  // ── QR scan-to-deduct ───────────────────────────────────────────────────────
  // scannerTarget carries the expected SKU, BOM row quantity, and the composite
  // row key (bomId:rowIndex) used to track pick state per-row, not per-SKU
  const [scannerTarget, setScannerTarget] = useState<{ sku: string; qty: number; rowKey: string; kitId?: string; upgradeId?: string } | null>(null);
  // pickedBomRows is keyed by composite "bomId:rowIndex" — the same physical SKU
  // appearing in two different BOM sections tracks independently
  const [pickedBomRows, setPickedBomRows] = useState<Set<string>>(new Set());

  // Mutation: update only the targetCompletionDate (Due-By countdown edit).
  const targetDateMutation = useMutation({
    mutationFn: async (isoDateOrNull: string | null) => {
      const res = await apiRequest("PATCH", `/api/admin/quotes/${quoteId}`, {
        targetCompletionDate: isoDateOrNull,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Due-by date updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quotes"] });
    },
    onError: (err: any) => {
      toast({ title: "Could not update due-by date", description: err?.message ?? "Unknown error", variant: "destructive" });
    },
  });

  const deductMutation = useMutation({
    mutationFn: async ({ sku, qty, rowKey, kitId, upgradeId }: { sku: string; qty: number; rowKey: string; kitId?: string; upgradeId?: string }) => {
      const res = await apiRequest("POST", `/api/admin/stock/${encodeURIComponent(sku)}/deduct`, {
        quantity: qty,
        quoteId,
        buildSheetRef: `Build sheet — quote ${quoteId}`,
        kitId,
        upgradeId,
      });
      return { data: await res.json(), rowKey };
    },
    onMutate: async ({ sku, qty }: { sku: string; qty: number; rowKey: string }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/admin/stock"] });
      const previous = queryClient.getQueryData<StockItem[]>(["/api/admin/stock"]);
      queryClient.setQueryData<StockItem[]>(["/api/admin/stock"], (old = []) =>
        old.map((item) =>
          item.sku === sku ? { ...item, onHand: Math.max(0, item.onHand - qty) } : item
        )
      );
      return { previous };
    },
    onSuccess: ({ data, rowKey }: { data: any; rowKey: string }) => {
      toast({
        title: "Stock deducted",
        description: `${data.sku} — ${data.onHand} remaining`,
      });
      if (rowKey) setPickedBomRows(prev => new Set(prev).add(rowKey));
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stock/low-stock-count"] });
    },
    onError: (err: any, _vars: any, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/admin/stock"], context.previous);
      }
      toast({ title: "Deduction failed", description: err?.message ?? "Unknown error", variant: "destructive" });
    },
  });

  // Parse kit/upgrade IDs from the composite rowKey (format: "bomId:rowIndex").
  // bomId is one of: "kit-{id}", "upgrade-{id}", "kit-upgrade-{id}"
  const parseItemIds = (rowKey: string): { kitId?: string; upgradeId?: string } => {
    const bomId = rowKey.substring(0, rowKey.lastIndexOf(":"));
    if (bomId.startsWith("kit-upgrade-")) return { upgradeId: bomId.slice("kit-upgrade-".length) };
    if (bomId.startsWith("upgrade-")) return { upgradeId: bomId.slice("upgrade-".length) };
    if (bomId.startsWith("kit-")) return { kitId: bomId.slice("kit-".length) };
    return {};
  };

  // Called when a workshop user clicks the scan button on a specific BOM row.
  // rowKey is the composite "bomId:rowIndex" that uniquely identifies this row.
  const handleScanRow = (expectedSku: string, qty: number, rowKey: string) => {
    setScannerTarget({ sku: expectedSku, qty, rowKey, ...parseItemIds(rowKey) });
  };

  const handleScanResult = (scannedSku: string) => {
    const target = scannerTarget;
    setScannerTarget(null);
    if (target && scannedSku !== target.sku) {
      toast({
        title: "Wrong part scanned",
        description: `Expected "${target.sku}" but scanned "${scannedSku}". Please scan the correct label.`,
        variant: "destructive",
      });
      return;
    }
    deductMutation.mutate({ sku: scannedSku, qty: target?.qty ?? 1, rowKey: target?.rowKey ?? "", kitId: target?.kitId, upgradeId: target?.upgradeId });
  };

  // Checked items stored in localStorage per quote
  const storageKey = `buildsheet-checked-${quoteId}`;
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const setChecked = useCallback((itemKey: string, value: boolean) => {
    setCheckedItems(prev => {
      const next = { ...prev, [itemKey]: value };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [storageKey]);

  const isChecked = (key: string) => !!checkedItems[key];

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => { window.location.href = "/login"; }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  useEffect(() => {
    if (user && (!user.adminRole || user.adminRole === "none")) {
      toast({
        title: "Access Denied",
        description: "Admin access required.",
        variant: "destructive",
      });
      setTimeout(() => { window.location.href = "/"; }, 1000);
    }
  }, [user, toast]);

  const { data: quotes = [], isLoading: isLoadingQuotes } = useQuery<Quote[]>({
    queryKey: ["/api/admin/quotes"],
    enabled: !!(user?.adminRole && user.adminRole !== "none"),
  });

  const { data: vans = [] } = useQuery<Van[]>({
    queryKey: ["/api/admin/vans"],
    enabled: !!(user?.adminRole && user.adminRole !== "none"),
  });

  const { data: kits = [] } = useQuery<Kit[]>({
    queryKey: ["/api/admin/kits"],
    enabled: !!(user?.adminRole && user.adminRole !== "none"),
  });

  const { data: allUpgrades = [] } = useQuery<Upgrade[]>({
    queryKey: ["/api/admin/upgrades"],
    enabled: !!(user?.adminRole && user.adminRole !== "none"),
  });

  const { data: financePlans = [] } = useQuery<FinancePlan[]>({
    queryKey: ["/api/admin/finance-plans"],
    enabled: !!(user?.adminRole && user.adminRole !== "none"),
  });

  const { data: stockItems = [] } = useQuery<StockItem[]>({
    queryKey: ["/api/admin/stock"],
    enabled: !!(user?.adminRole && user.adminRole !== "none"),
  });

  const stockMap = useMemo(
    () => new Map(stockItems.map((s) => [s.sku, s])),
    [stockItems]
  );

  const quote = quotes.find((q) => q.id === quoteId);
  const van = quote?.vanId ? vans.find((v) => v.id === quote.vanId) : undefined;

  const stockBuildId = (quote as any)?.stockBuildId as string | undefined;
  const qrUrl = stockBuildId ? `https://autotradeportal.com/van-build-scan/${stockBuildId}` : undefined;

  const { data: tokenData } = useQuery<{ token: string }>({
    queryKey: [`/api/admin/quotes/${quoteId}/progress-token`],
    enabled: !!quoteId,
  });
  const progressUrl = tokenData?.token
    ? `${window.location.origin}/workshop/${tokenData.token}`
    : `${window.location.origin}/admin/quotes/${quoteId}/build-progress`;

  const kit = kits.find((k) => k.id === quote?.kitId);
  // Dedupe by parentId — only one variant per parent should ever appear
  // (mirrors the configurator's radio behaviour). The configurator shows the
  // FIRST variant in `selectedUpgradeIds` that belongs to a given parent
  // (see SelectUpgrades.tsx: `state.upgradeIds.find(...)`), so we follow the
  // exact same rule here. Iterate in the saved array order, keep the first
  // variant per parent, drop the rest.
  const savedOrder = (quote?.selectedUpgradeIds as string[] | undefined) ?? [];
  const upgradesById = new Map(allUpgrades.map((u) => [u.id, u] as const));
  const seenParents = new Set<string>();
  const upgrades: typeof allUpgrades = [];
  for (const id of savedOrder) {
    const u = upgradesById.get(id);
    if (!u) continue;
    const pid = (u as any).parentId as string | null | undefined;
    if (pid) {
      if (seenParents.has(pid)) continue;
      seenParents.add(pid);
    }
    upgrades.push(u);
  }
  const financePlan = quote?.financePlanId ? financePlans.find((f) => f.id === quote.financePlanId) : undefined;

  // ── Build-sheet supersession logic ──────────────────────────────────────────
  // Variants inherit their parent's supersedesKitItems if the variant itself has none.
  // This allows the admin to configure supersession on the parent and have it apply
  // when any variant of that upgrade is selected by a customer.
  const upgradesWithSupersession = upgrades.map((u) => {
    const uAny = u as any;
    const ownItems: string[] = Array.isArray(uAny.supersedesKitItems) ? uAny.supersedesKitItems : [];
    if (ownItems.length === 0 && uAny.parentId) {
      const parent = allUpgrades.find((p) => p.id === uAny.parentId);
      const parentItems: string[] = parent && Array.isArray((parent as any).supersedesKitItems)
        ? (parent as any).supersedesKitItems : [];
      if (parentItems.length > 0) {
        // Use parent name for display so build sheet shows the upgrade family name
        return { ...u, supersedesKitItems: parentItems, _displayName: parent!.name } as any;
      }
    }
    return { ...u, _displayName: u.name } as any;
  });

  const supersedingUpgrades = upgradesWithSupersession.filter(
    (u) => Array.isArray(u.supersedesKitItems) && u.supersedesKitItems.length > 0
  );
  const regularUpgrades = upgradesWithSupersession.filter(
    (u) => !Array.isArray(u.supersedesKitItems) || u.supersedesKitItems.length === 0
  );

  // Build a lookup: lower-cased kit item text → the upgrade that supersedes it
  const kitItemToUpgrade = new Map<string, typeof upgradesWithSupersession[0]>();
  for (const upgrade of supersedingUpgrades) {
    for (const item of (upgrade.supersedesKitItems as string[])) {
      kitItemToUpgrade.set(item.trim().toLowerCase(), upgrade);
    }
  }

  // Compute the effective kit items list for rendering:
  // Each entry is either a plain kit string or a superseding upgrade.
  type KitEntry =
    | { kind: "kit"; text: string; origIdx: number }
    | { kind: "upgrade"; upgrade: typeof upgradesWithSupersession[0]; origIdx: number };

  const effectiveKitItems: KitEntry[] = [];
  const renderedUpgradeIds = new Set<string>();

  if (kit) {
    kit.includes.forEach((item, idx) => {
      const matchingUpgrade = kitItemToUpgrade.get(item.trim().toLowerCase());
      if (matchingUpgrade) {
        if (!renderedUpgradeIds.has(matchingUpgrade.id)) {
          // First match: show the upgrade in place of this kit item
          effectiveKitItems.push({ kind: "upgrade", upgrade: matchingUpgrade, origIdx: idx });
          renderedUpgradeIds.add(matchingUpgrade.id);
        }
        // Subsequent matches for the same upgrade: skip (item is removed)
      } else {
        effectiveKitItems.push({ kind: "kit", text: item, origIdx: idx });
      }
    });
  }

  const formatDate = (dateString: string | Date | null): string => {
    if (!dateString) return "Unknown date";
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formatBuildStage = (stage: string | null): string => {
    if (!stage) return "Not Started";
    return stage.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  const upgradeSearchText = (u: Upgrade) => [
    u.id,
    u.name,
    u.category,
    u.description,
    u.parentId,
    u.variantName,
  ].filter(Boolean).join(" ").toLowerCase();

  const isInteriorWallUpgrade = (u: Upgrade) => {
    const text = upgradeSearchText(u);
    return text.includes("van-interior") ||
      /\binterior\s+walls?\b/.test(text) ||
      /\bdiamond\s+liner\b/.test(text);
  };

  const isBrandedInteriorWallUpgrade = (u: Upgrade) => {
    const text = [
      u.id,
      u.name,
      u.parentId,
      u.variantName,
    ].filter(Boolean).join(" ").toLowerCase();
    return isInteriorWallUpgrade(u) &&
      (/\bbranded\b/.test(text) || text.includes("with branding")) &&
      !/\bnon\s*branded\b|\bunbranded\b/.test(text);
  };

  const isWrapGraphicsUpgrade = (u: Upgrade) => {
    const text = upgradeSearchText(u);
    return !isInteriorWallUpgrade(u) && /\bwrap\b|\bgraphics?\b|\blivery\b/.test(text);
  };

  // Mirror the auto-generation logic from QuoteDetail — produces the ordered build stage checklist
  const autoGenerateStages = (): Array<{id: string; label: string; section?: string}> => {
    const stages: Array<{id: string; label: string; section?: string}> = [];
    stages.push({ id: "prep", label: "Van Preparation" });
    if (kit) {
      stages.push({ id: "kit", label: `Install ${kit.name}` });
    }
    // Prefix the stage label with "N× " when the customer has ordered more
    // than one of an item — mirrors the qty display in the upgrade rows
    // above so the build stage checklist reads as "2× Compressor".
    const qtyFor = (id: string) => quote?.selectedUpgrades?.[id] || 1;
    const labelFor = (u: Upgrade) => {
      const q = qtyFor(u.id);
      return q > 1 ? `${q}× ${u.name}` : u.name;
    };
    const nonWrapUpgrades = upgrades.filter(u => !isWrapGraphicsUpgrade(u) && !isBrandedInteriorWallUpgrade(u));
    const wrapUpgrades = upgrades.filter(u => isWrapGraphicsUpgrade(u));
    const brandedInteriorWallUpgrades = upgrades.filter(u => isBrandedInteriorWallUpgrade(u));
    for (const u of nonWrapUpgrades) {
      stages.push({ id: `upg_${u.id}`, label: labelFor(u) });
    }
    if (wrapUpgrades.length > 0) {
      stages.push({ id: "artwork_sent", label: "Artwork Sent", section: "Design Work" });
      stages.push({ id: "artwork_approved", label: "Artwork Approved", section: "Design Work" });
      stages.push({ id: "wrap_printed", label: "Wrap Printed", section: "Design Work" });
    }
    for (const u of wrapUpgrades) {
      stages.push({ id: `upg_${u.id}`, label: labelFor(u) });
    }
    if (brandedInteriorWallUpgrades.length > 0) {
      stages.push({ id: "interior_walls_artwork_sent", label: "Interior Walls Artwork Sent", section: "Design Work" });
      stages.push({ id: "interior_wall_artwork_approved", label: "Interior Wall Artwork Approved", section: "Design Work" });
      stages.push({ id: "interior_walls_ordered", label: "Interior Walls Ordered", section: "Design Work" });
    }
    for (const u of brandedInteriorWallUpgrades) {
      stages.push({ id: `upg_${u.id}`, label: labelFor(u) });
    }
    stages.push({ id: "final_checks", label: "Final Checks" });
    stages.push({ id: "valet", label: "Valet & Handover" });
    return stages;
  };

  const buildStageList: Array<{id: string; label: string; section?: string}> = (quote as any)?.customBuildStages ?? autoGenerateStages();
  const systemCompletedStages: string[] = (quote as any)?.completedBuildStages ?? [];

  type PushLogEntry = {
    pushed_at: string;
    pushed_by: string;
    build_job_id?: string;
    parts_received?: number;
  };

  const pushHistory: PushLogEntry[] = (quote as any)?.autotradePushes ?? [];
  const lastPush: PushLogEntry | undefined = pushHistory.length > 0 ? pushHistory[pushHistory.length - 1] : undefined;

  const formatPushDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };

  const pushMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/autotrade/push-build", { quoteId });
      return res.json();
    },
    onSuccess: (data: any) => {
      setPushResult(data);
      setPushPhase("done");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quotes"] });
    },
    onError: (err: any) => {
      setPushError(err?.message || err?.error || "Push failed — check server logs");
      setPushPhase("error");
    },
  });

  const preflightIssues: string[] = quote ? [
    ...(kit && !(kit as any).sku && !((kit as any).skuComponents?.length > 0) ? [`Kit: ${kit.name}`] : []),
    ...upgrades
      .filter(u => !(u as any).hasVariants) // parent group headers are never pushed directly
      .filter(u => !(u as any).sku && !((u as any).skuComponents?.length > 0))
      .map(u => `${(u as any).parentId ? "Variant" : "Upgrade"}: ${u.name}`),
  ] : [];

  const handlePrint = () => { window.print(); };

  const [pdfDownloading, setPdfDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    if (!quoteId || pdfDownloading) return;
    setPdfDownloading(true);
    try {
      const token = getAuthToken();
      const response = await fetch(`/api/admin/quotes/${quoteId}/build-sheet.pdf`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("PDF generation failed");
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `BuildSheet-${quoteId}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "PDF download failed", description: "Could not generate the PDF. Please try printing instead.", variant: "destructive" });
    } finally {
      setPdfDownloading(false);
    }
  };

  if (isLoading || isLoadingQuotes) {
    return (
      <div className="min-h-screen bg-background">
        <AdminPageHeader
          title="Van Build Sheet"
          actions={
            <Button variant="ghost" onClick={() => setLocation("/admin/quotes")} data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Quotes
            </Button>
          }
        />
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user?.adminRole || user.adminRole === "none") return null;

  if (!isLoadingQuotes && !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Quote not found</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/admin/quotes")} data-testid="button-back-to-quotes">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Quotes
          </Button>
        </div>
      </div>
    );
  }

  if (!quote) return null;

  return (
    <>
      {/* Print-override styles injected into head via a style tag */}
      <style>{`
        @page {
          size: A4;
          margin: 14mm 12mm 14mm 12mm;
        }

        @media print {
          body, html {
            background: #ffffff !important;
            color: #000000 !important;
          }
          * {
            color: #000000 !important;
            background: #ffffff !important;
            border-color: #000000 !important;
            box-shadow: none !important;
          }

          /* ── Page-break control ─────────────────────────────────── */

          /* Scoped break-inside: applied only to intentional section cards and
             the workshop instructions block via the print-section class.
             This avoids the problem of the blanket .rounded-lg rule: browsers
             silently ignore break-inside: avoid on elements taller than the
             remaining page space, which can cascade to unrelated elements. */
          .print-section {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          /* Card header must stay with its content — never orphaned at the
             bottom of a page. shadcn-card is set on every Card component;
             its first child is always the CardHeader div. */
          .shadcn-card > div:first-child {
            break-after: avoid !important;
            page-break-after: avoid !important;
          }

          /* Force the heavy sections to always start at the top of a fresh
             page. Applied via .print-page-break on the Card element in JSX. */
          .print-page-break {
            break-before: page !important;
            page-break-before: always !important;
          }

          /* Individual checklist rows stay together */
          .border-b {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          /* ── Checkbox square ───────────────────────────────────── */
          .print-checkbox-square {
            display: inline-block !important;
            width: 14px !important;
            height: 14px !important;
            border: 2px solid #000 !important;
            margin-right: 10px !important;
            flex-shrink: 0 !important;
            vertical-align: middle !important;
          }
        }
      `}</style>

      {/* Nav bar — hidden on print */}
      <div className="no-print">
        <AdminPageHeader
          title="Van Build Sheet"
          actions={
            <>
              <Button variant="ghost" onClick={() => setLocation("/admin/quotes")} data-testid="button-back">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Quotes
              </Button>
              <Button onClick={handlePrint} data-testid="button-print">
                <Printer className="w-4 h-4 mr-2" />
                Print Build Sheet
              </Button>
              <Button variant="outline" onClick={handleDownloadPdf} disabled={pdfDownloading} data-testid="button-download-pdf">
                {pdfDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
                {pdfDownloading ? "Generating…" : "Download PDF"}
              </Button>
              <Button variant="outline" onClick={() => window.open(`/admin/quotes/${quoteId}/qr-label`, "_blank")} data-testid="button-print-qr-sticker">
                <QrCode className="w-4 h-4 mr-2" />
                Print QR Sticker
              </Button>
              {user?.adminRole === "full" && (
                <Button
                  variant="outline"
                  onClick={() => { setPushResult(null); setPushError(""); setPushPhase("preflight"); }}
                  disabled={pushMutation.isPending}
                  data-testid="button-push-autotrade"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Push to AutoTradeOS
                </Button>
              )}
            </>
          }
        />
        {!printTipsDismissed && (
          <div className="mx-4 mb-3 mt-1 flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-4 py-3 text-sm text-blue-800 dark:text-blue-200" data-testid="div-print-tips">
            <Printer className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500 dark:text-blue-400" />
            <div className="flex-1 min-w-0">
              <p className="font-medium mb-0.5">Print tips — hide browser headers &amp; footers</p>
              {isSafari ? (
                <p className="text-blue-700 dark:text-blue-300">In Safari: File &rarr; Print &rarr; uncheck <strong>Print headers and footers</strong>.</p>
              ) : isChrome ? (
                <p className="text-blue-700 dark:text-blue-300">In Chrome: File &rarr; Print &rarr; <strong>More settings</strong> &rarr; uncheck <strong>Headers and footers</strong>.</p>
              ) : (
                <p className="text-blue-700 dark:text-blue-300">In your browser's print dialog, look for a <strong>Headers and footers</strong> option and uncheck it for a clean print.</p>
              )}
            </div>
            <button
              type="button"
              onClick={dismissPrintTips}
              className="flex-shrink-0 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 transition-colors"
              data-testid="button-dismiss-print-tips"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Due-By countdown — big WKS:DAYS:HRS:MIN ticker plus 6wk/9wk date chips.
          Editable here: staff can override the auto-seeded due date inline. */}
      {quote && (
        <div className="no-print px-4 pb-2">
          <DueByCountdown
            targetCompletionDate={(quote as any).targetCompletionDate}
            artworkApprovedAt={(quote as any).artworkApprovedAt}
            editable
            onChange={(iso) => targetDateMutation.mutate(iso)}
          />
        </div>
      )}

      {/* ── Last push summary — always visible to full admins when there's history ── */}
      {user?.adminRole === "full" && lastPush && pushPhase === "idle" && (
        <div className="no-print px-4 pb-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="div-last-push-summary">
            <History className="w-3.5 h-3.5 flex-shrink-0" />
            Last pushed {formatPushDate(lastPush.pushed_at)} by {lastPush.pushed_by}
            {lastPush.build_job_id && <span>· Job <span className="font-mono" data-testid="text-last-push-job-id">{lastPush.build_job_id}</span></span>}
            {typeof lastPush.parts_received === "number" && <span>· {lastPush.parts_received} part{lastPush.parts_received !== 1 ? "s" : ""}</span>}
            {pushHistory.length > 1 && <span className="text-muted-foreground">({pushHistory.length} pushes total)</span>}
          </div>
        </div>
      )}

      {/* ── AutoTradeOS push panel ─────────────────────────────────────────── */}
      {pushPhase !== "idle" && user?.adminRole === "full" && (
        <div className="no-print px-4 pb-4">
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-sm">
                {pushPhase === "preflight" && "Push to AutoTradeOS"}
                {pushPhase === "pushing" && "Pushing build…"}
                {pushPhase === "done" && "Push complete"}
                {pushPhase === "error" && "Push failed"}
              </p>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => { setPushPhase("idle"); setPushResult(null); setPushError(""); }}
                data-testid="button-close-push-panel"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Pre-flight confirmation */}
            {pushPhase === "preflight" && (
              <div className="space-y-3">
                {preflightIssues.length > 0 && (
                  <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 space-y-1">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-medium">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      {preflightIssues.length} item{preflightIssues.length !== 1 ? "s" : ""} without a SKU or Bill of Materials — these will be skipped:
                    </div>
                    <ul className="pl-6 text-sm text-amber-700 dark:text-amber-400 list-disc space-y-0.5">
                      {preflightIssues.map((issue, i) => <li key={i}>{issue}</li>)}
                    </ul>
                  </div>
                )}
                {preflightIssues.length === 0 && (
                  <p className="text-sm text-muted-foreground">All items have SKUs or BOMs. Ready to push.</p>
                )}
                {/* Previous push history shown in preflight so staff can check before re-pushing */}
                {pushHistory.length > 0 && (
                  <div className="space-y-1" data-testid="div-push-history">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <History className="w-3.5 h-3.5" />
                      Push history
                    </p>
                    <div className="rounded-md border divide-y text-xs">
                      {[...pushHistory].reverse().map((entry, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-1.5" data-testid={`row-push-history-${i}`}>
                          <span className="text-muted-foreground">{formatPushDate(entry.pushed_at)}</span>
                          <span className="font-medium">{entry.pushed_by}</span>
                          {entry.build_job_id && (
                            <span className="font-mono text-muted-foreground" data-testid={`text-push-job-id-${i}`}>Job {entry.build_job_id}</span>
                          )}
                          {typeof entry.parts_received === "number" && (
                            <span className="text-muted-foreground">{entry.parts_received} part{entry.parts_received !== 1 ? "s" : ""}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => { setPushPhase("pushing"); pushMutation.mutate(); }}
                    data-testid="button-confirm-push"
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Confirm Push
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPushPhase("idle")} data-testid="button-cancel-push">
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Pushing spinner */}
            {pushPhase === "pushing" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                Sending parts list to AutoTradeOS…
              </div>
            )}

            {/* Success */}
            {pushPhase === "done" && pushResult && (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  {pushResult.parts_received ?? 0} part{(pushResult.parts_received ?? 0) !== 1 ? "s" : ""} received
                  {pushResult.build_job_id && ` · Job ${pushResult.build_job_id}`}
                </div>
                {(pushResult.low_stock_warnings?.length ?? 0) > 0 && (
                  <p className="text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="inline w-3.5 h-3.5 mr-1" />
                    {pushResult.low_stock_warnings!.length} low-stock warning{pushResult.low_stock_warnings!.length !== 1 ? "s" : ""} — warehouse notified
                  </p>
                )}
                {(pushResult.parts_not_found?.length ?? 0) > 0 && (
                  <p className="text-destructive">
                    <XCircle className="inline w-3.5 h-3.5 mr-1" />
                    {pushResult.parts_not_found!.length} SKU{pushResult.parts_not_found!.length !== 1 ? "s" : ""} not found in AutoTradeOS — flagged for review
                  </p>
                )}
              </div>
            )}

            {/* Error */}
            {pushPhase === "error" && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                {pushError}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8 max-w-4xl print:max-w-full print:px-0 print:py-4">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-6">
          <div className="flex-1 text-center">
            <h1 className="text-3xl font-bold mb-1" data-testid="text-page-title">Van Build Sheet</h1>
            <p className="text-xl font-semibold print:text-black" data-testid="text-build-sheet-name">
              {quote.userName}
            </p>
            {quote.company && (
              <p className="text-lg font-medium mb-2 print:text-black" data-testid="text-build-sheet-company">
                {quote.company}
              </p>
            )}
            <p className="text-muted-foreground print:text-black mt-2">
              Quote Reference: <strong>{quote.id.substring(0, 8).toUpperCase()}</strong>
            </p>
            <p className="text-sm text-muted-foreground print:text-black">Date: {formatDate(quote.createdAt)}</p>
          </div>

          {/* QR codes — build progress (stock pick QR hidden until stock system is ready) */}
          <div className="flex-shrink-0 flex flex-row items-start gap-4">
            <div className="flex flex-col items-center gap-1 print:border print:border-black print:p-2 print:rounded" data-testid="div-progress-qr-code">
              <QRCodeCanvas
                value={progressUrl}
                size={112}
                marginSize={1}
                data-testid="img-progress-qr-code"
              />
              <p className="text-xs text-muted-foreground print:text-black text-center leading-tight">
                Scan to update<br />build progress
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">

          {/* Customer Info */}
          <Card className="print-section">
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground print:text-black">Name</p>
                  <p className="font-medium" data-testid="text-customer-name">{quote.userName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground print:text-black">Email</p>
                  <p className="font-medium" data-testid="text-customer-email">{quote.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground print:text-black">Phone</p>
                  <p className="font-medium" data-testid="text-customer-phone">{quote.phone}</p>
                </div>
                {quote.company && (
                  <div>
                    <p className="text-sm text-muted-foreground print:text-black">Company</p>
                    <p className="font-medium" data-testid="text-customer-company">{quote.company}</p>
                  </div>
                )}
              </div>
              {quote.notes && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground print:text-black">Customer Request Notes</p>
                  <p className="text-sm" data-testid="text-customer-notes">{quote.notes}</p>
                </div>
              )}
              {quote.adminNotes && (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-muted-foreground print:text-black">Admin Notes (Internal)</p>
                  <p className="text-sm whitespace-pre-wrap" data-testid="text-admin-notes">{quote.adminNotes}</p>
                </div>
              )}
              {quote.customerNotes && (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-muted-foreground print:text-black">Customer Notes</p>
                  <p className="text-sm whitespace-pre-wrap" data-testid="text-customer-facing-notes">{quote.customerNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Van Spec */}
          {van ? (
            <Card className="print-section">
              <CardHeader>
                <CardTitle>Base Vehicle Specification</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold" data-testid="text-van-title">
                    {van.make} {van.model} ({van.year})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    {/* Registration — shown first and prominently */}
                    {resolveVanReg(van, (quote as any).vanRegistration) && (
                      <div className="sm:col-span-2 md:col-span-3">
                        <p className="text-muted-foreground print:text-black">Registration</p>
                        <p className="font-bold text-base uppercase tracking-widest" data-testid="text-van-reg">
                          {resolveVanReg(van, (quote as any).vanRegistration)}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground print:text-black">Mileage</p>
                      <p className="font-medium" data-testid="text-van-mileage">{van.mileage.toLocaleString()} miles</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground print:text-black">Transmission</p>
                      <p className="font-medium" data-testid="text-van-transmission">{van.specs.transmission}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground print:text-black">Fuel Type</p>
                      <p className="font-medium" data-testid="text-van-fuel">{van.specs.fuel}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground print:text-black">Size/Body Type</p>
                      <p className="font-medium" data-testid="text-van-size">{van.specs.size}</p>
                    </div>
                    {van.specs.engine && (
                      <div>
                        <p className="text-muted-foreground print:text-black">Engine</p>
                        <p className="font-medium" data-testid="text-van-engine">{van.specs.engine}</p>
                      </div>
                    )}
                    {van.specs.doors && (
                      <div>
                        <p className="text-muted-foreground print:text-black">Doors</p>
                        <p className="font-medium" data-testid="text-van-doors">{van.specs.doors}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (quote as any).vanRegistration ? (
            /* No stock van linked, but a registration was recorded — show a minimal van details card */
            <Card className="print-section">
              <CardHeader>
                <CardTitle>Van Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  <div>
                    <p className="text-muted-foreground print:text-black">Registration</p>
                    <p className="font-bold text-base uppercase tracking-widest" data-testid="text-van-reg">
                      {(quote as any).vanRegistration}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Artwork & Design — shown only when wrap/graphic pack or branded interior walls upgrades are selected */}
          {(() => {
            const hasWrap = upgrades.some(u => isWrapGraphicsUpgrade(u));
            const hasBrandedInteriorWalls = upgrades.some(u => isBrandedInteriorWallUpgrade(u));
            if (!hasWrap && !hasBrandedInteriorWalls) return null;
            return (
              <Card className="print-section" data-testid="card-artwork-design">
                <CardHeader>
                  <CardTitle>Artwork &amp; Design</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {hasWrap && (
                      <>
                        {[
                          { key: "artwork_sent", label: "Artwork Sent" },
                          { key: "artwork_approved", label: "Artwork Approved" },
                          { key: "wrap_printed", label: "Wrap Printed" },
                        ].map(item => (
                          <div key={item.key} className="flex items-center gap-1 py-2 border-b last:border-0" data-testid={`row-artwork-${item.key}`}>
                            <PrintCheckbox
                              id={`checkbox-artwork-${item.key}`}
                              checked={isChecked(`artwork-${item.key}`)}
                              onChange={v => setChecked(`artwork-${item.key}`, v)}
                            />
                            <span
                              className={`flex-1 text-sm font-medium ${isChecked(`artwork-${item.key}`) ? "line-through text-muted-foreground print:no-underline print:text-black" : ""}`}
                              data-testid={`text-artwork-label-${item.key}`}
                            >
                              {item.label}
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                    {hasBrandedInteriorWalls && (
                      <>
                        {[
                          { key: "interior_walls_artwork_sent", label: "Interior Walls Artwork Sent" },
                          { key: "interior_wall_artwork_approved", label: "Interior Wall Artwork Approved" },
                          { key: "interior_walls_ordered", label: "Interior Walls Ordered" },
                        ].map(item => (
                          <div key={item.key} className="flex items-center gap-1 py-2 border-b last:border-0" data-testid={`row-artwork-${item.key}`}>
                            <PrintCheckbox
                              id={`checkbox-artwork-${item.key}`}
                              checked={isChecked(`artwork-${item.key}`)}
                              onChange={v => setChecked(`artwork-${item.key}`, v)}
                            />
                            <span
                              className={`flex-1 text-sm font-medium ${isChecked(`artwork-${item.key}`) ? "line-through text-muted-foreground print:no-underline print:text-black" : ""}`}
                              data-testid={`text-artwork-label-${item.key}`}
                            >
                              {item.label}
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Kit Items — with checkboxes */}
          {kit && (
            <Card className="print-page-break print-section">
              <CardHeader>
                <CardTitle>Equipment Package — Items to Install</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold text-base" data-testid="text-kit-name">{kit.name}</p>
                    {/* Headline machines (e.g. Tyre Changer · Wheel Balancer ·
                        Compressor) — resolved by the shared helper: admin
                        override wins, otherwise derived from this kit's BOM
                        (skuComponents) by strict keyword match. Gives the
                        workshop a one-glance summary above the full BOM
                        without them having to scan crimps and wire entries. */}
                    {(() => {
                      const machines = deriveHeadlineMachines({
                        headlineMachines: (kit as { headlineMachines?: string[] | null }).headlineMachines ?? null,
                        skuComponents: kit.skuComponents ?? null,
                      });
                      if (machines.length === 0) return null;
                      return (
                        <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-kit-machines">
                          <span className="font-medium">Includes:</span>{" "}
                          {machines.join(" · ")}
                        </p>
                      );
                    })()}
                    {/* Workshop hint — the headline machines above are the
                        pack's stock spec. Any selected upgrade further down
                        this sheet (e.g. T4000, Super Spin, 48V compressor)
                        supersedes the corresponding stock machine. */}
                    {upgrades.length > 0 && (
                      <p
                        className="text-xs italic text-muted-foreground mt-1"
                        data-testid="text-kit-upgrades-note"
                      >
                        Check upgrades below — they may replace items in this pack.
                      </p>
                    )}
                    <SkuBomInfo sku={kit.sku} skuComponents={kit.skuComponents} bomId={`kit-${kit.id}`} onScanRow={handleScanRow} pickedRows={pickedBomRows} stockMap={stockMap} />
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    {effectiveKitItems.map((entry, idx) => {
                      const itemKey = entry.kind === "upgrade"
                        ? `kit-upgrade-${entry.upgrade.id}`
                        : `kit-${entry.origIdx}`;
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-1 py-1.5 border-b last:border-0"
                          data-testid={`row-kit-item-${idx}`}
                        >
                          <PrintCheckbox
                            id={`checkbox-${itemKey}`}
                            checked={isChecked(itemKey)}
                            onChange={v => setChecked(itemKey, v)}
                          />
                          {entry.kind === "upgrade" ? (
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-baseline gap-x-2">
                                {(() => {
                                  const qty = quote.selectedUpgrades?.[entry.upgrade.id] || 1;
                                  return qty > 1 ? (
                                    <span className="font-bold text-accent print:text-black text-base flex-shrink-0" data-testid={`text-kit-upgrade-qty-${entry.upgrade.id}`}>
                                      {qty}&times;
                                    </span>
                                  ) : null;
                                })()}
                                {(() => {
                                  // Prefer the variant_name when set — in production the parent
                                  // name is often duplicated across siblings (e.g. all CCTV
                                  // variants are stored as "Van Online CCTV/NVR System"), so the
                                  // variant_name is the only distinguishing label.
                                  const variantName = ((entry.upgrade as any).variantName ?? "").trim();
                                  const fallbackName = (entry.upgrade as any)._displayName ?? entry.upgrade.name;
                                  const primary = variantName || fallbackName;
                                  return (
                                    <span
                                      className={`text-sm font-semibold ${isChecked(itemKey) ? 'line-through text-muted-foreground print:no-underline print:text-black' : ''}`}
                                      data-testid={`text-kit-includes-${idx}`}
                                    >
                                      {primary}
                                    </span>
                                  );
                                })()}
                                <span className="text-xs font-bold uppercase tracking-wide text-accent print:text-black">
                                  (Upgraded)
                                </span>
                              </div>
                              <SkuBomInfo sku={entry.upgrade.sku} skuComponents={entry.upgrade.skuComponents} bomId={`kit-upgrade-${entry.upgrade.id}`} onScanRow={handleScanRow} pickedRows={pickedBomRows} stockMap={stockMap} />
                            </div>
                          ) : (
                            <span
                              className={`text-sm font-medium flex-1 ${isChecked(itemKey) ? 'line-through text-muted-foreground print:no-underline print:text-black' : ''}`}
                              data-testid={`text-kit-includes-${idx}`}
                            >
                              {entry.text}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upgrades — with checkboxes (superseding upgrades are shown in the kit section above) */}
          {regularUpgrades.length > 0 && (
            <Card className="print-page-break print-section">
              <CardHeader>
                <CardTitle>Additional Equipment &amp; Upgrades — Items to Install</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {regularUpgrades.map((upgrade) => {
                    const quantity = quote.selectedUpgrades?.[upgrade.id] || 1;
                    const itemKey = `upgrade-${upgrade.id}`;
                    return (
                      <div
                        key={upgrade.id}
                        className="flex items-start gap-1 py-2 border-b last:border-0"
                        data-testid={`row-upgrade-${upgrade.id}`}
                      >
                        <PrintCheckbox
                          id={`checkbox-upgrade-${upgrade.id}`}
                          checked={isChecked(itemKey)}
                          onChange={v => setChecked(itemKey, v)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            {quantity > 1 && (
                              <span className="font-bold text-accent print:text-black text-base flex-shrink-0">
                                {quantity}&times;
                              </span>
                            )}
                            {/* Show the variant_name (sibling label) as the primary
                                heading when available — in production several
                                upgrades share the same parent name (e.g. all CCTV
                                variants are "Van Online CCTV/NVR System"), so the
                                variant_name is the only distinguishing label. */}
                            {(() => {
                              const variantName = ((upgrade as any).variantName ?? "").trim();
                              const primary = variantName || upgrade.name;
                              return (
                                <p
                                  className={`font-semibold text-sm ${isChecked(itemKey) ? 'line-through text-muted-foreground print:no-underline print:text-black' : ''}`}
                                  data-testid={`text-upgrade-name-${upgrade.id}`}
                                >
                                  {primary}
                                </p>
                              );
                            })()}
                          </div>
                          <SkuBomInfo sku={upgrade.sku} skuComponents={upgrade.skuComponents} bomId={`upgrade-${upgrade.id}`} onScanRow={handleScanRow} pickedRows={pickedBomRows} stockMap={stockMap} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bespoke Extras */}
          {((quote as any).customExtras as Array<{id: string; description: string; pricePence: number}> | undefined)?.length ? (
            <Card className="print-section">
              <CardHeader>
                <CardTitle>Bespoke Extras</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {((quote as any).customExtras as Array<{id: string; description: string; pricePence: number}>).map((extra) => {
                    const itemKey = `extra-${extra.id}`;
                    return (
                      <div
                        key={extra.id}
                        className="flex items-center gap-1 py-2 border-b last:border-0"
                        data-testid={`row-extra-${extra.id}`}
                      >
                        <PrintCheckbox
                          id={`checkbox-extra-${extra.id}`}
                          checked={isChecked(itemKey)}
                          onChange={v => setChecked(itemKey, v)}
                        />
                        <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2">
                          <p className={`font-semibold text-sm ${isChecked(itemKey) ? 'line-through text-muted-foreground print:no-underline print:text-black' : ''}`}>
                            {extra.description}
                          </p>
                          <span className="text-xs text-muted-foreground print:text-black">
                            £{(extra.pricePence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })} ex. VAT
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Build Status */}
          <Card className="print-page-break print-section">
            <CardHeader>
              <CardTitle>Build Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground print:text-black">Current Build Stage</p>
                  <p className="text-lg font-semibold" data-testid="text-build-stage">{formatBuildStage(quote.buildStage)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground print:text-black">Quote Status</p>
                  <p className="font-medium" data-testid="text-quote-status">
                    {quote.status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                </div>
                {quote.graphicsArtworkUrl && (
                  <div>
                    <p className="text-sm text-muted-foreground print:text-black">Graphics Artwork</p>
                    <p className="font-medium" data-testid="text-artwork-status">
                      Artwork uploaded — See attached file
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Workshop instructions */}
        <div className="mt-8 p-4 border rounded-md print:border-black print-section">
          <p className="text-sm font-bold mb-2">Build Team Instructions</p>
          <ul className="text-sm space-y-1 list-disc list-inside">
            <li>Verify all equipment and parts are available before starting build</li>
            <li>Check vehicle condition and note any pre-existing damage</li>
            <li>Tick each item above as it is fitted or installation is in progress</li>
            <li>Follow installation guides for all equipment packages</li>
            <li>Test all installed equipment before sign-off</li>
            <li>Update the build stage in the system as work progresses</li>
          </ul>

          {/* Print-only signature line */}
          <div className="hidden print:block mt-6 pt-4 border-t border-black">
            <div className="grid grid-cols-2 gap-8 mt-2">
              <div>
                <p className="text-xs font-semibold mb-6">Engineer Name:</p>
                <div className="border-b border-black h-px" />
              </div>
              <div>
                <p className="text-xs font-semibold mb-6">Signed &amp; Completed:</p>
                <div className="border-b border-black h-px" />
              </div>
              <div>
                <p className="text-xs font-semibold mb-6">Date Started:</p>
                <div className="border-b border-black h-px" />
              </div>
              <div>
                <p className="text-xs font-semibold mb-6">Date Completed:</p>
                <div className="border-b border-black h-px" />
              </div>
            </div>
          </div>
        </div>

        {/* Print-only footer */}
        <div className="hidden print:block mt-6 text-center text-xs text-black border-t border-black pt-3">
          <p>Mobile Tyre Vans &mdash; Internal Workshop Document &mdash; {formatDate(new Date())}</p>
          <p>Quote Ref: {quote.id.substring(0, 8).toUpperCase()}</p>
        </div>
      </div>

      {/* QR scan-to-deduct modal */}
      <QrScannerModal
        open={scannerTarget !== null}
        onClose={() => setScannerTarget(null)}
        onScan={handleScanResult}
        expectedSku={scannerTarget?.sku}
      />
    </>
  );
}
