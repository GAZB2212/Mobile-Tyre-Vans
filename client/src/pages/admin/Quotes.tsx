const REDIRECT_DELAY_MS = 500;
const ACCESS_DENIED_REDIRECT_MS = 1000;
const POLL_INTERVAL_MS = 60_000;
const MS_PER_DAY = 86_400_000;
const PENCE_PER_POUND = 100;
const DATE_FILTER_WEEK_DAYS = 7;
const DATE_FILTER_MONTH_DAYS = 30;
const SHORT_ID_LENGTH = 8;
const END_OF_DAY_HOUR = 23;
const END_OF_DAY_MINUTE = 59;
const END_OF_DAY_SECOND = 59;

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "new":               return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case "contacted":         return "bg-violet-500/10 text-violet-400 border-violet-500/20";
    case "awaiting_deposit":  return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "awaiting_finance":  return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    case "finance_declined":  return "bg-red-500/10 text-red-400 border-red-500/20";
    case "deposit_taken":     return "bg-lime-500/10 text-lime-400 border-lime-500/20";
    case "finance_approved":  return "bg-lime-500/10 text-lime-400 border-lime-500/20";
    case "in_build":          return "bg-[hsl(86_45%_51%/0.15)] text-[hsl(86_53%_60%)] border-[hsl(86_53%_51%/0.25)]";
    case "in_workshop":       return "bg-red-500/15 text-red-300 border-red-500/30";
    case "completed":         return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "cancelled":         return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
    default:                  return "bg-muted/60 text-muted-foreground border-border/60";
  }
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    new: "New",
    contacted: "Contacted",
    awaiting_deposit: "Awaiting Deposit",
    awaiting_finance: "Finance Submitted",
    finance_declined: "Finance Declined",
    deposit_taken: "Deposit Taken",
    finance_approved: "Finance Approved",
    in_build: "In Build",
    in_workshop: "In Workshop",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return labels[status] ?? status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

const ALL_STATUSES = [
  "new", "contacted", "awaiting_deposit", "awaiting_finance",
  "finance_declined", "deposit_taken", "finance_approved", "in_build", "in_workshop", "completed", "cancelled",
] as const;

// How many days a quote can sit in each status before it's flagged as needing attention
const STALE_THRESHOLDS: Partial<Record<string, number>> = {
  new:              1,   // Should be contacted same day / next day
  contacted:        4,   // Should be chasing within 4 days
  awaiting_deposit: 7,   // Deposit pending for a week
  awaiting_finance: 7,   // Finance pending for a week
  finance_declined: 3,   // Needs alternative offer quickly
  deposit_taken:    14,  // Should be moving into build
  finance_approved: 14,  // Should be moving into build
};

function daysInStatus(quote: { status: string; statusChangedAt?: string | Date | null; createdAt?: string | Date | null }): number {
  const since = (quote as any).statusChangedAt ?? quote.createdAt;
  if (!since) return 0;
  return Math.floor((Date.now() - new Date(since).getTime()) / MS_PER_DAY);
}

function isOverdue(quote: { status: string; statusChangedAt?: string | Date | null; createdAt?: string | Date | null }): boolean {
  const threshold = STALE_THRESHOLDS[quote.status];
  if (threshold === undefined) return false;
  return daysInStatus(quote) >= threshold;
}

import { useAuth } from "@/hooks/useAuth";
import { useIdlePolling } from "@/hooks/useIdlePolling";
import type { User, Quote, Van, Kit, Upgrade, StaffPhone } from "@shared/schema";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { resolveVanReg } from "@/lib/vanDisplay";
import { Link, useLocation } from "wouter";
import { AdminBackButton } from "@/components/AdminBackButton";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  FileText, 
  Search, 
  Download,
  Calendar,
  User as UserIcon,
  Phone,
  Mail,
  Building,
  Car,
  Package,
  Wrench,
  StickyNote,
  PoundSterling,
  Printer,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Bell,
  Bot,
  Settings,
  History,
  CheckCircle2,
  XCircle,
  RefreshCw,
  PhoneCall,
  Building2,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type QuoteWithCustomer = Quote & { customerName?: string | null };

export default function AdminQuotes() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth() as {
    user: User | undefined;
    isAuthenticated: boolean;
    isLoading: boolean;
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [profileFilter, setProfileFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [hideIncomplete, setHideIncomplete] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // Local pending status overrides — updated instantly on selection, cleared after server confirms
  const [pendingStatuses, setPendingStatuses] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<"list" | "kanban">(() => {
    try { return (localStorage.getItem("quotesViewMode") as "list" | "kanban") || "list"; } catch { return "list"; }
  });

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Follow-up scheduling dialog state (triggered when status → "contacted")
  const [fuDialogOpen, setFuDialogOpen] = useState(false);
  const [fuDate, setFuDate] = useState(new Date().toISOString().split("T")[0]);
  const [fuNotes, setFuNotes] = useState("");
  const [fuPendingQuote, setFuPendingQuote] = useState<{ id: string; name?: string | null; email?: string | null; phone?: string | null } | null>(null);

  const scheduleFollowUpMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/admin/follow-ups", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/follow-ups"], refetchType: "all" });
      setFuDialogOpen(false);
      toast({ title: "Follow-up scheduled", description: "Added to your calendar." });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to schedule follow-up" }),
  });

  // Status-change note dialog state
  const [pendingStatusChange, setPendingStatusChange] = useState<{ id: string; newStatus: string; currentStatus: string } | null>(null);
  const [statusNoteText, setStatusNoteText] = useState("");

  // Quick note popover state
  const [notePopover, setNotePopover] = useState<{ quoteId: string; customerId: string | null } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState<"call" | "email" | "meeting" | "general">("call");

  const addNoteMutation = useMutation({
    mutationFn: async ({ quoteId, customerId, text, type }: { quoteId: string; customerId: string | null; text: string; type: string }) => {
      if (customerId) {
        const res = await apiRequest("POST", `/api/admin/customers/${customerId}/notes`, { text, noteType: type });
        if (!res.ok) throw new Error("Failed to save note");
        return res.json();
      } else {
        const res = await apiRequest("POST", `/api/admin/quotes/${quoteId}/notes`, { text });
        if (!res.ok) throw new Error("Failed to save note");
        return res.json();
      }
    },
    onSuccess: () => {
      toast({ title: "Note saved" });
      setNotePopover(null);
      setNoteText("");
      setNoteType("call");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quotes"] });
    },
    onError: () => {
      toast({ title: "Failed to save note", variant: "destructive" });
    },
  });

  // Click-to-call state
  const [callDialog, setCallDialog] = useState<{ quoteId: string; customerName: string; toNumber: string } | null>(null);
  const [selectedStaffPhoneId, setSelectedStaffPhoneId] = useState("");
  const normaliseToE164 = (n: string): string => {
    const d = n.replace(/[\s\-().]/g, "");
    if (/^07\d{9}$/.test(d)) return "+44" + d.slice(1);
    if (/^447\d{9}$/.test(d)) return "+" + d;
    return d;
  };

  const { data: twilioStatus } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/admin/twilio/status"],
  });
  const twilioConfigured = twilioStatus?.configured ?? false;

  const { data: staffPhones = [] } = useQuery<StaffPhone[]>({
    queryKey: ["/api/admin/staff-phones"],
    enabled: twilioConfigured,
  });

  const initiateCallMutation = useMutation({
    mutationFn: async ({ staffNumberId, toNumber, quoteId }: { staffNumberId: string; toNumber: string; quoteId: string }) => {
      const res = await apiRequest("POST", "/api/admin/calls/initiate", { staffNumberId, toNumber, quoteId });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed to start call"); }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Connected — check your phone", description: data.message || "Twilio will ring your phone and connect you to the customer." });
      setCallDialog(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quotes"] });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Call failed", description: err.message });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/quotes/${id}`, {
        status,
        ...(note?.trim() ? { newAdminNote: `Status → ${getStatusLabel(status)}: ${note.trim()}` } : {}),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onMutate: ({ id, status }) => {
      // Show the new status instantly in local state — independent of query cache
      setPendingStatuses(prev => ({ ...prev, [id]: status }));
      return { id, previousStatus: pendingStatuses[id] };
    },
    onError: (err: Error, { id }, ctx) => {
      // Roll back to previous value on error
      setPendingStatuses(prev => {
        const next = { ...prev };
        if (ctx?.previousStatus) next[id] = ctx.previousStatus;
        else delete next[id];
        return next;
      });
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
    onSuccess: () => {
      toast({ title: "Status updated" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quotes"] });
    },
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, REDIRECT_DELAY_MS);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Check if user has admin role (basic or full)
  useEffect(() => {
    if (user && (!user.adminRole || user.adminRole === "none")) {
      toast({
        title: "Access Denied",
        description: "Admin access required.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, ACCESS_DENIED_REDIRECT_MS);
      return;
    }
  }, [user, toast]);

  const isActive = useIdlePolling();

  // Fetch quotes data
  const { data: quotes = [], isLoading: quotesLoading, error: quotesError, isFetching: quotesFetching, refetch: refetchQuotes } = useQuery<QuoteWithCustomer[]>({
    queryKey: ["/api/admin/quotes"],
    enabled: !!(user?.adminRole && user.adminRole !== "none"),
    refetchInterval: isActive ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });

  // Clear pending status overrides only once the refetched query data
  // confirms the server has the updated status — avoids the brief revert.
  useEffect(() => {
    if (!quotes.length || Object.keys(pendingStatuses).length === 0) return;
    setPendingStatuses(prev => {
      const next = { ...prev };
      let changed = false;
      quotes.forEach((q: Quote) => {
        if (next[q.id] !== undefined && next[q.id] === q.status) {
          delete next[q.id];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [quotes]);

  // Fetch vans, kits, and upgrades for reference data
  const { data: vans = [] } = useQuery<Van[]>({
    queryKey: ["/api/admin/vans"],
    enabled: !!(user?.adminRole && user.adminRole !== "none"),
  });

  const { data: kits = [] } = useQuery<Kit[]>({
    queryKey: ["/api/admin/kits"],
    enabled: !!(user?.adminRole && user.adminRole !== "none"),
  });

  const { data: upgrades = [] } = useQuery<Upgrade[]>({
    queryKey: ["/api/admin/upgrades"],
    enabled: !!(user?.adminRole && user.adminRole !== "none"),
  });

  const canEdit = user?.adminRole === "full";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user?.adminRole || user.adminRole === "none") {
    return null;
  }

  if (quotesError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-destructive text-sm">Failed to load — check your connection and try again</p>
          <Button variant="outline" size="sm" onClick={() => refetchQuotes()} data-testid="button-retry-quotes">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Helper functions
  const formatPrice = (pence: number): string => {
    return `£${(pence / PENCE_PER_POUND).toFixed(2)}`;
  };

  const formatDate = (dateString: string | Date | null): string => {
    if (!dateString) return "Unknown date";
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getVanName = (vanId: string | null): string => {
    if (!vanId) return "No van selected";
    const van = vans.find((v) => v.id === vanId);
    return van ? `${van.make} ${van.model}` : "Unknown van";
  };

  const getVanReg = (vanId: string | null, typedReg?: string | null): string | null => {
    const van = vanId ? vans.find((v) => v.id === vanId) : undefined;
    return resolveVanReg(van ?? null, typedReg ?? null);
  };

  const getKitName = (kitId: string | null): string => {
    if (!kitId) return "No kit selected";
    const kit = kits.find((k) => k.id === kitId);
    return kit?.name || "Unknown kit";
  };

  const upgradeDisplay = (u: { name: string; variantName?: string | null }) =>
    (u.variantName && u.variantName.trim()) ? u.variantName.trim() : u.name;

  // Variant groups are radio-style in the configurator. The configurator
  // shows the FIRST variant in the saved array per parent, so we follow
  // the same rule everywhere upgrades are listed.
  const dedupeByParent = (upgradeIds: string[]): typeof upgrades => {
    const byId = new Map(upgrades.map((u) => [u.id, u] as const));
    const seen = new Set<string>();
    const out: typeof upgrades = [];
    for (const id of upgradeIds) {
      const u = byId.get(id);
      if (!u) continue;
      const pid = (u as any).parentId as string | null | undefined;
      if (pid) {
        if (seen.has(pid)) continue;
        seen.add(pid);
      }
      out.push(u);
    }
    return out;
  };

  const getUpgradeNames = (upgradeIds: string[]): string => {
    if (!upgradeIds.length) return "No upgrades";
    return dedupeByParent(upgradeIds).map(upgradeDisplay).join(", ");
  };

  const getUpgradeList = (upgradeIds: string[]): string[] => {
    if (!upgradeIds.length) return [];
    return dedupeByParent(upgradeIds).map(upgradeDisplay);
  };

  const computeEquipCost = (kitId: string | null, upgradeIds: string[], upgradeQuantities: Record<string, number>): number | null => {
    let equipCost = 0;
    let hasAnyCost = false;
    const selectedKit = kitId ? kits.find(k => k.id === kitId) : null;
    if (selectedKit) {
      const bom = selectedKit.skuComponents as Array<{ costPrice?: number | null; quantity: number }> | null;
      const bomHasCost = Array.isArray(bom) && bom.some(c => c.costPrice != null);
      if (bomHasCost) {
        equipCost += (bom as Array<{ costPrice?: number | null; quantity: number }>).reduce((s, c) => s + (c.costPrice ?? 0) * c.quantity, 0);
        hasAnyCost = true;
      } else if (selectedKit.costPrice != null) {
        equipCost += selectedKit.costPrice;
        hasAnyCost = true;
      }
    }
    upgradeIds.forEach(uid => {
      const u = upgrades.find(x => x.id === uid);
      if (!u) return;
      const qty = upgradeQuantities[uid] || 1;
      const bom = u.skuComponents as Array<{ costPrice?: number | null; quantity: number }> | null;
      const bomHasCost = Array.isArray(bom) && bom.some(c => c.costPrice != null);
      if (bomHasCost) {
        equipCost += (bom as Array<{ costPrice?: number | null; quantity: number }>).reduce((s, c) => s + (c.costPrice ?? 0) * c.quantity, 0) * qty;
        hasAnyCost = true;
      } else if (u.costPrice != null) {
        equipCost += u.costPrice * qty;
        hasAnyCost = true;
      }
    });
    return hasAnyCost ? equipCost : null;
  };

  const getMarginColor = (pct: number): string =>
    pct >= 30 ? "text-emerald-600 dark:text-emerald-400" :
    pct >= 15 ? "text-amber-600 dark:text-amber-400" :
    "text-red-600 dark:text-red-400";

  const getMarginBadgeClass = (pct: number): string =>
    pct >= 30 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" :
    pct >= 15 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" :
    "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";

  const INCOMPLETE_PLACEHOLDER = "Via Max (name pending)";

  // Filter and sort quotes
  const filteredQuotes = quotes
    .filter((quote) => {
      // Hide Max AI entries where we never captured the customer's name
      if (hideIncomplete && quote.userName === INCOMPLETE_PLACEHOLDER) return false;

      const normalizedSearch = searchTerm.toLowerCase().replace(/^#/, '');
      const normalizedPhone = normalizedSearch.replace(/[\s\-().+]/g, '');
      const shortId = quote.id.slice(0, SHORT_ID_LENGTH).toUpperCase();
      const vanName = quote.vanId ? (vans.find(v => v.id === quote.vanId)?.title ?? '') : '';
      const kitName = quote.kitId ? (kits.find(k => k.id === quote.kitId)?.name ?? '') : '';
      const quotePhone = (quote.phone ?? '').replace(/[\s\-().+]/g, '');
      const upgradeNames = getUpgradeList((quote.selectedUpgradeIds as string[]) ?? []);
      const matchesSearch = !normalizedSearch ||
        quote.userName.toLowerCase().includes(normalizedSearch) ||
        quote.email.toLowerCase().includes(normalizedSearch) ||
        (quote.company && quote.company.toLowerCase().includes(normalizedSearch)) ||
        quote.id.toLowerCase().includes(normalizedSearch) ||
        shortId.toLowerCase().includes(normalizedSearch) ||
        (quote.phone && quote.phone.toLowerCase().includes(normalizedSearch)) ||
        (normalizedPhone && quotePhone.includes(normalizedPhone)) ||
        (quote.vanRegistration && quote.vanRegistration.toLowerCase().replace(/\s/g, '').includes(normalizedSearch.replace(/\s/g, ''))) ||
        vanName.toLowerCase().includes(normalizedSearch) ||
        kitName.toLowerCase().includes(normalizedSearch) ||
        upgradeNames.some(name => name.toLowerCase().includes(normalizedSearch));

      if (!quote.createdAt) return matchesSearch;
      const quoteDate = new Date(quote.createdAt);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - quoteDate.getTime()) / MS_PER_DAY);

      let matchesDate = true;
      if (dateFilter === "today") matchesDate = daysDiff === 0;
      else if (dateFilter === "week") matchesDate = daysDiff <= DATE_FILTER_WEEK_DAYS;
      else if (dateFilter === "month") matchesDate = daysDiff <= DATE_FILTER_MONTH_DAYS;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "overdue" ? isOverdue(quote) : quote.status === statusFilter);

      const matchesProfile =
        profileFilter === "all" ||
        (profileFilter === "linked" ? !!quote.customerId : !quote.customerId);

      return matchesSearch && matchesDate && matchesStatus && matchesProfile;
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      }
      if (sortBy === "oldest") {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aDate - bDate;
      }
      if (sortBy === "highest") return b.estTotal - a.estTotal;
      if (sortBy === "lowest") return a.estTotal - b.estTotal;
      return 0;
    });

  const setAndPersistViewMode = (mode: "list" | "kanban") => {
    setViewMode(mode);
    try { localStorage.setItem("quotesViewMode", mode); } catch {}
  };

  // Trend calculation helpers
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * MS_PER_DAY);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * MS_PER_DAY);
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND);

  const thisWeekQuotes = quotes.filter(q => q.createdAt && new Date(q.createdAt) >= sevenDaysAgo);
  const lastWeekQuotes = quotes.filter(q => q.createdAt && new Date(q.createdAt) >= fourteenDaysAgo && new Date(q.createdAt) < sevenDaysAgo);
  const thisMonthQuotes = quotes.filter(q => q.createdAt && new Date(q.createdAt) >= startOfThisMonth);
  const lastMonthQuotes = quotes.filter(q => q.createdAt && new Date(q.createdAt) >= startOfLastMonth && new Date(q.createdAt) <= endOfLastMonth);

  const calcTrend = (current: number, previous: number): { pct: number; dir: "up" | "down" | "flat" } => {
    if (previous === 0) return current > 0 ? { pct: 100, dir: "up" } : { pct: 0, dir: "flat" };
    const pct = Math.round(((current - previous) / previous) * 100);
    return { pct: Math.abs(pct), dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
  };

  const weekCountTrend = calcTrend(thisWeekQuotes.length, lastWeekQuotes.length);
  const monthCountTrend = calcTrend(thisMonthQuotes.length, lastMonthQuotes.length);
  const thisWeekValue = thisWeekQuotes.reduce((s, q) => s + q.estTotal, 0);
  const lastWeekValue = lastWeekQuotes.reduce((s, q) => s + q.estTotal, 0);
  const weekValueTrend = calcTrend(thisWeekValue, lastWeekValue);

  const handleExportQuotes = () => {
    if (filteredQuotes.length === 0) {
      toast({
        title: "No Data to Export",
        description: "There are no quotes to export with the current filters.",
        variant: "destructive",
      });
      return;
    }

    // Create CSV content
    const headers = [
      "Date", "Customer Name", "Email", "Phone", "Company", 
      "Van", "Equipment Package", "Upgrades", "Notes",
      "Subtotal (£)", "VAT (£)", "Total (£)",
      "Equipment cost (£)", "Gross margin (£)", "Gross margin (%)"
    ];

    const csvRows = [
      headers.join(","),
      ...filteredQuotes.map((quote) => {
        const upgradeIds = (quote.selectedUpgradeIds as string[]) ?? [];
        const upgradeQuantities = (quote.selectedUpgrades as Record<string, number>) || {};
        const equipCostPence = computeEquipCost(quote.kitId, upgradeIds, upgradeQuantities);
        const equipCostPounds = equipCostPence != null ? equipCostPence / PENCE_PER_POUND : null;
        const subtotalPounds = quote.estSubtotal / PENCE_PER_POUND;
        const grossMargin = equipCostPounds != null ? subtotalPounds - equipCostPounds : null;
        const grossMarginPct = equipCostPounds != null && subtotalPounds > 0
          ? ((subtotalPounds - equipCostPounds) / subtotalPounds) * 100
          : null;

        return [
          quote.createdAt ? new Date(quote.createdAt).toLocaleDateString("en-GB") : "Unknown",
          `"${quote.userName}"`,
          `"${quote.email}"`,
          `"${quote.phone}"`,
          `"${quote.company || ""}"`,
          `"${getVanName(quote.vanId)}"`,
          `"${getKitName(quote.kitId)}"`,
          `"${getUpgradeNames(quote.selectedUpgradeIds)}"`,
          `"${quote.notes || ""}"`,
          subtotalPounds.toFixed(2),
          (quote.estVAT / PENCE_PER_POUND).toFixed(2),
          (quote.estTotal / PENCE_PER_POUND).toFixed(2),
          equipCostPounds != null ? equipCostPounds.toFixed(2) : "",
          grossMargin != null ? grossMargin.toFixed(2) : "",
          grossMarginPct != null ? grossMarginPct.toFixed(1) : ""
        ].join(",");
      })
    ];

    // Create and trigger download
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `quotes-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Successful",
      description: `Exported ${filteredQuotes.length} quotes to CSV file.`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminBackButton />
      <AdminPageHeader
        title="Configurator Management"
        description="Review and manage customer configurators"
        statusIndicator={
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`w-1.5 h-1.5 rounded-full ${quotesFetching ? "bg-amber-400 animate-pulse" : isActive ? "bg-[hsl(86_53%_51%)]" : "bg-muted-foreground/40"}`} />
            {quotesFetching ? "Refreshing…" : isActive ? `Live` : "Paused"}
          </span>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportQuotes}
            data-testid="button-export-quotes"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>
        }
      />

      <div className="container mx-auto px-4 py-6">

        {/* ── Conversion Stats ── */}
        {(() => {
          const CONVERTED_STATUSES = ["deposit_taken", "finance_approved", "in_build", "in_workshop", "completed"];
          const total = quotes.length;
          const convertedQuotes = quotes.filter(q => CONVERTED_STATUSES.includes(q.status));
          const converted = convertedQuotes.length;
          const convPct = total > 0 ? Math.round((converted / total) * 100) : 0;
          const revenueConverted = convertedQuotes.reduce((s, q) => s + q.estTotal, 0);
          const overdueCount = quotes.filter(q => isOverdue(q)).length;

          // Blended margin — computed from currently filtered quotes
          let marginTotalSubtotal = 0;
          let marginTotalGross = 0;
          let marginQuotesWithCost = 0;
          for (const q of filteredQuotes) {
            const cost = computeEquipCost(
              q.kitId,
              (q.selectedUpgradeIds as string[]) || [],
              (q.selectedUpgrades as Record<string, number>) || {}
            );
            if (cost !== null && q.estSubtotal > 0) {
              marginTotalSubtotal += q.estSubtotal;
              marginTotalGross += q.estSubtotal - cost;
              marginQuotesWithCost++;
            }
          }
          const blendedMarginPct = marginTotalSubtotal > 0
            ? Math.round((marginTotalGross / marginTotalSubtotal) * 100)
            : null;

          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              <Card>
                <CardContent className="py-4 px-5">
                  <p className="text-xs text-muted-foreground mb-1">Conversion Rate</p>
                  <p className="text-3xl font-bold text-accent" data-testid="stat-conversion-rate">{convPct}%</p>
                  <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${convPct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{converted} of {total} became real builds</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 px-5">
                  <p className="text-xs text-muted-foreground mb-1">Revenue Converted</p>
                  <p className="text-2xl font-bold text-accent" data-testid="stat-revenue-converted">{formatPrice(revenueConverted)}</p>
                  <p className="text-xs text-muted-foreground mt-1">across {converted} converted job{converted !== 1 ? "s" : ""}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4 px-5">
                  <p className="text-xs text-muted-foreground mb-1">Total Configurators</p>
                  <p className="text-2xl font-bold" data-testid="stat-total-quotes">{total}</p>
                  <p className="text-xs text-muted-foreground mt-1">all time</p>
                </CardContent>
              </Card>
              {/* Blended margin — updates with current filter selection */}
              <Card>
                <CardContent className="py-4 px-5">
                  <p className="text-xs text-muted-foreground mb-1">Blended Margin</p>
                  {blendedMarginPct === null ? (
                    <p className="text-2xl font-bold text-muted-foreground" data-testid="stat-blended-margin">—</p>
                  ) : (
                    <p
                      className={`text-3xl font-bold ${getMarginColor(blendedMarginPct)}`}
                      data-testid="stat-blended-margin"
                    >
                      {blendedMarginPct}%
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {marginQuotesWithCost === 0
                      ? "no cost data available"
                      : `based on ${marginQuotesWithCost} of ${filteredQuotes.length} quote${filteredQuotes.length !== 1 ? "s" : ""}`}
                  </p>
                </CardContent>
              </Card>
              {/* Needs attention card — clickable to filter */}
              <button
                className="text-left"
                onClick={() => setStatusFilter(statusFilter === "overdue" ? "all" : "overdue")}
                data-testid="stat-needs-attention"
              >
                <Card className={`h-full transition-colors ${overdueCount > 0 ? "border-amber-400/60" : ""} ${statusFilter === "overdue" ? "ring-2 ring-amber-400" : ""}`}>
                  <CardContent className="py-4 px-5">
                    <div className="flex items-center gap-2 mb-1">
                      <Bell className={`w-3.5 h-3.5 ${overdueCount > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
                      <p className="text-xs text-muted-foreground">Needs Attention</p>
                    </div>
                    <p className={`text-3xl font-bold ${overdueCount > 0 ? "text-amber-500" : ""}`} data-testid="value-needs-attention">{overdueCount}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {overdueCount === 0 ? "All up to date" : `${overdueCount === 1 ? "lead" : "leads"} gone quiet`}
                    </p>
                  </CardContent>
                </Card>
              </button>
            </div>
          );
        })()}

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter Configurators</CardTitle>
            <CardDescription>
              Search and filter configurators by customer details or date
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, phone, reg, van, kit or equipment..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-quotes"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full" data-testid="select-status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="overdue">Needs attention</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="awaiting_deposit">Awaiting Deposit</SelectItem>
                  <SelectItem value="awaiting_finance">Finance Submitted</SelectItem>
                  <SelectItem value="finance_declined">Finance Declined</SelectItem>
                  <SelectItem value="deposit_taken">Deposit Taken</SelectItem>
                  <SelectItem value="finance_approved">Finance Approved</SelectItem>
                  <SelectItem value="in_build">In Build</SelectItem>
                  <SelectItem value="in_workshop">In Workshop</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={profileFilter} onValueChange={setProfileFilter}>
                <SelectTrigger className="w-full" data-testid="select-profile-filter-quotes">
                  <SelectValue placeholder="Profile linked" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All profiles</SelectItem>
                  <SelectItem value="linked">Linked to profile</SelectItem>
                  <SelectItem value="unlinked">No profile</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-full" data-testid="select-date-filter">
                  <SelectValue placeholder="Filter by date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This week</SelectItem>
                  <SelectItem value="month">This month</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full" data-testid="select-sort-quotes">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="highest">Highest value</SelectItem>
                  <SelectItem value="lowest">Lowest value</SelectItem>
                </SelectContent>
              </Select>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={hideIncomplete}
                  onClick={() => setHideIncomplete(v => !v)}
                  data-testid="toggle-hide-incomplete"
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${hideIncomplete ? "bg-accent" : "bg-input"}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${hideIncomplete ? "translate-x-4" : "translate-x-0"}`} />
                </button>
                <span className="text-sm text-muted-foreground">
                  Hide incomplete Max AI entries (no name captured)
                  {hideIncomplete && (
                    <span className="ml-2 text-xs text-muted-foreground/60">
                      — {quotes.filter(q => q.userName === INCOMPLETE_PLACEHOLDER).length} hidden
                    </span>
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Configurators</p>
                    <p className="text-2xl font-bold" data-testid="stat-total-quotes">{quotes.length}</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{thisMonthQuotes.length} this month</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <PoundSterling className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Value</p>
                    <p className="text-2xl font-bold" data-testid="stat-total-value">
                      {formatPrice(quotes.reduce((sum, quote) => sum + quote.estTotal, 0))}
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{formatPrice(thisWeekValue)} this week</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm text-muted-foreground">This Week</p>
                    <p className="text-2xl font-bold" data-testid="stat-week-quotes">{thisWeekQuotes.length}</p>
                  </div>
                </div>
                {weekCountTrend.dir !== "flat" && (
                  <div className={`flex items-center gap-0.5 text-xs font-medium shrink-0 ${weekCountTrend.dir === "up" ? "text-green-500" : "text-destructive"}`} data-testid="trend-week-count">
                    {weekCountTrend.dir === "up" ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {weekCountTrend.pct}%
                  </div>
                )}
                {weekCountTrend.dir === "flat" && (
                  <div className="flex items-center gap-0.5 text-xs font-medium shrink-0 text-muted-foreground">
                    <Minus className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">vs {lastWeekQuotes.length} prev week</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm text-muted-foreground">This Month</p>
                    <p className="text-2xl font-bold" data-testid="stat-month-quotes">{thisMonthQuotes.length}</p>
                  </div>
                </div>
                {monthCountTrend.dir !== "flat" && (
                  <div className={`flex items-center gap-0.5 text-xs font-medium shrink-0 ${monthCountTrend.dir === "up" ? "text-green-500" : "text-destructive"}`} data-testid="trend-month-count">
                    {monthCountTrend.dir === "up" ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {monthCountTrend.pct}%
                  </div>
                )}
                {monthCountTrend.dir === "flat" && (
                  <div className="flex items-center gap-0.5 text-xs font-medium shrink-0 text-muted-foreground">
                    <Minus className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">vs {lastMonthQuotes.length} last month</p>
            </CardContent>
          </Card>
        </div>

        {/* Quotes List */}
        {/* View toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-sm text-muted-foreground">
            {quotesLoading ? "Loading..." : `${filteredQuotes.length} configurator${filteredQuotes.length !== 1 ? "s" : ""}`}
          </p>
          <div className="flex items-center gap-1 border rounded-md p-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAndPersistViewMode("list")}
              className={viewMode === "list" ? "bg-muted" : ""}
              data-testid="button-view-list"
            >
              <List className="w-4 h-4 mr-1.5" />
              List
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAndPersistViewMode("kanban")}
              className={viewMode === "kanban" ? "bg-muted" : ""}
              data-testid="button-view-kanban"
            >
              <LayoutGrid className="w-4 h-4 mr-1.5" />
              Kanban
            </Button>
          </div>
        </div>

        {quotesLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading quotes...</p>
            </CardContent>
          </Card>
        ) : filteredQuotes.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No configurators found</h3>
              <p className="text-muted-foreground">
                {searchTerm || dateFilter !== "all" 
                  ? "Try adjusting your filters to see more configurators."
                  : "Customer configurators will appear here once they start using the configurator."
                }
              </p>
            </CardContent>
          </Card>
        ) : viewMode === "kanban" ? (
          (() => {
            const kanbanColumns = [
              { key: "new", label: "New" },
              { key: "contacted", label: "Contacted" },
              { key: "awaiting_deposit", label: "Awaiting Deposit" },
              { key: "awaiting_finance", label: "Finance Submitted" },
              { key: "finance_declined", label: "Finance Declined" },
              { key: "deposit_taken", label: "Deposit Taken" },
              { key: "finance_approved", label: "Finance Approved" },
              { key: "in_build", label: "In Build" },
              { key: "in_workshop", label: "In Workshop" },
              { key: "completed", label: "Completed" },
              { key: "cancelled", label: "Cancelled" },
            ];
            return (
              <div className="overflow-x-auto pb-4 -mx-1 px-1">
                <div className="flex gap-3 min-w-max">
                  {kanbanColumns.map(col => {
                    const colQuotes = filteredQuotes.filter(q => q.status === col.key);
                    return (
                      <div key={col.key} className="w-64 shrink-0" data-testid={`kanban-col-${col.key}`}>
                        <div className="flex items-center justify-between mb-2 px-1">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{col.label}</span>
                          <Badge variant="secondary" className="text-xs">{colQuotes.length}</Badge>
                        </div>
                        <div className="space-y-2 min-h-16">
                          {colQuotes.map(quote => (
                            <Card
                              key={quote.id}
                              className={`hover-elevate cursor-pointer ${isOverdue(quote) ? "border-amber-400/50" : ""}`}
                              data-testid={`kanban-card-${quote.id}`}
                              onClick={() => setLocation(`/admin/quotes/${quote.id}`)}
                            >
                              <CardContent className="p-3 space-y-1.5">
                                <div className="flex items-start gap-1.5 flex-wrap">
                                  <UserIcon className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground" />
                                  <p className="font-semibold text-sm truncate flex-1 min-w-0">{quote.userName}</p>
                                  {(quote as any).aiSessionId && (
                                    <Badge className="shrink-0 bg-[#8bc440]/15 text-[#5a8a1a] dark:text-[#8bc440] border border-[#8bc440]/30 gap-1 text-[10px] px-1.5 py-0" data-testid={`badge-max-ai-kanban-${quote.id}`}>
                                      <Bot className="w-2.5 h-2.5" />
                                      Max
                                    </Badge>
                                  )}
                                  {(quote as any).staffName && (
                                    <Badge className="shrink-0 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 gap-1 text-[10px] px-1.5 py-0" data-testid={`badge-staff-built-kanban-${quote.id}`}>
                                      <Wrench className="w-2.5 h-2.5" />
                                      {(quote as any).staffName}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Building2 className="w-3 h-3 shrink-0 text-muted-foreground" />
                                  <p className="text-xs text-muted-foreground truncate">{quote.company || "—"}</p>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {getVanName(quote.vanId)} {quote.kitId ? `· ${getKitName(quote.kitId)}` : ""}
                                </p>
                                <div className="flex items-center justify-between pt-0.5">
                                  <span className="text-xs font-bold text-accent">{formatPrice(quote.estTotal)}</span>
                                  <span className="text-xs text-muted-foreground">{quote.createdAt ? new Date(quote.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : ""}</span>
                                </div>
                                {(() => {
                                  const equipCost = computeEquipCost(quote.kitId, quote.selectedUpgradeIds || [], quote.selectedUpgrades || {});
                                  if (equipCost === null) return null;
                                  const marginPence = quote.estSubtotal - equipCost;
                                  const marginPct = quote.estSubtotal > 0 ? (marginPence / quote.estSubtotal) * 100 : 0;
                                  return (
                                    <Badge className={`text-[10px] px-1.5 py-0 border ${getMarginBadgeClass(marginPct)}`} data-testid={`badge-margin-kanban-${quote.id}`}>
                                      {marginPct.toFixed(0)}% margin
                                    </Badge>
                                  );
                                })()}
                                {isOverdue(quote) && (
                                  <div className="flex items-center gap-1 pt-0.5" data-testid={`badge-overdue-kanban-${quote.id}`}>
                                    <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">{daysInStatus(quote)}d — action needed</span>
                                  </div>
                                )}
                                {/* Profile-linked indicator */}
                                {(quote as any).customerId ? (
                                  <Link
                                    href={`/admin/customers/${(quote as any).customerId}`}
                                    onClick={e => e.stopPropagation()}
                                    data-testid={`link-profile-linked-kanban-${quote.id}`}
                                  >
                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline">
                                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                                      {quote.customerName ? `${quote.customerName} · View profile` : "View profile"}
                                    </span>
                                  </Link>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                                    data-testid={`text-no-profile-kanban-${quote.id}`}
                                  >
                                    <XCircle className="w-3 h-3 shrink-0" />
                                    No profile
                                  </span>
                                )}
                                <div className="pt-1 border-t border-border/50 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-3">
                                    <Link
                                      href={`/admin/quotes/${quote.id}?tab=configuration&from=quotes`}
                                      onClick={e => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                                      data-testid={`link-edit-config-kanban-${quote.id}`}
                                    >
                                      <Settings className="w-3 h-3" />
                                      Edit Config
                                    </Link>
                                    <Link
                                      href={`/admin/quotes/${quote.id}/build-sheet`}
                                      onClick={e => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                                      data-testid={`link-build-sheet-kanban-${quote.id}`}
                                    >
                                      <Printer className="w-3 h-3" />
                                      Build Sheet
                                    </Link>
                                  </div>
                                  {twilioConfigured && staffPhones.length > 0 && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          onClick={(e) => {
                                            if (!quote.phone) return;
                                            e.stopPropagation();
                                            setSelectedStaffPhoneId(staffPhones[0]?.id ?? "");
                                            setCallDialog({ quoteId: quote.id, customerName: quote.name || "Customer", toNumber: normaliseToE164(quote.phone) });
                                          }}
                                          disabled={!quote.phone}
                                          className="hidden md:flex p-1 rounded text-[#8bc440] hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                          data-testid={`icon-call-kanban-${quote.id}`}
                                        >
                                          <PhoneCall className="w-3 h-3" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent>{quote.phone ? "Call via bridge" : "No phone number on record"}</TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                          {colQuotes.length === 0 && (
                            <div className="text-center py-6 text-xs text-muted-foreground border border-dashed rounded-md">
                              None
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()
        ) : (
          <div className="space-y-2">
            {filteredQuotes.map((quote) => {
              const isExpanded = expandedIds.has(quote.id);
              return (
                <Card key={quote.id}>
                  {/* Collapsed summary row — always visible, click to expand */}
                  <div
                    className="w-full text-left cursor-pointer"
                    onClick={() => toggleExpanded(quote.id)}
                    data-testid={`button-expand-${quote.id}`}
                  >
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 px-4 py-3 hover-elevate rounded-md">
                      {/* Date stamp */}
                      <div className="flex flex-col items-center justify-center w-10 shrink-0 select-none" data-testid={`text-date-${quote.id}`}>
                        <span className="text-base font-bold leading-none">
                          {quote.createdAt ? new Date(quote.createdAt).toLocaleDateString("en-GB", { day: "2-digit" }) : "—"}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide leading-tight mt-0.5">
                          {quote.createdAt ? new Date(quote.createdAt).toLocaleDateString("en-GB", { month: "short" }) : ""}
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-tight">
                          {quote.createdAt ? new Date(quote.createdAt).getFullYear() : ""}
                        </span>
                      </div>

                      {/* Left: name, company, status */}
                      <div className="flex items-center gap-3 flex-wrap min-w-0">
                        <UserIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-semibold text-sm truncate" data-testid={`text-name-${quote.id}`}>{quote.userName}</span>
                        {quote.company && (
                          <Badge variant="secondary" className="shrink-0" data-testid={`text-company-${quote.id}`}>{quote.company}</Badge>
                        )}
                        {(quote as any).aiSessionId && (
                          <Badge className="shrink-0 bg-[#8bc440]/15 text-[#5a8a1a] dark:text-[#8bc440] border border-[#8bc440]/30 gap-1" data-testid={`badge-max-ai-${quote.id}`}>
                            <Bot className="w-3 h-3" />
                            Via Max
                          </Badge>
                        )}
                        {(quote as any).staffName && (
                          <Badge className="shrink-0 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 gap-1" data-testid={`badge-staff-built-${quote.id}`}>
                            <Wrench className="w-3 h-3" />
                            Built by {(quote as any).staffName}
                          </Badge>
                        )}
                        {/* Quick status dropdown */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0"
                          data-testid={`status-select-wrapper-${quote.id}`}
                        >
                          <Select
                            value={pendingStatuses[quote.id] ?? quote.status}
                            onValueChange={(v) => {
                              setPendingStatusChange({ id: quote.id, newStatus: v, currentStatus: pendingStatuses[quote.id] ?? quote.status });
                              setStatusNoteText("");
                            }}
                          >
                            <SelectTrigger
                              className={`h-auto py-0.5 pl-2 pr-1.5 text-xs font-medium border-0 gap-1 shadow-none focus:ring-1 focus:ring-ring ${getStatusBadgeClass(pendingStatuses[quote.id] ?? quote.status)}`}
                              data-testid={`status-select-${quote.id}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ALL_STATUSES.map(s => (
                                <SelectItem key={s} value={s}>
                                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${getStatusBadgeClass(s)}`}>
                                    {getStatusLabel(s)}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {/* Overdue nudge — show when stuck in status too long */}
                        {isOverdue(quote) && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 shrink-0"
                            data-testid={`badge-overdue-${quote.id}`}
                          >
                            <Clock className="w-3 h-3" />
                            {daysInStatus(quote)}d — action needed
                          </span>
                        )}
                        {/* Profile-linked indicator */}
                        {(quote as any).customerId ? (
                          <Link
                            href={`/admin/customers/${(quote as any).customerId}`}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            data-testid={`link-profile-linked-${quote.id}`}
                          >
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline shrink-0">
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              {quote.customerName ? `${quote.customerName} · View profile` : "View profile"}
                            </span>
                          </Link>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0"
                            data-testid={`text-no-profile-${quote.id}`}
                          >
                            <XCircle className="w-3 h-3 shrink-0" />
                            No profile
                          </span>
                        )}
                      </div>

                      {/* Centre: phone & email as quick-action links */}
                      <div className="hidden md:flex items-center gap-3 text-sm text-muted-foreground shrink-0">
                        <a
                          href={`tel:${quote.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                          data-testid={`link-phone-${quote.id}`}
                          title={`Call ${quote.phone}`}
                        >
                          <Phone className="w-3 h-3" />
                          {quote.phone}
                        </a>
                        <a
                          href={`mailto:${quote.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                          data-testid={`link-email-${quote.id}`}
                          title={`Email ${quote.email}`}
                        >
                          <Mail className="w-3 h-3" />
                          {quote.email}
                        </a>
                      </div>

                      {/* Right: quick-action icons + total + chevron */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a
                              href={`tel:${quote.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="md:hidden p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              data-testid={`icon-phone-${quote.id}`}
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          </TooltipTrigger>
                          <TooltipContent>Call {quote.phone}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a
                              href={`mailto:${quote.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="md:hidden p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              data-testid={`icon-email-${quote.id}`}
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          </TooltipTrigger>
                          <TooltipContent>Email {quote.email}</TooltipContent>
                        </Tooltip>
                        {/* Quick note button */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setNotePopover({ quoteId: quote.id, customerId: (quote as any).customerId ?? null });
                                setNoteText("");
                                setNoteType("call");
                              }}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              data-testid={`icon-note-${quote.id}`}
                            >
                              <StickyNote className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Add note</TooltipContent>
                        </Tooltip>
                        {/* Click-to-call button — desktop only, shown if Twilio is configured */}
                        {twilioConfigured && staffPhones.length > 0 && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={(e) => {
                                  if (!quote.phone) return;
                                  e.stopPropagation();
                                  setSelectedStaffPhoneId(staffPhones[0]?.id ?? "");
                                  setCallDialog({ quoteId: quote.id, customerName: quote.name || "Customer", toNumber: normaliseToE164(quote.phone) });
                                }}
                                disabled={!quote.phone}
                                className="hidden md:flex p-1.5 rounded hover:bg-muted text-[#8bc440] hover:text-[#8bc440]/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
                                data-testid={`icon-call-${quote.id}`}
                              >
                                <PhoneCall className="w-3.5 h-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>{quote.phone ? "Call via bridge" : "No phone number on record"}</TooltipContent>
                          </Tooltip>
                        )}
                        {(() => {
                          const equipCost = computeEquipCost(quote.kitId, quote.selectedUpgradeIds || [], quote.selectedUpgrades || {});
                          if (equipCost === null) return <span className="text-xs text-muted-foreground" data-testid={`text-margin-na-${quote.id}`}>—</span>;
                          const marginPct = quote.estSubtotal > 0 ? ((quote.estSubtotal - equipCost) / quote.estSubtotal) * 100 : 0;
                          return (
                            <Badge className={`text-[10px] px-1.5 py-0 border ${getMarginBadgeClass(marginPct)}`} data-testid={`badge-margin-${quote.id}`}>
                              {marginPct.toFixed(0)}% margin
                            </Badge>
                          );
                        })()}
                        <span className="font-bold text-sm" data-testid={`quote-total-${quote.id}`}>{formatPrice(quote.estTotal)}</span>
                        {isExpanded
                          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        }
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail — only visible when open */}
                  {isExpanded && (
                    <CardContent className="pt-0 pb-4 px-4 border-t">
                      {/* Mobile phone/email row */}
                      <div className="flex md:hidden items-center gap-4 text-sm text-muted-foreground mb-4 mt-3 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {quote.phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {quote.email}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                        {/* Customer Profile */}
                        {quote.customerId && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              Customer Profile
                            </div>
                            <Link
                              href={`/admin/customers/${quote.customerId}`}
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              data-testid={`link-profile-expanded-${quote.id}`}
                            >
                              <span className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline">
                                {quote.customerName ? `${quote.customerName} · Profile linked` : "Profile linked"}
                              </span>
                            </Link>
                          </div>
                        )}
                        {/* Van Selection */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Car className="w-4 h-4" />
                            Van
                          </div>
                          {quote.vanId ? (
                            (() => {
                              const stockReg = getVanReg(quote.vanId, quote.vanRegistration);
                              return (
                                <div className="space-y-0.5">
                                  <p className="text-sm text-muted-foreground">{getVanName(quote.vanId)}</p>
                                  {stockReg && (
                                    <p className="text-sm font-medium font-mono uppercase" data-testid={`text-quote-van-reg-${quote.id}`}>
                                      {stockReg}
                                    </p>
                                  )}
                                </div>
                              );
                            })()
                          ) : quote.customVanValue || quote.vanRegistration || quote.customVanDescription ? (
                            <div className="space-y-0.5">
                              {quote.vanRegistration && (
                                <p className="text-sm font-medium">{quote.vanRegistration.toUpperCase()}</p>
                              )}
                              {quote.customVanDescription && (
                                <p className="text-sm text-muted-foreground">{quote.customVanDescription}</p>
                              )}
                              {quote.customVanValue && (
                                <p className="text-sm text-muted-foreground">£{(quote.customVanValue / PENCE_PER_POUND).toLocaleString()}</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No van selected</p>
                          )}
                        </div>

                        {/* Kit Selection */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Package className="w-4 h-4" />
                            Equipment Package
                          </div>
                          <p className="text-sm text-muted-foreground">{getKitName(quote.kitId)}</p>
                        </div>

                        {/* Upgrades */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Wrench className="w-4 h-4" />
                            Upgrades ({quote.selectedUpgradeIds.length})
                          </div>
                          {quote.selectedUpgradeIds.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No upgrades</p>
                          ) : (
                            <ul className="space-y-0.5">
                              {getUpgradeList(quote.selectedUpgradeIds).map((name, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-sm text-muted-foreground">
                                  <span className="mt-1.5 w-1 h-1 rounded-full bg-muted-foreground/50 flex-shrink-0" />
                                  {name}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>

                      {/* Reassignment history */}
                      {Array.isArray((quote as any).reassignmentHistory) && (quote as any).reassignmentHistory.length > 1 && (
                        <div className="mt-4">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                            <History className="w-3.5 h-3.5" /> Reassignment History
                          </p>
                          <div className="space-y-1.5" data-testid={`text-reassignment-history-quote-${quote.id}`}>
                            {(quote as any).reassignmentHistory.map((entry: { fromCustomerName: string; fromCustomerId: string; toCustomerName: string; toCustomerId: string; reassignedAt: string }, i: number) => (
                              <div key={i} className="flex items-center gap-1.5 text-xs">
                                <Link href={`/admin/customers/${entry.fromCustomerId}`} className="text-muted-foreground hover:text-foreground hover:underline transition-colors" data-testid={`link-reassignment-from-customer-${entry.fromCustomerId}`}>{entry.fromCustomerName}</Link>
                                <span className="text-muted-foreground">→</span>
                                <Link href={`/admin/customers/${entry.toCustomerId}`} className="text-foreground font-medium hover:underline transition-colors" data-testid={`link-reassignment-to-customer-${entry.toCustomerId}`}>{entry.toCustomerName}</Link>
                                <span className="text-muted-foreground ml-auto">
                                  {new Date(entry.reassignedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}{" "}
                                  {new Date(entry.reassignedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {quote.notes && (
                        <div className="mt-4 p-3 bg-muted rounded-md">
                          <div className="flex items-center gap-2 text-sm font-medium mb-1">
                            <StickyNote className="w-4 h-4" />
                            Customer Notes
                          </div>
                          <p className="text-sm text-muted-foreground">{quote.notes}</p>
                        </div>
                      )}

                      {/* Pricing Breakdown */}
                      <div className="mt-4 p-3 border rounded-md">
                        <div className="space-y-1">
                          {(() => {
                            const equipCost = computeEquipCost(quote.kitId, quote.selectedUpgradeIds || [], quote.selectedUpgrades || {});
                            if (equipCost === null) return null;
                            const marginPence = quote.estSubtotal - equipCost;
                            const marginPct = quote.estSubtotal > 0 ? (marginPence / quote.estSubtotal) * 100 : 0;
                            return (
                              <>
                                <div className="flex justify-between text-sm text-muted-foreground">
                                  <span>Equipment cost:</span>
                                  <span>{formatPrice(equipCost)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Gross margin:</span>
                                  <span className={`font-semibold ${getMarginColor(marginPct)}`} data-testid={`text-margin-list-${quote.id}`}>
                                    {formatPrice(marginPence)} ({marginPct.toFixed(1)}%)
                                  </span>
                                </div>
                              </>
                            );
                          })()}
                          <div className="flex justify-between text-sm">
                            <span>Subtotal:</span>
                            <span>{formatPrice(quote.estSubtotal)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>VAT (20%):</span>
                            <span>{formatPrice(quote.estVAT)}</span>
                          </div>
                          <div className="flex justify-between font-bold border-t pt-1">
                            <span>Total:</span>
                            <span>{formatPrice(quote.estTotal)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-4 flex justify-end gap-3 flex-wrap">
                        <Button variant="outline" asChild data-testid={`button-edit-config-${quote.id}`}>
                          <Link href={`/admin/quotes/${quote.id}?tab=configuration&from=quotes`}>
                            <Settings className="w-4 h-4 mr-2" />
                            Edit Config
                          </Link>
                        </Button>
                        <Button variant="default" asChild data-testid={`button-manage-${quote.id}`}>
                          <Link href={`/admin/quotes/${quote.id}?from=quotes`}>
                            <Wrench className="w-4 h-4 mr-2" />
                            View Details
                          </Link>
                        </Button>
                        <Button variant="outline" asChild data-testid={`button-build-sheet-${quote.id}`}>
                          <Link href={`/admin/quotes/${quote.id}/build-sheet`}>
                            <Printer className="w-4 h-4 mr-2" />
                            View Build Sheet
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick note dialog */}
      <Dialog open={!!notePopover} onOpenChange={(open) => { if (!open) setNotePopover(null); }}>
        <DialogContent className="max-w-sm" data-testid="dialog-quick-note">
          <DialogHeader>
            <DialogTitle>
              {notePopover && (quotes as any[]).find((q: any) => q.id === notePopover.quoteId)
                ? notePopover.customerId
                  ? `Note for ${(quotes as any[]).find((q: any) => q.id === notePopover.quoteId)?.customerName || (quotes as any[]).find((q: any) => q.id === notePopover.quoteId)?.userName}`
                  : `Note on quote`
                : "Add note"}
            </DialogTitle>
            <DialogDescription>
              {notePopover?.customerId
                ? "Saved to the customer's profile and linked quotes."
                : "Saved as an internal note on this quote."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {notePopover?.customerId && (
              <div className="space-y-1">
                <Label htmlFor="quick-note-type">Type</Label>
                <Select value={noteType} onValueChange={(v) => setNoteType(v as typeof noteType)}>
                  <SelectTrigger id="quick-note-type" className="h-9" data-testid="select-quick-note-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Phone call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="quick-note-text">Note</Label>
              <Textarea
                id="quick-note-text"
                placeholder="What happened on this call?"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={4}
                autoFocus
                data-testid="textarea-quick-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotePopover(null)}>Cancel</Button>
            <Button
              disabled={!noteText.trim() || addNoteMutation.isPending}
              onClick={() => notePopover && addNoteMutation.mutate({
                quoteId: notePopover.quoteId,
                customerId: notePopover.customerId,
                text: noteText.trim(),
                type: noteType,
              })}
              data-testid="button-save-quick-note"
            >
              {addNoteMutation.isPending ? "Saving…" : "Save note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status change note dialog */}
      <Dialog
        open={!!pendingStatusChange}
        onOpenChange={(open) => { if (!open) setPendingStatusChange(null); }}
      >
        <DialogContent className="max-w-md" data-testid="dialog-status-change-note">
          <DialogHeader>
            <DialogTitle>
              Moving to: {pendingStatusChange ? getStatusLabel(pendingStatusChange.newStatus) : ""}
            </DialogTitle>
            <DialogDescription>
              Add a note to explain this status change — it will be saved to the quote's notes history.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="status-change-note">
              Note <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="status-change-note"
              placeholder="e.g. Customer confirmed they are happy to proceed..."
              value={statusNoteText}
              onChange={(e) => setStatusNoteText(e.target.value)}
              rows={3}
              data-testid="textarea-status-change-note"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingStatusChange(null)} data-testid="button-cancel-status-change">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!pendingStatusChange) return;
                const { id, newStatus } = pendingStatusChange;
                statusMutation.mutate({ id, status: newStatus, note: statusNoteText });
                if (newStatus === "contacted") {
                  const q = quotes?.find((q: any) => q.id === id);
                  if (q) {
                    setFuPendingQuote({ id, name: (q as any).userName, email: (q as any).email, phone: (q as any).phone });
                    setFuDate(new Date().toISOString().split("T")[0]);
                    setFuNotes("");
                    setFuDialogOpen(true);
                  }
                }
                setPendingStatusChange(null);
                setStatusNoteText("");
              }}
              data-testid="button-confirm-status-change"
            >
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fuDialogOpen} onOpenChange={setFuDialogOpen}>
        <DialogContent className="max-w-sm" data-testid="modal-schedule-followup-quote">
          <DialogHeader>
            <DialogTitle>When do you want to follow up?</DialogTitle>
            <DialogDescription>
              {fuPendingQuote?.name
                ? <>Choose a follow-up date for <strong>{fuPendingQuote.name}</strong>. It will be added to your calendar automatically.</>
                : <>Choose a follow-up date. It will be added to your calendar automatically.</>
              }
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-1">
            <div>
              <Label htmlFor="fu-date-quote">Follow-up date</Label>
              <Input
                id="fu-date-quote"
                type="date"
                value={fuDate}
                onChange={(e) => setFuDate(e.target.value)}
                data-testid="input-followup-date-quote"
              />
            </div>
            <div>
              <Label htmlFor="fu-notes-quote">Notes (optional)</Label>
              <Textarea
                id="fu-notes-quote"
                value={fuNotes}
                onChange={(e) => setFuNotes(e.target.value)}
                placeholder="What to discuss or follow up on..."
                rows={2}
                data-testid="textarea-followup-notes-quote"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFuDialogOpen(false)} data-testid="button-skip-followup-quote">
              Skip
            </Button>
            <Button
              onClick={() => {
                if (!fuPendingQuote || !fuDate) return;
                scheduleFollowUpMutation.mutate({
                  customerName: fuPendingQuote.name || fuPendingQuote.email || "Unknown",
                  customerPhone: fuPendingQuote.phone || null,
                  customerEmail: fuPendingQuote.email || null,
                  scheduledDate: fuDate,
                  notes: fuNotes || null,
                  quoteId: fuPendingQuote.id,
                  assignedToUserId: user?.id || null,
                  assignedToName: user ? `${(user as any).firstName || ""} ${(user as any).lastName || ""}`.trim() || user.username : null,
                  assignedToEmail: user?.email || null,
                  createdBy: user?.username || "admin",
                });
              }}
              disabled={!fuDate || scheduleFollowUpMutation.isPending}
              data-testid="button-confirm-followup-quote"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Add to calendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Click-to-call dialog */}
      <Dialog open={!!callDialog} onOpenChange={(open) => { if (!open) setCallDialog(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-[#8bc440]" />
              Call {callDialog?.customerName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="font-mono font-medium">{callDialog?.toNumber}</span>
            </div>
            <div className="space-y-1.5">
              <Label>Your phone (Twilio will ring this first)</Label>
              {staffPhones.length === 1 ? (
                <div className="rounded-md border px-3 py-2 text-sm flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span>{staffPhones[0].phone}</span>
                  <span className="text-muted-foreground text-xs">({staffPhones[0].label})</span>
                </div>
              ) : (
                <Select value={selectedStaffPhoneId} onValueChange={setSelectedStaffPhoneId}>
                  <SelectTrigger data-testid="select-staff-phone">
                    <SelectValue placeholder="Select your phone…" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffPhones.map((p) => (
                      <SelectItem key={p.id} value={p.id} data-testid={`option-staff-phone-${p.id}`}>
                        {p.phone} <span className="text-muted-foreground text-xs ml-1">({p.label})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Twilio will call your phone. Answer it and you will be automatically connected to the customer. The call is logged as a note on this quote.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCallDialog(null)}>Cancel</Button>
            <Button
              size="sm"
              className="bg-[#8bc440] text-[#191919]"
              disabled={!selectedStaffPhoneId || !callDialog?.toNumber || initiateCallMutation.isPending}
              onClick={() => {
                if (!callDialog) return;
                initiateCallMutation.mutate({
                  staffNumberId: selectedStaffPhoneId,
                  toNumber: callDialog.toNumber,
                  quoteId: callDialog.quoteId,
                });
              }}
              data-testid="button-confirm-call"
            >
              <PhoneCall className="w-3.5 h-3.5 mr-1.5" />
              {initiateCallMutation.isPending ? "Calling…" : "Call me now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}