import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";
import type { StockItem } from "@shared/schema";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Package,
  Search,
  Plus,
  Pencil,
  TrendingDown,
  History,
  RefreshCw,
  ListChecks,
  X,
  Sparkles,
  ClipboardList,
} from "lucide-react";
import { QrScannerModal } from "@/components/QrScannerModal";
import { useLocation } from "wouter";

interface BomSyncEntry {
  id: string;
  syncedAt: string;
  skusImported: number;
  triggeredBy: string | null;
  errorMessage: string | null;
}

function StockBadge({ item }: { item: StockItem }) {
  const isLow = item.lowStockThreshold != null && item.onHand <= item.lowStockThreshold;
  const isEmpty = item.onHand === 0;
  if (isEmpty) return <Badge className="bg-red-600 text-white no-default-active-elevate">Out of stock</Badge>;
  if (isLow) return <Badge className="bg-amber-500 text-white no-default-active-elevate">Low stock</Badge>;
  return <Badge variant="outline" className="text-green-600 border-green-500 no-default-active-elevate">In stock</Badge>;
}

interface EditDialogProps {
  item: StockItem | null;
  open: boolean;
  onClose: () => void;
}

function EditStockDialog({ item, open, onClose }: EditDialogProps) {
  const { toast } = useToast();
  const isNew = !item;

  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [onHand, setOnHand] = useState("0");
  const [threshold, setThreshold] = useState("");

  // Sync local state whenever the dialog opens or the target item changes
  useEffect(() => {
    if (open) {
      setSku(item?.sku ?? "");
      setDescription(item?.description ?? "");
      setOnHand(String(item?.onHand ?? 0));
      setThreshold(item?.lowStockThreshold != null ? String(item.lowStockThreshold) : "");
    }
  }, [open, item]);

  const mutation = useMutation({
    mutationFn: async () => {
      const targetSku = isNew ? sku.trim() : item!.sku;
      if (!targetSku) throw new Error("SKU is required");
      const body: Record<string, any> = {
        description: description.trim(),
        onHand: Number(onHand) || 0,
        lowStockThreshold: threshold.trim() !== "" ? Number(threshold) : null,
      };
      return apiRequest("PUT", `/api/admin/stock/${encodeURIComponent(targetSku)}`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stock/low-stock-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stock/sync-from-bom/preview"] });
      toast({ title: isNew ? "Stock item created" : "Stock item updated" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add stock item" : `Edit ${item?.sku}`}</DialogTitle>
          <DialogDescription>
            {isNew ? "Add a new part to the stock tracking system." : "Update on-hand quantity and low stock threshold."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {isNew && (
            <div>
              <label className="text-sm font-medium">SKU</label>
              <Input
                value={sku}
                onChange={e => setSku(e.target.value)}
                placeholder="e.g. MTV-P-T1000"
                className="mt-1"
                data-testid="input-stock-sku"
              />
            </div>
          )}
          <div>
            <label className="text-sm font-medium">Description</label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Tyre Machine Motor Belt"
              className="mt-1"
              data-testid="input-stock-description"
            />
          </div>
          <div>
            <label className="text-sm font-medium">On-hand quantity</label>
            <Input
              type="number"
              min={0}
              value={onHand}
              onChange={e => setOnHand(e.target.value)}
              className="mt-1"
              data-testid="input-stock-on-hand"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Low stock threshold <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input
              type="number"
              min={0}
              value={threshold}
              onChange={e => setThreshold(e.target.value)}
              placeholder="e.g. 2 — leave blank to disable warning"
              className="mt-1"
              data-testid="input-stock-threshold"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            data-testid="button-save-stock-item"
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function StockLevels() {
  const { toast } = useToast();
  const { user } = useAuth() as { user: User | undefined };
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<StockItem | null | "new">(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<StockItem | null>(null);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncThreshold, setSyncThreshold] = useState("2");
  const [newlyImportedSkus, setNewlyImportedSkus] = useState<Set<string>>(new Set());
  const [showNewOnly, setShowNewOnly] = useState(false);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [syncHistoryOpen, setSyncHistoryOpen] = useState(false);

  // Bulk threshold edit state
  const [bulkEditMode, setBulkEditMode] = useState(false);
  // Map of sku -> draft threshold string (only tracks edited rows)
  const [bulkDrafts, setBulkDrafts] = useState<Record<string, string>>({});

  // Stock levels are a full-admin feature
  const isFullAdmin = user?.adminRole === "full";

  useEffect(() => {
    if (user && !isFullAdmin) {
      navigate("/admin");
    }
  }, [user, isFullAdmin, navigate]);

  const { data: items = [], isLoading } = useQuery<StockItem[]>({
    queryKey: ["/api/admin/stock"],
    enabled: isFullAdmin,
  });

  const { data: bomPreview } = useQuery<{ totalBomSkus: number; alreadyTracked: number; newSkus: number }>({
    queryKey: ["/api/admin/stock/sync-from-bom/preview"],
    enabled: isFullAdmin,
  });

  const { data: bomSyncHistory = [] } = useQuery<BomSyncEntry[]>({
    queryKey: ["/api/admin/stock/bom-sync-history"],
    enabled: isFullAdmin,
  });

  const lastSync = bomSyncHistory[0] ?? null;

  const { data: historyData = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/stock", historyItem?.sku, "history"],
    queryFn: () =>
      fetch(`/api/admin/stock/${encodeURIComponent(historyItem!.sku)}/history?limit=30`, { credentials: "include" }).then(r => r.json()),
    enabled: !!historyItem,
  });

  const deductMutation = useMutation({
    mutationFn: async ({ sku, quantity }: { sku: string; quantity: number }) =>
      apiRequest("POST", `/api/admin/stock/${encodeURIComponent(sku)}/deduct`, { quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stock/low-stock-count"] });
      toast({ title: "Stock deducted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const syncMutation = useMutation({
    mutationFn: async (defaultThreshold: number) => {
      const res = await apiRequest("POST", "/api/admin/stock/sync-from-bom", { defaultThreshold });
      return res.json() as Promise<{ synced: number; newSkus: string[] }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stock/low-stock-count"] });
      setSyncDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stock/sync-from-bom/preview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stock/bom-sync-history"] });

      if (data.synced > 0 && data.newSkus?.length) {
        const skuSet = new Set(data.newSkus);
        setNewlyImportedSkus(skuSet);
        setShowNewOnly(true);
        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = setTimeout(() => {
          setNewlyImportedSkus(new Set());
          setShowNewOnly(false);
        }, 5 * 60 * 1000);
      }

      toast({
        title: data.synced > 0 ? `${data.synced} new SKU${data.synced !== 1 ? "s" : ""} imported` : "Stock already up to date",
        description: data.synced > 0 ? "New BOM components added at 0 on-hand. Showing new items only." : "All BOM SKUs already have stock records.",
      });
    },
    onError: (err: any) => toast({ title: "Sync failed", description: err.message, variant: "destructive" }),
  });

  const bulkSaveMutation = useMutation({
    mutationFn: async (updates: { sku: string; threshold: number | null }[]) => {
      const res = await apiRequest("POST", "/api/admin/stock/bulk-thresholds", { updates });
      return res.json() as Promise<{ updated: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stock/low-stock-count"] });
      setBulkEditMode(false);
      setBulkDrafts({});
      toast({
        title: `${data.updated} threshold${data.updated !== 1 ? "s" : ""} saved`,
        description: "Low stock thresholds updated successfully.",
      });
    },
    onError: (err: any) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    let list = items;
    if (showNewOnly && newlyImportedSkus.size > 0) {
      list = list.filter(i => newlyImportedSkus.has(i.sku));
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(i => i.sku.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
  }, [items, search, showNewOnly, newlyImportedSkus]);

  const lowCount = items.filter(i => i.lowStockThreshold != null && i.onHand <= i.lowStockThreshold).length;

  const handleScan = (sku: string) => {
    setScannerOpen(false);
    const item = items.find(i => i.sku === sku);
    if (!item) {
      toast({ title: "SKU not found", description: `No stock item found for "${sku}". Add it first.`, variant: "destructive" });
      return;
    }
    deductMutation.mutate({ sku, quantity: 1 });
  };

  const handleEnterBulkEdit = () => {
    // Initialise drafts from current data so every cell has a value
    const drafts: Record<string, string> = {};
    for (const item of items) {
      drafts[item.sku] = item.lowStockThreshold != null ? String(item.lowStockThreshold) : "";
    }
    setBulkDrafts(drafts);
    setBulkEditMode(true);
  };

  const handleCancelBulkEdit = () => {
    setBulkEditMode(false);
    setBulkDrafts({});
  };

  const handleBulkSaveAll = () => {
    // Only send rows where the draft value differs from the current stored value
    const updates: { sku: string; threshold: number | null }[] = [];
    for (const item of items) {
      const draft = bulkDrafts[item.sku] ?? "";
      const draftValue = draft.trim() === "" ? null : Number(draft);
      const current = item.lowStockThreshold ?? null;
      const changed = draftValue !== current;
      if (changed) {
        updates.push({ sku: item.sku, threshold: draftValue });
      }
    }
    if (updates.length === 0) {
      toast({ title: "No changes to save" });
      setBulkEditMode(false);
      setBulkDrafts({});
      return;
    }
    bulkSaveMutation.mutate(updates);
  };

  // Count pending changes for the save button label
  const pendingChanges = useMemo(() => {
    if (!bulkEditMode) return 0;
    let count = 0;
    for (const item of items) {
      const draft = bulkDrafts[item.sku] ?? "";
      const draftValue = draft.trim() === "" ? null : Number(draft);
      const current = item.lowStockThreshold ?? null;
      if (draftValue !== current) count++;
    }
    return count;
  }, [bulkEditMode, bulkDrafts, items]);

  if (!isFullAdmin && user) return null;

  return (
    <div className="min-h-full">
      <AdminPageHeader
        title="Stock Levels"
        description="Track on-hand quantities for BOM component parts"
        actions={
          <div className="flex gap-2 flex-wrap">
            {bulkEditMode ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelBulkEdit}
                  disabled={bulkSaveMutation.isPending}
                  data-testid="button-cancel-bulk-edit"
                >
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleBulkSaveAll}
                  disabled={bulkSaveMutation.isPending}
                  data-testid="button-save-all-thresholds"
                >
                  {bulkSaveMutation.isPending
                    ? "Saving…"
                    : pendingChanges > 0
                      ? `Save ${pendingChanges} change${pendingChanges !== 1 ? "s" : ""}`
                      : "Save all"}
                </Button>
              </>
            ) : (
              <>
                <div className="flex flex-col items-end gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSyncHistoryOpen(true)}
                      title="View sync history"
                      data-testid="button-bom-sync-history"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setSyncThreshold("2"); setSyncDialogOpen(true); }}
                      disabled={syncMutation.isPending}
                      data-testid="button-sync-from-bom"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                      Sync from BOM
                    </Button>
                  </div>
                  {lastSync && (
                    <p className="text-xs text-muted-foreground text-right" data-testid="text-last-sync">
                      Last sync{" "}
                      {new Date(lastSync.syncedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                      {" · "}
                      {lastSync.skusImported === 0 ? "no new SKUs" : `${lastSync.skusImported} SKU${lastSync.skusImported !== 1 ? "s" : ""} imported`}
                    </p>
                  )}
                  {bomPreview && (
                    <p
                      className="text-xs text-muted-foreground text-right"
                      data-testid="text-bom-preview"
                    >
                      {bomPreview.totalBomSkus === 0 ? (
                        <>No BOM components defined yet</>
                      ) : bomPreview.newSkus > 0 ? (
                        <>{bomPreview.newSkus} new &middot; {bomPreview.alreadyTracked} tracked &middot; {bomPreview.totalBomSkus} total in BOM</>
                      ) : (
                        <>All {bomPreview.totalBomSkus} BOM SKU{bomPreview.totalBomSkus !== 1 ? "s" : ""} tracked</>
                      )}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleEnterBulkEdit}
                  disabled={items.length === 0}
                  data-testid="button-edit-all-thresholds"
                >
                  <ListChecks className="w-3.5 h-3.5 mr-1.5" />
                  Edit all thresholds
                </Button>
                <Button size="sm" variant="outline" onClick={() => setScannerOpen(true)} data-testid="button-scan-stock">
                  <TrendingDown className="w-3.5 h-3.5 mr-1.5" />
                  Scan to deduct
                </Button>
                <Button size="sm" onClick={() => setEditItem("new")} data-testid="button-add-stock-item">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Add item
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="container mx-auto px-4 py-6 space-y-6">

        {lowCount > 0 && (
          <div className="flex items-center gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-sm">
              <strong>{lowCount}</strong> part{lowCount !== 1 ? "s are" : " is"} at or below the low stock threshold.
            </p>
          </div>
        )}

        {bulkEditMode && (
          <div className="flex items-center gap-3 rounded-md border border-blue-500/40 bg-blue-500/10 px-4 py-3">
            <ListChecks className="w-4 h-4 text-blue-500 shrink-0" />
            <p className="text-sm">
              <strong>Threshold edit mode</strong> — edit values inline below, then click <strong>Save</strong> to apply only changed rows. Tab through cells to move quickly.
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by SKU or description…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-stock-search"
            />
          </div>
          {newlyImportedSkus.size > 0 && (
            <Button
              size="sm"
              variant={showNewOnly ? "default" : "outline"}
              onClick={() => setShowNewOnly(v => !v)}
              data-testid="button-show-new-only"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              {showNewOnly ? `Showing ${newlyImportedSkus.size} new` : `Show new (${newlyImportedSkus.size})`}
            </Button>
          )}
          <Badge variant="outline" className="no-default-active-elevate">{items.length} items</Badge>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading stock data…</div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <Package className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">No stock items yet.</p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button size="sm" variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Sync from BOM catalogue
                </Button>
                <Button size="sm" onClick={() => setEditItem("new")}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Add manually
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No items match your search.</p>
        ) : (
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-base">Parts inventory</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">SKU</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground w-24">On hand</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground w-24 hidden sm:table-cell">
                        Threshold{bulkEditMode && <span className="text-blue-500 font-normal"> (editing)</span>}
                      </th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-28">Status</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-36 hidden lg:table-cell">Last updated</th>
                      <th className="px-3 py-2 w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, idx) => {
                      const isNew = newlyImportedSkus.has(item.sku);
                      const draftValue = bulkDrafts[item.sku] ?? "";
                      const draftNumeric = draftValue.trim() === "" ? null : Number(draftValue);
                      const isDirty = bulkEditMode && draftNumeric !== (item.lowStockThreshold ?? null);
                      return (
                        <tr
                          key={item.sku}
                          className={`border-b last:border-0 transition-colors ${isDirty ? "bg-blue-500/5" : isNew ? "bg-emerald-500/10 hover:bg-emerald-500/15" : "hover:bg-muted/30"}`}
                          data-testid={`row-stock-${item.sku}`}
                        >
                          <td className="px-3 py-2 font-mono text-xs">
                            <span className="flex items-center gap-1.5">
                              {isNew && <Sparkles className="w-3 h-3 text-emerald-500 shrink-0" aria-label="Newly imported" />}
                              {item.sku}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground max-w-xs truncate">{item.description || <span className="italic opacity-50">no description</span>}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">{item.onHand}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                            {bulkEditMode ? (
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                value={draftValue}
                                onChange={e => setBulkDrafts(prev => ({ ...prev, [item.sku]: e.target.value }))}
                                placeholder="—"
                                className={`h-7 w-20 ml-auto text-right text-xs px-2 ${isDirty ? "border-blue-400 ring-1 ring-blue-400/40" : ""}`}
                                data-testid={`input-bulk-threshold-${item.sku}`}
                                tabIndex={idx + 1}
                              />
                            ) : (
                              item.lowStockThreshold != null ? item.lowStockThreshold : <span className="opacity-40">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2"><StockBadge item={item} /></td>
                          <td className="px-3 py-2 text-xs text-muted-foreground hidden lg:table-cell">
                            {item.updatedAt
                              ? new Date(item.updatedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })
                              : <span className="opacity-40">—</span>}
                          </td>
                          <td className="px-3 py-2">
                            {!bulkEditMode && (
                              <div className="flex items-center gap-1 justify-end">
                                <Button size="icon" variant="ghost" title="View history" onClick={() => setHistoryItem(item)} data-testid={`button-history-${item.sku}`}>
                                  <History className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" title="Edit" onClick={() => setEditItem(item)} data-testid={`button-edit-stock-${item.sku}`}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {bulkEditMode && (
                <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
                  <p className="text-xs text-muted-foreground">
                    {pendingChanges > 0
                      ? `${pendingChanges} row${pendingChanges !== 1 ? "s" : ""} changed — leave a cell blank to remove the threshold.`
                      : "No changes yet. Edit the threshold column above."}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleCancelBulkEdit} disabled={bulkSaveMutation.isPending} data-testid="button-cancel-bulk-edit-footer">
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleBulkSaveAll}
                      disabled={bulkSaveMutation.isPending}
                      data-testid="button-save-all-thresholds-footer"
                    >
                      {bulkSaveMutation.isPending
                        ? "Saving…"
                        : pendingChanges > 0
                          ? `Save ${pendingChanges} change${pendingChanges !== 1 ? "s" : ""}`
                          : "Save all"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit / create dialog — keyed so state resets when target item changes */}
      <EditStockDialog
        key={editItem === "new" ? "new" : (editItem?.sku ?? "closed")}
        item={editItem === "new" ? null : editItem}
        open={editItem !== null}
        onClose={() => setEditItem(null)}
      />

      {/* QR scanner */}
      <QrScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        title="Scan to deduct stock"
        description="Scan a component QR label to deduct 1 unit from stock."
      />

      {/* Deduction history dialog */}
      <Dialog open={!!historyItem} onOpenChange={(v) => { if (!v) setHistoryItem(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Deduction history — {historyItem?.sku}</DialogTitle>
            <DialogDescription>Last 30 deductions for this SKU.</DialogDescription>
          </DialogHeader>
          {historyData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No deductions recorded yet.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-md border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">When</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qty</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Quote</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Item</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.map((d: any) => {
                    const itemRef = d.kitId
                      ? `Kit ${d.kitId.slice(0, 8)}`
                      : d.upgradeId
                      ? `Upgrade ${d.upgradeId.slice(0, 8)}`
                      : null;
                    return (
                      <tr key={d.id} className="border-b last:border-0">
                        <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                          {new Date(d.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">−{d.quantityDeducted}</td>
                        <td className="px-3 py-1.5">
                          {d.quoteId ? (
                            <a
                              href={`/admin/quotes/${d.quoteId}`}
                              className="text-blue-600 hover:underline font-mono"
                              title={d.buildSheetRef || d.quoteId}
                              data-testid={`link-history-quote-${d.id}`}
                            >
                              #{d.quoteId.slice(0, 8)}
                            </a>
                          ) : (
                            <span className="opacity-40">—</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground hidden sm:table-cell">
                          {itemRef ?? <span className="opacity-40">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setHistoryItem(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BOM sync history dialog */}
      <Dialog open={syncHistoryOpen} onOpenChange={setSyncHistoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>BOM sync history</DialogTitle>
            <DialogDescription>The last {bomSyncHistory.length} sync runs. Capped to 50 entries total.</DialogDescription>
          </DialogHeader>
          {bomSyncHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No syncs have been run yet.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-md border" data-testid="table-bom-sync-history">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">When</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">By</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">SKUs imported</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {bomSyncHistory.map((entry) => (
                    <tr key={entry.id} className="border-b last:border-0">
                      <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                        {new Date(entry.syncedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {entry.triggeredBy ?? <span className="italic">server startup</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {entry.skusImported === 0 && !entry.errorMessage ? (
                          <span className="text-muted-foreground">none</span>
                        ) : entry.errorMessage ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <Badge variant="outline" className="no-default-active-elevate text-xs">+{entry.skusImported}</Badge>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        {entry.errorMessage ? (
                          <span className="text-red-600 dark:text-red-400" title={entry.errorMessage}>
                            Error: {entry.errorMessage.length > 60 ? entry.errorMessage.slice(0, 60) + "…" : entry.errorMessage}
                          </span>
                        ) : entry.skusImported > 0 ? (
                          <span className="text-green-600 dark:text-green-400">Success</span>
                        ) : (
                          <span className="text-muted-foreground">No new SKUs</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              data-testid="button-bom-sync-history-download"
              onClick={async () => {
                const res = await fetch("/api/admin/stock/bom-sync-history?limit=50", { credentials: "include" });
                if (!res.ok) return;
                const entries: BomSyncEntry[] = await res.json();
                const rows = [
                  ["When", "Triggered By", "SKUs Imported", "Outcome"],
                  ...entries.map((entry) => [
                    new Date(entry.syncedAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }),
                    entry.triggeredBy ?? "server startup",
                    String(entry.skusImported),
                    entry.errorMessage ? `Error: ${entry.errorMessage}` : entry.skusImported > 0 ? "Success" : "No new SKUs",
                  ]),
                ];
                const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "bom-sync-history.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSyncHistoryOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sync from BOM — threshold dialog */}
      <Dialog open={syncDialogOpen} onOpenChange={(open) => { if (!syncMutation.isPending) setSyncDialogOpen(open); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sync from BOM</DialogTitle>
            <DialogDescription>
              New SKUs will be added with 0 on-hand. Set the low-stock threshold that should apply to any newly imported parts.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-1.5">
            <label htmlFor="sync-threshold" className="text-sm font-medium">
              Default low-stock threshold
            </label>
            <Input
              id="sync-threshold"
              type="number"
              min={0}
              step={1}
              value={syncThreshold}
              onChange={(e) => setSyncThreshold(e.target.value)}
              data-testid="input-sync-threshold"
              className="w-32"
            />
            {parseInt(syncThreshold, 10) > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                All new SKUs will start at 0 on-hand and will immediately show as low stock until stock is entered.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Existing stock records will not be changed.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSyncDialogOpen(false)} disabled={syncMutation.isPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const val = parseInt(syncThreshold, 10);
                syncMutation.mutate(isNaN(val) || val < 0 ? 2 : val);
              }}
              disabled={syncMutation.isPending}
              data-testid="button-confirm-sync"
            >
              {syncMutation.isPending ? "Syncing…" : "Sync"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
