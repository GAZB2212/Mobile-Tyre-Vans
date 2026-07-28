import { useState } from "react";
import { useFileUpload, uploadToObjectStorage } from "@/hooks/use-file-upload";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminBackButton } from "@/components/AdminBackButton";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus, Video, Eye, EyeOff, Upload, CheckCircle2, Loader2, Star } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { GalleryItem, InsertGalleryItem } from "@shared/schema";

const categories = [
  "Complete Builds",
  "Interior Layouts",
  "Equipment Installation",
  "Branding & Livery",
  "Van Designs",
  "Process Videos",
  "Customer Showcases",
] as const;

function inferMimeType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    mov: "video/quicktime",
    mp4: "video/mp4",
    webm: "video/webm",
    ogg: "video/ogg",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
  };
  return map[ext ?? ""] || "application/octet-stream";
}

function FileUploadField({
  label,
  accept,
  currentUrl,
  onUploaded,
  testId,
}: {
  label: string;
  accept: string;
  currentUrl: string;
  onUploaded: (url: string) => void;
  testId?: string;
}) {
  const { uploading, inputRef, handleChange } = useFileUpload({
    uploadFn: (file) => uploadToObjectStorage(file, inferMimeType(file)),
    onSuccess: onUploaded,
    successToast: { title: "Uploaded" },
    errorToast: { title: "Upload failed", description: "Could not upload file" },
  });

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
        data-testid={testId}
      />
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>
          ) : (
            <><Upload className="w-4 h-4 mr-2" />Choose File</>
          )}
        </Button>
        {currentUrl && (
          <span className="flex items-center gap-1 text-sm text-accent">
            <CheckCircle2 className="w-4 h-4" />
            {currentUrl.split("/").pop()}
          </span>
        )}
      </div>
    </div>
  );
}

export default function AdminGalleryItems() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    category: categories[0],
    type: "image" as "image" | "video",
    fileUrl: "",
    thumbnailUrl: "",
    description: "",
    sortOrder: 0,
    published: true,
    featured: false,
  });

  const { data: items = [], isLoading } = useQuery<GalleryItem[]>({
    queryKey: ["/api/admin/gallery-items"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertGalleryItem) => {
      const response = await apiRequest("POST", "/api/admin/gallery-items", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gallery-items"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: "Success", description: "Gallery item created successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create gallery item.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertGalleryItem> }) => {
      await apiRequest("PUT", `/api/admin/gallery-items/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gallery-items"] });
      setIsEditDialogOpen(false);
      setEditingItem(null);
      resetForm();
      toast({ title: "Success", description: "Gallery item updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update gallery item.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/gallery-items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gallery-items"] });
      toast({ title: "Success", description: "Gallery item deleted successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete gallery item.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      category: categories[0],
      type: "image",
      fileUrl: "",
      thumbnailUrl: "",
      description: "",
      sortOrder: 0,
      published: true,
      featured: false,
    });
  };

  const handleEdit = (item: GalleryItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      category: item.category,
      type: item.type as "image" | "video",
      fileUrl: item.fileUrl,
      thumbnailUrl: item.thumbnailUrl || "",
      description: item.description || "",
      sortOrder: item.sortOrder,
      published: item.published,
      featured: item.featured ?? false,
    });
    setIsEditDialogOpen(true);
  };

  const toggleFeaturedMutation = useMutation({
    mutationFn: async ({ id, featured }: { id: string; featured: boolean }) => {
      await apiRequest("PUT", `/api/admin/gallery-items/${id}`, { featured });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gallery-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gallery-items"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update featured status.", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fileUrl) {
      toast({ title: "Error", description: "Please upload a file first", variant: "destructive" });
      return;
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const closeDialog = () => {
    setIsCreateDialogOpen(false);
    setIsEditDialogOpen(false);
    setEditingItem(null);
    resetForm();
  };

  return (
    <>
      <AdminBackButton />
      <AdminPageHeader
        title="Gallery Items"
        description="Manage gallery images and videos"
        actions={
          <Button size="sm" onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-item">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Item
          </Button>
        }
      />
      <div className="p-6">

        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : items.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No gallery items yet</CardTitle>
              <CardDescription>Create your first gallery item to get started</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-lg">
          <Card>
            <Table className="min-w-[700px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Preview</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Homepage</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} data-testid={`row-item-${item.id}`}>
                    <TableCell>
                      <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center overflow-hidden">
                        {item.type === "video" ? (
                          <Video className="w-8 h-8 text-muted-foreground" />
                        ) : (
                          <img
                            src={item.fileUrl}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell>
                      <Badge variant={item.type === "video" ? "secondary" : "default"}>
                        {item.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.sortOrder}</TableCell>
                    <TableCell>
                      {item.published ? (
                        <Badge variant="default">
                          <Eye className="w-3 h-3 mr-1" />
                          Published
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <EyeOff className="w-3 h-3 mr-1" />
                          Draft
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleFeaturedMutation.mutate({ id: item.id, featured: !item.featured })}
                            disabled={toggleFeaturedMutation.isPending}
                            data-testid={`button-feature-${item.id}`}
                          >
                            <Star className={`w-4 h-4 ${item.featured ? "fill-accent text-accent" : "text-muted-foreground"}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{item.featured ? "Remove from homepage" : "Feature on homepage"}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(item)}
                            data-testid={`button-edit-${item.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit gallery item</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this item?")) {
                                deleteMutation.mutate(item.id);
                              }
                            }}
                            data-testid={`button-delete-${item.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete gallery item</TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          </div>
        )}

        <Dialog
          open={isCreateDialogOpen || isEditDialogOpen}
          onOpenChange={(open) => { if (!open) closeDialog(); }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Gallery Item" : "Create Gallery Item"}</DialogTitle>
              <DialogDescription>
                {editingItem ? "Update gallery item details" : "Add a new item to the gallery"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  data-testid="input-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger id="category" data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: "image" | "video") =>
                    setFormData({ ...formData, type: value, fileUrl: "", thumbnailUrl: "" })
                  }
                >
                  <SelectTrigger id="type" data-testid="select-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <FileUploadField
                label="File Upload"
                accept={formData.type === "video" ? "video/mp4,video/quicktime,video/webm,video/ogg,.mp4,.mov,.webm,.ogg" : "image/*"}
                currentUrl={formData.fileUrl}
                onUploaded={(url) => setFormData((prev) => ({ ...prev, fileUrl: url }))}
                testId="input-file-upload"
              />

              {formData.type === "video" && (
                <>
                  <p className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
                    Use MP4 format for best browser compatibility. MOV files (from iPhone) may not play in Chrome or Firefox — only Safari supports them.
                  </p>
                  <FileUploadField
                    label="Thumbnail (Optional)"
                    accept="image/*"
                    currentUrl={formData.thumbnailUrl}
                    onUploaded={(url) => setFormData((prev) => ({ ...prev, thumbnailUrl: url }))}
                    testId="input-thumbnail-upload"
                  />
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  data-testid="input-description"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sortOrder">Sort Order</Label>
                  <Input
                    id="sortOrder"
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) =>
                      setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })
                    }
                    data-testid="input-sort-order"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="published">Status</Label>
                  <Select
                    value={formData.published ? "published" : "draft"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, published: value === "published" })
                    }
                  >
                    <SelectTrigger id="published" data-testid="select-published">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="featured">Homepage Feature</Label>
                <Select
                  value={formData.featured ? "featured" : "not-featured"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, featured: value === "featured" })
                  }
                >
                  <SelectTrigger id="featured" data-testid="select-featured">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="featured">Featured on homepage</SelectItem>
                    <SelectItem value="not-featured">Gallery only</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Featured items appear in the "Featured Builds" section on the homepage</p>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending || !formData.fileUrl}
                  data-testid="button-submit"
                >
                  {editingItem ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
