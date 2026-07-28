import { useAuth } from "@/hooks/useAuth";
import { useIdlePolling } from "@/hooks/useIdlePolling";
import type { User, Lead, StaffPhone } from "@shared/schema";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchJson } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { AdminBackButton } from "@/components/AdminBackButton";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Users,
  Search,
  Download,
  Calendar,
  User as UserIcon,
  Phone,
  Mail,
  MessageSquare,
  Globe,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Plus,
  ExternalLink,
  StickyNote,
  XCircle,
  PhoneCall,
  CheckCircle2,
  Link2,
  History,
  UserPlus,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

const REDIRECT_DELAY_MS = 500;
const ACCESS_DENIED_REDIRECT_MS = 1000;
const POLL_INTERVAL_MS = 60_000;
const WEEK_DAYS = 7;

type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "closed" | "dead";

const STATUS_CONFIG: Record<LeadStatus, { label: string; className: string }> = {
  new:       { label: "New",        className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  contacted: { label: "Contacted",  className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  qualified: { label: "Qualified",  className: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  converted: { label: "Converted",  className: "bg-green-500/20 text-green-400 border-green-500/30" },
  closed:    { label: "Closed",     className: "bg-muted text-muted-foreground border-border" },
  dead:      { label: "Dead Lead",  className: "bg-red-500/15 text-red-400 border-red-500/30" },
};

function getSourceBadge(source: string) {
  const labels: Record<string, string> = {
    live_chat: "Live Chat",
    contact_form: "Contact Form",
    home_enquiry: "Home Enquiry",
    configurator: "Configurator",
  };
  return (
    <Badge variant="secondary" className="text-xs shrink-0">
      {labels[source] ?? source.replace(/_/g, " ")}
    </Badge>
  );
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "Unknown";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatNoteDate(ts: string) {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminLeads() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth() as {
    user: User | undefined;
    isAuthenticated: boolean;
    isLoading: boolean;
  };

  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [profileFilter, setProfileFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [showClosed, setShowClosed] = useState(false);

  // Deep-link focus: ?focus=<leadId> — auto-expand and scroll to a specific lead
  const focusLeadId = new URLSearchParams(window.location.search).get("focus") ?? null;
  const focusHandledRef = useRef(false);
  const focusCardRef = useRef<HTMLDivElement | null>(null);

  // CRM expansion state
  const [expandedLeads, setExpandedLeads] = useState<Set<string>>(
    focusLeadId ? new Set([focusLeadId]) : new Set()
  );
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  // Link-to-customer dialog state
  const [linkLeadId, setLinkLeadId] = useState<string | null>(null);
  const [linkCustomerSearch, setLinkCustomerSearch] = useState("");
  const [linkCustomerSelected, setLinkCustomerSelected] = useState<{ id: string; name: string; email?: string | null } | null>(null);
  const [linkCurrentCustomerId, setLinkCurrentCustomerId] = useState<string | null>(null);
  const linkSearchPrefilledRef = useRef(false);

  // Unlink-customer confirmation state
  const [unlinkLeadId, setUnlinkLeadId] = useState<string | null>(null);

  // Create-profile-from-lead dialog state
  const [createProfileLead, setCreateProfileLead] = useState<Lead | null>(null);
  const [createProfileName, setCreateProfileName] = useState("");
  const [createProfileEmail, setCreateProfileEmail] = useState("");
  const [createProfilePhone, setCreateProfilePhone] = useState("");

  // Follow-up scheduling prompt
  const [fuDialogOpen, setFuDialogOpen] = useState(false);
  const [fuLead, setFuLead] = useState<Lead | null>(null);
  const [fuDate, setFuDate] = useState(new Date().toISOString().split("T")[0]);
  const [fuNotes, setFuNotes] = useState("");

  const scheduleFollowUpMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/admin/follow-ups", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/follow-ups"], refetchType: "all" });
      setFuDialogOpen(false);
      toast({ title: "Follow-up scheduled", description: "You can view it in the Calendar." });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to schedule follow-up" }),
  });

  // Click-to-call
  const [callDialog, setCallDialog] = useState<{ leadId: string; customerName: string; toNumber: string } | null>(null);
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
    mutationFn: async ({ staffNumberId, toNumber, leadId }: { staffNumberId: string; toNumber: string; leadId: string }) => {
      const res = await apiRequest("POST", "/api/admin/calls/initiate", { staffNumberId, toNumber, leadId });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed to start call"); }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Connected — check your phone", description: data.message || "Twilio will ring your phone and connect you to the customer." });
      setCallDialog(null);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Call failed", description: err.message });
    },
  });

  const toggleExpand = (id: string) =>
    setExpandedLeads((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
      setTimeout(() => { window.location.href = "/login"; }, REDIRECT_DELAY_MS);
    }
  }, [isAuthenticated, isLoading, toast]);

  useEffect(() => {
    if (user && (!user.adminRole || user.adminRole === "none")) {
      toast({ title: "Access Denied", description: "Admin access required.", variant: "destructive" });
      setTimeout(() => { window.location.href = "/"; }, ACCESS_DENIED_REDIRECT_MS);
    }
  }, [user, toast]);

  const isActive = useIdlePolling();

  type LeadWithCustomer = Lead & { customerName?: string | null };

  const { data: leads = [], isLoading: leadsLoading, error: leadsError, isFetching: leadsFetching, refetch: refetchLeads } = useQuery<LeadWithCustomer[]>({
    queryKey: ["/api/admin/leads"],
    enabled: !!(user?.adminRole && user.adminRole !== "none"),
    refetchInterval: isActive ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });

  // Scroll to and highlight the focused lead once data is available
  useEffect(() => {
    if (!focusLeadId || focusHandledRef.current || leadsLoading || leads.length === 0) return;
    const exists = leads.some(l => l.id === focusLeadId);
    if (!exists) return;
    focusHandledRef.current = true;
    // If the lead is in a closed/dead state we need showClosed enabled
    const lead = leads.find(l => l.id === focusLeadId);
    if (lead) {
      const s = lead.status || "new";
      if (s === "closed" || s === "dead") setShowClosed(true);
    }
    // Scroll after a tick to let React render the card
    setTimeout(() => {
      focusCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  }, [focusLeadId, leads, leadsLoading]);

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Lead> }) =>
      apiRequest("PATCH", `/api/admin/leads/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/leads"] });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to update lead." });
    },
  });

  const linkCustomerMutation = useMutation({
    mutationFn: async ({ leadId, customerId }: { leadId: string; customerId: string }) =>
      apiRequest("PATCH", `/api/admin/leads/${leadId}`, { customerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/leads"] });
      setLinkLeadId(null);
      setLinkCustomerSearch("");
      setLinkCustomerSelected(null);
      toast({ title: "Customer linked", description: "The lead has been linked to the selected customer profile." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to link customer." });
    },
  });

  const unlinkCustomerMutation = useMutation({
    mutationFn: async (leadId: string) =>
      apiRequest("PATCH", `/api/admin/leads/${leadId}`, { customerId: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/leads"] });
      setUnlinkLeadId(null);
      toast({ title: "Customer unlinked", description: "The customer profile has been removed from this lead." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to unlink customer." });
    },
  });

  const createCustomerFromLeadMutation = useMutation({
    mutationFn: async ({ leadId, name, email, phone }: { leadId: string; name: string; email: string; phone: string }) => {
      const res = await apiRequest("POST", "/api/admin/customers", { name, email: email || undefined, phone: phone || undefined });
      const customer = await res.json() as { id: string; name: string; email?: string | null };
      await apiRequest("PATCH", `/api/admin/leads/${leadId}`, { customerId: customer.id });
      return customer;
    },
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      setCreateProfileLead(null);
      toast({
        title: "Profile created",
        description: `A customer profile for ${customer.name} has been created and linked to this lead.`,
        action: (
          <ToastAction altText="View profile" onClick={() => navigate(`/admin/customers/${customer.id}`)}>
            View profile
          </ToastAction>
        ),
      });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to create customer profile." });
    },
  });

  const { data: customerSearchResults = [] } = useQuery<Array<{ id: string; name: string; email?: string | null; phone?: string | null }>>({
    queryKey: ["/api/admin/customers", linkCustomerSearch],
    queryFn: () => fetchJson(`/api/admin/customers${linkCustomerSearch ? `?search=${encodeURIComponent(linkCustomerSearch)}` : ""}`),
    enabled: !!linkLeadId,
    staleTime: 10_000,
  });

  // Duplicate customer check for create-profile dialog — uses current input values
  // so the warning stays accurate if staff edits the email or phone before submitting
  const dupEmailTerm = createProfileEmail.trim();
  const dupPhoneTerm = createProfilePhone.trim();

  const { data: dupEmailResults = [] } = useQuery<Array<{ id: string; name: string; email?: string | null; phone?: string | null }>>({
    queryKey: ["/api/admin/customers", "dup-check-email", dupEmailTerm],
    queryFn: () => fetchJson(`/api/admin/customers?search=${encodeURIComponent(dupEmailTerm)}`),
    enabled: !!createProfileLead && !!dupEmailTerm,
    staleTime: 30_000,
  });

  const { data: dupPhoneResults = [] } = useQuery<Array<{ id: string; name: string; email?: string | null; phone?: string | null }>>({
    queryKey: ["/api/admin/customers", "dup-check-phone", dupPhoneTerm],
    queryFn: () => fetchJson(`/api/admin/customers?search=${encodeURIComponent(dupPhoneTerm)}`),
    enabled: !!createProfileLead && !!dupPhoneTerm,
    staleTime: 30_000,
  });

  const duplicateMatches = useMemo(() => {
    const leadEmail = dupEmailTerm.toLowerCase();
    const leadPhone = dupPhoneTerm;
    const seen = new Set<string>();
    return [...dupEmailResults, ...dupPhoneResults].filter((c) => {
      if (seen.has(c.id)) return false;
      const emailMatch = leadEmail && c.email?.toLowerCase() === leadEmail;
      const phoneMatch = leadPhone && c.phone === leadPhone;
      if (emailMatch || phoneMatch) { seen.add(c.id); return true; }
      return false;
    });
  }, [dupEmailResults, dupPhoneResults, dupEmailTerm, dupPhoneTerm]);

  const linkExistingFromCreateMutation = useMutation({
    mutationFn: async ({ leadId, customerId }: { leadId: string; customerId: string }) =>
      apiRequest("PATCH", `/api/admin/leads/${leadId}`, { customerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/leads"] });
      setCreateProfileLead(null);
      toast({ title: "Customer linked", description: "The existing customer profile has been linked to this lead." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to link customer." });
    },
  });

  const { data: linkedCustomerProfile, isError: linkedCustomerError } = useQuery<{ id: string; name: string; email?: string | null }>({
    queryKey: ["/api/admin/customers/profile", linkCurrentCustomerId],
    queryFn: () => fetchJson(`/api/admin/customers/${linkCurrentCustomerId}`),
    enabled: !!linkCurrentCustomerId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (linkedCustomerProfile && !linkSearchPrefilledRef.current) {
      linkSearchPrefilledRef.current = true;
      setLinkCustomerSearch(linkedCustomerProfile.name);
      setLinkCustomerSelected({ id: linkedCustomerProfile.id, name: linkedCustomerProfile.name, email: linkedCustomerProfile.email ?? null });
    }
  }, [linkedCustomerProfile]);

  // Status-change note dialog state
  const [pendingStatusChange, setPendingStatusChange] = useState<{ lead: Lead; status: LeadStatus } | null>(null);
  const [statusNoteText, setStatusNoteText] = useState("");

  const handleStatusChange = (lead: Lead, status: LeadStatus) => {
    setPendingStatusChange({ lead, status });
    setStatusNoteText("");
  };

  const confirmStatusChange = (note: string) => {
    if (!pendingStatusChange) return;
    const { lead, status } = pendingStatusChange;
    const updateData: Record<string, any> = { status };
    if (note.trim()) {
      const existing: Array<{ text: string; timestamp: string; author?: string }> = (lead as any).crmNotes ?? [];
      updateData.crmNotes = [
        ...existing,
        {
          text: `Status → ${STATUS_CONFIG[status]?.label ?? status}: ${note.trim()}`,
          timestamp: new Date().toISOString(),
          author: user?.username ?? "Admin",
        },
      ];
    }
    updateLeadMutation.mutate({ id: lead.id, data: updateData });
    if (status === "contacted") {
      setFuLead(lead);
      setFuDate(new Date().toISOString().split("T")[0]);
      setFuNotes("");
      setFuDialogOpen(true);
    }
    setPendingStatusChange(null);
    setStatusNoteText("");
  };

  const handleAddNote = (lead: Lead) => {
    const text = (noteInputs[lead.id] || "").trim();
    if (!text) return;
    const newNote = { text, timestamp: new Date().toISOString(), author: user?.username || "Admin" };
    const existing = (lead as any).crmNotes || [];
    updateLeadMutation.mutate(
      { id: lead.id, data: { crmNotes: [...existing, newNote] } as any },
      { onSuccess: () => setNoteInputs((prev) => ({ ...prev, [lead.id]: "" })) }
    );
  };

  // Filtering & sorting
  const closedLeadCount = leads.filter((l) => {
    const s = (l as any).status || "new";
    return s === "closed" || s === "dead";
  }).length;

  const filteredLeads = leads
    .filter((lead) => {
      const s = (lead as any).status || "new";
      if (!showClosed && (s === "closed" || s === "dead")) return false;
      const term = searchTerm.toLowerCase();
      if (term && ![lead.name, lead.email, lead.phone, lead.message].some(
        (f) => f?.toLowerCase().includes(term)
      )) return false;
      if (sourceFilter !== "all" && lead.source !== sourceFilter) return false;
      if (statusFilter !== "all" && (lead.status || "new") !== statusFilter) return false;
      if (profileFilter === "linked" && !lead.customerId) return false;
      if (profileFilter === "unlinked" && lead.customerId) return false;
      if (dateFilter !== "all" && lead.createdAt) {
        const d = new Date(lead.createdAt);
        const now = new Date();
        if (dateFilter === "today") {
          if (d.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === "week") {
          const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - WEEK_DAYS);
          if (d < weekAgo) return false;
        } else if (dateFilter === "month") {
          if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "newest") return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
      if (sortBy === "oldest") return new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime();
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return 0;
    });

  const uniqueSources = [...new Set(leads.map((l) => l.source))];

  const handleExportLeads = () => {
    if (filteredLeads.length === 0) {
      toast({ title: "No Data", description: "No leads to export with current filters.", variant: "destructive" });
      return;
    }
    const headers = ["Name", "Email", "Phone", "Source", "Status", "Message", "Date"];
    const rows = filteredLeads.map((l) => [
      `"${l.name}"`, `"${l.email}"`, `"${l.phone || ""}"`,
      `"${l.source}"`, `"${(l as any).status || "new"}"`,
      `"${(l.message || "").replace(/"/g, '""')}"`,
      `"${formatDate(l.createdAt)}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `leads-export-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Export Successful", description: `Exported ${filteredLeads.length} leads.` });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user?.adminRole || user.adminRole === "none") return null;

  if (leadsError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-destructive text-sm">Failed to load — check your connection and try again</p>
          <Button variant="outline" size="sm" onClick={() => refetchLeads()} data-testid="button-retry-leads">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminPageHeader
        title="Lead Management"
        description="Track and manage customer inquiries and leads"
        statusIndicator={
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`w-1.5 h-1.5 rounded-full ${leadsFetching ? "bg-amber-400 animate-pulse" : isActive ? "bg-[hsl(86_53%_51%)]" : "bg-muted-foreground/40"}`} />
            {leadsFetching ? "Refreshing…" : isActive ? `Live` : "Paused"}
          </span>
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExportLeads} data-testid="button-export-leads">
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export CSV
            </Button>
          </>
        }
      />

      <div className="w-full px-4 py-6">
        <AdminBackButton />

        <div className="space-y-6">
        {/* Filters */}
        <Card data-testid="card-leads-filter">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filter Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, phone, email, or message..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-leads"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-full" data-testid="select-source-filter">
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  {uniqueSources.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full" data-testid="select-status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {(Object.entries(STATUS_CONFIG) as [LeadStatus, typeof STATUS_CONFIG[LeadStatus]][]).map(([val, cfg]) => (
                    <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={profileFilter} onValueChange={setProfileFilter}>
                <SelectTrigger className="w-full" data-testid="select-profile-filter-leads">
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
                  <SelectValue placeholder="All time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This week</SelectItem>
                  <SelectItem value="month">This month</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full" data-testid="select-sort-leads">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="name">Name A–Z</SelectItem>
                </SelectContent>
              </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Result count — visible only when filters are active */}
        {!leadsLoading && (searchTerm !== "" || sourceFilter !== "all" || statusFilter !== "all" || profileFilter !== "all" || dateFilter !== "all") && (
          <p className="text-sm text-muted-foreground" data-testid="text-leads-result-count">
            Showing <span className="font-medium text-foreground">{filteredLeads.length}</span> of{" "}
            <span className="font-medium text-foreground">{leads.length}</span>{" "}
            {filteredLeads.length === 1 ? "lead" : "leads"}
          </p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold" data-testid="stat-total-leads">{leads.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">This Week</p>
                <p className="text-2xl font-bold" data-testid="stat-week-leads">
                  {leads.filter((l) => {
                    if (!l.createdAt) return false;
                    const d = new Date(l.createdAt);
                    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - WEEK_DAYS);
                    return d >= weekAgo;
                  }).length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <TrendingUp className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Today</p>
                <p className="text-2xl font-bold" data-testid="stat-today-leads">
                  {leads.filter((l) => l.createdAt && new Date(l.createdAt).toDateString() === new Date().toDateString()).length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Top Source</p>
                <p className="text-sm font-bold truncate" data-testid="stat-top-source">
                  {(() => {
                    const counts = leads.reduce<Record<string, number>>((acc, l) => {
                      acc[l.source] = (acc[l.source] || 0) + 1;
                      return acc;
                    }, {});
                    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
                    return top ? top[0].replace(/_/g, " ") : "—";
                  })()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Closed leads toggle — always visible when there are closed/dead leads */}
        {!leadsLoading && closedLeadCount > 0 && (
          <div className="text-center">
            {!showClosed ? (
              <button
                className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                onClick={() => setShowClosed(true)}
                data-testid="button-show-closed-leads"
              >
                {closedLeadCount} closed {closedLeadCount === 1 ? "lead" : "leads"} hidden — show
              </button>
            ) : (
              <button
                className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                onClick={() => setShowClosed(false)}
                data-testid="button-hide-closed-leads"
              >
                Hide closed leads
              </button>
            )}
          </div>
        )}

        {/* Leads list */}
        {leadsLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading leads...</p>
            </CardContent>
          </Card>
        ) : filteredLeads.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No leads found</h3>
              <p className="text-muted-foreground">
                {!showClosed && closedLeadCount > 0
                  ? "All leads are closed."
                  : searchTerm || sourceFilter !== "all" || statusFilter !== "all" || dateFilter !== "all"
                  ? "Try adjusting your filters to see more leads."
                  : "Customer inquiries and leads will appear here."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredLeads.map((lead) => {
              const isExpanded = expandedLeads.has(lead.id);
              const status = ((lead as any).status || "new") as LeadStatus;
              const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.new;
              const crmNotes: Array<{ text: string; timestamp: string; author?: string }> =
                (lead as any).crmNotes || [];

              const isFocused = lead.id === focusLeadId;

              return (
                <Card
                  key={lead.id}
                  data-testid={`card-lead-${lead.id}`}
                  ref={isFocused ? focusCardRef : undefined}
                  className={[
                    (status === 'dead' || status === 'closed') ? 'opacity-60' : '',
                    isFocused ? 'ring-2 ring-accent/50' : '',
                  ].filter(Boolean).join(' ')}
                >
                  {/* ── Main summary row ── */}
                  <div className="px-5 pt-4 pb-3">
                    {/* Top row: name + status */}
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="text-xl font-bold leading-tight" data-testid={`text-lead-name-${lead.id}`}>
                          {lead.name}
                        </span>
                        {getSourceBadge(lead.source)}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <span
                          className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold border ${statusCfg.className}`}
                          data-testid={`badge-lead-status-${lead.id}`}
                        >
                          {statusCfg.label}
                        </span>
                        {lead.quoteId && (
                          <Link
                            href={`/admin/quotes/${lead.quoteId}?tab=configuration&from=leads`}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          >
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              data-testid={`button-edit-config-${lead.id}`}
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Edit Config
                            </Button>
                          </Link>
                        )}
                        {status !== 'closed' && status !== 'dead' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground"
                                onClick={(e) => e.stopPropagation()}
                                data-testid={`button-quick-actions-${lead.id}`}
                              >
                                Actions
                                <ChevronDown className="w-3 h-3 ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(lead, 'contacted')}
                                data-testid={`button-mark-contacted-${lead.id}`}
                                disabled={status === 'contacted'}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-amber-500" />
                                Contacted
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(lead, 'closed')}
                                data-testid={`button-close-lead-${lead.id}`}
                                className="text-muted-foreground"
                              >
                                <XCircle className="w-3.5 h-3.5 mr-2" />
                                Close lead
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>

                    {/* Phone — prominent call row */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {lead.phone ? (
                        <a
                          href={`tel:${lead.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 text-2xl font-bold text-[#8bc440] hover:text-[#8bc440]/80 transition-colors leading-none"
                          data-testid={`link-lead-phone-${lead.id}`}
                        >
                          <Phone className="w-5 h-5 shrink-0" />
                          {lead.phone}
                        </a>
                      ) : (
                        <span className="flex items-center gap-2 text-2xl font-bold text-muted-foreground/40 leading-none select-none" data-testid={`text-no-phone-${lead.id}`}>
                          <Phone className="w-5 h-5 shrink-0" />
                          No phone
                        </span>
                      )}
                      {/* Call via bridge — desktop only, only shown when Twilio is fully configured */}
                      {twilioConfigured && staffPhones.length > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="hidden md:inline-flex">
                              <Button
                                size="sm"
                                className="bg-[#8bc440] text-[#191919] shrink-0"
                                disabled={!lead.phone}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedStaffPhoneId(staffPhones[0]?.id ?? "");
                                  setCallDialog({ leadId: lead.id, customerName: lead.name || "Customer", toNumber: normaliseToE164(lead.phone!) });
                                }}
                                data-testid={`button-call-bridge-${lead.id}`}
                              >
                                <PhoneCall className="w-3.5 h-3.5 mr-1.5" />
                                Call now
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {!lead.phone && <TooltipContent>No phone number on record</TooltipContent>}
                        </Tooltip>
                      )}
                    </div>

                    {/* Secondary row: email + date + expand */}
                    <div
                      className="flex items-center justify-between gap-3 mt-2 flex-wrap cursor-pointer"
                      onClick={() => toggleExpand(lead.id)}
                      data-testid={`button-expand-lead-${lead.id}`}
                    >
                      <div className="flex items-center gap-4 flex-wrap">
                        <a
                          href={`mailto:${lead.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                          data-testid={`link-lead-email-${lead.id}`}
                        >
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          {lead.email}
                        </a>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3 shrink-0" />
                          {formatDate(lead.createdAt)}
                        </span>
                        {crmNotes.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {crmNotes.length} {crmNotes.length === 1 ? "note" : "notes"}
                          </span>
                        )}
                        {lead.customerId ? (
                          <Link
                            href={`/admin/customers/${lead.customerId}`}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            data-testid={`link-profile-linked-summary-${lead.id}`}
                          >
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline">
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              {lead.customerName ? `${lead.customerName} · View profile` : "View profile"}
                            </span>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCreateProfileLead(lead);
                              setCreateProfileName(lead.name || "");
                              setCreateProfileEmail(lead.email || "");
                              setCreateProfilePhone(lead.phone ?? "");
                            }}
                            data-testid={`button-create-profile-summary-${lead.id}`}
                          >
                            <UserPlus className="w-3 h-3 shrink-0" />
                            No profile
                          </button>
                        )}
                      </div>
                      <div className="shrink-0">
                        {isExpanded
                          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        }
                      </div>
                    </div>
                  </div>

                  {/* ── CRM expanded panel ── */}
                  {isExpanded && (
                    <div className="border-t px-5 py-4 space-y-5">

                      {/* Original message */}
                      {lead.message && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5" /> Original Message
                          </p>
                          <p className="text-sm text-muted-foreground bg-muted rounded-md px-3 py-2">{lead.message}</p>
                        </div>
                      )}

                      {/* Status + Start Configurator */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</span>
                          <Select
                            value={status}
                            onValueChange={(v) => handleStatusChange(lead, v as LeadStatus)}
                          >
                            <SelectTrigger
                              className="h-8 text-xs w-36"
                              data-testid={`select-lead-status-${lead.id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.entries(STATUS_CONFIG) as [LeadStatus, typeof STATUS_CONFIG[LeadStatus]][]).map(([val, cfg]) => (
                                <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {lead.customerId ? (
                          <Link
                            href={`/admin/customers/${lead.customerId}`}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          >
                            <span
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                              data-testid={`text-profile-linked-${lead.id}`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              {lead.customerName ? `${lead.customerName} · Profile linked` : "Profile linked"}
                            </span>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCreateProfileLead(lead);
                              setCreateProfileName(lead.name || "");
                              setCreateProfileEmail(lead.email || "");
                              setCreateProfilePhone(lead.phone ?? "");
                            }}
                            data-testid={`button-create-profile-linked-${lead.id}`}
                          >
                            <UserPlus className="w-3.5 h-3.5 shrink-0" />
                            No profile — create one
                          </button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLinkLeadId(lead.id);
                            setLinkCurrentCustomerId(lead.customerId ?? null);
                            linkSearchPrefilledRef.current = false;
                            setLinkCustomerSearch("");
                            setLinkCustomerSelected(null);
                          }}
                          data-testid={`button-link-customer-${lead.id}`}
                        >
                          <Link2 className="w-3.5 h-3.5 mr-1.5" />
                          {lead.customerId ? "Change Customer" : "Link to Customer"}
                        </Button>
                        {lead.customerId && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUnlinkLeadId(lead.id);
                            }}
                            data-testid={`button-unlink-customer-${lead.id}`}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1.5" />
                            Unlink
                          </Button>
                        )}

                        <div className="ml-auto flex items-center gap-2">
                          {lead.customerId && (
                            <Link
                              href={`/admin/customers/${lead.customerId}`}
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            >
                              <Button
                                size="sm"
                                variant="outline"
                                data-testid={`button-view-customer-profile-${lead.id}`}
                              >
                                <UserIcon className="w-3.5 h-3.5 mr-1.5" />
                                View Customer Profile
                              </Button>
                            </Link>
                          )}
                          <Button
                            size="sm"
                            className="bg-[#8bc440e6] text-[#191919]"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open("/configurator/van", "_blank");
                            }}
                            data-testid={`button-start-configurator-${lead.id}`}
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                            Start Configurator
                          </Button>
                        </div>
                      </div>

                      {/* Reassignment history */}
                      {Array.isArray((lead as any).reassignmentHistory) && (lead as any).reassignmentHistory.length > 1 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                            <History className="w-3.5 h-3.5" /> Reassignment History
                          </p>
                          <div className="space-y-1.5" data-testid={`text-reassignment-history-lead-${lead.id}`}>
                            {(lead as any).reassignmentHistory.map((entry: { fromCustomerName: string; fromCustomerId: string; toCustomerName: string; toCustomerId: string; reassignedAt: string }, i: number) => (
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

                      {/* Notes history */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                          <StickyNote className="w-3.5 h-3.5" /> Notes ({crmNotes.length})
                        </p>
                        {crmNotes.length > 0 ? (
                          <div className="space-y-2 mb-3">
                            {crmNotes.map((note, i) => {
                              // Broad detection: covers "Click-to-call initiated", "Call initiated to ...", and other legacy variants
                              const isCallNote = note.text.toLowerCase().includes("call initiated");
                              let callStaffDisplay = "";
                              let callCustomerNumber = "";
                              if (isCallNote) {
                                // New format: "Click-to-call initiated — staff: +447... (Label) → customer: +447..."
                                // Legacy format: "Call initiated to +447..."
                                const staffMatch = note.text.match(/staff:\s*(\+[\d]+)\s*\(([^)]+)\)/i);
                                const customerMatch = note.text.match(/customer:\s*(\+[\d]+)/i);
                                const legacyToMatch = !customerMatch && note.text.match(/(?:initiated\s+to|call(?:ing)?\s+to|→)\s*(\+[\d]+)/i);
                                if (staffMatch) callStaffDisplay = `${staffMatch[1]} (${staffMatch[2]})`;
                                if (customerMatch) callCustomerNumber = customerMatch[1];
                                else if (legacyToMatch) callCustomerNumber = legacyToMatch[1];
                              }
                              return (
                                <div key={i} className={`rounded-md px-3 py-2 ${isCallNote ? 'bg-blue-500/5 border border-blue-500/20' : 'bg-muted'}`}>
                                  {isCallNote ? (
                                    <>
                                      <p className="text-sm flex items-center gap-1.5 font-medium">
                                        <PhoneCall className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                        <span className="text-blue-500">Call attempt</span>
                                      </p>
                                      {callStaffDisplay && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                          <span className="font-medium">Staff:</span> {callStaffDisplay}
                                        </p>
                                      )}
                                      {callCustomerNumber ? (
                                        <p className="text-xs text-muted-foreground">
                                          <span className="font-medium">Customer:</span> {callCustomerNumber}
                                        </p>
                                      ) : (
                                        <p className="text-xs text-muted-foreground">{note.text}</p>
                                      )}
                                    </>
                                  ) : (
                                    <p className="text-sm">{note.text}</p>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {note.author && <span className="font-medium">{note.author} · </span>}
                                    {formatNoteDate(note.timestamp)}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground mb-3 italic">No notes yet.</p>
                        )}

                        {/* Add note */}
                        <div className="flex flex-col gap-2">
                          <Textarea
                            placeholder="Add a note about this lead…"
                            value={noteInputs[lead.id] || ""}
                            onChange={(e) => setNoteInputs((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                            className="resize-none text-sm min-h-[60px] w-full"
                            rows={2}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddNote(lead);
                            }}
                            data-testid={`input-lead-note-${lead.id}`}
                          />
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => { e.stopPropagation(); handleAddNote(lead); }}
                              disabled={!noteInputs[lead.id]?.trim() || updateLeadMutation.isPending}
                              data-testid={`button-add-note-${lead.id}`}
                            >
                              <Plus className="w-3.5 h-3.5 mr-1" />
                              Add Note
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Tip: Ctrl+Enter to save quickly</p>
                      </div>

                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
        </div>
      </div>

      {/* Create customer profile from lead dialog */}
      <Dialog
        open={!!createProfileLead}
        onOpenChange={(open) => {
          if (!open && !createCustomerFromLeadMutation.isPending) setCreateProfileLead(null);
        }}
      >
        <DialogContent className="max-w-md" data-testid="modal-create-profile">
          <DialogHeader>
            <DialogTitle>Create Customer Profile</DialogTitle>
            <DialogDescription>
              Create a new customer profile pre-filled from this lead's details. The profile will be linked to the lead automatically.
            </DialogDescription>
          </DialogHeader>
          {duplicateMatches.length > 0 && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3 space-y-2" data-testid="banner-duplicate-customer">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Possible duplicate detected</p>
                  {duplicateMatches.map((match) => {
                    const matchReason = match.email?.toLowerCase() === dupEmailTerm.toLowerCase() ? "email" : "phone number";
                    return (
                      <div key={match.id} className="flex items-center justify-between gap-2 mt-2">
                        <p className="text-sm text-muted-foreground min-w-0 truncate">
                          A customer with this {matchReason} already exists:{" "}
                          <span className="font-medium text-foreground">{match.name}</span>
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => {
                            if (createProfileLead) {
                              linkExistingFromCreateMutation.mutate({ leadId: createProfileLead.id, customerId: match.id });
                            }
                          }}
                          disabled={linkExistingFromCreateMutation.isPending}
                          data-testid={`button-link-existing-customer-${match.id}`}
                        >
                          <Link2 className="w-3.5 h-3.5 mr-1" />
                          Link instead
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <div className="space-y-3 py-1">
            <div>
              <Label htmlFor="create-profile-name">Name</Label>
              <Input
                id="create-profile-name"
                value={createProfileName}
                onChange={(e) => setCreateProfileName(e.target.value)}
                placeholder="Full name"
                data-testid="input-create-profile-name"
              />
            </div>
            <div>
              <Label htmlFor="create-profile-email">Email</Label>
              <Input
                id="create-profile-email"
                type="email"
                value={createProfileEmail}
                onChange={(e) => setCreateProfileEmail(e.target.value)}
                placeholder="Email address"
                data-testid="input-create-profile-email"
              />
            </div>
            <div>
              <Label htmlFor="create-profile-phone">Phone</Label>
              <Input
                id="create-profile-phone"
                type="tel"
                value={createProfilePhone}
                onChange={(e) => setCreateProfilePhone(e.target.value)}
                placeholder="Phone number"
                data-testid="input-create-profile-phone"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCreateProfileLead(null)}
              data-testid="button-cancel-create-profile"
            >
              Cancel
            </Button>
            <Button
              disabled={!createProfileName.trim() || createCustomerFromLeadMutation.isPending}
              onClick={() => {
                if (createProfileLead) {
                  createCustomerFromLeadMutation.mutate({
                    leadId: createProfileLead.id,
                    name: createProfileName.trim(),
                    email: createProfileEmail.trim(),
                    phone: createProfilePhone.trim(),
                  });
                }
              }}
              data-testid="button-confirm-create-profile"
            >
              {createCustomerFromLeadMutation.isPending ? (
                <span className="flex items-center gap-2"><span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" /> Creating…</span>
              ) : (
                <><UserPlus className="w-3.5 h-3.5 mr-1.5" />Create Profile</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlink customer confirmation dialog */}
      <Dialog
        open={!!unlinkLeadId}
        onOpenChange={(open) => {
          if (!open) setUnlinkLeadId(null);
        }}
      >
        <DialogContent className="max-w-sm" data-testid="modal-unlink-customer">
          <DialogHeader>
            <DialogTitle>Remove customer profile link?</DialogTitle>
            <DialogDescription>
              This will clear the customer profile association from this lead. The lead and the customer profile will remain unchanged — only the link between them will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setUnlinkLeadId(null)}
              data-testid="button-cancel-unlink-customer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={unlinkCustomerMutation.isPending}
              onClick={() => {
                if (unlinkLeadId) unlinkCustomerMutation.mutate(unlinkLeadId);
              }}
              data-testid="button-confirm-unlink-customer"
            >
              {unlinkCustomerMutation.isPending ? (
                <span className="flex items-center gap-2"><span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" /> Unlinking…</span>
              ) : (
                <><XCircle className="w-3.5 h-3.5 mr-1.5" />Remove Link</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link to customer dialog */}
      <Dialog
        open={!!linkLeadId}
        onOpenChange={(open) => {
          if (!open) {
            setLinkLeadId(null);
            setLinkCustomerSearch("");
            setLinkCustomerSelected(null);
            setLinkCurrentCustomerId(null);
            linkSearchPrefilledRef.current = false;
          }
        }}
      >
        <DialogContent className="max-w-md" data-testid="modal-link-customer">
          <DialogHeader>
            <DialogTitle>Link to Customer Profile</DialogTitle>
            <DialogDescription>
              Search by name or email to find the right customer profile and link it to this lead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {linkCurrentCustomerId && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-2" data-testid="banner-currently-linked">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Currently linked:{" "}
                  <span className="font-semibold">
                    {linkedCustomerProfile ? linkedCustomerProfile.name : linkedCustomerError ? "Unable to load customer" : "Loading…"}
                  </span>
                </p>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by name or email…"
                value={linkCustomerSearch}
                onChange={(e) => {
                  setLinkCustomerSearch(e.target.value);
                  setLinkCustomerSelected(null);
                }}
                className="pl-8"
                autoFocus
                data-testid="input-link-customer-search"
              />
            </div>
            <div className="border rounded-md divide-y max-h-56 overflow-y-auto">
              {customerSearchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground px-3 py-4 text-center">
                  {linkCustomerSearch ? "No customers found." : "Type to search customers."}
                </p>
              ) : (
                customerSearchResults.map((c) => {
                  const isCurrentlyLinked = linkCurrentCustomerId === c.id;
                  const isSelected = linkCustomerSelected?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`w-full text-left px-3 py-2 hover-elevate transition-colors ${isSelected ? "bg-accent" : ""}`}
                      onClick={() => setLinkCustomerSelected({ id: c.id, name: c.name, email: c.email })}
                      data-testid={`option-customer-${c.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{c.name}</p>
                          {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                        </div>
                        {isCurrentlyLinked && (
                          <span className="shrink-0 text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1" data-testid={`badge-currently-linked-${c.id}`}>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Current
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            {linkCustomerSelected && (
              <p className="text-xs text-muted-foreground">
                Selected: <span className="font-medium text-foreground">{linkCustomerSelected.name}</span>
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setLinkLeadId(null);
                setLinkCustomerSearch("");
                setLinkCustomerSelected(null);
                setLinkCurrentCustomerId(null);
                linkSearchPrefilledRef.current = false;
              }}
              data-testid="button-cancel-link-customer"
            >
              Cancel
            </Button>
            <Button
              disabled={!linkCustomerSelected || linkCustomerMutation.isPending}
              onClick={() => {
                if (linkLeadId && linkCustomerSelected) {
                  linkCustomerMutation.mutate({ leadId: linkLeadId, customerId: linkCustomerSelected.id });
                }
              }}
              data-testid="button-confirm-link-customer"
            >
              {linkCustomerMutation.isPending ? (
                <span className="flex items-center gap-2"><span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" /> Linking…</span>
              ) : (
                <><Link2 className="w-3.5 h-3.5 mr-1.5" />Link Customer</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status change note dialog */}
      <Dialog
        open={!!pendingStatusChange}
        onOpenChange={(open) => { if (!open) setPendingStatusChange(null); }}
      >
        <DialogContent className="max-w-md" data-testid="dialog-lead-status-change-note">
          <DialogHeader>
            <DialogTitle>
              Moving to: {pendingStatusChange ? (STATUS_CONFIG[pendingStatusChange.status]?.label ?? pendingStatusChange.status) : ""}
            </DialogTitle>
            <DialogDescription>
              Add a note to explain this status change — it will be saved to the lead's CRM notes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="lead-status-change-note">
              Note <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="lead-status-change-note"
              placeholder="e.g. Called customer, very interested — sending quote today."
              value={statusNoteText}
              onChange={(e) => setStatusNoteText(e.target.value)}
              rows={3}
              data-testid="textarea-lead-status-note"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingStatusChange(null)} data-testid="button-cancel-lead-status">
              Cancel
            </Button>
            <Button
              onClick={() => confirmStatusChange(statusNoteText)}
              disabled={updateLeadMutation.isPending}
              data-testid="button-confirm-lead-status"
            >
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule follow-up dialog — shown when a lead is marked as "Contacted" */}
      {fuLead && (
        <Dialog open={fuDialogOpen} onOpenChange={setFuDialogOpen}>
          <DialogContent className="max-w-sm" data-testid="modal-schedule-followup">
            <DialogHeader>
              <DialogTitle>Schedule a follow-up?</DialogTitle>
              <DialogDescription>
                You marked <strong>{(fuLead as any).name || (fuLead as any).email}</strong> as Contacted. Would you like to schedule a follow-up call?
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-1">
              <div>
                <Label htmlFor="fu-date-lead">Follow-up date</Label>
                <Input
                  id="fu-date-lead"
                  type="date"
                  value={fuDate}
                  onChange={(e) => setFuDate(e.target.value)}
                  data-testid="input-followup-date"
                />
              </div>
              <div>
                <Label htmlFor="fu-notes-lead">Notes (optional)</Label>
                <Textarea
                  id="fu-notes-lead"
                  value={fuNotes}
                  onChange={(e) => setFuNotes(e.target.value)}
                  placeholder="What to follow up on..."
                  rows={2}
                  data-testid="textarea-followup-notes"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setFuDialogOpen(false)} data-testid="button-skip-followup">
                Skip
              </Button>
              <Button
                onClick={() => {
                  scheduleFollowUpMutation.mutate({
                    customerName: (fuLead as any).name || (fuLead as any).email || "Unknown",
                    customerPhone: (fuLead as any).phone || null,
                    customerEmail: (fuLead as any).email || null,
                    scheduledDate: fuDate,
                    notes: fuNotes || null,
                    leadId: fuLead.id,
                    assignedToUserId: user?.id || null,
                    assignedToName: user ? `${(user as any).firstName || ""} ${(user as any).lastName || ""}`.trim() || user.username : null,
                    assignedToEmail: user?.email || null,
                    createdBy: user?.username || "admin",
                  });
                }}
                disabled={!fuDate || scheduleFollowUpMutation.isPending}
                data-testid="button-confirm-followup"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Schedule follow-up
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
                  <SelectTrigger data-testid="select-staff-phone-lead">
                    <SelectValue placeholder="Select your phone…" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffPhones.map((p) => (
                      <SelectItem key={p.id} value={p.id} data-testid={`option-staff-phone-lead-${p.id}`}>
                        {p.phone} <span className="text-muted-foreground text-xs ml-1">({p.label})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Twilio will call your phone. Answer it and you will be automatically connected to the customer. The call is logged as a note on this lead.
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
                  leadId: callDialog.leadId,
                });
              }}
              data-testid="button-confirm-call-lead"
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
