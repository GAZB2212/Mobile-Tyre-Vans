import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import {
  LogOut, FileText, Clock, CheckCircle2, XCircle, AlertCircle,
  ChevronRight, Building2, RefreshCw, User, Phone, Car, Wrench,
  CreditCard, CalendarDays,
} from "lucide-react";

type FinanceDeal = {
  id: string;
  userName: string;
  email: string;
  phone: string;
  quoteStatus: string;
  financeStatus: string;
  financeNotes: string | null;
  financeDecisionAt: string | null;
  financeSentAt: string;
  financePlanId: string | null;
  financePlanName: string | null;
  financeInputs: { deposit?: number; term?: number; balloon?: number } | null;
  vanTitle: string | null;
  vanRegistration: string | null;
  vanMileage: number | null;
  kitName: string | null;
  estTotal: number;
  estSubtotal: number;
  estVat: number;
  estDiscount: number;
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; badgeClass: string }> = {
  pending:          { label: "Pending Review",    icon: Clock,         badgeClass: "bg-amber-100 text-amber-800 border-amber-200" },
  approved:         { label: "Approved",           icon: CheckCircle2,  badgeClass: "bg-green-100 text-green-800 border-green-200" },
  declined:         { label: "Declined",           icon: XCircle,       badgeClass: "bg-red-100 text-red-800 border-red-200" },
  more_info_needed: { label: "More Info Needed",   icon: AlertCircle,   badgeClass: "bg-blue-100 text-blue-800 border-blue-200" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.badgeClass}`} data-testid={`badge-finance-status-${status}`}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
}

function formatGBP(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-2 py-1.5">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

function DealCard({ deal, onReview }: { deal: FinanceDeal; onReview: (d: FinanceDeal) => void }) {
  return (
    <Card data-testid={`card-deal-${deal.id}`}>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-sm">{deal.userName}</p>
              <span className="text-muted-foreground text-xs font-mono">#{deal.id.slice(-6).toUpperCase()}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {deal.vanTitle && <span>{deal.vanTitle}</span>}
              {deal.kitName && <><span className="opacity-40">·</span><span>{deal.kitName}</span></>}
              <><span className="opacity-40">·</span><span className="font-semibold text-foreground">{formatGBP(deal.estTotal)}</span></>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <StatusBadge status={deal.financeStatus} />
              {deal.financeSentAt && (
                <span className="text-xs text-muted-foreground">
                  Received {formatDistanceToNow(new Date(deal.financeSentAt), { addSuffix: true })}
                </span>
              )}
            </div>
            {deal.financeNotes && (
              <p className="text-xs text-muted-foreground italic line-clamp-1 pt-0.5">"{deal.financeNotes}"</p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => onReview(deal)} data-testid={`button-review-${deal.id}`}>
            Review
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FinancePortal() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [selectedDeal, setSelectedDeal] = useState<FinanceDeal | null>(null);
  const [newStatus, setNewStatus] = useState<string>("pending");
  const [newNotes, setNewNotes] = useState<string>("");

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || user?.adminRole !== "finance")) {
      setLocation("/login");
    }
  }, [authLoading, isAuthenticated, user, setLocation]);

  const { data: deals = [], isLoading, refetch } = useQuery<FinanceDeal[]>({
    queryKey: ["/api/finance-portal/deals"],
    enabled: !!isAuthenticated && user?.adminRole === "finance",
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, financeStatus, financeNotes }: { id: string; financeStatus: string; financeNotes: string }) => {
      const res = await apiRequest("PATCH", `/api/finance-portal/deals/${id}`, { financeStatus, financeNotes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance-portal/deals"] });
      toast({ title: "Decision saved", description: "The MTV team has been notified." });
      setSelectedDeal(null);
    },
    onError: (err: any) => {
      toast({ title: "Error saving decision", description: err.message || "Please try again.", variant: "destructive" });
    },
  });

  const handleLogout = async () => {
    try { await apiRequest("POST", "/api/auth/logout", {}); } catch { /* ignore */ }
    localStorage.removeItem("_authToken");
    window.location.href = "/login";
  };

  const openDeal = (deal: FinanceDeal) => {
    setSelectedDeal(deal);
    setNewStatus(deal.financeStatus);
    setNewNotes(deal.financeNotes ?? "");
  };

  const handleSubmit = () => {
    if (!selectedDeal) return;
    updateMutation.mutate({ id: selectedDeal.id, financeStatus: newStatus, financeNotes: newNotes });
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-primary">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  if (!isAuthenticated || user?.adminRole !== "finance") return null;

  const pendingDeals = deals.filter(d => d.financeStatus === "pending");
  const actionedDeals = deals.filter(d => d.financeStatus !== "pending");

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <header className="bg-primary border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-accent flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">Finance Partner Portal</p>
              <p className="text-white/40 text-xs leading-tight hidden sm:block">Mobile Tyre Vans</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="text-white/60 hover:text-white h-8"
              data-testid="button-refresh"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-white/60 hover:text-white h-8"
              data-testid="button-logout"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-4 sm:p-6 outline-none">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Awaiting Review", value: deals.filter(d => d.financeStatus === "pending").length, colorClass: "text-amber-600 dark:text-amber-400" },
            { label: "Approved", value: deals.filter(d => d.financeStatus === "approved").length, colorClass: "text-green-600 dark:text-green-400" },
            { label: "Declined", value: deals.filter(d => d.financeStatus === "declined").length, colorClass: "text-red-500 dark:text-red-400" },
            { label: "More Info", value: deals.filter(d => d.financeStatus === "more_info_needed").length, colorClass: "text-blue-600 dark:text-blue-400" },
          ].map(stat => (
            <Card key={stat.label} data-testid={`card-stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}>
              <CardContent className="p-4">
                <p className={`text-2xl font-bold ${stat.colorClass}`}>{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pending */}
        {pendingDeals.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-amber-600 dark:text-amber-400" data-testid="heading-pending">
              <Clock className="w-4 h-4" />
              Awaiting Your Review ({pendingDeals.length})
            </h2>
            <div className="grid gap-2">
              {pendingDeals.map(deal => <DealCard key={deal.id} deal={deal} onReview={openDeal} />)}
            </div>
          </section>
        )}

        {/* Actioned */}
        {actionedDeals.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground" data-testid="heading-actioned">
              <FileText className="w-4 h-4" />
              Previously Actioned ({actionedDeals.length})
            </h2>
            <div className="grid gap-2">
              {actionedDeals.map(deal => <DealCard key={deal.id} deal={deal} onReview={openDeal} />)}
            </div>
          </section>
        )}

        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        )}

        {!isLoading && deals.length === 0 && (
          <div className="text-center py-20 text-muted-foreground" data-testid="empty-state">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-25" />
            <p className="font-medium">No finance deals yet</p>
            <p className="text-sm mt-1">Deals will appear here once the MTV team submits applications to you.</p>
          </div>
        )}
      </main>

      {/* Review sheet */}
      <Sheet open={!!selectedDeal} onOpenChange={open => { if (!open) setSelectedDeal(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto" data-testid="sheet-deal-review">
          {selectedDeal && (
            <div className="flex flex-col h-full">
              <SheetHeader className="mb-5">
                <SheetTitle>Finance Application</SheetTitle>
                <p className="text-sm text-muted-foreground font-mono">Ref #{selectedDeal.id.slice(-6).toUpperCase()}</p>
              </SheetHeader>

              {/* Customer & deal info */}
              <div className="space-y-4 mb-5">
                <div className="rounded-md border p-3 space-y-0 divide-y">
                  <div className="flex items-center gap-2 pb-2">
                    <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <DetailRow label="Customer" value={selectedDeal.userName} />
                  </div>
                  {selectedDeal.email && (
                    <div className="flex items-center gap-2 py-0">
                      <span className="w-3.5 shrink-0" />
                      <DetailRow label="Email" value={selectedDeal.email} />
                    </div>
                  )}
                  {selectedDeal.phone && (
                    <div className="flex items-center gap-2 pt-0">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <DetailRow label="Phone" value={selectedDeal.phone} />
                    </div>
                  )}
                </div>

                <div className="rounded-md border p-3 space-y-0 divide-y">
                  {selectedDeal.vanTitle && (
                    <div className="flex items-center gap-2">
                      <Car className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <DetailRow label="Vehicle" value={selectedDeal.vanTitle} />
                    </div>
                  )}
                  {selectedDeal.vanRegistration && (
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 shrink-0" />
                      <DetailRow label="Registration" value={<span className="font-mono uppercase">{selectedDeal.vanRegistration}</span>} />
                    </div>
                  )}
                  {selectedDeal.vanMileage != null && (
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 shrink-0" />
                      <DetailRow label="Mileage" value={`${selectedDeal.vanMileage.toLocaleString()} miles`} />
                    </div>
                  )}
                  {selectedDeal.kitName && (
                    <div className="flex items-center gap-2">
                      <Wrench className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <DetailRow label="Kit" value={selectedDeal.kitName} />
                    </div>
                  )}
                </div>

                {/* Finance inputs */}
                {(selectedDeal.financeInputs || selectedDeal.financePlanName) && (
                  <div className="rounded-md border p-3 divide-y">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2">Finance Details</p>
                    {selectedDeal.financePlanName && (
                      <div className="flex items-center gap-2 pt-1">
                        <CreditCard className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <DetailRow label="Plan" value={selectedDeal.financePlanName} />
                      </div>
                    )}
                    {selectedDeal.financeInputs?.deposit != null && (
                      <div className="flex items-center gap-2 pt-0">
                        <span className="w-3.5 shrink-0" />
                        <DetailRow label="Deposit" value={formatGBP(selectedDeal.financeInputs.deposit)} />
                      </div>
                    )}
                    {selectedDeal.financeInputs?.term != null && (
                      <div className="flex items-center gap-2 pt-0">
                        <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <DetailRow label="Term" value={`${selectedDeal.financeInputs.term} months`} />
                      </div>
                    )}
                    {selectedDeal.financeInputs?.balloon != null && selectedDeal.financeInputs.balloon > 0 && (
                      <div className="flex items-center gap-2 pt-0">
                        <span className="w-3.5 shrink-0" />
                        <DetailRow label="Balloon" value={formatGBP(selectedDeal.financeInputs.balloon)} />
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="w-3.5 shrink-0" />
                      <DetailRow
                        label="Total Amount"
                        value={<span className="text-base font-bold">{formatGBP(selectedDeal.estTotal)}</span>}
                      />
                    </div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  Received: {format(new Date(selectedDeal.financeSentAt), "d MMMM yyyy 'at' HH:mm")}
                  {selectedDeal.financeDecisionAt && (
                    <span className="ml-2">· Last updated: {format(new Date(selectedDeal.financeDecisionAt), "d MMM yyyy")}</span>
                  )}
                </div>
              </div>

              <Separator className="my-4" />

              {/* Update form */}
              <div className="space-y-4 flex-1">
                <h3 className="font-semibold text-sm">Update Decision</h3>

                <div className="space-y-1.5">
                  <Label htmlFor="fp-status-select">Finance Decision</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger id="fp-status-select" data-testid="select-finance-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">In Review (no decision yet)</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="declined">Declined</SelectItem>
                      <SelectItem value="more_info_needed">More Info Needed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fp-notes">Notes for MTV Team</Label>
                  <Textarea
                    id="fp-notes"
                    value={newNotes}
                    onChange={e => setNewNotes(e.target.value)}
                    placeholder="Add conditions, requests for additional documents, or any other notes..."
                    rows={4}
                    data-testid="textarea-finance-notes"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={handleSubmit}
                    disabled={updateMutation.isPending}
                    className="flex-1 bg-accent hover:bg-[#7ab035] text-white border-0"
                    data-testid="button-save-decision"
                  >
                    {updateMutation.isPending ? "Saving..." : "Save Decision & Notify MTV"}
                  </Button>
                </div>
                <Button variant="outline" className="w-full" onClick={() => setSelectedDeal(null)} data-testid="button-cancel-review">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
