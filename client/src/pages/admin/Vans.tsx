import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Car, Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { VanImages } from "@/components/VanImages";
import { VanFormNew } from "./VanFormNew";
import { VanWizard } from "@/components/VanWizard";
import type { Van, InsertVan, VanWithSaleStatus, VanSaleStatus } from "@shared/schema";
import { AdminBackButton } from "@/components/AdminBackButton";
import { AdminPageHeader } from "@/components/AdminPageHeader";

export default function AdminVans() {
  const { toast } = useToast();
  const [editingVanId, setEditingVanId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editDialogTab, setEditDialogTab] = useState<string>("details");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch vans (using admin endpoint to see all vans including unpublished).
  // The admin endpoint also returns the computed sale state for each van.
  const { data: vans = [], isLoading } = useQuery<VanWithSaleStatus[]>({
    queryKey: ['/api/admin/vans'],
  });

  // Set a van's manual sale status (available / deposit taken / sold)
  const saleStatusMutation = useMutation({
    mutationFn: async ({ id, saleStatus }: { id: string; saleStatus: VanSaleStatus }) => {
      await apiRequest('PUT', `/api/admin/vans/${id}`, { saleStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/vans'] });
      toast({ title: "Updated", description: "Van sale status updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update sale status.", variant: "destructive" });
    },
  });

  // Derive editingVan live from query cache so images update immediately after upload
  const editingVan = vans.find(v => v.id === editingVanId) ?? null;

  // Create van mutation
  const createVanMutation = useMutation({
    mutationFn: async (vanData: InsertVan) => {
      const response = await apiRequest('POST', '/api/admin/vans', vanData);
      return response.json();
    },
    onSuccess: async (createdVan: Van) => {
      await queryClient.invalidateQueries({ queryKey: ['/api/admin/vans'] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Van created!",
        description: "Add photos using the Images tab below.",
      });
      // Open edit dialog straight onto the Images tab so photos can be added immediately
      setEditingVanId(createdVan.id);
      setEditDialogTab("images");
      setIsEditDialogOpen(true);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create van.",
        variant: "destructive",
      });
    },
  });

  // Update van mutation
  const updateVanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertVan> }) => {
      await apiRequest('PUT', `/api/admin/vans/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/vans'] });
      setIsEditDialogOpen(false);
      setEditingVanId(null);
      toast({
        title: "Success",
        description: "Van updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update van.",
        variant: "destructive",
      });
    },
  });

  // Delete van mutation
  const deleteVanMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/admin/vans/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/vans'] });
      toast({
        title: "Success",
        description: "Van deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete van.",
        variant: "destructive",
      });
    },
  });

  // Fix van image ACLs mutation
  const fixAclsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/admin/vans/fix-acls', {});
      return response.json();
    },
    onSuccess: (data: { fixedCount: number; message: string }) => {
      toast({
        title: "Success",
        description: data.message || `Fixed ${data.fixedCount} images`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to fix image permissions.",
        variant: "destructive",
      });
    },
  });

  const handleCreateVan = async (formData: FormData, selectedFiles?: File[]) => {
    const files = selectedFiles;

    // Upload images first if any (max 10)
    let imageUrls: string[] = [];
    if (files && files.length > 0) {
      try {
        toast({
          title: "Uploading images...",
          description: `Uploading ${files.length} image(s)`,
        });

        for (let i = 0; i < files.length; i++) {
          const uploadFormData = new FormData();
          uploadFormData.append('file', files[i]);

          const response = await fetch(`/api/admin/temp-upload`, {
            method: 'POST',
            credentials: 'include',
            body: uploadFormData,
          });

          if (!response.ok) throw new Error('Upload failed');
          
          const data = await response.json();
          imageUrls.push(data.url);
          // File is automatically made public during upload - no ACL step needed
        }
      } catch (error) {
        toast({
          title: "Upload failed",
          description: "Could not upload images",
          variant: "destructive",
        });
        return;
      }
    }

    const vanData: InsertVan = {
      slug: formData.get('slug') as string,
      reg: (formData.get('reg') as string)?.toUpperCase().trim() || undefined,
      title: formData.get('title') as string,
      make: formData.get('make') as string,
      model: formData.get('model') as string,
      year: parseInt(formData.get('year') as string),
      mileage: parseInt(formData.get('mileage') as string),
      price: parseInt(formData.get('price') as string) * 100,
      vatIncluded: formData.get('vatIncluded') === 'on',
      specs: {
        transmission: formData.get('transmission') as string,
        size: formData.get('size') as string,
        fuel: formData.get('fuel') as string,
        doors: parseInt(formData.get('doors') as string) || undefined,
        engine: formData.get('engine') as string || undefined,
      },
      images: imageUrls,
      heroImage: imageUrls[0] || undefined,
      description: (formData.get('description') as string) || undefined,
      published: formData.get('published') === 'on',
      euroStatus: (formData.get('euroStatus') as string) || undefined,
      urgencyBadge: (() => { const v = formData.get('urgencyBadge') as string; return (v && v !== 'none') ? v : null; })(),
      expectedArrivalDate: (() => {
        const v = formData.get('expectedArrivalDate') as string;
        return v ? (new Date(`${v}T00:00:00.000Z`) as any) : null;
      })(),
    };

    createVanMutation.mutate(vanData);
  };

  const handleUpdateVan = async (formData: FormData, selectedFiles?: File[]) => {
    if (!editingVan) return;

    // Upload new images if any
    let newImageUrls: string[] = [];
    if (selectedFiles && selectedFiles.length > 0) {
      try {
        toast({
          title: "Uploading images...",
          description: `Uploading ${selectedFiles.length} image(s)`,
        });

        for (let i = 0; i < selectedFiles.length; i++) {
          const uploadFormData = new FormData();
          uploadFormData.append('file', selectedFiles[i]);

          const response = await fetch('/api/admin/temp-upload', {
            method: 'POST',
            credentials: 'include',
            body: uploadFormData,
          });

          if (!response.ok) {
            throw new Error(`Failed to upload image ${i + 1}`);
          }

          const { url } = await response.json();
          newImageUrls.push(url);
        }

        toast({
          title: "Images uploaded",
          description: `Successfully uploaded ${newImageUrls.length} image(s)`,
        });
      } catch (error) {
        toast({
          title: "Image upload failed",
          description: error instanceof Error ? error.message : "Failed to upload images",
          variant: "destructive",
        });
        return;
      }
    }

    // Get existing images from the form (if managing them separately)
    const imagesJson = formData.get('images') as string;
    const existingImages = imagesJson ? JSON.parse(imagesJson) : (editingVan.images || []);

    // Combine existing and new images
    const allImages = [...existingImages, ...newImageUrls];

    const vanData: Partial<InsertVan> = {
      slug: formData.get('slug') as string,
      reg: (formData.get('reg') as string)?.toUpperCase().trim() || undefined,
      title: formData.get('title') as string,
      make: formData.get('make') as string,
      model: formData.get('model') as string,
      year: parseInt(formData.get('year') as string),
      mileage: parseInt(formData.get('mileage') as string),
      price: parseInt(formData.get('price') as string) * 100, // Convert to pence
      vatIncluded: formData.get('vatIncluded') === 'on',
      specs: {
        transmission: formData.get('transmission') as string,
        size: formData.get('size') as string,
        fuel: formData.get('fuel') as string,
        doors: parseInt(formData.get('doors') as string) || undefined,
        engine: formData.get('engine') as string || undefined,
      },
      images: allImages,
      heroImage: allImages[0] || formData.get('heroImage') as string || undefined,
      description: (formData.get('description') as string) || undefined,
      published: formData.get('published') === 'on',
      euroStatus: (formData.get('euroStatus') as string) || undefined,
      urgencyBadge: (() => { const v = formData.get('urgencyBadge') as string; return (v && v !== 'none') ? v : null; })(),
      expectedArrivalDate: (() => {
        const v = formData.get('expectedArrivalDate') as string;
        return v ? (new Date(`${v}T00:00:00.000Z`) as any) : null;
      })(),
    };

    updateVanMutation.mutate({ id: editingVan.id, data: vanData });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading vans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminBackButton />
      <AdminPageHeader
        title="Van Management"
        description="Manage your van inventory and listings"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fixAclsMutation.mutate()}
              disabled={fixAclsMutation.isPending}
              data-testid="button-fix-acls"
            >
              {fixAclsMutation.isPending ? "Fixing..." : "Fix Image Permissions"}
            </Button>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-create-van">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Add Van
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <VanWizard onComplete={handleCreateVan} isLoading={createVanMutation.isPending} />
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="container mx-auto px-4 py-8">
        {vans.length > 0 && (
          <div className="mb-6 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by registration, title, make or model…"
                className="pl-9"
                data-testid="input-search-vans"
              />
            </div>
          </div>
        )}

        {vans.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Car className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No vans found</h3>
              <p className="text-muted-foreground mb-4">
                Get started by adding your first van to the inventory
              </p>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                data-testid="button-create-first-van"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Van
              </Button>
            </CardContent>
          </Card>
        ) : (() => {
          const q = searchQuery.trim().toLowerCase();
          const qNoSpace = q.replace(/\s+/g, "");
          const filteredVans = q
            ? vans.filter((v) => {
                const reg = (v.reg ?? "").toLowerCase().replace(/\s+/g, "");
                return (
                  reg.includes(qNoSpace) ||
                  (v.title ?? "").toLowerCase().includes(q) ||
                  (v.make ?? "").toLowerCase().includes(q) ||
                  (v.model ?? "").toLowerCase().includes(q)
                );
              })
            : vans;
          if (filteredVans.length === 0) {
            return (
              <Card>
                <CardContent className="py-8 text-center">
                  <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground" data-testid="text-no-vans-match">
                    No vans match "{searchQuery}".
                  </p>
                </CardContent>
              </Card>
            );
          }
          return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVans.map((van) => (
              <Card key={van.id} className="hover-elevate">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-lg">{van.title}</CardTitle>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {van.effectiveSaleStatus !== "available" && (
                        <Badge
                          className={
                            van.effectiveSaleStatus === "sold"
                              ? "bg-red-600 text-white border-red-600"
                              : "bg-amber-500 text-black border-amber-500"
                          }
                          data-testid={`badge-van-sale-status-${van.id}`}
                        >
                          {van.effectiveSaleStatus === "sold" ? "Sold" : "Deposit Taken"}
                        </Badge>
                      )}
                      <Badge variant={van.published ? "default" : "secondary"}>
                        {van.published ? "Published" : "Draft"}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>
                    {van.year} {van.make} {van.model}
                  </CardDescription>
                  {van.reg && (
                    <div className="pt-1">
                      <Badge
                        variant="outline"
                        className="font-mono uppercase tracking-wider"
                        data-testid={`badge-van-reg-${van.id}`}
                      >
                        {van.reg}
                      </Badge>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Price:</span>
                      <span className="font-medium">£{(van.price / 100).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Mileage:</span>
                      <span>{van.mileage.toLocaleString()} miles</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Size:</span>
                      <span>{van.specs.size}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Transmission:</span>
                      <span>{van.specs.transmission}</span>
                    </div>
                  </div>
                  <div className="mb-4 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Sale status</Label>
                    <Select
                      value={van.saleStatus ?? "available"}
                      onValueChange={(value) =>
                        saleStatusMutation.mutate({ id: van.id, saleStatus: value as VanSaleStatus })
                      }
                      disabled={saleStatusMutation.isPending}
                    >
                      <SelectTrigger data-testid={`select-van-sale-status-${van.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="deposit_taken">Deposit Taken</SelectItem>
                        <SelectItem value="sold">Sold</SelectItem>
                      </SelectContent>
                    </Select>
                    {van.derivedSaleStatus !== "available" && (
                      <p className="text-xs text-muted-foreground" data-testid={`text-van-sale-auto-${van.id}`}>
                        Auto-set to "{van.derivedSaleStatus === "sold" ? "Sold" : "Deposit Taken"}" from a linked quote.
                      </p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setEditingVanId(van.id);
                        setEditDialogTab("details");
                        setIsEditDialogOpen(true);
                      }}
                      data-testid={`button-edit-van-${van.id}`}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete "${van.title}"?`)) {
                              deleteVanMutation.mutate(van.id);
                            }
                          }}
                          data-testid={`button-delete-van-${van.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete van</TooltipContent>
                    </Tooltip>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          );
        })()}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditingVanId(null);
            setEditDialogTab("details");
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Van</DialogTitle>
              <DialogDescription>
                Update van information, specifications, and images
              </DialogDescription>
            </DialogHeader>
            {editingVan && (
              <Tabs value={editDialogTab} onValueChange={setEditDialogTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="details" data-testid="tab-details">Details</TabsTrigger>
                  <TabsTrigger value="images" data-testid="tab-images">Images</TabsTrigger>
                </TabsList>
                <TabsContent value="details">
                  <VanFormNew
                    van={editingVan}
                    onSubmit={handleUpdateVan}
                    isLoading={updateVanMutation.isPending}
                  />
                </TabsContent>
                <TabsContent value="images">
                  <VanImages 
                    vanId={editingVan.id} 
                    images={editingVan.images || []} 
                    heroImage={editingVan.heroImage}
                  />
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}