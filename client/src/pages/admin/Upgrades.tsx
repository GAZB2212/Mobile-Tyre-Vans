import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AdminBackButton } from "@/components/AdminBackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminSwitch } from "@/components/AdminSwitch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, Package, GripVertical, ArrowUp, ArrowDown, Barcode, ChevronDown as ChevronDownIcon, Check, ClipboardList, Copy, Tags, Pencil, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import type { Upgrade, Kit } from "@shared/schema";
import { insertUpgradeSchema } from "@shared/schema";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { UpgradeImageUploader } from "@/components/UpgradeImageUploader";
import { UpgradeVideoUploader } from "@/components/UpgradeVideoUploader";
import { useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Human-readable labels for upgrade categories (fallback for DB-driven labels)
const CATEGORY_LABELS: Record<string, string> = {
  "air-systems": "Air Systems",
  "equipment": "Equipment",
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

// Form validation schema - extend shared schema for price conversion
const upgradeFormSchema = insertUpgradeSchema.omit({ price: true, costPrice: true }).extend({
  price: z.string().optional(),
  costPrice: z.string().optional().nullable(),
  detailedInfo: z.string().optional().nullable(),
  videoUrl: z.string().optional().nullable(),
  showVideo: z.boolean().optional(),
  parentId: z.string().optional().nullable(),
  variantName: z.string().optional().nullable(),
  hasVariants: z.boolean().optional(),
  allowQuantity: z.boolean().optional(),
  popular: z.boolean().optional(),
  forCommercial: z.boolean().optional(),
  carOnly: z.boolean().optional(),
  hideForHybrid: z.boolean().optional(),
  supersedesKitItems: z.string().optional(), // newline-separated in the form, converted to array on submit
  exclusiveGroup: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  skuComponents: z.array(z.object({ sku: z.string(), description: z.string(), quantity: z.number().min(1), costPrice: z.number().optional().nullable() })).optional().nullable(),
});

type UpgradeFormData = z.infer<typeof upgradeFormSchema>;

// Variant type for UI management
type VariantOption = {
  id?: string;
  name: string;
  price: string;
  costPrice: string;
  description: string;
  images: string[];
};

// Helper function to convert pounds to pence
const poundsToPence = (pounds: string): number => {
  const num = parseFloat(pounds);
  return isNaN(num) ? 0 : Math.round(num * 100);
};

// Helper function to convert pence to pounds
const penceToPounds = (pence: number): string => {
  return (pence / 100).toFixed(2);
};

// Sortable Card Component
interface SortableUpgradeCardProps {
  upgrade: Upgrade;
  onEdit: (upgrade: Upgrade) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  hasVariants?: boolean;
  variants?: Upgrade[];
}

function SortableUpgradeCard({ upgrade, onEdit, onDelete, isDeleting, hasVariants, variants = [] }: SortableUpgradeCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: upgrade.id });

  const [bomOpen, setBomOpen] = useState(false);
  const [variantBomOpen, setVariantBomOpen] = useState<Set<string>>(new Set());
  const [copiedSkuId, setCopiedSkuId] = useState<string | null>(null);
  const [copiedBomPartKey, setCopiedBomPartKey] = useState<string | null>(null);
  const [copiedAllBomKey, setCopiedAllBomKey] = useState<string | null>(null);
  const [copiedAllBomDescKey, setCopiedAllBomDescKey] = useState<string | null>(null);
  const [copiedBomDescKey, setCopiedBomDescKey] = useState<string | null>(null);

  const { toast } = useToast();

  const handleCopySku = (id: string, sku: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sku).then(() => {
      setCopiedSkuId(id);
      setTimeout(() => setCopiedSkuId(null), 1500);
    }).catch(() => {
      toast({ title: "Could not copy SKU", description: "Please copy it manually.", variant: "destructive" });
    });
  };

  const handleCopyBomPartSku = (key: string, sku: string) => {
    navigator.clipboard.writeText(sku).then(() => {
      setCopiedBomPartKey(key);
      setTimeout(() => setCopiedBomPartKey(null), 1500);
    }).catch(() => {
      toast({ title: "Could not copy SKU", description: "Please copy it manually.", variant: "destructive" });
    });
  };

  const handleCopyAllBomSkus = (key: string, parts: { sku: string }[]) => {
    const skus = parts.map(p => p.sku).filter(Boolean).join('\n');
    navigator.clipboard.writeText(skus).then(() => {
      setCopiedAllBomKey(key);
      setTimeout(() => setCopiedAllBomKey(null), 1500);
    }).catch(() => {
      toast({ title: "Could not copy SKUs", description: "Please copy them manually.", variant: "destructive" });
    });
  };

  const handleCopyAllBomDescs = (key: string, parts: { description: string }[]) => {
    const descs = parts.map(p => p.description).filter(Boolean).join('\n');
    navigator.clipboard.writeText(descs).then(() => {
      setCopiedAllBomDescKey(key);
      setTimeout(() => setCopiedAllBomDescKey(null), 1500);
    }).catch(() => {
      toast({ title: "Could not copy descriptions", description: "Please copy them manually.", variant: "destructive" });
    });
  };

  const handleCopyBomPartDesc = (key: string, description: string) => {
    navigator.clipboard.writeText(description).then(() => {
      setCopiedBomDescKey(key);
      setTimeout(() => setCopiedBomDescKey(null), 1500);
    }).catch(() => {
      toast({ title: "Could not copy description", description: "Please copy it manually.", variant: "destructive" });
    });
  };

  const toggleVariantBom = (id: string) => {
    setVariantBomOpen(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const upgradeSku = upgrade.sku;
  const upgradeSkuComponents = upgrade.skuComponents;

  return (
    <Card ref={setNodeRef} style={style} className="hover-elevate">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
                data-testid={`handle-drag-${upgrade.id}`}
              >
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent>Drag to reorder</TooltipContent>
          </Tooltip>
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg" data-testid={`text-upgrade-name-${upgrade.id}`}>
                {upgrade.name}
              </CardTitle>
              {hasVariants && (
                <Badge variant="secondary" className="text-xs">
                  {variants.length} Variants
                </Badge>
              )}
            </div>
            {upgradeSku && (
              <Badge
                variant="outline"
                className="font-mono text-xs gap-1 w-fit cursor-pointer select-none"
                data-testid={`badge-upgrade-sku-${upgrade.id}`}
                onClick={(e) => handleCopySku(upgrade.id, upgradeSku, e)}
                title="Click to copy SKU"
              >
                {copiedSkuId === upgrade.id ? (
                  <>
                    <Check className="w-3 h-3" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Barcode className="w-3 h-3" />
                    {upgradeSku}
                  </>
                )}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center flex-shrink-0">
          {upgrade.published ? (
            <Badge variant="default" data-testid={`badge-upgrade-published-${upgrade.id}`}>
              Published
            </Badge>
          ) : (
            <Badge variant="secondary" data-testid={`badge-upgrade-draft-${upgrade.id}`}>
              Draft
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-upgrade-description-${upgrade.id}`}>
            {upgrade.description}
          </p>
          
          {/* Show variants nested under parent */}
          {hasVariants && variants.length > 0 && (
            <div className="mt-3 space-y-2 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">Variants:</p>
              {variants.map((variant) => (
                <div key={variant.id} className="bg-muted/50 rounded p-2 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                      <Badge variant="outline" className="text-xs flex-shrink-0">
                        {variant.variantName}
                      </Badge>
                      <span className="text-sm font-semibold">
                        £{penceToPounds(variant.price)}
                      </span>
                      {variant.sku && (
                        <Badge
                          variant="outline"
                          className="font-mono text-xs gap-1 flex-shrink-0 cursor-pointer select-none"
                          data-testid={`badge-variant-sku-${variant.id}`}
                          onClick={(e) => handleCopySku(variant.id, variant.sku!, e)}
                          title="Click to copy SKU"
                        >
                          {copiedSkuId === variant.id ? (
                            <>
                              <Check className="w-3 h-3" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Barcode className="w-3 h-3" />
                              {variant.sku}
                            </>
                          )}
                        </Badge>
                      )}
                    </div>
                    <div className="flex space-x-1 flex-shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onEdit(variant)}
                            data-testid={`button-edit-variant-${variant.id}`}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit variant</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  {variant.skuComponents && variant.skuComponents.length > 0 && (
                    <div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => toggleVariantBom(variant.id)}
                          data-testid={`button-variant-bom-toggle-${variant.id}`}
                        >
                          <ChevronDownIcon className={`w-3 h-3 transition-transform ${variantBomOpen.has(variant.id) ? "" : "-rotate-90"}`} />
                          View BOM ({variant.skuComponents.length} {variant.skuComponents.length === 1 ? "part" : "parts"})
                        </button>
                        <button
                          type="button"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => handleCopyAllBomSkus(`variant-all-${variant.id}`, variant.skuComponents!)}
                          data-testid={`button-variant-bom-copy-all-${variant.id}`}
                          title="Copy all part SKUs to clipboard"
                        >
                          {copiedAllBomKey === `variant-all-${variant.id}` ? (
                            <>
                              <Check className="w-3 h-3 text-green-600" />
                              <span className="text-green-600">Copied {variant.skuComponents.length} SKUs!</span>
                            </>
                          ) : (
                            <>
                              <ClipboardList className="w-3 h-3" />
                              Copy all SKUs
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => handleCopyAllBomDescs(`variant-all-${variant.id}`, variant.skuComponents!)}
                          data-testid={`button-variant-bom-copy-all-descs-${variant.id}`}
                          title="Copy all part descriptions to clipboard"
                        >
                          {copiedAllBomDescKey === `variant-all-${variant.id}` ? (
                            <>
                              <Check className="w-3 h-3 text-green-600" />
                              <span className="text-green-600">Copied {variant.skuComponents.length} descriptions!</span>
                            </>
                          ) : (
                            <>
                              <ClipboardList className="w-3 h-3" />
                              Copy all descriptions
                            </>
                          )}
                        </button>
                      </div>
                      {variantBomOpen.has(variant.id) && (
                        <div className="mt-1.5 rounded-md border bg-background overflow-hidden" data-testid={`table-variant-bom-${variant.id}`}>
                          <table className="w-full text-xs table-fixed">
                            <thead>
                              <tr className="border-b bg-muted/60">
                                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground w-28">Part SKU</th>
                                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Description</th>
                                <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-10">Qty</th>
                              </tr>
                            </thead>
                            <tbody>
                              {variant.skuComponents.map((part, i) => {
                                const partKey = `variant-${variant.id}-${i}`;
                                const isCopied = copiedBomPartKey === partKey;
                                return (
                                  <tr key={i} className="border-b last:border-0">
                                    <td
                                      className="px-2 py-1.5 font-mono cursor-pointer select-none group"
                                      title="Click to copy SKU"
                                      data-testid={`cell-variant-bom-sku-${variant.id}-${i}`}
                                      onClick={() => handleCopyBomPartSku(partKey, part.sku)}
                                    >
                                      {isCopied ? (
                                        <span className="flex items-center gap-1 text-green-600">
                                          <Check className="w-3 h-3" />
                                          Copied!
                                        </span>
                                      ) : (
                                        <span className="flex items-center gap-1">
                                          <span className="break-words min-w-0">{part.sku}</span>
                                          <Copy className="w-3 h-3 text-muted-foreground invisible group-hover:visible shrink-0" />
                                        </span>
                                      )}
                                    </td>
                                    <td
                                      className="px-2 py-1.5 text-muted-foreground cursor-pointer select-none group"
                                      title="Click to copy description"
                                      data-testid={`cell-variant-bom-desc-${variant.id}-${i}`}
                                      onClick={() => handleCopyBomPartDesc(partKey, part.description)}
                                    >
                                      {copiedBomDescKey === partKey ? (
                                        <span className="flex items-center gap-1 text-green-600">
                                          <Check className="w-3 h-3" />
                                          Copied!
                                        </span>
                                      ) : (
                                        <span className="flex items-start gap-1">
                                          <span className="break-words min-w-0 flex-1">{part.description}</span>
                                          <Copy className="w-3 h-3 text-muted-foreground invisible group-hover:visible shrink-0 mt-0.5" />
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-2 py-1.5 text-right tabular-nums">{part.quantity}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* BOM expansion */}
          {upgradeSkuComponents && upgradeSkuComponents.length > 0 && (
            <div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setBomOpen(o => !o)}
                  data-testid={`button-upgrade-bom-toggle-${upgrade.id}`}
                >
                  <ChevronDownIcon className={`w-3 h-3 transition-transform ${bomOpen ? "" : "-rotate-90"}`} />
                  View BOM ({upgradeSkuComponents.length} {upgradeSkuComponents.length === 1 ? "part" : "parts"})
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => handleCopyAllBomSkus(`upgrade-all-${upgrade.id}`, upgradeSkuComponents)}
                  data-testid={`button-upgrade-bom-copy-all-${upgrade.id}`}
                  title="Copy all part SKUs to clipboard"
                >
                  {copiedAllBomKey === `upgrade-all-${upgrade.id}` ? (
                    <>
                      <Check className="w-3 h-3 text-green-600" />
                      <span className="text-green-600">Copied {upgradeSkuComponents.length} SKUs!</span>
                    </>
                  ) : (
                    <>
                      <ClipboardList className="w-3 h-3" />
                      Copy all SKUs
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => handleCopyAllBomDescs(`upgrade-all-${upgrade.id}`, upgradeSkuComponents)}
                  data-testid={`button-upgrade-bom-copy-all-descs-${upgrade.id}`}
                  title="Copy all part descriptions to clipboard"
                >
                  {copiedAllBomDescKey === `upgrade-all-${upgrade.id}` ? (
                    <>
                      <Check className="w-3 h-3 text-green-600" />
                      <span className="text-green-600">Copied {upgradeSkuComponents.length} descriptions!</span>
                    </>
                  ) : (
                    <>
                      <ClipboardList className="w-3 h-3" />
                      Copy all descriptions
                    </>
                  )}
                </button>
              </div>
              {bomOpen && (
                <div className="mt-2 rounded-md border bg-muted/40 overflow-hidden" data-testid={`table-upgrade-bom-${upgrade.id}`}>
                  <table className="w-full text-xs table-fixed">
                    <thead>
                      <tr className="border-b bg-muted/60">
                        <th className="text-left px-2 py-1.5 font-medium text-muted-foreground w-28">Part SKU</th>
                        <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Description</th>
                        <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-10">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upgradeSkuComponents.map((part, i) => {
                        const partKey = `upgrade-${upgrade.id}-${i}`;
                        const isCopied = copiedBomPartKey === partKey;
                        return (
                          <tr key={i} className="border-b last:border-0">
                            <td
                              className="px-2 py-1.5 font-mono cursor-pointer select-none group"
                              title="Click to copy SKU"
                              data-testid={`cell-upgrade-bom-sku-${upgrade.id}-${i}`}
                              onClick={() => handleCopyBomPartSku(partKey, part.sku)}
                            >
                              {isCopied ? (
                                <span className="flex items-center gap-1 text-green-600">
                                  <Check className="w-3 h-3" />
                                  Copied!
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <span className="break-words min-w-0">{part.sku}</span>
                                  <Copy className="w-3 h-3 text-muted-foreground invisible group-hover:visible shrink-0" />
                                </span>
                              )}
                            </td>
                            <td
                              className="px-2 py-1.5 text-muted-foreground cursor-pointer select-none group"
                              title="Click to copy description"
                              data-testid={`cell-upgrade-bom-desc-${upgrade.id}-${i}`}
                              onClick={() => handleCopyBomPartDesc(partKey, part.description)}
                            >
                              {copiedBomDescKey === partKey ? (
                                <span className="flex items-center gap-1 text-green-600">
                                  <Check className="w-3 h-3" />
                                  Copied!
                                </span>
                              ) : (
                                <span className="flex items-start gap-1">
                                  <span className="break-words min-w-0 flex-1">{part.description}</span>
                                  <Copy className="w-3 h-3 text-muted-foreground invisible group-hover:visible shrink-0 mt-0.5" />
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{part.quantity}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            {hasVariants ? (
              <span className="text-sm text-muted-foreground italic">
                See variants above
              </span>
            ) : (
              <span className="text-xl font-bold" data-testid={`text-upgrade-price-${upgrade.id}`}>
                £{penceToPounds(upgrade.price)}
              </span>
            )}
            <div className="flex space-x-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(upgrade)}
                    data-testid={`button-edit-upgrade-${upgrade.id}`}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit upgrade</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDelete(upgrade.id)}
                    disabled={isDeleting}
                    data-testid={`button-delete-upgrade-${upgrade.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete upgrade</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface UpgradeDialogProps {
  upgrade?: Upgrade;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allUpgrades: Upgrade[]; // For parent equipment dropdown
}

function UpgradeDialog({ upgrade, open, onOpenChange, allUpgrades }: UpgradeDialogProps) {
  const { toast } = useToast();
  const isEditing = !!upgrade;

  const { data: allKits = [] } = useQuery<Kit[]>({ queryKey: ["/api/admin/kits"], enabled: open });
  const { data: dialogCategories = [] } = useQuery<{ id: string; label: string; sortOrder: number }[]>({
    queryKey: ["/api/admin/upgrade-categories"],
    enabled: open,
  });
  const [showKitItems, setShowKitItems] = useState(false);
  const uniqueKitItems = Array.from(new Set(allKits.flatMap(k => k.includes))).sort();
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState<VariantOption[]>([]);
  const [cachedPrice, setCachedPrice] = useState<string>("");

  // Get variants for this upgrade (children)
  const upgradeVariants = allUpgrades.filter(u => u.parentId === upgrade?.id);
  
  // Get parent equipment options (exclude current item and its children)
  const parentOptions = allUpgrades.filter(u => 
    u.id !== upgrade?.id && u.parentId === null
  );

  const form = useForm<UpgradeFormData>({
    resolver: zodResolver(upgradeFormSchema),
    defaultValues: {
      name: "",
      category: "",
      description: "",
      detailedInfo: "",
      videoUrl: "",
      showVideo: false,
      price: "",
      images: [],
      parentId: "",
      variantName: "",
      published: true,
      hasVariants: false,
      allowQuantity: false,
      popular: false,
      forCommercial: false,
      carOnly: false,
      hideForHybrid: false,
      supersedesKitItems: "",
      exclusiveGroup: null,
      sku: null,
      skuComponents: null,
    },
  });

  // Reset form when dialog opens or upgrade changes
  useEffect(() => {
    if (!open) {
      // Clear cached price when dialog closes
      setCachedPrice("");
      return;
    }
    
    // Only reset if we're opening the dialog for the first time or switching upgrades
    // Don't reset when allUpgrades refreshes (e.g., after image upload)
    if (upgrade) {
      const children = allUpgrades.filter(u => u.parentId === upgrade.id);
      const hasChildren = children.length > 0;
      setHasVariants(hasChildren);
      setCachedPrice(""); // Clear cache for fresh edit
      
      // Load existing variants
      if (hasChildren) {
        setVariants(children.map(v => ({
          id: v.id,
          name: v.variantName || "",
          price: penceToPounds(v.price),
          costPrice: v.costPrice != null ? penceToPounds(v.costPrice) : "",
          description: v.description || "",
          images: v.images || [],
        })));
      } else {
        setVariants([]);
      }
      
      form.reset({
        name: upgrade.name,
        category: upgrade.category,
        description: upgrade.description,
        detailedInfo: upgrade.detailedInfo || "",
        videoUrl: upgrade.videoUrl || "",
        showVideo: upgrade.showVideo || false,
        price: hasChildren ? "" : penceToPounds(upgrade.price),
        costPrice: upgrade.costPrice != null ? penceToPounds(upgrade.costPrice) : "",
        images: upgrade.images,
        parentId: upgrade.parentId || "",
        variantName: upgrade.variantName || "",
        published: upgrade.published,
        hasVariants: hasChildren,
        allowQuantity: upgrade.allowQuantity || false,
        popular: upgrade.popular || false,
        forCommercial: upgrade.forCommercial || false,
        carOnly: upgrade.carOnly || false,
        hideForHybrid: (upgrade as any).hideForHybrid || false,
        supersedesKitItems: ((upgrade as any).supersedesKitItems as string[] || []).join('\n'),
        exclusiveGroup: upgrade.exclusiveGroup || null,
        sku: (upgrade as any).sku ?? null,
        skuComponents: (upgrade as any).skuComponents ?? null,
      });
    } else {
      setHasVariants(false);
      setVariants([]);
      setCachedPrice("");
      form.reset({
        name: "",
        category: "",
        description: "",
        detailedInfo: "",
        videoUrl: "",
        showVideo: false,
        price: "",
        costPrice: "",
        images: [],
        parentId: "",
        variantName: "",
        published: true,
        hasVariants: false,
        allowQuantity: false,
        popular: false,
        forCommercial: false,
        carOnly: false,
        hideForHybrid: false,
        supersedesKitItems: "",
        exclusiveGroup: null,
        sku: null,
        skuComponents: null,
      });
    }
    // Only run when dialog opens/closes or upgrade ID changes, not on every allUpgrades change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, upgrade?.id]);

  // Sync newly created variant IDs and images from server, but keep local edits
  useEffect(() => {
    if (!open || !upgrade || !hasVariants) return;
    
    const children = allUpgrades.filter(u => u.parentId === upgrade.id);
    if (children.length === 0) return;
    
    setVariants(prevVariants => {
      // If server has more variants than local (new ones were created), reload all from server
      if (children.length > prevVariants.length) {
        return children.map(v => ({
          id: v.id,
          name: v.variantName || "",
          price: penceToPounds(v.price),
          costPrice: v.costPrice != null ? penceToPounds(v.costPrice) : "",
          description: v.description || "",
          images: v.images || [],
        }));
      }
      
      // If local variants have no IDs but server has same count, sync IDs
      if (prevVariants.some(v => !v.id) && children.length === prevVariants.length) {
        return prevVariants.map((localVar, index) => ({
          ...localVar,
          id: children[index]?.id || localVar.id,
        }));
      }
      
      // Otherwise, just sync images for existing variants (keep local edits to name/price/description)
      return prevVariants.map(localVar => {
        if (localVar.id) {
          const serverVar = children.find(c => c.id === localVar.id);
          if (serverVar && serverVar.images) {
            return { ...localVar, images: serverVar.images };
          }
        }
        return localVar;
      });
    });
  }, [open, upgrade, hasVariants, allUpgrades]);

  const createMutation = useMutation({
    mutationFn: async (data: UpgradeFormData) => {
      // If this has variants, create parent with no price
      if (hasVariants && variants.length > 0) {
        const parentData = {
          ...data,
          price: 0,
          costPrice: null,
          parentId: null,
          variantName: null,
        };
        const parentResult: any = await apiRequest("POST", "/api/admin/upgrades", parentData);
        
        // Create each variant as a child with sortOrder based on position
        await Promise.all(
          variants.map((variant, index) =>
            apiRequest("POST", "/api/admin/upgrades", {
              name: data.name,
              category: data.category,
              description: variant.description || data.description,
              images: variant.images.length > 0 ? variant.images : [],
              price: poundsToPence(variant.price),
              costPrice: variant.costPrice ? poundsToPence(variant.costPrice) : null,
              parentId: parentResult.id,
              variantName: variant.name,
              published: data.published,
              popular: data.popular || false,
              allowQuantity: data.allowQuantity || false,
              exclusiveGroup: data.exclusiveGroup || null,
              sortOrder: index,
            })
          )
        );
        
        return parentResult;
      } else {
        // Regular single upgrade
        const upgradeData = {
          ...data,
          price: data.price ? poundsToPence(data.price) : 0,
          costPrice: data.costPrice ? poundsToPence(data.costPrice) : null,
          parentId: null,
          variantName: null,
        };
        return apiRequest("POST", "/api/admin/upgrades", upgradeData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/upgrades"] });
      toast({
        title: "Success",
        description: "Upgrade created successfully",
      });
      onOpenChange(false);
      form.reset();
      setVariants([]);
      setHasVariants(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create upgrade",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UpgradeFormData) => {
      if (hasVariants && variants.length > 0) {
        // Update parent with no price
        const parentData = {
          ...data,
          price: 0,
          costPrice: null,
          parentId: null,
          variantName: null,
        };
        const parentResult = await apiRequest("PUT", `/api/admin/upgrades/${upgrade!.id}`, parentData);
        
        // Delete removed variants (only those that user explicitly removed)
        const existingVariantIds = upgradeVariants.map(v => v.id);
        const keptVariantIds = variants.filter(v => v.id).map(v => v.id!).filter(Boolean);
        const toDelete = existingVariantIds.filter(id => !keptVariantIds.includes(id));
        
        console.log('Variant deletion check:', { 
          existingVariantIds, 
          keptVariantIds, 
          toDelete,
          variantsState: variants 
        });
        
        // Safety check: only delete if we have the same or more local variants than server variants
        // This prevents accidental deletion if state gets out of sync
        if (variants.length >= upgradeVariants.length && toDelete.length > 0) {
          await Promise.all(toDelete.map(id => 
            apiRequest("DELETE", `/api/admin/upgrades/${id}`)
          ));
        } else if (toDelete.length > 0) {
          console.warn('Skipping variant deletion - state mismatch detected', {
            localCount: variants.length,
            serverCount: upgradeVariants.length,
            toDelete
          });
        }
        
        // Update or create variants with sortOrder based on position
        await Promise.all(
          variants.map((variant, index) => {
            const variantData = {
              name: data.name,
              category: data.category,
              description: variant.description || data.description,
              images: variant.images.length > 0 ? variant.images : [],
              price: poundsToPence(variant.price),
              costPrice: variant.costPrice ? poundsToPence(variant.costPrice) : null,
              parentId: upgrade!.id,
              variantName: variant.name,
              published: data.published,
              popular: data.popular || false,
              allowQuantity: data.allowQuantity || false,
              exclusiveGroup: data.exclusiveGroup || null,
              sortOrder: index,
            };
            
            if (variant.id) {
              // Update existing variant
              return apiRequest("PUT", `/api/admin/upgrades/${variant.id}`, variantData);
            } else {
              // Create new variant
              return apiRequest("POST", "/api/admin/upgrades", variantData);
            }
          })
        );
        
        return parentResult;
      } else {
        // Regular single upgrade - delete any existing variants if switching from variants to single
        if (upgradeVariants.length > 0) {
          await Promise.all(
            upgradeVariants.map(v => apiRequest("DELETE", `/api/admin/upgrades/${v.id}`))
          );
        }
        
        const upgradeData = {
          ...data,
          price: data.price ? poundsToPence(data.price) : 0,
          costPrice: data.costPrice ? poundsToPence(data.costPrice) : null,
          parentId: null,
          variantName: null,
        };
        return apiRequest("PUT", `/api/admin/upgrades/${upgrade!.id}`, upgradeData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/upgrades"] });
      toast({
        title: "Success",
        description: "Upgrade updated successfully",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update upgrade",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UpgradeFormData) => {
    // Validate variants if hasVariants is enabled
    if (hasVariants) {
      if (variants.length === 0) {
        toast({
          title: "Validation Error",
          description: "Please add at least one variant option",
          variant: "destructive",
        });
        return;
      }
      
      const invalidVariants = variants.filter(v => !v.name.trim() || !v.price || parseFloat(v.price) <= 0);
      if (invalidVariants.length > 0) {
        toast({
          title: "Validation Error",
          description: "All variants must have a name and a price greater than 0",
          variant: "destructive",
        });
        return;
      }
    } else if (!upgrade?.parentId) {
      // Validate price for single upgrades (not child variants)
      if (!data.price || parseFloat(data.price) <= 0) {
        toast({
          title: "Validation Error",
          description: "Price is required and must be greater than 0",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Convert newline-separated supersedesKitItems text to array before sending
    const transformedData = {
      ...data,
      supersedesKitItems: (data.supersedesKitItems || '')
        .split('\n')
        .map((s: string) => s.trim())
        .filter(Boolean),
    };

    if (isEditing) {
      updateMutation.mutate(transformedData as any);
    } else {
      createMutation.mutate(transformedData as any);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Upgrade" : "Create New Upgrade"}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 overflow-y-auto flex-1 pr-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter upgrade name"
                      data-testid="input-upgrade-name"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (value === "commercial") {
                        form.setValue("forCommercial", true);
                        form.setValue("carOnly", false);
                      }
                    }}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-upgrade-category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {dialogCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Short Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description shown in the upgrade list"
                      className="min-h-[80px]"
                      data-testid="input-upgrade-description"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="detailedInfo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Detailed Information (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Extended information shown in 'More Info' modal"
                      className="min-h-[120px]"
                      data-testid="input-upgrade-detailed-info"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <FormLabel>Video (Optional)</FormLabel>
              <p className="text-sm text-muted-foreground">
                Upload a video file or enter a YouTube/Vimeo URL
              </p>
              
              <FormField
                control={form.control}
                name="videoUrl"
                render={({ field }) => (
                  <FormItem>
                    <div className="space-y-4">
                      {/* Video Uploader */}
                      <UpgradeVideoUploader
                        videoUrl={field.value || null}
                        onChange={(url) => field.onChange(url)}
                      />
                      
                      {/* OR divider */}
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">
                            Or use embed URL
                          </span>
                        </div>
                      </div>
                      
                      {/* URL Input */}
                      <FormControl>
                        <Input
                          placeholder="https://www.youtube.com/embed/VIDEO_ID or Vimeo URL"
                          data-testid="input-upgrade-video-url"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="showVideo"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium">Show Video in More Info</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Display the video section when customers view this upgrade
                    </p>
                  </div>
                  <FormControl>
                    <AdminSwitch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-show-video"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Only show variant toggle if this is not already a variant */}
            {!upgrade?.parentId && (
              <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Has Variants</label>
                  <p className="text-sm text-muted-foreground">
                    This equipment has multiple options (e.g., LWB/MWB)
                  </p>
                </div>
                <AdminSwitch
                  checked={hasVariants}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      // When enabling variants, cache the current price and clear it
                      const currentPrice = form.getValues("price");
                      if (currentPrice) {
                        setCachedPrice(currentPrice);
                      }
                      form.setValue("price", "");
                      if (variants.length === 0) {
                        setVariants([{ name: "", price: "", costPrice: "", description: "", images: [] }]);
                      }
                    } else {
                      // When disabling variants, restore cached price or require new entry
                      if (cachedPrice) {
                        form.setValue("price", cachedPrice);
                      } else if (upgrade && upgrade.price > 0) {
                        form.setValue("price", penceToPounds(upgrade.price));
                      } else {
                        // Require user to enter a price
                        form.setValue("price", "");
                      }
                      setVariants([]);
                    }
                    setHasVariants(checked);
                  }}
                  data-testid="switch-has-variants"
                />
              </div>
            )}

            {/* Show price only if not a variant item and doesn't have variants */}
            {!upgrade?.parentId && !hasVariants && (
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (£)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        data-testid="input-upgrade-price"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Cost price — shown for standalone upgrades only; variants carry their own cost price */}
            {!upgrade?.parentId && !hasVariants && (
              <FormField
                control={form.control}
                name="costPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Price (£) <span className="font-normal text-muted-foreground">— ex VAT, optional</span></FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        data-testid="input-upgrade-cost-price"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Used to calculate profit margin on quotes</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Variant management section */}
            {hasVariants && !upgrade?.parentId && (
              <div className="space-y-3 rounded-lg border p-4">
                <h3 className="font-medium">Variants</h3>
                <p className="text-sm text-muted-foreground">
                  Add different options for this equipment (e.g., LWB, MWB). At least one variant is required.
                </p>
                
                {variants.length === 0 && (
                  <p className="text-sm text-destructive">
                    Please add at least one variant option
                  </p>
                )}
                
                {variants.map((variant, index) => {
                  const hasError = !variant.name.trim() || !variant.price || parseFloat(variant.price) <= 0;
                  
                  return (
                    <div key={index} className="space-y-3 p-4 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Variant {index + 1}</h4>
                        <div className="flex items-center gap-2">
                          {/* Reorder buttons */}
                          <div className="flex flex-col">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    if (index > 0) {
                                      const newVariants = [...variants];
                                      [newVariants[index - 1], newVariants[index]] = [newVariants[index], newVariants[index - 1]];
                                      setVariants(newVariants);
                                    }
                                  }}
                                  disabled={index === 0}
                                  data-testid={`button-variant-up-${index}`}
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Move variant up</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    if (index < variants.length - 1) {
                                      const newVariants = [...variants];
                                      [newVariants[index], newVariants[index + 1]] = [newVariants[index + 1], newVariants[index]];
                                      setVariants(newVariants);
                                    }
                                  }}
                                  disabled={index === variants.length - 1}
                                  data-testid={`button-variant-down-${index}`}
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Move variant down</TooltipContent>
                            </Tooltip>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setVariants(variants.filter((_, i) => i !== index));
                            }}
                            data-testid={`button-remove-variant-${index}`}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input
                          placeholder="Variant name (e.g., LWB)"
                          value={variant.name}
                          onChange={(e) => {
                            const newVariants = [...variants];
                            newVariants[index].name = e.target.value;
                            setVariants(newVariants);
                          }}
                          className={!variant.name.trim() ? "border-destructive" : ""}
                          data-testid={`input-variant-name-${index}`}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="Price (£)"
                          value={variant.price}
                          onChange={(e) => {
                            const newVariants = [...variants];
                            newVariants[index].price = e.target.value;
                            setVariants(newVariants);
                          }}
                          className={(!variant.price || parseFloat(variant.price) <= 0) ? "border-destructive" : ""}
                          data-testid={`input-variant-price-${index}`}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">
                          Cost Price (£) <span className="font-normal text-muted-foreground">— ex VAT, optional</span>
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={variant.costPrice}
                          onChange={(e) => {
                            const newVariants = [...variants];
                            newVariants[index].costPrice = e.target.value;
                            setVariants(newVariants);
                          }}
                          data-testid={`input-variant-cost-price-${index}`}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Used to calculate profit margin on quotes</p>
                      </div>
                      
                      <Textarea
                        placeholder="Variant description (optional - defaults to parent description)"
                        value={variant.description}
                        onChange={(e) => {
                          const newVariants = [...variants];
                          newVariants[index].description = e.target.value;
                          setVariants(newVariants);
                        }}
                        className="min-h-[80px]"
                        data-testid={`input-variant-description-${index}`}
                      />
                      
                      <div>
                        <label className="text-sm font-medium mb-2 block">Variant Images</label>
                        <UpgradeImageUploader
                          images={variant.images}
                          onChange={(images: string[]) => {
                            const newVariants = [...variants];
                            newVariants[index].images = images;
                            setVariants(newVariants);
                          }}
                          maxImages={5}
                          uploaderId={`variant-image-upload-${variant.id || index}`}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Upload images for this variant (optional - defaults to parent images)
                        </p>
                      </div>
                      
                      {hasError && (
                        <p className="text-xs text-destructive">
                          Both name and price are required
                        </p>
                      )}
                    </div>
                  );
                })}
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setVariants([...variants, { name: "", price: "", costPrice: "", description: "", images: [] }])}
                  data-testid="button-add-variant"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Variant
                </Button>
              </div>
            )}

            <FormField
              control={form.control}
              name="images"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Images</FormLabel>
                  <FormControl>
                    <UpgradeImageUploader
                      images={(field.value as string[]) || []}
                      onChange={(images: string[]) => field.onChange(images)}
                      maxImages={5}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Upload product images to help customers see what they're purchasing
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="published"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Published</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Make this upgrade visible to customers
                    </p>
                  </div>
                  <FormControl>
                    <AdminSwitch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-upgrade-published"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="allowQuantity"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Allow Quantity Selection</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Let customers choose quantity for this upgrade
                    </p>
                  </div>
                  <FormControl>
                    <AdminSwitch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-allow-quantity"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="popular"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Popular Upgrade</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Mark this upgrade as popular to show a green star indicator
                    </p>
                  </div>
                  <FormControl>
                    <AdminSwitch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-popular-upgrade"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="forCommercial"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Commercial / Hybrid Only</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Only show this upgrade to customers who selected a Commercial or Hybrid service type
                    </p>
                  </div>
                  <FormControl>
                    <AdminSwitch
                      checked={field.value}
                      onCheckedChange={(checked: boolean) => {
                        field.onChange(checked);
                        if (checked) {
                          form.setValue("carOnly", false);
                        }
                      }}
                      data-testid="switch-for-commercial"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="carOnly"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Car/Van Only (hide from commercial)</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Hide this upgrade from customers who selected a Commercial service type
                    </p>
                    {form.watch("forCommercial") && field.value && (
                      <p className="text-sm text-destructive font-medium" data-testid="text-car-only-warning">
                        Warning: This upgrade is also marked as Commercial Only — these settings contradict each other
                      </p>
                    )}
                  </div>
                  <FormControl>
                    <AdminSwitch
                      checked={field.value}
                      onCheckedChange={(checked: boolean) => {
                        field.onChange(checked);
                        if (checked) {
                          form.setValue("forCommercial", false);
                        }
                      }}
                      data-testid="switch-car-only"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hideForHybrid"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Hide from Car &amp; Commercial (Hybrid)</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Hide this upgrade from customers who selected the Hybrid service type, while still showing it to pure Commercial customers
                    </p>
                  </div>
                  <FormControl>
                    <AdminSwitch
                      checked={field.value ?? false}
                      onCheckedChange={field.onChange}
                      data-testid="switch-hide-for-hybrid"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="supersedesKitItems"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supersedes Kit Items (Build Sheet)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={"e.g.\nT1000 Pro Tyre Changer\nT2000 Pro Tyre Changer"}
                      {...field}
                      value={field.value ?? ""}
                      rows={4}
                      className="resize-none font-mono text-xs"
                      data-testid="input-supersedes-kit-items"
                    />
                  </FormControl>
                  <p className="text-sm text-muted-foreground">
                    One kit item per line (exact text match). On the build sheet, this upgrade will appear <strong>in place of</strong> these kit items — the kit items will be hidden and the upgrade name shown instead. Leave blank if this upgrade does not supersede any kit items.
                  </p>
                  <div className="mt-1">
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                      onClick={() => setShowKitItems(v => !v)}
                    >
                      {showKitItems ? "Hide kit items" : "View current kit item names"}
                    </button>
                    {showKitItems && (
                      <div className="mt-2 p-2 rounded-md bg-muted text-xs font-mono space-y-0.5 max-h-36 overflow-y-auto">
                        {uniqueKitItems.length === 0
                          ? <span className="text-muted-foreground">No kit items found</span>
                          : uniqueKitItems.map(item => (
                            <div
                              key={item}
                              className="cursor-pointer hover:bg-background px-1 rounded transition-colors"
                              title="Click to append to supersedes list"
                              onClick={() => {
                                const current = (form.getValues("supersedesKitItems") || "").trimEnd();
                                form.setValue("supersedesKitItems", current ? `${current}\n${item}` : item);
                              }}
                            >
                              {item}
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="exclusiveGroup"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Exclusive Group</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. air-system (leave blank if not exclusive)"
                      {...field}
                      value={field.value ?? ""}
                      onChange={e => field.onChange(e.target.value || null)}
                      data-testid="input-exclusive-group"
                    />
                  </FormControl>
                  <p className="text-sm text-muted-foreground">
                    Upgrades sharing the same group name cannot be selected together. Only one can be chosen at a time.
                  </p>
                </FormItem>
              )}
            />

            {/* ── SKU & Bill of Materials (AutoTradeOS) ──────────────────── */}
            <div className="space-y-4 pt-2 border-t">
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. ATS-UPGRADE-001"
                        {...field}
                        value={field.value ?? ""}
                        onChange={e => field.onChange(e.target.value || null)}
                        data-testid="input-upgrade-sku"
                      />
                    </FormControl>
                    <p className="text-sm text-muted-foreground">
                      AutoTradeOS stock-keeping unit — used when pushing this build to the warehouse.
                    </p>
                  </FormItem>
                )}
              />

              {/* BOM — variants each have their own independent BOM; simple upgrades may also define one */}
              <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Bill of Materials</p>
                      <p className="text-sm text-muted-foreground">
                        Component parts sent to the AutoTradeOS warehouse. Leave empty if this item ships as a single unit.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const current = form.getValues("skuComponents") || [];
                        form.setValue("skuComponents", [...current, { sku: "", description: "", quantity: 1 }]);
                      }}
                      data-testid="button-add-bom-row-upgrade"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Part
                    </Button>
                  </div>
                  {(form.watch("skuComponents") || []).length > 0 && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-[1fr_2fr_72px_auto] gap-2 text-xs font-medium text-muted-foreground px-1">
                        <span>Part SKU</span>
                        <span>Description</span>
                        <span>Qty</span>
                        <span />
                      </div>
                      {(form.watch("skuComponents") || []).map((row, idx) => (
                        <div key={idx} className="grid grid-cols-[1fr_2fr_72px_auto] gap-2 items-center">
                          <Input
                            placeholder="SKU"
                            value={row.sku}
                            onChange={e => {
                              const rows = [...(form.getValues("skuComponents") || [])];
                              rows[idx] = { ...rows[idx], sku: e.target.value };
                              form.setValue("skuComponents", rows);
                            }}
                            className="text-sm h-8"
                            data-testid={`input-bom-sku-${idx}`}
                          />
                          <Input
                            placeholder="Description"
                            value={row.description}
                            onChange={e => {
                              const rows = [...(form.getValues("skuComponents") || [])];
                              rows[idx] = { ...rows[idx], description: e.target.value };
                              form.setValue("skuComponents", rows);
                            }}
                            className="text-sm h-8"
                            data-testid={`input-bom-desc-${idx}`}
                          />
                          <Input
                            type="number"
                            min={1}
                            value={row.quantity}
                            onChange={e => {
                              const rows = [...(form.getValues("skuComponents") || [])];
                              rows[idx] = { ...rows[idx], quantity: parseInt(e.target.value) || 1 };
                              form.setValue("skuComponents", rows);
                            }}
                            className="text-sm h-8"
                            data-testid={`input-bom-qty-${idx}`}
                          />
                          <div className="flex gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  disabled={idx === 0}
                                  onClick={() => {
                                    const rows = [...(form.getValues("skuComponents") || [])];
                                    if (idx > 0) { [rows[idx - 1], rows[idx]] = [rows[idx], rows[idx - 1]]; form.setValue("skuComponents", rows); }
                                  }}
                                  data-testid={`button-bom-up-${idx}`}
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Move part up</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  disabled={idx === (form.watch("skuComponents") || []).length - 1}
                                  onClick={() => {
                                    const rows = [...(form.getValues("skuComponents") || [])];
                                    if (idx < rows.length - 1) { [rows[idx], rows[idx + 1]] = [rows[idx + 1], rows[idx]]; form.setValue("skuComponents", rows); }
                                  }}
                                  data-testid={`button-bom-down-${idx}`}
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Move part down</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    const rows = (form.getValues("skuComponents") || []).filter((_, i) => i !== idx);
                                    form.setValue("skuComponents", rows.length > 0 ? rows : null);
                                  }}
                                  data-testid={`button-remove-bom-row-${idx}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Remove part</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-upgrade"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-upgrade"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : isEditing
                  ? "Update Upgrade"
                  : "Create Upgrade"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

type UpgradeCategory = { id: string; label: string; sortOrder: number };

export default function AdminUpgrades() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUpgrade, setEditingUpgrade] = useState<Upgrade | undefined>();
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryLabel, setEditCategoryLabel] = useState("");
  const { toast } = useToast();

  const { data: upgrades = [], isLoading } = useQuery<Upgrade[]>({
    queryKey: ["/api/admin/upgrades"],
  });

  const { data: dbCategories = [], isLoading: categoriesLoading } = useQuery<UpgradeCategory[]>({
    queryKey: ["/api/admin/upgrade-categories"],
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (label: string) =>
      apiRequest("POST", "/api/admin/upgrade-categories", { label }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/upgrade-categories"] });
      setNewCategoryLabel("");
      toast({ title: "Category added" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to add category", variant: "destructive" });
    },
  });

  const renameCategoryMutation = useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) =>
      apiRequest("PATCH", `/api/admin/upgrade-categories/${id}`, { label }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/upgrade-categories"] });
      setEditingCategoryId(null);
      toast({ title: "Category renamed" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to rename category", variant: "destructive" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest("DELETE", `/api/admin/upgrade-categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/upgrade-categories"] });
      toast({ title: "Category deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Cannot delete", description: err?.message || "Failed to delete category", variant: "destructive" });
    },
  });

  const reorderCategoryMutation = useMutation({
    mutationFn: async (ids: string[]) =>
      apiRequest("PUT", "/api/admin/upgrade-categories/order", { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/upgrade-categories"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reorder categories", variant: "destructive" });
    },
  });

  const moveCategoryUp = (index: number) => {
    if (index <= 0) return;
    const newOrder = [...dbCategories];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    reorderCategoryMutation.mutate(newOrder.map(c => c.id));
  };

  const moveCategoryDown = (index: number) => {
    if (index >= dbCategories.length - 1) return;
    const newOrder = [...dbCategories];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    reorderCategoryMutation.mutate(newOrder.map(c => c.id));
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/upgrades/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/upgrades"] });
      toast({
        title: "Success",
        description: "Upgrade deleted successfully",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || error?.error || "Failed to delete upgrade";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateSortOrderMutation = useMutation({
    mutationFn: async ({ id, sortOrder }: { id: string; sortOrder: number }) => {
      return apiRequest("PATCH", `/api/admin/upgrades/${id}/sort-order`, { sortOrder });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/upgrades"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update sort order",
        variant: "destructive",
      });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent, categoryUpgrades: Upgrade[]) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = categoryUpgrades.findIndex((u) => u.id === active.id);
      const newIndex = categoryUpgrades.findIndex((u) => u.id === over.id);
      
      const reorderedUpgrades = arrayMove(categoryUpgrades, oldIndex, newIndex);
      
      // Update sort orders for all items in the new order
      reorderedUpgrades.forEach((upgrade, index) => {
        updateSortOrderMutation.mutate({ id: upgrade.id, sortOrder: index });
      });
    }
  };

  const handleEdit = (upgrade: Upgrade) => {
    setEditingUpgrade(upgrade);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingUpgrade(undefined);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this upgrade?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Filter to only parent upgrades (no parentId) for main list
  const parentUpgrades = upgrades.filter(u => !u.parentId);
  
  // Group parent upgrades by category and sort by sortOrder
  const upgradesByCategory = parentUpgrades.reduce((acc, upgrade) => {
    if (!acc[upgrade.category]) {
      acc[upgrade.category] = [];
    }
    acc[upgrade.category].push(upgrade);
    return acc;
  }, {} as Record<string, Upgrade[]>);

  // Sort each category by sortOrder
  Object.keys(upgradesByCategory).forEach(category => {
    upgradesByCategory[category].sort((a, b) => a.sortOrder - b.sortOrder);
  });

  // Get all categories from DB (falls back to empty until loaded)
  const allCategories = dbCategories.map(c => c.id);

  return (
    <>
      <AdminBackButton />
      <AdminPageHeader
        title="Upgrade Management"
        description="Manage upgrade options and add-ons for mobile tyre services"
        actions={
          <Button onClick={handleCreate} size="sm" data-testid="button-create-upgrade">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Upgrade
          </Button>
        }
      />
      <div className="space-y-6 p-6">

      {/* ── Category Management ── */}
      <Accordion type="single" collapsible className="border rounded-lg px-4">
        <AccordionItem value="categories" className="border-none">
          <AccordionTrigger className="hover:no-underline py-3">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Tags className="h-4 w-4" />
              Manage Categories
              <Badge variant="secondary" className="ml-1">{dbCategories.length}</Badge>
            </span>
          </AccordionTrigger>
          <AccordionContent>
        <div className="space-y-3 pb-2">
          {categoriesLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="divide-y rounded-md border">
              {dbCategories.map((cat, index) => (
                <div key={cat.id} className="flex items-center gap-2 px-3 py-2">
                  {editingCategoryId === cat.id ? (
                    <>
                      <Input
                        value={editCategoryLabel}
                        onChange={(e) => setEditCategoryLabel(e.target.value)}
                        className="h-8 flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameCategoryMutation.mutate({ id: cat.id, label: editCategoryLabel });
                          if (e.key === "Escape") setEditingCategoryId(null);
                        }}
                        autoFocus
                        data-testid={`input-rename-category-${cat.id}`}
                      />
                      <Button
                        size="sm"
                        onClick={() => renameCategoryMutation.mutate({ id: cat.id, label: editCategoryLabel })}
                        disabled={renameCategoryMutation.isPending}
                        data-testid={`button-save-category-${cat.id}`}
                      >
                        Save
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" onClick={() => setEditingCategoryId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Cancel rename</TooltipContent>
                      </Tooltip>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col gap-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5"
                              onClick={() => moveCategoryUp(index)}
                              disabled={index === 0 || reorderCategoryMutation.isPending}
                              data-testid={`button-category-up-${cat.id}`}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Move category up</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5"
                              onClick={() => moveCategoryDown(index)}
                              disabled={index === dbCategories.length - 1 || reorderCategoryMutation.isPending}
                              data-testid={`button-category-down-${cat.id}`}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Move category down</TooltipContent>
                        </Tooltip>
                      </div>
                      <span className="flex-1 text-sm font-medium" data-testid={`text-category-label-${cat.id}`}>{cat.label}</span>
                      <span className="text-xs text-muted-foreground mr-2">{cat.id}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => { setEditingCategoryId(cat.id); setEditCategoryLabel(cat.label); }}
                            data-testid={`button-rename-category-${cat.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Rename category</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Delete category "${cat.label}"? This will fail if any upgrades still use it.`)) {
                                deleteCategoryMutation.mutate(cat.id);
                              }
                            }}
                            disabled={deleteCategoryMutation.isPending}
                            data-testid={`button-delete-category-${cat.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete category</TooltipContent>
                      </Tooltip>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* Add new category */}
          <div className="flex gap-2 pt-1">
            <Input
              placeholder="New category name, e.g. Profit Makers"
              value={newCategoryLabel}
              onChange={(e) => setNewCategoryLabel(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newCategoryLabel.trim()) {
                  createCategoryMutation.mutate(newCategoryLabel.trim());
                }
              }}
              data-testid="input-new-category"
            />
            <Button
              onClick={() => { if (newCategoryLabel.trim()) createCategoryMutation.mutate(newCategoryLabel.trim()); }}
              disabled={createCategoryMutation.isPending || !newCategoryLabel.trim()}
              size="sm"
              data-testid="button-add-category"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>
        </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {upgrades.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No upgrades found</h3>
            <p className="text-muted-foreground text-center mb-4">
              Get started by creating your first upgrade option
            </p>
            <Button onClick={handleCreate} data-testid="button-create-first-upgrade">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Upgrade
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={allCategories} className="space-y-4">
          {allCategories.map((category) => {
            const categoryUpgrades = upgradesByCategory[category] || [];
            
            return (
              <AccordionItem key={category} value={category} className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold">
                      {dbCategories.find(c => c.id === category)?.label ?? CATEGORY_LABELS[category] ?? category.replace(/-/g, ' ')}
                    </h2>
                    <Badge variant="secondary">{categoryUpgrades.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {categoryUpgrades.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No upgrades in this category yet
                    </p>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleDragEnd(event, categoryUpgrades)}
                    >
                      <SortableContext
                        items={categoryUpgrades.map(u => u.id)}
                        strategy={rectSortingStrategy}
                      >
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pt-4">
                          {categoryUpgrades.map((upgrade: Upgrade) => {
                            // Get variants for this parent
                            const variantChildren = upgrades.filter(u => u.parentId === upgrade.id);
                            const hasVariants = variantChildren.length > 0;
                            return (
                              <SortableUpgradeCard
                                key={upgrade.id}
                                upgrade={upgrade}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                isDeleting={deleteMutation.isPending}
                                hasVariants={hasVariants}
                                variants={variantChildren}
                              />
                            );
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <UpgradeDialog
        upgrade={editingUpgrade}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingUpgrade(undefined);
          }
        }}
        allUpgrades={upgrades}
      />
    </div>
    </>
  );
}