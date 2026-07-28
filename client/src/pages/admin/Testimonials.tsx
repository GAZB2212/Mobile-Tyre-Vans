import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminBackButton } from "@/components/AdminBackButton";
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
import { Pencil, Trash2, Plus, Eye, EyeOff, ChevronUp, ChevronDown, Star, Mail } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Testimonial, InsertTestimonial } from "@shared/schema";

const QUERY_KEY = "/api/admin/testimonials";

type SendRequestForm = {
  customerName: string;
  customerEmail: string;
};

type FormData = {
  name: string;
  company: string;
  location: string;
  content: string;
  rating: number;
  sortOrder: number;
  published: boolean;
};

const defaultForm: FormData = {
  name: "",
  company: "",
  location: "",
  content: "",
  rating: 5,
  sortOrder: 0,
  published: true,
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i <= rating ? "fill-accent text-accent" : "text-muted-foreground"}`}
        />
      ))}
    </div>
  );
}

export default function AdminTestimonials() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isFullAdmin = user?.adminRole === "full";
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Testimonial | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultForm);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [sendForm, setSendForm] = useState<SendRequestForm>({ customerName: "", customerEmail: "" });

  const { data: items = [], isLoading } = useQuery<Testimonial[]>({
    queryKey: [QUERY_KEY],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertTestimonial) => {
      const response = await apiRequest("POST", "/api/admin/testimonials", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["/api/testimonials"] });
      closeDialog();
      toast({ title: "Testimonial created successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create testimonial.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertTestimonial> }) => {
      await apiRequest("PATCH", `/api/admin/testimonials/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["/api/testimonials"] });
      closeDialog();
      toast({ title: "Testimonial updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update testimonial.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/testimonials/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["/api/testimonials"] });
      toast({ title: "Testimonial deleted." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete testimonial.", variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertTestimonial> }) => {
      await apiRequest("PATCH", `/api/admin/testimonials/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["/api/testimonials"] });
    },
  });

  const sendRequestMutation = useMutation({
    mutationFn: async (data: SendRequestForm) => {
      const response = await apiRequest("POST", "/api/admin/testimonials/send-request", data);
      return response.json();
    },
    onSuccess: () => {
      setIsSendDialogOpen(false);
      setSendForm({ customerName: "", customerEmail: "" });
      toast({ title: "Request sent", description: "The customer has been emailed a review link." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send the request email.", variant: "destructive" });
    },
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
    setFormData(defaultForm);
  };

  const handleEdit = (item: Testimonial) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      company: item.company,
      location: item.location ?? "",
      content: item.content,
      rating: item.rating,
      sortOrder: item.sortOrder,
      published: item.published,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: InsertTestimonial = {
      ...formData,
      location: formData.location || null,
    };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleMoveUp = (item: Testimonial, index: number) => {
    if (index === 0) return;
    const sibling = items[index - 1];
    reorderMutation.mutate({ id: item.id, data: { sortOrder: sibling.sortOrder } });
    reorderMutation.mutate({ id: sibling.id, data: { sortOrder: item.sortOrder } });
  };

  const handleMoveDown = (item: Testimonial, index: number) => {
    if (index === items.length - 1) return;
    const sibling = items[index + 1];
    reorderMutation.mutate({ id: item.id, data: { sortOrder: sibling.sortOrder } });
    reorderMutation.mutate({ id: sibling.id, data: { sortOrder: item.sortOrder } });
  };

  const handleTogglePublished = (item: Testimonial) => {
    updateMutation.mutate({ id: item.id, data: { published: !item.published } });
  };

  return (
    <>
      <AdminBackButton />
      <div className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-testimonials-title">
              Testimonials
            </h1>
            <p className="text-muted-foreground">Manage customer testimonials shown on the homepage</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setIsSendDialogOpen(true)} data-testid="button-send-request" className="flex-shrink-0">
              <Mail className="w-4 h-4 mr-2" />
              Request a Review
            </Button>
            {isFullAdmin && (
              <Button onClick={() => setIsDialogOpen(true)} data-testid="button-create-testimonial" className="flex-shrink-0">
                <Plus className="w-4 h-4 mr-2" />
                Add Testimonial
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : items.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No testimonials yet</CardTitle>
              <CardDescription>
                {isFullAdmin
                  ? "Add your first testimonial to display it on the homepage"
                  : "No testimonials have been added yet"}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-lg">
            <Card>
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    {isFullAdmin && <TableHead>Order</TableHead>}
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Status</TableHead>
                    {isFullAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.id} data-testid={`row-testimonial-${item.id}`}>
                      {isFullAdmin && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={index === 0 || reorderMutation.isPending}
                                  onClick={() => handleMoveUp(item, index)}
                                  data-testid={`button-move-up-${item.id}`}
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Move testimonial up</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={index === items.length - 1 || reorderMutation.isPending}
                                  onClick={() => handleMoveDown(item, index)}
                                  data-testid={`button-move-down-${item.id}`}
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Move testimonial down</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        <span>{item.company}</span>
                        {item.location && (
                          <span className="text-muted-foreground text-xs block">{item.location}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StarRating rating={item.rating} />
                      </TableCell>
                      <TableCell>
                        {isFullAdmin ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTogglePublished(item)}
                            data-testid={`button-toggle-published-${item.id}`}
                          >
                            {item.published ? (
                              <Badge variant="default" className="cursor-pointer">
                                <Eye className="w-3 h-3 mr-1" />
                                Published
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="cursor-pointer">
                                <EyeOff className="w-3 h-3 mr-1" />
                                Draft
                              </Badge>
                            )}
                          </Button>
                        ) : (
                          <div data-testid={`status-published-${item.id}`}>
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
                          </div>
                        )}
                      </TableCell>
                      {isFullAdmin && (
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
                            <TooltipContent>Edit testimonial</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={deleteMutation.isPending}
                                onClick={() => {
                                  if (confirm("Delete this testimonial?")) {
                                    deleteMutation.mutate(item.id);
                                  }
                                }}
                                data-testid={`button-delete-${item.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete testimonial</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Testimonial" : "Add Testimonial"}</DialogTitle>
              <DialogDescription>
                {editingItem ? "Update this testimonial" : "Add a new customer testimonial"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Customer Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    data-testid="input-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    required
                    data-testid="input-company"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location (Optional)</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. Manchester"
                  data-testid="input-location"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Quote</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={4}
                  required
                  data-testid="input-content"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rating">Star Rating</Label>
                  <Select
                    value={String(formData.rating)}
                    onValueChange={(v) => setFormData({ ...formData, rating: parseInt(v) })}
                  >
                    <SelectTrigger id="rating" data-testid="select-rating">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((r) => (
                        <SelectItem key={r} value={String(r)}>{r} Star{r !== 1 ? "s" : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sortOrder">Sort Order</Label>
                  <Input
                    id="sortOrder"
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                    data-testid="input-sort-order"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="published">Status</Label>
                  <Select
                    value={formData.published ? "published" : "draft"}
                    onValueChange={(v) => setFormData({ ...formData, published: v === "published" })}
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

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit"
                >
                  {editingItem ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Send Review Request Dialog */}
        <Dialog open={isSendDialogOpen} onOpenChange={(open) => { if (!open) { setIsSendDialogOpen(false); setSendForm({ customerName: "", customerEmail: "" }); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Request a review</DialogTitle>
              <DialogDescription>
                Send the customer a personal link to leave a testimonial. They'll get an email with a one-click form — their review lands here as a draft for you to approve.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendRequestMutation.mutate(sendForm);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="send-name">Customer name</Label>
                <Input
                  id="send-name"
                  value={sendForm.customerName}
                  onChange={(e) => setSendForm({ ...sendForm, customerName: e.target.value })}
                  placeholder="e.g. James Smith"
                  required
                  data-testid="input-send-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="send-email">Customer email</Label>
                <Input
                  id="send-email"
                  type="email"
                  value={sendForm.customerEmail}
                  onChange={(e) => setSendForm({ ...sendForm, customerEmail: e.target.value })}
                  placeholder="e.g. james@smithtyres.co.uk"
                  required
                  data-testid="input-send-email"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setIsSendDialogOpen(false); setSendForm({ customerName: "", customerEmail: "" }); }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={sendRequestMutation.isPending}
                  data-testid="button-send-submit"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {sendRequestMutation.isPending ? "Sending..." : "Send request"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
