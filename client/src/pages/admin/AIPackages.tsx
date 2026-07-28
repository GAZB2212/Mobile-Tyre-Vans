import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { ArrowLeft, Pencil, Check, Package2, Layers, ChevronDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Upgrade } from "@shared/schema";

interface AiPackage {
  id: string;
  name: string;
  tier: number;
  description: string | null;
  recommended_for: string | null;
  upgrade_ids: string[];
  active: boolean;
}

const TIER_COLORS: Record<string, { badge: string; border: string; heading: string }> = {
  bronze: {
    badge: "bg-[#cd7f32]/20 text-[#cd7f32] border-[#cd7f32]/30",
    border: "border-[#cd7f32]/40",
    heading: "text-[#cd7f32]",
  },
  silver: {
    badge: "bg-[#aaa]/20 text-[#bbb] border-[#aaa]/30",
    border: "border-[#aaa]/40",
    heading: "text-[#bbb]",
  },
  gold: {
    badge: "bg-[#d4af37]/20 text-[#d4af37] border-[#d4af37]/30",
    border: "border-[#d4af37]/40",
    heading: "text-[#d4af37]",
  },
};

interface UpgradeGroup {
  parent: Upgrade;
  variants: Upgrade[];
}

interface CategorySection {
  groups: UpgradeGroup[];
  standalones: Upgrade[];
}

function buildGroups(upgrades: Upgrade[]): Record<string, CategorySection> {
  const parentIdSet = new Set(upgrades.map(u => u.parentId).filter(Boolean) as string[]);
  const variantMap = new Map<string, Upgrade[]>();

  for (const u of upgrades) {
    if (u.parentId) {
      if (!variantMap.has(u.parentId)) variantMap.set(u.parentId, []);
      variantMap.get(u.parentId)!.push(u);
    }
  }

  const categoryMap: Record<string, CategorySection> = {};
  const ensureCat = (cat: string) => {
    if (!categoryMap[cat]) categoryMap[cat] = { groups: [], standalones: [] };
  };

  for (const u of upgrades) {
    if (!u.parentId && parentIdSet.has(u.id)) {
      const cat = u.category ?? "Other";
      ensureCat(cat);
      categoryMap[cat].groups.push({ parent: u, variants: variantMap.get(u.id) ?? [] });
    } else if (!u.parentId && !parentIdSet.has(u.id)) {
      const cat = u.category ?? "Other";
      ensureCat(cat);
      categoryMap[cat].standalones.push(u);
    }
  }

  return categoryMap;
}

function getSelectedVariantForGroup(group: UpgradeGroup, selectedIds: string[]): string | null {
  for (const v of group.variants) {
    if (selectedIds.includes(v.id)) return v.id;
  }
  return null;
}

export default function AdminAIPackages() {
  const { toast } = useToast();
  const [editingPackage, setEditingPackage] = useState<AiPackage | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editRecommendedFor, setEditRecommendedFor] = useState("");
  const [editUpgradeIds, setEditUpgradeIds] = useState<string[]>([]);

  const { data: packages, isLoading: packagesLoading } = useQuery<AiPackage[]>({
    queryKey: ["/api/admin/ai-packages"],
  });

  const { data: upgrades, isLoading: upgradesLoading } = useQuery<Upgrade[]>({
    queryKey: ["/api/upgrades"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AiPackage> & { recommendedFor?: string } }) => {
      const res = await apiRequest("PATCH", `/api/admin/ai-packages/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-packages"] });
      toast({ title: "Package updated" });
      setEditingPackage(null);
    },
    onError: () => {
      toast({ title: "Update failed", variant: "destructive" });
    },
  });

  const openEdit = (pkg: AiPackage) => {
    setEditingPackage(pkg);
    setEditDescription(pkg.description ?? "");
    setEditRecommendedFor(pkg.recommended_for ?? "");
    setEditUpgradeIds([...pkg.upgrade_ids]);
  };

  const toggleStandalone = (id: string) => {
    setEditUpgradeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectVariant = (group: UpgradeGroup, variantId: string) => {
    const variantIds = group.variants.map(v => v.id);
    if (variantId === "__none__") {
      setEditUpgradeIds(prev => prev.filter(x => !variantIds.includes(x)));
    } else {
      setEditUpgradeIds(prev => [...prev.filter(x => !variantIds.includes(x)), variantId]);
    }
  };

  const handleSave = () => {
    if (!editingPackage) return;
    updateMutation.mutate({
      id: editingPackage.id,
      data: {
        description: editDescription,
        recommendedFor: editRecommendedFor,
        upgradeIds: editUpgradeIds,
      },
    });
  };

  const categoryMap = upgrades ? buildGroups(upgrades) : {};

  const isLoading = packagesLoading || upgradesLoading;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="sm" data-testid="button-back-admin">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Admin
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-muted-foreground" />
              <div>
                <h1 className="text-xl font-semibold leading-none">AI Packages</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Configure the Bronze, Silver and Gold tiers the AI recommends
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader><div className="h-6 bg-muted rounded w-1/3" /></CardHeader>
                <CardContent><div className="h-24 bg-muted rounded" /></CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <p className="text-muted-foreground text-sm mb-6 max-w-2xl">
              The AI assistant recommends one of these three packages based on each customer's workload and situation.
              Adjust the upgrades included in each tier and the guidance shown to the AI below.
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              {packages?.map(pkg => {
                const colors = TIER_COLORS[pkg.id] ?? TIER_COLORS.silver;
                const includedUpgrades = pkg.upgrade_ids.map(uid =>
                  upgrades?.find(u => u.id === uid)
                ).filter(Boolean) as Upgrade[];

                return (
                  <Card key={pkg.id} className={`border ${colors.border} flex flex-col`} data-testid={`card-package-${pkg.id}`}>
                    <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Package2 className="w-4 h-4 text-muted-foreground" />
                          <CardTitle className={`text-lg ${colors.heading}`}>{pkg.name}</CardTitle>
                        </div>
                        <Badge variant="outline" className={`text-xs ${colors.badge}`}>
                          Tier {pkg.tier}
                        </Badge>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(pkg)}
                            data-testid={`button-edit-package-${pkg.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit package</TooltipContent>
                      </Tooltip>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-4">
                      {pkg.description && (
                        <p className="text-sm text-muted-foreground">{pkg.description}</p>
                      )}
                      {pkg.recommended_for && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Recommended for</p>
                          <p className="text-sm">{pkg.recommended_for}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                          Upgrades included ({includedUpgrades.length})
                        </p>
                        {includedUpgrades.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">No upgrades configured</p>
                        ) : (
                          <ul className="space-y-1">
                            {includedUpgrades.map(u => (
                              <li key={u.id} className="flex items-center gap-2 text-sm">
                                <Check className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                                <span>{u.variantName ? `${upgrades?.find(p => p.id === u.parentId)?.name ?? u.name} — ${u.variantName}` : u.name}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Dialog open={!!editingPackage} onOpenChange={open => { if (!open) setEditingPackage(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit {editingPackage?.name} Package
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            <div className="space-y-2">
              <Label htmlFor="pkg-description">Description</Label>
              <Textarea
                id="pkg-description"
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                rows={3}
                placeholder="Short description shown in the admin panel"
                data-testid="input-package-description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pkg-recommended">Recommended for (shown to AI as guidance)</Label>
              <Textarea
                id="pkg-recommended"
                value={editRecommendedFor}
                onChange={e => setEditRecommendedFor(e.target.value)}
                rows={3}
                placeholder="e.g. Growing operations, 10–20 jobs per day…"
                data-testid="input-package-recommended"
              />
            </div>

            <div className="space-y-3">
              <Label>Upgrades included in this package</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Select the upgrades that form this package. The AI will set these exactly when recommending this tier.
              </p>
              {upgradesLoading ? (
                <p className="text-sm text-muted-foreground">Loading upgrades…</p>
              ) : (
                <div className="space-y-5">
                  {Object.entries(categoryMap).sort().map(([category, section]) => {
                    const hasContent = section.groups.length > 0 || section.standalones.length > 0;
                    if (!hasContent) return null;
                    return (
                      <div key={category}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{category}</p>
                        <div className="space-y-3 pl-1">

                          {/* Variant groups — show as dropdown */}
                          {section.groups.map(group => {
                            const selectedVariantId = getSelectedVariantForGroup(group, editUpgradeIds);
                            return (
                              <div key={group.parent.id} className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{group.parent.name}</span>
                                  {group.parent.popular && (
                                    <Badge variant="outline" className="text-[10px] py-0">Popular</Badge>
                                  )}
                                </div>
                                <Select
                                  value={selectedVariantId ?? "__none__"}
                                  onValueChange={val => selectVariant(group, val)}
                                >
                                  <SelectTrigger
                                    className="h-8 text-sm w-full"
                                    data-testid={`select-variant-${group.parent.id}`}
                                  >
                                    <SelectValue placeholder="Not included" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">Not included</SelectItem>
                                    {group.variants.map(v => (
                                      <SelectItem key={v.id} value={v.id}>
                                        {v.variantName || v.name}
                                        {v.popular && " ★"}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          })}

                          {/* Standalone upgrades — show as checkboxes */}
                          {section.standalones.map(u => (
                            <div key={u.id} className="flex items-start gap-2" data-testid={`checkbox-upgrade-${u.id}`}>
                              <Checkbox
                                id={`pkg-upgrade-${u.id}`}
                                checked={editUpgradeIds.includes(u.id)}
                                onCheckedChange={() => toggleStandalone(u.id)}
                                className="mt-0.5"
                              />
                              <div>
                                <label
                                  htmlFor={`pkg-upgrade-${u.id}`}
                                  className="text-sm leading-none cursor-pointer"
                                >
                                  {u.name}
                                </label>
                                {u.popular && (
                                  <Badge variant="outline" className="ml-2 text-[10px] py-0">Popular</Badge>
                                )}
                              </div>
                            </div>
                          ))}

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingPackage(null)} data-testid="button-cancel-edit">
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                data-testid="button-save-package"
                className="bg-accent/90 text-accent-foreground hover:bg-accent"
              >
                {updateMutation.isPending ? "Saving…" : "Save Package"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
