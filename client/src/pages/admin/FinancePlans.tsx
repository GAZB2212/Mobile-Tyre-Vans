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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, Calculator } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import type { FinancePlan } from "@shared/schema";
import { AdminBackButton } from "@/components/AdminBackButton";
import { AdminPageHeader } from "@/components/AdminPageHeader";

const financePlanSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["HP", "Lease"], { required_error: "Type is required" }),
  termMonths: z.number().min(1, "Term must be at least 1 month"),
  aprBps: z.number().min(0, "APR must be positive").max(10000, "APR cannot exceed 100%"),
  depositPercent: z.number().min(0, "Deposit must be at least 0%").max(100, "Deposit cannot exceed 100%"),
  balloonPercent: z.number().min(0, "Balloon must be positive").max(100, "Balloon cannot exceed 100%").optional().nullable(),
  notes: z.string().optional().nullable(),
  published: z.boolean().default(true),
});

type FinancePlanFormData = z.infer<typeof financePlanSchema>;

export default function AdminFinancePlans() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<FinancePlan | null>(null);
  const { toast } = useToast();

  const { data: plans = [], isLoading } = useQuery<FinancePlan[]>({
    queryKey: ["/api/admin/finance-plans"],
  });

  const form = useForm<FinancePlanFormData>({
    resolver: zodResolver(financePlanSchema),
    defaultValues: {
      name: "",
      type: "HP",
      termMonths: 60,
      aprBps: 595,
      depositPercent: 10,
      balloonPercent: null,
      notes: "",
      published: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: FinancePlanFormData) => {
      return apiRequest("POST", "/api/admin/finance-plans", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/finance-plans"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({ title: "Finance plan created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create finance plan", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FinancePlanFormData }) => {
      return apiRequest("PUT", `/api/admin/finance-plans/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/finance-plans"] });
      setEditingPlan(null);
      form.reset();
      toast({ title: "Finance plan updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update finance plan", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/finance-plans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/finance-plans"] });
      toast({ title: "Finance plan deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete finance plan", variant: "destructive" });
    },
  });

  const handleEditPlan = (plan: FinancePlan) => {
    setEditingPlan(plan);
    form.reset({
      name: plan.name,
      type: plan.type as "HP" | "Lease",
      termMonths: plan.termMonths,
      aprBps: plan.aprBps,
      depositPercent: plan.depositPercent,
      balloonPercent: plan.balloonPercent ?? null,
      notes: plan.notes ?? "",
      published: plan.published,
    });
  };

  const onSubmit = (data: FinancePlanFormData) => {
    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const formatAPR = (aprBps: number) => {
    return `${(aprBps / 100).toFixed(2)}%`;
  };

  if (isLoading) {
    return (
      <div>
        <AdminPageHeader title="Finance Plans" description="Manage financing options for customers" />
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
        title="Finance Plans"
        description="Manage financing options for customers"
        actions={
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-create-plan">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Finance Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Finance Plan</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan Name</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="e.g., Standard HP 5 Year" 
                          data-testid="input-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Finance Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-type">
                            <SelectValue placeholder="Select finance type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="HP" data-testid="option-hp">Hire Purchase (HP)</SelectItem>
                          <SelectItem value="Lease" data-testid="option-lease">Lease</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        HP: Customer owns at end. Lease: Return or buy at residual value.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="termMonths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Term (months)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            data-testid="input-term-months"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="aprBps"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>APR (basis points)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            placeholder="e.g., 595 = 5.95%"
                            data-testid="input-apr-bps"
                          />
                        </FormControl>
                        <FormDescription>
                          100 basis points = 1%. E.g., 595 = 5.95% APR
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="depositPercent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deposit (%)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            data-testid="input-deposit-percent"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="balloonPercent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Balloon Payment (%) - Optional</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            data-testid="input-balloon-percent"
                          />
                        </FormControl>
                        <FormDescription>
                          Final balloon payment as % of total
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          value={field.value ?? ""}
                          placeholder="Additional information about this finance plan..."
                          rows={3}
                          data-testid="input-notes"
                        />
                      </FormControl>
                      <FormMessage />
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
                        <FormDescription>
                          Make this plan visible to customers
                        </FormDescription>
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

                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending}
                    data-testid="button-submit"
                  >
                    {createMutation.isPending ? "Creating..." : "Create Plan"}
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
        {plans.map((plan) => (
          <Card key={plan.id} data-testid={`card-plan-${plan.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle data-testid={`text-plan-name-${plan.id}`}>{plan.name}</CardTitle>
                    <Badge 
                      variant={plan.type === "HP" ? "default" : "secondary"}
                      data-testid={`badge-type-${plan.id}`}
                    >
                      {plan.type}
                    </Badge>
                    {!plan.published && (
                      <Badge variant="outline" data-testid={`badge-unpublished-${plan.id}`}>
                        Unpublished
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Dialog 
                    open={editingPlan?.id === plan.id} 
                    onOpenChange={(open) => !open && setEditingPlan(null)}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Edit finance plan"
                            onClick={() => handleEditPlan(plan)}
                            data-testid={`button-edit-${plan.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Edit finance plan</TooltipContent>
                    </Tooltip>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Edit Finance Plan</DialogTitle>
                      </DialogHeader>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Plan Name</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    placeholder="e.g., Standard HP 5 Year" 
                                    data-testid="input-name-edit"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Finance Type</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-type-edit">
                                      <SelectValue placeholder="Select finance type" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="HP">Hire Purchase (HP)</SelectItem>
                                    <SelectItem value="Lease">Lease</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormDescription>
                                  HP: Customer owns at end. Lease: Return or buy at residual value.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="termMonths"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Term (months)</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      {...field} 
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                      data-testid="input-term-months-edit"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="aprBps"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>APR (basis points)</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      {...field} 
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                      placeholder="e.g., 595 = 5.95%"
                                      data-testid="input-apr-bps-edit"
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    100 basis points = 1%. E.g., 595 = 5.95% APR
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="depositPercent"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Deposit (%)</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      {...field} 
                                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                      data-testid="input-deposit-percent-edit"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="balloonPercent"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Balloon Payment (%) - Optional</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      {...field} 
                                      value={field.value ?? ""}
                                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                                      data-testid="input-balloon-percent-edit"
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Final balloon payment as % of total
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Notes (optional)</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    {...field} 
                                    value={field.value ?? ""}
                                    placeholder="Additional information about this finance plan..."
                                    rows={3}
                                    data-testid="input-notes-edit"
                                  />
                                </FormControl>
                                <FormMessage />
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
                                  <FormDescription>
                                    Make this plan visible to customers
                                  </FormDescription>
                                </div>
                                <FormControl>
                                  <AdminSwitch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="switch-published-edit"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <div className="flex justify-end gap-2">
                            <Button 
                              type="button" 
                              variant="outline" 
                              onClick={() => setEditingPlan(null)}
                              data-testid="button-cancel-edit"
                            >
                              Cancel
                            </Button>
                            <Button 
                              type="submit" 
                              disabled={updateMutation.isPending}
                              data-testid="button-submit-edit"
                            >
                              {updateMutation.isPending ? "Saving..." : "Save Changes"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete finance plan"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this finance plan?")) {
                            deleteMutation.mutate(plan.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${plan.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete finance plan</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Term</p>
                  <p className="text-base font-medium" data-testid={`text-term-${plan.id}`}>
                    {plan.termMonths} months
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">APR</p>
                  <p className="text-base font-medium" data-testid={`text-apr-${plan.id}`}>
                    {formatAPR(plan.aprBps)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Deposit</p>
                  <p className="text-base font-medium" data-testid={`text-deposit-${plan.id}`}>
                    {plan.depositPercent}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Balloon</p>
                  <p className="text-base font-medium" data-testid={`text-balloon-${plan.id}`}>
                    {plan.balloonPercent ? `${plan.balloonPercent}%` : "None"}
                  </p>
                </div>
              </div>
              {plan.notes && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm mt-1" data-testid={`text-notes-${plan.id}`}>
                    {plan.notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {plans.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calculator className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">No finance plans yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first finance plan to offer financing options
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-plan">
                <Plus className="h-4 w-4 mr-2" />
                Add Finance Plan
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </>
  );
}
