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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, GraduationCap, X, PoundSterling } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import type { TrainingOption } from "@shared/schema";
import { AdminBackButton } from "@/components/AdminBackButton";
import { AdminPageHeader } from "@/components/AdminPageHeader";

const trainingOptionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  type: z.string().min(1, "Type is required"),
  durationDays: z.number().min(1, "Duration must be at least 1 day"),
  includes: z.array(z.string()).default([]),
  price: z.number().min(0, "Price must be positive"),
  published: z.boolean().default(true),
});

type TrainingOptionFormData = z.infer<typeof trainingOptionSchema>;

export default function AdminTrainingOptions() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<TrainingOption | null>(null);
  const [includesInput, setIncludesInput] = useState("");
  const [includesList, setIncludesList] = useState<string[]>([]);
  const { toast } = useToast();

  const { data: options = [], isLoading } = useQuery<TrainingOption[]>({
    queryKey: ["/api/admin/training-options"],
  });

  const form = useForm<TrainingOptionFormData>({
    resolver: zodResolver(trainingOptionSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "",
      durationDays: 1,
      includes: [],
      price: 0,
      published: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: TrainingOptionFormData) => {
      return apiRequest("POST", "/api/admin/training-options", {
        ...data,
        includes: includesList,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/training-options"] });
      queryClient.invalidateQueries({ queryKey: ["/api/training-options"] });
      setIsCreateDialogOpen(false);
      form.reset();
      setIncludesList([]);
      setIncludesInput("");
      toast({ title: "Training option created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create training option", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TrainingOptionFormData }) => {
      return apiRequest("PUT", `/api/admin/training-options/${id}`, {
        ...data,
        includes: includesList,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/training-options"] });
      queryClient.invalidateQueries({ queryKey: ["/api/training-options"] });
      setEditingOption(null);
      form.reset();
      setIncludesList([]);
      setIncludesInput("");
      toast({ title: "Training option updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update training option", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/training-options/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/training-options"] });
      queryClient.invalidateQueries({ queryKey: ["/api/training-options"] });
      toast({ title: "Training option deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete training option", variant: "destructive" });
    },
  });

  const handleEditOption = (option: TrainingOption) => {
    setEditingOption(option);
    setIncludesList(option.includes || []);
    form.reset({
      name: option.name,
      description: option.description,
      type: option.type,
      durationDays: option.durationDays,
      includes: option.includes || [],
      price: option.price,
      published: option.published,
    });
  };

  const handleAddInclude = () => {
    if (includesInput.trim()) {
      setIncludesList([...includesList, includesInput.trim()]);
      setIncludesInput("");
    }
  };

  const handleRemoveInclude = (index: number) => {
    setIncludesList(includesList.filter((_, i) => i !== index));
  };

  const onSubmit = (data: TrainingOptionFormData) => {
    if (editingOption) {
      updateMutation.mutate({ id: editingOption.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const formatPrice = (pence: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
    }).format(pence / 100);
  };

  const handleCloseDialog = () => {
    setIsCreateDialogOpen(false);
    setEditingOption(null);
    form.reset();
    setIncludesList([]);
    setIncludesInput("");
  };

  if (isLoading) {
    return (
      <div>
        <AdminPageHeader title="Training Options" description="Manage training programmes available in the configurator" />
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
        title="Training Options"
        description="Manage training programmes available in the configurator"
        actions={
          <Dialog open={isCreateDialogOpen || !!editingOption} onOpenChange={(open) => {
            if (!open) handleCloseDialog();
            else setIsCreateDialogOpen(true);
          }}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-create-training">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add Training Option
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingOption ? "Edit Training Option" : "Create Training Option"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., REACT Training" data-testid="input-name" />
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
                          <Textarea {...field} placeholder="Describe the training programme..." rows={3} data-testid="input-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., REACT, Tyre Fitting" data-testid="input-type" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="durationDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duration (days)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              data-testid="input-duration"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price (in pence)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <PoundSterling className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              className="pl-10"
                              placeholder="e.g., 50000 (£500)"
                              data-testid="input-price"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                        {field.value > 0 && (
                          <p className="text-sm text-muted-foreground">
                            Display price: {formatPrice(field.value)}
                          </p>
                        )}
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <Label>What's Included</Label>
                    <div className="flex gap-2">
                      <Input
                        value={includesInput}
                        onChange={(e) => setIncludesInput(e.target.value)}
                        placeholder="Add an item..."
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddInclude();
                          }
                        }}
                        data-testid="input-includes"
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="button" onClick={handleAddInclude} variant="outline" size="icon" aria-label="Add item" data-testid="button-add-include">
                            <Plus className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Add item</TooltipContent>
                      </Tooltip>
                    </div>
                    {includesList.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {includesList.map((item, index) => (
                          <Badge key={index} variant="secondary" className="gap-1" data-testid={`badge-include-${index}`}>
                            {item}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  aria-label="Remove item"
                                  onClick={() => handleRemoveInclude(index)}
                                  className="ml-1 hover:text-destructive"
                                  data-testid={`button-remove-include-${index}`}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Remove item</TooltipContent>
                            </Tooltip>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name="published"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Published</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Make this training option visible to customers
                          </p>
                        </div>
                        <FormControl>
                          <AdminSwitch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-published"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={handleCloseDialog} data-testid="button-cancel">
                      Cancel
                    </Button>
                    <Button type="submit" data-testid="button-save">
                      {editingOption ? "Update" : "Create"} Training Option
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-6 space-y-6">
      <div className="grid gap-4">
          {options.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <GraduationCap className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No training options yet. Create one to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            options.map((option) => (
              <Card key={option.id} data-testid={`card-training-${option.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-xl" data-testid={`text-name-${option.id}`}>{option.name}</CardTitle>
                        {!option.published && (
                          <Badge variant="secondary">Draft</Badge>
                        )}
                        <Badge variant="outline" data-testid={`badge-type-${option.id}`}>{option.type}</Badge>
                      </div>
                      <p className="text-muted-foreground text-sm" data-testid={`text-description-${option.id}`}>
                        {option.description}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label="Edit training option"
                            onClick={() => handleEditOption(option)}
                            data-testid={`button-edit-${option.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit training option</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label="Delete training option"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this training option?")) {
                                deleteMutation.mutate(option.id);
                              }
                            }}
                            data-testid={`button-delete-${option.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete training option</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Duration</p>
                      <p className="font-medium" data-testid={`text-duration-${option.id}`}>
                        {option.durationDays} {option.durationDays === 1 ? 'day' : 'days'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Price</p>
                      <p className="font-medium" data-testid={`text-price-${option.id}`}>{formatPrice(option.price)}</p>
                    </div>
                  </div>
                  {option.includes && option.includes.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">What's Included:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {option.includes.map((item, index) => (
                          <li key={index} className="text-sm" data-testid={`text-include-${option.id}-${index}`}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
      </div>
    </div>
    </>
  );
}
