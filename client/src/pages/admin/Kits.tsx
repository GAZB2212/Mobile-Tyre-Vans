import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { AdminSwitch } from "@/components/AdminSwitch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, Package, ChevronUp, ChevronDown, Check, Barcode, ChevronRight, ClipboardList, Copy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { UpgradeImageUploader } from "@/components/UpgradeImageUploader";
import type { Kit } from "@shared/schema";
import { kitServiceTypes } from "@shared/schema";
import { AdminBackButton } from "@/components/AdminBackButton";
import { AdminPageHeader } from "@/components/AdminPageHeader";

// Form validation schema
const kitSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  includes: z.array(z.string()).min(1, "At least one included item is required"),
  powerKw: z.string().min(1, "Power (kW) is required"),
  price: z.number().min(0, "Price must be positive"),
  costPrice: z.number().min(0, "Cost price must be positive").optional().nullable(),
  euroSixCompatible: z.boolean().default(false),
  serviceType: z.array(z.enum(kitServiceTypes)).min(1, "Select at least one service type").default(["car", "commercial", "hybrid"]),
  images: z.array(z.string()).default([]),
  published: z.boolean().default(true),
  sku: z.string().optional().nullable(),
  skuComponents: z.array(z.object({ sku: z.string(), description: z.string(), quantity: z.number().min(1), costPrice: z.number().optional().nullable() })).optional().nullable(),
  headlineMachines: z.array(z.string()).optional().nullable(),
});

type KitFormData = z.infer<typeof kitSchema>;

export default function AdminKits() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingKit, setEditingKit] = useState<Kit | null>(null);
  const [includesInput, setIncludesInput] = useState("");
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editingItemText, setEditingItemText] = useState("");
  const [copiedKitSkuId, setCopiedKitSkuId] = useState<string | null>(null);
  const [copiedBomPartKey, setCopiedBomPartKey] = useState<string | null>(null);
  const [copiedAllBomId, setCopiedAllBomId] = useState<string | null>(null);
  const [copiedAllBomDescId, setCopiedAllBomDescId] = useState<string | null>(null);
  const [copiedBomDescKey, setCopiedBomDescKey] = useState<string | null>(null);

  const handleCopyKitSku = (kitId: string, sku: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sku).then(() => {
      setCopiedKitSkuId(kitId);
      setTimeout(() => setCopiedKitSkuId(null), 1500);
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

  const handleCopyAllBomSkus = (id: string, parts: { sku: string }[]) => {
    const skus = parts.map(p => p.sku).filter(Boolean).join('\n');
    navigator.clipboard.writeText(skus).then(() => {
      setCopiedAllBomId(id);
      setTimeout(() => setCopiedAllBomId(null), 1500);
    }).catch(() => {
      toast({ title: "Could not copy SKUs", description: "Please copy them manually.", variant: "destructive" });
    });
  };

  const handleCopyAllBomDescs = (id: string, parts: { description: string }[]) => {
    const descs = parts.map(p => p.description).filter(Boolean).join('\n');
    navigator.clipboard.writeText(descs).then(() => {
      setCopiedAllBomDescId(id);
      setTimeout(() => setCopiedAllBomDescId(null), 1500);
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

  const [expandedBomIds, setExpandedBomIds] = useState<Set<string>>(new Set());

  const toggleBom = (id: string) => {
    setExpandedBomIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const { toast } = useToast();

  // Fetch kits with admin access (includes unpublished)
  const { data: kits = [], isLoading } = useQuery<Kit[]>({
    queryKey: ["/api/admin/kits"],
  });

  const form = useForm<KitFormData>({
    resolver: zodResolver(kitSchema),
    defaultValues: {
      name: "",
      description: "",
      includes: [],
      powerKw: "",
      price: 0,
      costPrice: null,
      euroSixCompatible: false,
      serviceType: ["car", "commercial", "hybrid"] as const,
      images: [],
      published: true,
      sku: null,
      skuComponents: null,
      headlineMachines: null,
    },
  });

  // Create kit mutation
  const createMutation = useMutation({
    mutationFn: (data: KitFormData) => {
      const kitData = {
        ...data,
        includes: data.includes,
        price: Math.round(data.price * 100), // Convert to pence
        costPrice: data.costPrice != null ? Math.round(data.costPrice * 100) : null,
      };
      return apiRequest("POST", "/api/admin/kits", kitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kits"] });
      setIsCreateDialogOpen(false);
      form.reset();
      setIncludesInput("");
      toast({ title: "Kit created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create kit", variant: "destructive" });
    },
  });

  // Update kit mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: KitFormData }) => {
      const kitData = {
        ...data,
        includes: data.includes,
        price: Math.round(data.price * 100), // Convert to pence
        costPrice: data.costPrice != null ? Math.round(data.costPrice * 100) : null,
      };
      return apiRequest("PUT", `/api/admin/kits/${id}`, kitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kits"] });
      setEditingKit(null);
      form.reset();
      setIncludesInput("");
      toast({ title: "Kit updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update kit", variant: "destructive" });
    },
  });

  // Delete kit mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/kits/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kits"] });
      toast({ title: "Kit deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete kit", variant: "destructive" });
    },
  });

  // Reorder kit mutation
  const reorderMutation = useMutation({
    mutationFn: ({ id, sortOrder }: { id: string; sortOrder: number }) =>
      apiRequest("PATCH", `/api/admin/kits/${id}/sort-order`, { sortOrder }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kits"] });
    },
    onError: () => {
      toast({ title: "Failed to reorder kit", variant: "destructive" });
    },
  });

  const handleMoveKitUp = (index: number) => {
    if (index === 0 || !kits) return;
    const currentKit = kits[index];
    const previousKit = kits[index - 1];
    
    // Swap sort orders
    reorderMutation.mutate({ id: currentKit.id, sortOrder: previousKit.sortOrder ?? index - 1 });
    reorderMutation.mutate({ id: previousKit.id, sortOrder: currentKit.sortOrder ?? index });
  };

  const handleMoveKitDown = (index: number) => {
    if (!kits || index === kits.length - 1) return;
    const currentKit = kits[index];
    const nextKit = kits[index + 1];
    
    // Swap sort orders
    reorderMutation.mutate({ id: currentKit.id, sortOrder: nextKit.sortOrder ?? index + 1 });
    reorderMutation.mutate({ id: nextKit.id, sortOrder: currentKit.sortOrder ?? index });
  };

  const handleAddInclude = () => {
    if (includesInput.trim()) {
      const currentIncludes = form.getValues("includes");
      form.setValue("includes", [...currentIncludes, includesInput.trim()]);
      setIncludesInput("");
    }
  };

  const handleRemoveInclude = (index: number) => {
    const currentIncludes = form.getValues("includes");
    form.setValue("includes", currentIncludes.filter((_, i) => i !== index));
  };

  const handleMoveIncludeUp = (index: number) => {
    if (index === 0) return;
    const currentIncludes = form.getValues("includes");
    const newIncludes = [...currentIncludes];
    [newIncludes[index - 1], newIncludes[index]] = [newIncludes[index], newIncludes[index - 1]];
    form.setValue("includes", newIncludes);
  };

  const handleMoveIncludeDown = (index: number) => {
    const currentIncludes = form.getValues("includes");
    if (index === currentIncludes.length - 1) return;
    const newIncludes = [...currentIncludes];
    [newIncludes[index], newIncludes[index + 1]] = [newIncludes[index + 1], newIncludes[index]];
    form.setValue("includes", newIncludes);
  };

  const handleStartEditItem = (index: number) => {
    const currentIncludes = form.getValues("includes");
    setEditingItemIndex(index);
    setEditingItemText(currentIncludes[index]);
  };

  const handleSaveEditItem = () => {
    if (editingItemIndex !== null && editingItemText.trim()) {
      const currentIncludes = form.getValues("includes");
      const newIncludes = [...currentIncludes];
      newIncludes[editingItemIndex] = editingItemText.trim();
      form.setValue("includes", newIncludes);
      setEditingItemIndex(null);
      setEditingItemText("");
    }
  };

  const handleCancelEditItem = () => {
    setEditingItemIndex(null);
    setEditingItemText("");
  };

  const handleEditKit = (kit: Kit) => {
    setEditingKit(kit);
    form.reset({
      name: kit.name,
      description: kit.description,
      includes: kit.includes || [],
      powerKw: kit.powerKw,
      price: parseInt(kit.price.toString()) / 100, // Convert from pence
      costPrice: kit.costPrice != null ? kit.costPrice / 100 : null,
      euroSixCompatible: kit.euroSixCompatible,
      serviceType: (Array.isArray(kit.serviceType) ? kit.serviceType : ["car", "commercial", "hybrid"]) as typeof kitServiceTypes[number][],
      images: kit.images || [],
      published: kit.published,
      sku: (kit as any).sku ?? null,
      skuComponents: (kit as any).skuComponents ?? null,
      headlineMachines: (kit as any).headlineMachines ?? null,
    });
  };

  const onSubmit = (data: KitFormData) => {
    if (editingKit) {
      updateMutation.mutate({ id: editingKit.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const formatPrice = (priceInPence: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(priceInPence / 100);
  };

  if (isLoading) {
    return (
      <div>
        <AdminPageHeader title="Equipment Kits" description="Manage equipment packages for the configurator" />
        <div className="p-6 grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <AdminBackButton />
      <AdminPageHeader
        title="Equipment Kits"
        description="Manage equipment packages for the configurator"
        actions={
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-kit" className="flex-shrink-0">
              <Plus className="w-4 h-4 mr-2" />
              Add Kit
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Kit</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kit Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Premium Pro Kit" {...field} data-testid="input-kit-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the kit and its benefits..."
                          className="min-h-[100px]"
                          {...field}
                          data-testid="input-kit-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="includes"
                  render={() => (
                    <FormItem>
                      <FormLabel>Included Items</FormLabel>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            value={includesInput}
                            onChange={(e) => setIncludesInput(e.target.value)}
                            placeholder="Add an included item..."
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddInclude())}
                            data-testid="input-kit-include"
                          />
                          <Button type="button" onClick={handleAddInclude} data-testid="button-add-include">
                            Add
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {form.watch("includes").map((item, index) => (
                            <div key={index} className="flex items-center gap-2 bg-muted p-2 rounded-md">
                              <div className="flex flex-col gap-0.5">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5"
                                      onClick={() => handleMoveIncludeUp(index)}
                                      disabled={index === 0 || editingItemIndex !== null}
                                      data-testid={`button-move-include-up-${index}`}
                                    >
                                      <ChevronUp className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Move item up</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-5 w-5"
                                      onClick={() => handleMoveIncludeDown(index)}
                                      disabled={index === form.watch("includes").length - 1 || editingItemIndex !== null}
                                      data-testid={`button-move-include-down-${index}`}
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Move item down</TooltipContent>
                                </Tooltip>
                              </div>
                              {editingItemIndex === index ? (
                                <>
                                  <Input
                                    value={editingItemText}
                                    onChange={(e) => setEditingItemText(e.target.value)}
                                    className="flex-1"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleSaveEditItem();
                                      } else if (e.key === "Escape") {
                                        handleCancelEditItem();
                                      }
                                    }}
                                    autoFocus
                                    data-testid={`input-edit-item-${index}`}
                                  />
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={handleSaveEditItem}
                                        data-testid={`button-save-item-${index}`}
                                      >
                                        <Check className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Save item</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={handleCancelEditItem}
                                        data-testid={`button-cancel-item-${index}`}
                                      >
                                        ×
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Cancel edit</TooltipContent>
                                  </Tooltip>
                                </>
                              ) : (
                                <>
                                  <span className="flex-1 text-sm">{item}</span>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleStartEditItem(index)}
                                        data-testid={`button-edit-item-${index}`}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Edit item</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => handleRemoveInclude(index)}
                                        data-testid={`button-remove-include-${index}`}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Remove item</TooltipContent>
                                  </Tooltip>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="headlineMachines"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Headline Machines (Build Sheet & Kiosk)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={"e.g.\nTyre Changer\nWheel Balancer\nSilent Compressor"}
                          className="min-h-[90px] font-mono text-sm"
                          value={(field.value ?? []).join("\n")}
                          onChange={(e) => {
                            const lines = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
                            field.onChange(lines.length > 0 ? lines : null);
                          }}
                          data-testid="input-kit-headline-machines"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        One machine per line. Shown as an "Includes:" sub-line under the pack name on the build sheet and kiosk so the workshop can see the headline machines at a glance.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="powerKw"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Power (kW)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 3.5" {...field} data-testid="input-kit-power" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                            placeholder="0.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            data-testid="input-kit-price"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
                          data-testid="input-kit-cost-price"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">Used to calculate profit margin on quotes</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="serviceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Type</FormLabel>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        {([
                          { value: "car", label: "Car & Van" },
                          { value: "commercial", label: "Commercial" },
                          { value: "hybrid", label: "Hybrid" },
                        ] as const).map(({ value, label }) => {
                          const checked = (field.value as string[])?.includes(value) ?? false;
                          return (
                            <label
                              key={value}
                              className={`flex items-center gap-2 p-3 rounded-md border cursor-pointer hover-elevate ${checked ? "border-accent bg-accent/10" : "border-border"}`}
                              data-testid={`checkbox-service-type-create-${value}`}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(c) => {
                                  const current = (field.value as string[]) ?? [];
                                  field.onChange(c ? [...current, value] : current.filter(t => t !== value));
                                }}
                              />
                              <span className="text-sm">{label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Select all that apply — controls which customers see this kit
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                          data-testid="uploader-kit-images"
                        />
                      </FormControl>
                      <div className="text-sm text-muted-foreground">
                        Upload product images to showcase the kit equipment
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="euroSixCompatible"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Euro 6 Compatible</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Select for Euro 6 vehicles (newer vans with smart alternators/split chargers)
                        </div>
                      </div>
                      <FormControl>
                        <AdminSwitch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-kit-euro6"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="published"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Published</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Make this kit visible in the configurator
                        </div>
                      </div>
                      <FormControl>
                        <AdminSwitch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-kit-published"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* ── SKU & Bill of Materials (AutoTradeOS) ─────────────── */}
                <div className="space-y-4 pt-2 border-t">
                  <div>
                    <Label className="text-sm font-medium">SKU</Label>
                    <p className="text-sm text-muted-foreground mb-1">AutoTradeOS stock-keeping unit — used when pushing this build to the warehouse.</p>
                    <Input
                      placeholder="e.g. ATS-KIT-001"
                      value={form.watch("sku") ?? ""}
                      onChange={e => form.setValue("sku", e.target.value || null)}
                      data-testid="input-kit-sku"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">Bill of Materials</p>
                        <p className="text-sm text-muted-foreground">Component parts sent to the AutoTradeOS warehouse. Leave empty if this kit ships as a single unit.</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const current = form.getValues("skuComponents") || [];
                          form.setValue("skuComponents", [...current, { sku: "", description: "", quantity: 1 }]);
                        }}
                        data-testid="button-add-bom-row-kit"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add Part
                      </Button>
                    </div>
                    {(form.watch("skuComponents") || []).length > 0 && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_2fr_72px_36px] gap-2 text-xs font-medium text-muted-foreground px-1">
                          <span>Part SKU</span><span>Description</span><span>Qty</span><span />
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
                              data-testid={`input-kit-bom-sku-${idx}`}
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
                              data-testid={`input-kit-bom-desc-${idx}`}
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
                              data-testid={`input-kit-bom-qty-${idx}`}
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
                                    data-testid={`button-kit-bom-up-${idx}`}
                                  >
                                    <ChevronUp className="w-3.5 h-3.5" />
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
                                    data-testid={`button-kit-bom-down-${idx}`}
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
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
                                    data-testid={`button-kit-remove-bom-${idx}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
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

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel-kit"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-save-kit"
                  >
                    {createMutation.isPending ? "Creating..." : "Create Kit"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        }
      />

      <div className="p-6 space-y-6">

      {/* Edit Dialog */}
      <Dialog open={!!editingKit} onOpenChange={() => setEditingKit(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Kit</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kit Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Premium Pro Kit" {...field} data-testid="input-edit-kit-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the kit and its benefits..."
                        className="min-h-[100px]"
                        {...field}
                        data-testid="input-edit-kit-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="includes"
                render={() => (
                  <FormItem>
                    <FormLabel>Included Items</FormLabel>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={includesInput}
                          onChange={(e) => setIncludesInput(e.target.value)}
                          placeholder="Add an included item..."
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddInclude())}
                          data-testid="input-edit-kit-include"
                        />
                        <Button type="button" onClick={handleAddInclude} data-testid="button-add-include-edit">
                          Add
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {form.watch("includes").map((item, index) => (
                          <div key={index} className="flex items-center gap-2 bg-muted p-2 rounded-md">
                            <div className="flex flex-col gap-0.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => handleMoveIncludeUp(index)}
                                    disabled={index === 0 || editingItemIndex !== null}
                                    data-testid={`button-edit-move-include-up-${index}`}
                                  >
                                    <ChevronUp className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Move item up</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => handleMoveIncludeDown(index)}
                                    disabled={index === form.watch("includes").length - 1 || editingItemIndex !== null}
                                    data-testid={`button-edit-move-include-down-${index}`}
                                  >
                                    <ChevronDown className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Move item down</TooltipContent>
                              </Tooltip>
                            </div>
                            {editingItemIndex === index ? (
                              <>
                                <Input
                                  value={editingItemText}
                                  onChange={(e) => setEditingItemText(e.target.value)}
                                  className="flex-1"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleSaveEditItem();
                                    } else if (e.key === "Escape") {
                                      handleCancelEditItem();
                                    }
                                  }}
                                  autoFocus
                                  data-testid={`input-edit-item-edit-${index}`}
                                />
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={handleSaveEditItem}
                                      data-testid={`button-save-item-edit-${index}`}
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Save item</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={handleCancelEditItem}
                                      data-testid={`button-cancel-item-edit-${index}`}
                                    >
                                      ×
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Cancel edit</TooltipContent>
                                </Tooltip>
                              </>
                            ) : (
                              <>
                                <span className="flex-1 text-sm">{item}</span>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => handleStartEditItem(index)}
                                      data-testid={`button-edit-item-edit-${index}`}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit item</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                      onClick={() => handleRemoveInclude(index)}
                                      data-testid={`button-remove-include-edit-${index}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Remove item</TooltipContent>
                                </Tooltip>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="headlineMachines"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Headline Machines (Build Sheet & Kiosk)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={"e.g.\nTyre Changer\nWheel Balancer\nSilent Compressor"}
                        className="min-h-[90px] font-mono text-sm"
                        value={(field.value ?? []).join("\n")}
                        onChange={(e) => {
                          const lines = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
                          field.onChange(lines.length > 0 ? lines : null);
                        }}
                        data-testid="input-edit-kit-headline-machines"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      One machine per line. Shown as an "Includes:" sub-line under the pack name on the build sheet and kiosk so the workshop can see the headline machines at a glance.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="powerKw"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Power (kW)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 3.5" {...field} data-testid="input-edit-kit-power" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                          placeholder="0.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          data-testid="input-edit-kit-price"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
                        data-testid="input-edit-kit-cost-price"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Used to calculate profit margin on quotes</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="serviceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Type</FormLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      {([
                        { value: "car", label: "Car & Van" },
                        { value: "commercial", label: "Commercial" },
                        { value: "hybrid", label: "Hybrid" },
                      ] as const).map(({ value, label }) => {
                        const checked = (field.value as string[])?.includes(value) ?? false;
                        return (
                          <label
                            key={value}
                            className={`flex items-center gap-2 p-3 rounded-md border cursor-pointer hover-elevate ${checked ? "border-accent bg-accent/10" : "border-border"}`}
                            data-testid={`checkbox-service-type-edit-${value}`}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) => {
                                const current = (field.value as string[]) ?? [];
                                field.onChange(c ? [...current, value] : current.filter(t => t !== value));
                              }}
                            />
                            <span className="text-sm">{label}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Select all that apply — controls which customers see this kit
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                        data-testid="uploader-edit-kit-images"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="euroSixCompatible"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Euro 6 Compatible</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Select for Euro 6 vehicles (newer vans with smart alternators/split chargers)
                      </div>
                    </div>
                    <FormControl>
                      <AdminSwitch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-edit-kit-euro6"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="published"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Published</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Make this kit visible in the configurator
                      </div>
                    </div>
                    <FormControl>
                      <AdminSwitch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-edit-kit-published"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* ── SKU & Bill of Materials (AutoTradeOS) ─────────────── */}
              <div className="space-y-4 pt-2 border-t">
                <div>
                  <Label className="text-sm font-medium">SKU</Label>
                  <p className="text-sm text-muted-foreground mb-1">AutoTradeOS stock-keeping unit — used when pushing this build to the warehouse.</p>
                  <Input
                    placeholder="e.g. ATS-KIT-001"
                    value={form.watch("sku") ?? ""}
                    onChange={e => form.setValue("sku", e.target.value || null)}
                    data-testid="input-edit-kit-sku"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Bill of Materials</p>
                      <p className="text-sm text-muted-foreground">Component parts sent to the AutoTradeOS warehouse. Leave empty if this kit ships as a single unit.</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const current = form.getValues("skuComponents") || [];
                        form.setValue("skuComponents", [...current, { sku: "", description: "", quantity: 1 }]);
                      }}
                      data-testid="button-edit-add-bom-row-kit"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Part
                    </Button>
                  </div>
                  {(form.watch("skuComponents") || []).length > 0 && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-[1fr_2fr_72px_36px] gap-2 text-xs font-medium text-muted-foreground px-1">
                        <span>Part SKU</span><span>Description</span><span>Qty</span><span />
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
                            data-testid={`input-edit-kit-bom-sku-${idx}`}
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
                            data-testid={`input-edit-kit-bom-desc-${idx}`}
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
                            data-testid={`input-edit-kit-bom-qty-${idx}`}
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
                                  data-testid={`button-edit-kit-bom-up-${idx}`}
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
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
                                  data-testid={`button-edit-kit-bom-down-${idx}`}
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
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
                                  data-testid={`button-edit-kit-remove-bom-${idx}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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

              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingKit(null)}
                  data-testid="button-cancel-edit-kit"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  data-testid="button-update-kit"
                >
                  {updateMutation.isPending ? "Updating..." : "Update Kit"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {kits.map((kit, index) => (
          <Card key={kit.id} className="overflow-hidden flex flex-col">
            <div className="aspect-video relative bg-muted group">
              {kit.images?.[0] ? (
                <img
                  src={kit.images[0]}
                  alt={kit.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-12 h-12 text-muted-foreground/50" />
                </div>
              )}
              <div className="absolute top-2 right-2 flex gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                      onClick={() => handleMoveKitUp(index)}
                      disabled={index === 0}
                      data-testid={`button-card-move-up-${kit.id}`}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Move kit up</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8 bg-background/80 backdrop-blur-sm"
                      onClick={() => handleMoveKitDown(index)}
                      disabled={index === kits.length - 1}
                      data-testid={`button-card-move-down-${kit.id}`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Move kit down</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <CardTitle className="text-lg">{kit.name}</CardTitle>
                <div className="flex flex-wrap gap-2">
                  {!kit.published && (
                    <Badge variant="outline">Unpublished</Badge>
                  )}
                  {kit.euroSixCompatible && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 no-default-hover-elevate">Euro 6</Badge>
                  )}
                  {kit.sku && (
                    <Badge
                      variant="outline"
                      className="font-mono text-xs gap-1 cursor-pointer select-none"
                      data-testid={`badge-kit-sku-${kit.id}`}
                      onClick={(e) => handleCopyKitSku(kit.id, kit.sku!, e)}
                      title="Click to copy SKU"
                    >
                      {copiedKitSkuId === kit.id ? (
                        <>
                          <Check className="w-3 h-3" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Barcode className="w-3 h-3" />
                          {kit.sku}
                        </>
                      )}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {kit.description}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-lg">{formatPrice(kit.price)}</div>
                <div className="text-sm font-medium">{kit.powerKw}kW</div>
              </div>
              {kit.skuComponents && kit.skuComponents.length > 0 && (
                <div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => toggleBom(kit.id)}
                      data-testid={`button-kit-bom-toggle-${kit.id}`}
                    >
                      <ChevronRight className={`w-3 h-3 transition-transform ${expandedBomIds.has(kit.id) ? "rotate-90" : ""}`} />
                      View BOM ({kit.skuComponents.length} {kit.skuComponents.length === 1 ? "part" : "parts"})
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => handleCopyAllBomSkus(kit.id, kit.skuComponents!)}
                      data-testid={`button-kit-bom-copy-all-${kit.id}`}
                      title="Copy all part SKUs to clipboard"
                    >
                      {copiedAllBomId === kit.id ? (
                        <>
                          <Check className="w-3 h-3 text-green-600" />
                          <span className="text-green-600">Copied {kit.skuComponents.length} SKUs!</span>
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
                      onClick={() => handleCopyAllBomDescs(kit.id, kit.skuComponents!)}
                      data-testid={`button-kit-bom-copy-all-descs-${kit.id}`}
                      title="Copy all part descriptions to clipboard"
                    >
                      {copiedAllBomDescId === kit.id ? (
                        <>
                          <Check className="w-3 h-3 text-green-600" />
                          <span className="text-green-600">Copied {kit.skuComponents.length} descriptions!</span>
                        </>
                      ) : (
                        <>
                          <ClipboardList className="w-3 h-3" />
                          Copy all descriptions
                        </>
                      )}
                    </button>
                  </div>
                  {expandedBomIds.has(kit.id) && (
                    <div className="mt-2 rounded-md border bg-muted/40 overflow-hidden" data-testid={`table-kit-bom-${kit.id}`}>
                      <table className="w-full text-xs table-fixed">
                        <thead>
                          <tr className="border-b bg-muted/60">
                            <th className="text-left px-2 py-1.5 font-medium text-muted-foreground w-28">Part SKU</th>
                            <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">Description</th>
                            <th className="text-right px-2 py-1.5 font-medium text-muted-foreground w-10">Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {kit.skuComponents.map((part, i) => {
                            const partKey = `${kit.id}-${i}`;
                            const isCopied = copiedBomPartKey === partKey;
                            return (
                              <tr key={i} className="border-b last:border-0">
                                <td
                                  className="px-2 py-1.5 font-mono cursor-pointer select-none group"
                                  title="Click to copy SKU"
                                  data-testid={`cell-kit-bom-sku-${kit.id}-${i}`}
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
                                  data-testid={`cell-kit-bom-desc-${kit.id}-${i}`}
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
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleEditKit(kit)}
                  data-testid={`button-edit-kit-card-${kit.id}`}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      size="icon"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this kit?")) {
                          deleteMutation.mutate(kit.id);
                        }
                      }}
                      data-testid={`button-delete-kit-card-${kit.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete kit</TooltipContent>
                </Tooltip>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
    </>
  );
}
