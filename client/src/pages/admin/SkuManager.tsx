import { useState, useMemo, useRef, useCallback } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";
import type { Kit, Upgrade } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowUp, ArrowDown, AlertTriangle, CheckCircle2, ChevronRight, Wand2, Search, QrCode, RefreshCw, Download, Printer, Upload, XCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type SkuComponent = { sku: string; description: string; quantity: number; costPrice?: number | null };

// ── Client-side SKU generation from description ───────────────────────────────
const STOP_WORDS = new Set(['the','a','an','of','for','and','or','with','to','in','on','at','by']);

function generateSkuFromDescription(description: string, existingSkus: string[]): string {
  const words = description.trim().split(/\s+/).filter(Boolean);
  const meaningful = words.filter(w => !STOP_WORDS.has(w.toLowerCase()));

  const parts = meaningful.map(word => {
    const clean = word.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean) return '';
    // Keep codes that contain digits (T1000, 48V, K1) or are short (LWB, LED)
    if (/[0-9]/.test(clean) && clean.length <= 7) return clean;
    if (clean.length <= 4) return clean;
    // Longer plain words → first letter only
    return clean[0];
  }).filter(Boolean);

  const abbrev = parts.join('').slice(0, 10) || 'PART';
  const base = `MTV-P-${abbrev}`;
  const upper = (s: string) => s.toUpperCase();

  if (!existingSkus.some(s => upper(s) === upper(base))) return base;
  for (let n = 2; n <= 99; n++) {
    const candidate = `${base}-${n}`;
    if (!existingSkus.some(s => upper(s) === upper(candidate))) return candidate;
  }
  return base;
}

interface SkuCatalogueEntry {
  sku: string;
  description: string;
  type: "Equipment Pack" | "Upgrade" | "BOM Part";
  source: string;
  costPrice: number | null;
}

// ── BOM Editor ───────────────────────────────────────────────────────────────
function BomEditor({
  components,
  onChange,
  catalogue,
}: {
  components: SkuComponent[];
  onChange: (rows: SkuComponent[]) => void;
  catalogue: SkuCatalogueEntry[];
}) {
  const [activeRow, setActiveRow] = useState<number | null>(null);
  const [skuQuery, setSkuQuery] = useState("");
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const suggestions = useMemo(() => {
    if (activeRow === null || !skuQuery.trim()) return [];
    const q = skuQuery.toLowerCase();
    const seen = new Set<string>();
    return catalogue
      .filter(e => {
        const key = e.sku.toLowerCase();
        if (seen.has(key)) return false;
        if (e.sku.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)) {
          seen.add(key);
          return true;
        }
        return false;
      })
      .slice(0, 8);
  }, [activeRow, skuQuery, catalogue]);

  const addRow = () => onChange([...components, { sku: "", description: "", quantity: 1, costPrice: null }]);
  const remove = (i: number) => onChange(components.filter((_, idx) => idx !== i));
  const update = (i: number, patch: Partial<SkuComponent>) => {
    const rows = [...components];
    rows[i] = { ...rows[i], ...patch };
    onChange(rows);
  };
  const moveUp = (i: number) => {
    if (i === 0) return;
    const rows = [...components];
    [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]];
    onChange(rows);
  };
  const moveDown = (i: number) => {
    if (i >= components.length - 1) return;
    const rows = [...components];
    [rows[i], rows[i + 1]] = [rows[i + 1], rows[i]];
    onChange(rows);
  };

  const handleDescriptionBlur = (i: number) => {
    const row = components[i];
    if (!row || row.sku.trim() || !row.description.trim()) return;
    const existingSkus = components.map(r => r.sku).filter(Boolean);
    const sku = generateSkuFromDescription(row.description, existingSkus);
    update(i, { sku });
  };

  const openSuggestions = (i: number, value: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setActiveRow(i);
    setSkuQuery(value);
  };

  const schedulClose = () => {
    closeTimer.current = setTimeout(() => setActiveRow(null), 150);
  };

  const pickSuggestion = (i: number, entry: SkuCatalogueEntry) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    update(i, { sku: entry.sku, description: entry.description || entry.sku });
    setActiveRow(null);
    setSkuQuery("");
  };

  return (
    <div className="space-y-2">
      {components.length > 0 && (
        <div className="grid grid-cols-[1fr_2fr_72px_88px_auto] gap-2 text-xs font-medium text-muted-foreground px-1">
          <span>Part SKU</span>
          <span>Description</span>
          <span>Qty</span>
          <span>Cost (£ ex VAT)</span>
          <span />
        </div>
      )}
      {components.map((row, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_2fr_72px_88px_auto] gap-2 items-start">
          <div className="relative">
            <Input
              placeholder="SKU or search…"
              value={row.sku}
              onChange={e => {
                update(idx, { sku: e.target.value });
                openSuggestions(idx, e.target.value);
              }}
              onFocus={() => openSuggestions(idx, row.sku)}
              onBlur={schedulClose}
              className="text-sm h-8 font-mono"
              data-testid={`input-skumgr-bom-sku-${idx}`}
            />
            {activeRow === idx && suggestions.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md overflow-hidden">
                {suggestions.map((entry, si) => (
                  <button
                    key={si}
                    type="button"
                    className="w-full text-left px-3 py-2 text-xs hover-elevate flex flex-col gap-0.5 border-b last:border-0"
                    onMouseDown={() => pickSuggestion(idx, entry)}
                  >
                    <span className="font-mono font-semibold tracking-wide">{entry.sku}</span>
                    <span className="text-muted-foreground truncate">{entry.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Input
            placeholder="Description"
            value={row.description}
            onChange={e => update(idx, { description: e.target.value })}
            onBlur={() => handleDescriptionBlur(idx)}
            className="text-sm h-8"
            data-testid={`input-skumgr-bom-desc-${idx}`}
          />
          <Input
            type="number"
            min={1}
            value={row.quantity}
            onChange={e => update(idx, { quantity: parseInt(e.target.value) || 1 })}
            className="text-sm h-8"
            data-testid={`input-skumgr-bom-qty-${idx}`}
          />
          <Input
            type="number"
            min={0}
            step={0.01}
            placeholder="0.00"
            value={row.costPrice != null ? (row.costPrice / 100).toFixed(2) : ""}
            onChange={e => {
              const val = parseFloat(e.target.value);
              update(idx, { costPrice: isNaN(val) ? null : Math.round(val * 100) });
            }}
            className="text-sm h-8"
            data-testid={`input-skumgr-bom-cost-${idx}`}
          />
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={idx === 0} onClick={() => moveUp(idx)} data-testid={`button-skumgr-bom-up-${idx}`}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Move part up</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={idx === components.length - 1} onClick={() => moveDown(idx)} data-testid={`button-skumgr-bom-down-${idx}`}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Move part down</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(idx)} data-testid={`button-skumgr-bom-remove-${idx}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove part</TooltipContent>
            </Tooltip>
          </div>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={addRow} data-testid="button-skumgr-add-bom-row">
        <Plus className="w-3.5 h-3.5 mr-1" />
        Add Part
      </Button>
    </div>
  );
}

// ── BOM Dialog ───────────────────────────────────────────────────────────────
function BomDialog({
  open,
  onOpenChange,
  title,
  initialComponents,
  onSave,
  isSaving,
  catalogue,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  initialComponents: SkuComponent[];
  onSave: (rows: SkuComponent[]) => void;
  isSaving: boolean;
  catalogue: SkuCatalogueEntry[];
}) {
  const [rows, setRows] = useState<SkuComponent[]>(initialComponents);

  const handleOpenChange = (v: boolean) => {
    if (v) setRows(initialComponents);
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bill of Materials — {title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Component parts sent to the AutoTradeOS warehouse when this item is pushed.
          Leave empty if this item ships as a single unit identified by its own SKU.
        </p>
        <BomEditor components={rows} onChange={setRows} catalogue={catalogue} />
        <div className="flex gap-2 justify-end pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-skumgr-cancel-bom">
            Cancel
          </Button>
          <Button onClick={() => onSave(rows)} disabled={isSaving} data-testid="button-skumgr-save-bom">
            {isSaving ? "Saving…" : "Save BOM"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Inline SKU input — saves on blur / Enter ──────────────────────────────────
function InlineSkuInput({
  value,
  onSave,
  isSaving,
}: {
  value: string | null | undefined;
  onSave: (sku: string) => void;
  isSaving?: boolean;
}) {
  const [draft, setDraft] = useState(value ?? "");

  const commit = () => {
    if (draft !== (value ?? "")) onSave(draft);
  };

  return (
    <Input
      value={draft}
      placeholder="e.g. MTV-U001"
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className={`h-8 text-sm w-36 font-mono ${isSaving ? "opacity-60" : ""}`}
      disabled={isSaving}
      data-testid="input-skumgr-sku"
    />
  );
}

// ── SKU status badge ──────────────────────────────────────────────────────────
function SkuBadge({ sku }: { sku?: string | null }) {
  if (sku) {
    return (
      <Badge variant="outline" className="gap-1 text-green-700 border-green-400 dark:border-green-600 dark:text-green-400 font-mono text-xs">
        <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
        {sku}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-amber-600 border-amber-400 dark:border-amber-600 dark:text-amber-400">
      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
      No SKU
    </Badge>
  );
}

// ── Inline cost price input — saves on blur / Enter ──────────────────────────
function InlineCostPriceInput({
  value,
  onSave,
  isSaving,
}: {
  value: number | null | undefined;
  onSave: (pence: number | null) => void;
  isSaving?: boolean;
}) {
  const [draft, setDraft] = useState(value != null ? (value / 100).toFixed(2) : "");

  const commit = () => {
    const parsed = parseFloat(draft);
    const pence = isNaN(parsed) ? null : Math.round(parsed * 100);
    const current = value != null ? value : null;
    if (pence !== current) onSave(pence);
  };

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">£</span>
      <Input
        type="number"
        min={0}
        step={0.01}
        placeholder="0.00"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className={`h-8 text-sm w-24 ${isSaving ? "opacity-60" : ""}`}
        disabled={isSaving}
        data-testid="input-skumgr-cost-price"
      />
      <span className="text-xs text-muted-foreground whitespace-nowrap">ex VAT</span>
    </div>
  );
}

// ── Row layout shared by kit rows and upgrade rows ────────────────────────────
function ItemRow({
  name,
  subtitle,
  sku,
  costPrice,
  bomCount,
  canEdit,
  onSkuSave,
  onCostPriceSave,
  onBomClick,
  isSavingSku,
  isSavingCostPrice,
  indented,
  stockQty,
}: {
  name: string;
  subtitle?: string;
  sku?: string | null;
  costPrice?: number | null;
  bomCount: number;
  canEdit: boolean;
  onSkuSave: (v: string) => void;
  onCostPriceSave: (pence: number | null) => void;
  onBomClick: () => void;
  isSavingSku?: boolean;
  isSavingCostPrice?: boolean;
  indented?: boolean;
  stockQty?: number | null;
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 flex-wrap gap-y-2 ${indented ? "pl-10 border-t" : ""}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        {bomCount > 0 && !subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {bomCount} BOM component{bomCount !== 1 ? "s" : ""}
          </p>
        )}
      </div>
      <StockBadge qty={stockQty} />
      <SkuBadge sku={sku} />
      {canEdit && (
        <>
          <InlineSkuInput value={sku} onSave={onSkuSave} isSaving={isSavingSku} />
          <InlineCostPriceInput value={costPrice} onSave={onCostPriceSave} isSaving={isSavingCostPrice} />
          <Button
            size="sm"
            variant="outline"
            onClick={onBomClick}
            data-testid={`button-skumgr-edit-bom`}
          >
            {bomCount > 0 ? `Edit BOM (${bomCount})` : "Add BOM"}
          </Button>
        </>
      )}
    </div>
  );
}

// ── Stock level badge ─────────────────────────────────────────────────────────
// qty === undefined  → no SKU on this item, render nothing
// qty === null       → SKU exists but no stock data yet, render grey badge
// qty === number     → actual stock level
function StockBadge({ qty }: { qty: number | null | undefined }) {
  if (qty === undefined) return null;
  if (qty === null) return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground shrink-0">
      Stock unknown
    </span>
  );
  if (qty === 0) return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 shrink-0">
      Out of stock
    </span>
  );
  if (qty <= 3) return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 shrink-0">
      Low: {qty}
    </span>
  );
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 shrink-0">
      Stock: {qty}
    </span>
  );
}

// ── CSV import results dialog ─────────────────────────────────────────────────
function ImportResultsDialog({
  open,
  onOpenChange,
  result,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  result: { updated: number; overwritten: number; skipped: number; errors: string[] } | null;
}) {
  if (!result) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import complete</DialogTitle>
          <DialogDescription>
            Cost prices have been applied from your CSV file.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="flex gap-4">
            <div className="flex-1 rounded-md border bg-muted/40 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{result.updated}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Updated</p>
            </div>
            <div className="flex-1 rounded-md border bg-muted/40 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{result.overwritten}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Overwritten</p>
            </div>
            <div className="flex-1 rounded-md border bg-muted/40 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{result.skipped}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Skipped</p>
            </div>
          </div>
          {result.overwritten > 0 && (
            <div className="rounded-md border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500 dark:text-orange-400 mt-0.5 shrink-0" />
              <p className="text-xs text-orange-700 dark:text-orange-300">
                <span className="font-semibold">{result.overwritten} item{result.overwritten !== 1 ? "s" : ""}</span> had an existing cost price that was replaced. Check this looks correct before continuing.
              </p>
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1">
              <p className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" />
                {result.errors.length} issue{result.errors.length !== 1 ? "s" : ""} found
              </p>
              <ul className="space-y-0.5 pl-5 list-disc text-xs text-muted-foreground">
                {result.errors.slice(0, 10).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {result.errors.length > 10 && (
                  <li className="italic">…and {result.errors.length - 10} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={() => onOpenChange(false)} data-testid="button-import-results-close">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── CSV parsing helper ────────────────────────────────────────────────────────
/** Parse a single CSV line respecting double-quoted fields (RFC 4180 subset). */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      // Quoted field
      let field = "";
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          field += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++; // skip closing quote
          break;
        } else {
          field += line[i++];
        }
      }
      fields.push(field);
      if (line[i] === ",") i++; // skip comma after field
    } else {
      // Unquoted field — read up to next comma or end
      const end = line.indexOf(",", i);
      if (end === -1) {
        fields.push(line.slice(i).trim());
        break;
      } else {
        fields.push(line.slice(i, end).trim());
        i = end + 1;
      }
    }
  }
  return fields;
}

function parseCostPriceCsv(text: string): Array<{ identifier: string; costPrice: number }> | { error: string } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { error: "The file appears to be empty." };

  const rows: Array<{ identifier: string; costPrice: number }> = [];

  // Detect header and determine which column holds the cost price.
  // 3-column template: SKU | Item Name | Cost Price (£)  → price at index 2
  // Legacy 2-column:   SKU | Cost Price (£)              → price at index 1
  let startLine = 0;
  let priceColIndex = 1;

  const headerCols = parseCsvLine(lines[0]);
  if (headerCols.length >= 2) {
    // If the second column is non-numeric it's a header row
    if (isNaN(parseFloat(headerCols[1]))) {
      startLine = 1;
      // 3-column template has a third column header
      if (headerCols.length >= 3) {
        priceColIndex = 2;
      }
    }
  }

  for (let i = startLine; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i]);
    if (parts.length <= priceColIndex) continue;
    const identifier = parts[0].trim();
    const priceStr = parts[priceColIndex].trim().replace(/^£/, "");
    const priceFloat = parseFloat(priceStr);
    if (!identifier || isNaN(priceFloat)) continue;
    rows.push({ identifier, costPrice: Math.round(priceFloat * 100) });
  }

  if (rows.length === 0) return { error: "No valid rows found. Check the format: SKU or ID, cost price (£)." };
  return rows;
}
// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminSkuManager() {
  const { user } = useAuth() as { user: User | undefined };
  const { toast } = useToast();

  const { data: kits = [], isLoading: kitsLoading } = useQuery<Kit[]>({
    queryKey: ["/api/admin/kits"],
  });
  const { data: allUpgrades = [], isLoading: upgradesLoading } = useQuery<Upgrade[]>({
    queryKey: ["/api/admin/upgrades"],
  });

  const { data: stockLevels = {} } = useQuery<Record<string, { stockQty: number; updatedAt: string }>>({
    queryKey: ["/api/admin/sku-stock"],
    refetchInterval: 60_000,
  });

  const { data: siteSettings = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/site-settings"],
  });

  const [bomDialog, setBomDialog] = useState<{
    type: "kit" | "upgrade";
    id: string;
    name: string;
    components: SkuComponent[];
  } | null>(null);

  const [catalogueSearch, setCatalogueSearch] = useState("");

  // ── CSV cost price import ──────────────────────────────────────────────────
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<{
    updated: number;
    overwritten: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [importResultOpen, setImportResultOpen] = useState(false);

  const importMutation = useMutation({
    mutationFn: (rows: Array<{ identifier: string; costPrice: number }>) =>
      apiRequest("POST", "/api/admin/sku/import-cost-prices", rows),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/upgrades"] });
      setImportResult({ updated: data.updated ?? 0, overwritten: data.overwritten ?? 0, skipped: data.skipped ?? 0, errors: data.errors ?? [] });
      setImportResultOpen(true);
    },
    onError: () => toast({ title: "Import failed", description: "Could not process the file. Please try again.", variant: "destructive" }),
  });

  const handleCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCostPriceCsv(text);
      if ("error" in parsed) {
        toast({ title: "Could not read CSV", description: parsed.error, variant: "destructive" });
        return;
      }
      importMutation.mutate(parsed);
    };
    reader.readAsText(file);
  };

  // ── Upgrade grouping ──────────────────────────────────────────────────────
  const variantChildren = allUpgrades.filter(u => !!(u as any).parentId);
  const parentIds = new Set(variantChildren.map(v => (v as any).parentId as string));
  const parentGroups = allUpgrades.filter(u => parentIds.has(u.id));
  const simples = allUpgrades.filter(u => !(u as any).parentId && !parentIds.has(u.id));

  const bomCount = (item: any): number =>
    Array.isArray((item as any).skuComponents) ? (item as any).skuComponents.length : 0;

  // ── SKU Catalogue ─────────────────────────────────────────────────────────
  const catalogue = useMemo<SkuCatalogueEntry[]>(() => {
    const entries: SkuCatalogueEntry[] = [];

    // Kit SKUs
    for (const kit of kits) {
      if ((kit as any).sku) {
        entries.push({ sku: (kit as any).sku, description: kit.name, type: "Equipment Pack", source: kit.name, costPrice: (kit as any).costPrice ?? null });
      }
      // BOM parts from kits
      const parts: SkuComponent[] = (kit as any).skuComponents ?? [];
      for (const p of parts) {
        if (p.sku) entries.push({ sku: p.sku, description: p.description || p.sku, type: "BOM Part", source: kit.name, costPrice: null });
      }
    }

    // Upgrade SKUs (non-parent groups)
    for (const u of allUpgrades) {
      if ((u as any).hasVariants) continue; // parent groups have no SKU
      if ((u as any).sku) {
        entries.push({ sku: (u as any).sku, description: u.name, type: "Upgrade", source: u.name, costPrice: (u as any).costPrice ?? null });
      }
      // BOM parts from upgrades
      const parts: SkuComponent[] = (u as any).skuComponents ?? [];
      for (const p of parts) {
        if (p.sku) entries.push({ sku: p.sku, description: p.description || p.sku, type: "BOM Part", source: u.name, costPrice: null });
      }
    }

    return entries;
  }, [kits, allUpgrades]);

  const filteredCatalogue = useMemo(() => {
    const q = catalogueSearch.toLowerCase().trim();
    if (!q) return catalogue;
    return catalogue.filter(e =>
      e.sku.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.source.toLowerCase().includes(q) ||
      e.type.toLowerCase().includes(q)
    );
  }, [catalogue, catalogueSearch]);

  // Count items missing SKUs
  const missingSku = useMemo(() => {
    const kitsMissing = kits.filter(k => !(k as any).sku).length;
    const upgradesMissing = allUpgrades.filter(u => {
      if ((u as any).hasVariants) return false; // parent groups don't need SKU
      return !(u as any).sku;
    }).length;
    return kitsMissing + upgradesMissing;
  }, [kits, allUpgrades]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updateKitSku = useMutation({
    mutationFn: ({ id, sku }: { id: string; sku: string }) =>
      apiRequest("PATCH", `/api/admin/kits/${id}`, { sku: sku || null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/kits"] }),
    onError: () => toast({ title: "Failed to save SKU", variant: "destructive" }),
  });

  const updateKitCostPrice = useMutation({
    mutationFn: ({ id, costPrice }: { id: string; costPrice: number | null }) =>
      apiRequest("PATCH", `/api/admin/kits/${id}`, { costPrice }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/kits"] }),
    onError: () => toast({ title: "Failed to save cost price", variant: "destructive" }),
  });

  const updateKitBom = useMutation({
    mutationFn: ({ id, skuComponents }: { id: string; skuComponents: SkuComponent[] | null }) =>
      apiRequest("PATCH", `/api/admin/kits/${id}`, { skuComponents }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kits"] });
      setBomDialog(null);
      toast({ title: "BOM saved" });
    },
    onError: () => toast({ title: "Failed to save BOM", variant: "destructive" }),
  });

  const updateUpgradeSku = useMutation({
    mutationFn: ({ id, sku }: { id: string; sku: string }) =>
      apiRequest("PATCH", `/api/admin/upgrades/${id}`, { sku: sku || null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/upgrades"] }),
    onError: () => toast({ title: "Failed to save SKU", variant: "destructive" }),
  });

  const updateUpgradeCostPrice = useMutation({
    mutationFn: ({ id, costPrice }: { id: string; costPrice: number | null }) =>
      apiRequest("PATCH", `/api/admin/upgrades/${id}`, { costPrice }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/upgrades"] }),
    onError: () => toast({ title: "Failed to save cost price", variant: "destructive" }),
  });

  const updateUpgradeBom = useMutation({
    mutationFn: ({ id, skuComponents }: { id: string; skuComponents: SkuComponent[] | null }) =>
      apiRequest("PATCH", `/api/admin/upgrades/${id}`, { skuComponents }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/upgrades"] });
      setBomDialog(null);
      toast({ title: "BOM saved" });
    },
    onError: () => toast({ title: "Failed to save BOM", variant: "destructive" }),
  });

  const backfillMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/sku/backfill", {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/upgrades"] });
      const assigned = data?.assigned ?? 0;
      toast({ title: assigned > 0 ? `SKUs assigned to ${assigned} item${assigned !== 1 ? "s" : ""}` : "All items already have SKUs" });
    },
    onError: () => toast({ title: "Failed to generate SKUs", variant: "destructive" }),
  });

  interface SkuSyncResponse {
    ok: boolean;
    items_sent: number;
    synced_at: string;
  }

  const syncCatalogueMutation = useMutation<SkuSyncResponse, Error>({
    mutationFn: () => apiRequest("POST", "/api/admin/sku-sync/push", {}).then(r => r.json() as Promise<SkuSyncResponse>),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-settings"] });
      const sent = data.items_sent ?? 0;
      toast({ title: `Catalogue synced — ${sent} item${sent !== 1 ? "s" : ""} sent to AutoTradeOS` });
    },
    onError: (err) => {
      toast({ title: err.message || "Failed to sync catalogue", variant: "destructive" });
    },
  });

  const canEdit = user?.adminRole === "full";

  const openBom = (type: "kit" | "upgrade", item: any) =>
    setBomDialog({ type, id: item.id, name: item.name, components: (item.skuComponents as SkuComponent[] | null) ?? [] });

  const saveBom = (rows: SkuComponent[]) => {
    if (!bomDialog) return;
    const payload = rows.length > 0 ? rows : null;
    if (bomDialog.type === "kit") {
      updateKitBom.mutate({ id: bomDialog.id, skuComponents: payload });
    } else {
      updateUpgradeBom.mutate({ id: bomDialog.id, skuComponents: payload });
    }
  };

  const [qrLabelItem, setQrLabelItem] = useState<{ sku: string; description: string } | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const downloadQrPng = useCallback(() => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${qrLabelItem?.sku ?? "label"}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [qrLabelItem]);

  if (kitsLoading || upgradesLoading) {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }

  const typeBadgeClass = (type: SkuCatalogueEntry["type"]) => {
    if (type === "Equipment Pack") return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
    if (type === "Upgrade") return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
    return "bg-muted text-muted-foreground";
  };

  return (
    <>
      <input
        ref={csvFileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        data-testid="input-csv-cost-price"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleCsvFile(file);
          e.target.value = "";
        }}
      />

      <AdminPageHeader
        title="SKU Manager"
        subtitle="Assign AutoTradeOS stock-keeping units and bills of materials to packs and upgrades"
        actions={
          canEdit ? (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex flex-col items-start gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => syncCatalogueMutation.mutate()}
                      disabled={syncCatalogueMutation.isPending}
                      data-testid="button-sku-sync"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncCatalogueMutation.isPending ? "animate-spin" : ""}`} />
                      {syncCatalogueMutation.isPending ? "Syncing…" : "Sync to AutoTradeOS"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Push the full SKU catalogue (prices + BOMs) to AutoTradeOS</TooltipContent>
                </Tooltip>
                <span className="text-xs text-muted-foreground" data-testid="text-sku-last-synced">
                  {siteSettings["sku_catalogue_last_sync"]
                    ? `Last synced: ${new Date(siteSettings["sku_catalogue_last_sync"]).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
                    : "Never synced"}
                </span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/admin/sku/cost-price-template", {
                          credentials: "include",
                        });
                        if (!res.ok) throw new Error("Failed to download template");
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "cost-price-template.csv";
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch {
                        toast({ title: "Download failed", description: "Could not download the template. Please try again.", variant: "destructive" });
                      }
                    }}
                    data-testid="button-download-cost-price-template"
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Download template
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download a pre-filled CSV with all SKUs — add cost prices and re-import</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => csvFileInputRef.current?.click()}
                    disabled={importMutation.isPending}
                    data-testid="button-import-cost-prices"
                  >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    {importMutation.isPending ? "Importing…" : "Import cost prices (CSV)"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Upload a two-column CSV (SKU or ID, cost price £) to bulk-set cost prices</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => backfillMutation.mutate()}
                    disabled={backfillMutation.isPending}
                    data-testid="button-sku-backfill"
                  >
                    <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                    {backfillMutation.isPending ? "Generating…" : `Generate Missing SKUs${missingSku > 0 ? ` (${missingSku})` : ""}`}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Auto-assign MTV SKU codes to all items currently missing one</TooltipContent>
              </Tooltip>
            </div>
          ) : undefined
        }
      />

      <div className="p-4 md:p-6 max-w-5xl">
        <Tabs defaultValue="manager">
          <TabsList className="mb-6">
            <TabsTrigger value="manager" data-testid="tab-sku-manager">SKU Manager</TabsTrigger>
            <TabsTrigger value="catalogue" data-testid="tab-sku-catalogue">
              SKU Catalogue
              <Badge variant="secondary" className="ml-2 text-xs">{catalogue.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* ── SKU Manager Tab ─────────────────────────────────────────── */}
          <TabsContent value="manager" className="space-y-8">

            {/* Equipment Packs */}
            <section>
              <h2 className="text-base font-semibold mb-3">Equipment Packs</h2>
              <div className="rounded-lg border divide-y">
                {kits.length === 0 && (
                  <p className="text-sm text-muted-foreground p-4">No packs found.</p>
                )}
                {kits.map(kit => (
                  <ItemRow
                    key={kit.id}
                    name={kit.name}
                    subtitle={bomCount(kit) > 0 ? `${bomCount(kit)} BOM component${bomCount(kit) !== 1 ? "s" : ""}` : undefined}
                    sku={kit.sku}
                    costPrice={kit.costPrice ?? null}
                    bomCount={bomCount(kit)}
                    canEdit={canEdit}
                    onSkuSave={sku => updateKitSku.mutate({ id: kit.id, sku })}
                    onCostPriceSave={costPrice => updateKitCostPrice.mutate({ id: kit.id, costPrice })}
                    onBomClick={() => openBom("kit", kit)}
                    isSavingSku={updateKitSku.isPending}
                    isSavingCostPrice={updateKitCostPrice.isPending}
                    stockQty={kit.sku ? (stockLevels[kit.sku]?.stockQty ?? null) : undefined}
                  />
                ))}
              </div>
            </section>

            {/* Upgrades & Options */}
            <section>
              <h2 className="text-base font-semibold mb-3">Upgrades &amp; Options</h2>
              <div className="rounded-lg border divide-y">

                {/* Simple upgrades (no parent, no variants) */}
                {simples.map(u => (
                  <ItemRow
                    key={u.id}
                    name={u.name}
                    subtitle={bomCount(u) > 0 ? `${bomCount(u)} BOM component${bomCount(u) !== 1 ? "s" : ""}` : undefined}
                    sku={u.sku}
                    costPrice={u.costPrice ?? null}
                    bomCount={bomCount(u)}
                    canEdit={canEdit}
                    onSkuSave={sku => updateUpgradeSku.mutate({ id: u.id, sku })}
                    onCostPriceSave={costPrice => updateUpgradeCostPrice.mutate({ id: u.id, costPrice })}
                    onBomClick={() => openBom("upgrade", u)}
                    isSavingSku={updateUpgradeSku.isPending}
                    isSavingCostPrice={updateUpgradeCostPrice.isPending}
                    stockQty={u.sku ? (stockLevels[u.sku]?.stockQty ?? null) : undefined}
                  />
                ))}

                {/* Parent groups with their variant children */}
                {parentGroups.map(parent => {
                  const children = variantChildren.filter(v => (v as any).parentId === parent.id);
                  return (
                    <div key={parent.id}>
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/40">
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <p className="text-sm font-medium text-muted-foreground flex-1 truncate">
                          {parent.name}
                        </p>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          Group — see variants
                        </Badge>
                      </div>

                      {children.map(v => (
                        <ItemRow
                          key={v.id}
                          name={v.name}
                          subtitle={bomCount(v) > 0 ? `${bomCount(v)} BOM component${bomCount(v) !== 1 ? "s" : ""}` : undefined}
                          sku={v.sku}
                          costPrice={v.costPrice ?? null}
                          bomCount={bomCount(v)}
                          canEdit={canEdit}
                          onSkuSave={sku => updateUpgradeSku.mutate({ id: v.id, sku })}
                          onCostPriceSave={costPrice => updateUpgradeCostPrice.mutate({ id: v.id, costPrice })}
                          onBomClick={() => openBom("upgrade", v)}
                          isSavingSku={updateUpgradeSku.isPending}
                          isSavingCostPrice={updateUpgradeCostPrice.isPending}
                          indented
                          stockQty={v.sku ? (stockLevels[v.sku]?.stockQty ?? null) : undefined}
                        />
                      ))}

                      {children.length === 0 && (
                        <p className="text-xs text-muted-foreground pl-10 pr-4 py-2.5 border-t italic">
                          No variants defined.
                        </p>
                      )}
                    </div>
                  );
                })}

                {simples.length === 0 && parentGroups.length === 0 && (
                  <p className="text-sm text-muted-foreground p-4">No upgrades found.</p>
                )}
              </div>
            </section>
          </TabsContent>

          {/* ── SKU Catalogue Tab ───────────────────────────────────────── */}
          <TabsContent value="catalogue">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search SKUs, descriptions, or items…"
                    value={catalogueSearch}
                    onChange={e => setCatalogueSearch(e.target.value)}
                    className="pl-8"
                    data-testid="input-sku-catalogue-search"
                  />
                </div>
                <span className="text-sm text-muted-foreground">
                  {filteredCatalogue.length} of {catalogue.length} SKUs
                </span>
              </div>
              {filteredCatalogue.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Click the <QrCode className="inline w-3.5 h-3.5 mx-0.5 -mt-0.5" /> icon on any row to print a QR label for that part.
                </p>
              )}

              {catalogue.length === 0 ? (
                <div className="rounded-lg border p-8 text-center text-muted-foreground">
                  <p className="font-medium mb-1">No SKUs assigned yet</p>
                  <p className="text-sm">Use "Generate Missing SKUs" to auto-assign codes to all your products.</p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm" data-testid="table-sku-catalogue">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground w-36">SKU</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground">Description</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground w-32">Type</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground hidden md:table-cell">Source Item</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground hidden md:table-cell">Cost Price</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground hidden md:table-cell">Stock</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredCatalogue.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                            No SKUs match your search.
                          </td>
                        </tr>
                      ) : (
                        filteredCatalogue.map((entry, i) => (
                          <tr key={i} className="hover-elevate" data-testid={`row-sku-${i}`}>
                            <td className="px-4 py-2.5 font-mono text-xs font-semibold tracking-wide">
                              {entry.sku}
                            </td>
                            <td className="px-4 py-2.5 text-sm">
                              {entry.description}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${typeBadgeClass(entry.type)}`}>
                                {entry.type}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell truncate max-w-48">
                              {entry.source}
                            </td>
                            <td className="px-4 py-2.5 text-xs hidden md:table-cell tabular-nums">
                              {entry.costPrice != null
                                ? <span className="text-foreground">£{(entry.costPrice / 100).toFixed(2)}</span>
                                : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-2.5 hidden md:table-cell">
                              <StockBadge qty={entry.sku ? (stockLevels[entry.sku]?.stockQty ?? null) : undefined} />
                            </td>
                            <td className="px-2 py-1 text-center">
                              <button
                                type="button"
                                title={`QR label for ${entry.sku}`}
                                onClick={() => setQrLabelItem({ sku: entry.sku, description: entry.description })}
                                className="inline-flex items-center justify-center w-7 h-7 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                                data-testid={`button-print-qr-${i}`}
                              >
                                <QrCode className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* BOM dialog */}
      {bomDialog && (
        <BomDialog
          open
          onOpenChange={v => { if (!v) setBomDialog(null); }}
          title={bomDialog.name}
          initialComponents={bomDialog.components}
          onSave={saveBom}
          isSaving={updateKitBom.isPending || updateUpgradeBom.isPending}
          catalogue={catalogue}
        />
      )}

      {/* QR label modal — preview + Download PNG + optional print */}
      <Dialog open={!!qrLabelItem} onOpenChange={v => { if (!v) setQrLabelItem(null); }}>
        <DialogContent className="max-w-xs text-center">
          <DialogHeader>
            <DialogTitle>QR Label</DialogTitle>
            <DialogDescription>
              Scan this code with the workshop scanner to deduct stock.
            </DialogDescription>
          </DialogHeader>
          {qrLabelItem && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="rounded-md border bg-white p-3">
                <QRCodeCanvas
                  ref={qrCanvasRef}
                  value={qrLabelItem.sku}
                  size={192}
                  marginSize={1}
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>
              <p className="font-mono text-sm font-semibold tracking-wide">{qrLabelItem.sku}</p>
              {qrLabelItem.description && (
                <p className="text-xs text-muted-foreground max-w-[200px] text-center">{qrLabelItem.description}</p>
              )}
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button size="sm" variant="outline" onClick={downloadQrPng} className="w-full sm:w-auto" data-testid="button-download-qr-png">
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download PNG
            </Button>
            <Button size="sm" onClick={() => setQrLabelItem(null)} className="w-full sm:w-auto">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV import results */}
      <ImportResultsDialog
        open={importResultOpen}
        onOpenChange={setImportResultOpen}
        result={importResult}
      />
    </>
  );
}
