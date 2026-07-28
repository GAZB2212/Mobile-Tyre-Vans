import { useAuth } from "@/hooks/useAuth";
import { useIdlePolling } from "@/hooks/useIdlePolling";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import type { User } from "@shared/schema";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchJson } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Bot,
  MessageSquare,
  CheckCircle2,
  Percent,
  Phone,
  Download,
  Eye,
  PhoneCall,
  ExternalLink,
  Zap,
  Calendar,
  Bell,
  X,
  Pencil,
  AlertCircle,
  Loader2,
  Settings,
  Mail,
  History,
  RefreshCw,
} from "lucide-react";
import maxAvatarSrc from "@assets/max-avatar.png";

interface ConversationStats {
  totalThisMonth: number;
  completionRate: number;
  fortyEightVConversionRate: number;
  leadCaptureRate: number;
  leadsCapturedThisMonth: number;
}

interface ReassignmentHistoryEntry {
  fromCustomerName: string;
  fromCustomerId: string;
  toCustomerName: string;
  toCustomerId: string;
  reassignedAt: string;
}

interface AiConversationRow {
  id: string;
  session_id: string;
  status: string;
  van_type?: string;
  van_size?: string;
  spec_level?: string;
  finance_preference?: string;
  includes_48v?: boolean;
  was_48v_pitched?: boolean;
  response_to_48v?: string;
  config_completed?: boolean;
  marked_contacted?: boolean;
  contacted_note?: string | null;
  created_at?: string;
  completed_at?: string;
  contact_name?: string;
  contact_phone?: string;
  linked_quote_id?: string;
  messages?: Array<{ role: string; content: string }>;
  mapped_config?: Record<string, unknown> | string;
  reassignment_history?: ReassignmentHistoryEntry[];
}

interface AiConversationsResponse {
  conversations: AiConversationRow[];
  stats: ConversationStats;
}

function formatDate(date: string | null | undefined) {
  if (!date) return "Unknown";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const classes =
    status === "completed"
      ? "bg-green-500/15 text-green-400 border-green-500/30"
      : status === "abandoned"
      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
      : "bg-blue-500/15 text-blue-400 border-blue-500/30";
  return (
    <Badge variant="secondary" className={`text-xs ${classes}`}>
      {status?.replace("_", " ")}
    </Badge>
  );
}

const MAX_EXPORT_RETRIES = 3;
const EXPORT_DEBOUNCE_MS = 400;
const END_OF_DAY_SUFFIX = "T23:59:59";
const EXPORT_CSV_FILENAME = "ai-conversations.csv";
const QP_STATUS = "status";
const QP_DATE_FROM = "dateFrom";
const QP_DATE_TO = "dateTo";
const QP_MARKED_CONTACTED = "markedContacted";

type KitBasic = { id: string; name: string; price: number };
type UpgradeBasic = { id: string; name: string; price: number; category?: string };

export default function AdminAIConversations() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth() as {
    user: User | undefined;
    isAuthenticated: boolean;
    isLoading: boolean;
  };

  const [statusFilter, setStatusFilter] = useState("all");
  const [contactFilter, setContactFilter] = useState("all");
  const [v48Filter, setV48Filter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [transcriptConv, setTranscriptConv] = useState<AiConversationRow | null>(null);

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportRetryCount, setExportRetryCount] = useState(0);
  const [exportStatus, setExportStatus] = useState("all");
  const [exportDateFrom, setExportDateFrom] = useState("");
  const [exportDateTo, setExportDateTo] = useState("");
  const [exportMarkedContacted, setExportMarkedContacted] = useState("all");
  const [debouncedExportFilters, setDebouncedExportFilters] = useState({
    status: "all",
    dateFrom: "",
    dateTo: "",
    markedContacted: "all",
  });
  const [contactNoteDialogConv, setContactNoteDialogConv] = useState<AiConversationRow | null>(null);
  const [contactNoteText, setContactNoteText] = useState("");
  const [editNoteDialogConv, setEditNoteDialogConv] = useState<AiConversationRow | null>(null);
  const [editNoteText, setEditNoteText] = useState("");
  const [editContactDialogConv, setEditContactDialogConv] = useState<AiConversationRow | null>(null);
  const [editContactName, setEditContactName] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactLoading, setEditContactLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  useEffect(() => {
    if (user && (!user.adminRole || user.adminRole === "none")) {
      toast({
        title: "Access Denied",
        description: "Admin access required.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    }
  }, [user, toast]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedExportFilters({
        status: exportStatus,
        dateFrom: exportDateFrom,
        dateTo: exportDateTo,
        markedContacted: exportMarkedContacted,
      });
    }, EXPORT_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [exportStatus, exportDateFrom, exportDateTo, exportMarkedContacted]);

  const exportCountParams = new URLSearchParams();
  if (debouncedExportFilters.status !== "all") exportCountParams.set(QP_STATUS, debouncedExportFilters.status);
  if (debouncedExportFilters.dateFrom) exportCountParams.set(QP_DATE_FROM, debouncedExportFilters.dateFrom);
  if (debouncedExportFilters.dateTo) exportCountParams.set(QP_DATE_TO, `${debouncedExportFilters.dateTo}${END_OF_DAY_SUFFIX}`);
  if (debouncedExportFilters.markedContacted !== "all") exportCountParams.set(QP_MARKED_CONTACTED, debouncedExportFilters.markedContacted);

  const { data: exportCountData, isFetching: exportCountFetching, isError: exportCountError } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/ai-conversations/export/count", debouncedExportFilters],
    queryFn: async () => {
      const qs = exportCountParams.toString() ? `?${exportCountParams}` : "";
      return fetchJson(`/api/admin/ai-conversations/export/count${qs}`);
    },
    enabled: exportDialogOpen && !!(user?.adminRole && user.adminRole !== "none"),
  });

  const isActive = useIdlePolling();

  const filters = {
    status: statusFilter !== "all" ? statusFilter : undefined,
    includes48v: v48Filter !== "all" ? v48Filter : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo ? `${dateTo}${END_OF_DAY_SUFFIX}` : undefined,
  };

  const {
    data: aiData,
    isLoading: aiLoading,
    isFetching: aiFetching,
    isError: aiError,
    refetch,
  } = useQuery<AiConversationsResponse>({
    queryKey: ["/api/admin/ai-conversations", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.set(QP_STATUS, filters.status);
      if (filters.includes48v) params.set("includes48v", filters.includes48v);
      if (filters.dateFrom) params.set(QP_DATE_FROM, filters.dateFrom);
      if (filters.dateTo) params.set(QP_DATE_TO, filters.dateTo);
      const url = `/api/admin/ai-conversations${params.toString() ? `?${params}` : ""}`;
      return fetchJson(url);
    },
    enabled: !!(user?.adminRole && user.adminRole !== "none"),
    refetchInterval: isActive ? 60_000 : false,
    refetchIntervalInBackground: false,
  });

  // Fetch kits and upgrades for the spec panel in the transcript dialog
  const { data: kitsData = [] } = useQuery<KitBasic[]>({
    queryKey: ["/api/kits"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: upgradesData = [] } = useQuery<UpgradeBasic[]>({
    queryKey: ["/api/upgrades"],
    staleTime: 5 * 60 * 1000,
  });

  // Open the admin configurator pre-loaded with the AI conversation's config
  const handleOpenInConfigurator = () => {
    if (!transcriptConv?.mapped_config) return;
    const cfg =
      typeof transcriptConv.mapped_config === "string"
        ? JSON.parse(transcriptConv.mapped_config)
        : transcriptConv.mapped_config;

    const defaultSlot = {
      vanId: null,
      customVanDescription: null,
      customVanValue: null,
      vanReg: null,
      serviceType: null,
      kitId: null,
      upgradeIds: [],
      upgradeQuantities: {},
      trainingOptionIds: [],
      financePlanId: null,
      financeInputs: null,
      pricingSnapshot: null,
    };

    let customVanDescription: string | null = null;
    if (cfg.ownVan === false && cfg.vanSize) {
      customVanDescription = `${cfg.vanSize} van supplied by Mobile Tyre Vans`;
    } else if (cfg.ownVan === true) {
      customVanDescription = "Customer's own van";
    }

    const configState = {
      slotA: {
        ...defaultSlot,
        customVanDescription,
        serviceType: cfg.serviceType ?? null,
        kitId: cfg.kitId ?? null,
        upgradeIds: Array.isArray(cfg.upgradeIds) ? cfg.upgradeIds : [],
        financePlanId: cfg.financePlanId ?? null,
      },
      slotB: defaultSlot,
      compareMode: false,
      activeSlot: "A",
    };

    try {
      localStorage.setItem("configurator:v6", JSON.stringify(configState));
    } catch { /* ignore */ }

    setTranscriptConv(null);
    setLocation("/admin/configurator");
  };

  const openContactNoteDialog = (conv: AiConversationRow) => {
    setContactNoteText("");
    setContactNoteDialogConv(conv);
  };

  const contactedMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiRequest("PATCH", `/api/admin/ai-conversations/${id}/contacted`, { note }),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/admin/ai-conversations"] });

      const previousEntries = queryClient.getQueriesData<AiConversationsResponse>({
        queryKey: ["/api/admin/ai-conversations"],
      });

      queryClient.setQueriesData<AiConversationsResponse>(
        { queryKey: ["/api/admin/ai-conversations"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            conversations: old.conversations.map((c) =>
              c.id === id ? { ...c, marked_contacted: true } : c
            ),
          };
        }
      );

      return { previousEntries };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousEntries) {
        for (const [queryKey, data] of context.previousEntries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      toast({ title: "Error", description: "Failed to mark as contacted.", variant: "destructive" });
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-conversations"] });
      toast({ title: "Marked as contacted" });
      setContactNoteDialogConv(null);
    },
  });

  const handleSubmitContacted = () => {
    if (!contactNoteDialogConv) return;
    contactedMutation.mutate({ id: contactNoteDialogConv.id, note: contactNoteText });
  };

  const openEditNoteDialog = (conv: AiConversationRow) => {
    setEditNoteText(conv.contacted_note ?? "");
    setEditNoteDialogConv(conv);
  };

  const editNoteMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiRequest("PATCH", `/api/admin/ai-conversations/${id}/contacted`, { note }),
    onMutate: async ({ id, note }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/admin/ai-conversations"] });

      const previousEntries = queryClient.getQueriesData<AiConversationsResponse>({
        queryKey: ["/api/admin/ai-conversations"],
      });

      queryClient.setQueriesData<AiConversationsResponse>(
        { queryKey: ["/api/admin/ai-conversations"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            conversations: old.conversations.map((c) =>
              c.id === id ? { ...c, contacted_note: note } : c
            ),
          };
        }
      );

      return { previousEntries };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousEntries) {
        for (const [queryKey, data] of context.previousEntries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      toast({ title: "Error", description: "Failed to update note.", variant: "destructive" });
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-conversations"] });
      toast({ title: "Note updated" });
      setEditNoteDialogConv(null);
    },
  });

  const handleSubmitEditNote = () => {
    if (!editNoteDialogConv) return;
    editNoteMutation.mutate({ id: editNoteDialogConv.id, note: editNoteText });
  };

  const openEditContactDialog = async (conv: AiConversationRow) => {
    setEditContactLoading(true);
    setEditContactDialogConv(conv);
    try {
      const r = await apiRequest("GET", `/api/admin/ai-conversations/${conv.id}`);
      const detail: AiConversationRow = await r.json();
      const cfg =
        detail.mapped_config && typeof detail.mapped_config === "string"
          ? JSON.parse(detail.mapped_config)
          : (detail.mapped_config as Record<string, unknown> | null) ?? {};
      setEditContactName(detail.contact_name ?? conv.contact_name ?? "");
      setEditContactPhone(detail.contact_phone ?? conv.contact_phone ?? "");
      setEditContactEmail((cfg.contactEmail as string | null | undefined) ?? "");
    } catch {
      setEditContactName(conv.contact_name ?? "");
      setEditContactPhone(conv.contact_phone ?? "");
      setEditContactEmail("");
    } finally {
      setEditContactLoading(false);
    }
  };

  const editContactMutation = useMutation({
    mutationFn: ({ id, name, phone, email }: { id: string; name: string; phone: string; email: string }) =>
      apiRequest("PATCH", `/api/admin/ai-conversations/${id}/contact`, { name: name || null, phone: phone || null, email: email || null }),
    onMutate: async ({ id, name, phone }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/admin/ai-conversations"] });
      const previousEntries = queryClient.getQueriesData<AiConversationsResponse>({
        queryKey: ["/api/admin/ai-conversations"],
      });
      queryClient.setQueriesData<AiConversationsResponse>(
        { queryKey: ["/api/admin/ai-conversations"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            conversations: old.conversations.map((c) =>
              c.id === id
                ? { ...c, contact_name: name || c.contact_name, contact_phone: phone || c.contact_phone }
                : c
            ),
          };
        }
      );
      return { previousEntries };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousEntries) {
        for (const [queryKey, data] of context.previousEntries) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      toast({ title: "Error", description: "Failed to update contact details.", variant: "destructive" });
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-conversations"] });
      toast({ title: "Contact details updated" });
      setEditContactDialogConv(null);
    },
  });

  const handleSubmitEditContact = () => {
    if (!editContactDialogConv) return;
    editContactMutation.mutate({
      id: editContactDialogConv.id,
      name: editContactName,
      phone: editContactPhone,
      email: editContactEmail,
    });
  };

  const exportMutation = useMutation({
    mutationFn: async () => {
      const p = new URLSearchParams();
      if (exportStatus !== "all") p.set(QP_STATUS, exportStatus);
      if (exportDateFrom) p.set(QP_DATE_FROM, exportDateFrom);
      if (exportDateTo) p.set(QP_DATE_TO, `${exportDateTo}${END_OF_DAY_SUFFIX}`);
      if (exportMarkedContacted !== "all") p.set(QP_MARKED_CONTACTED, exportMarkedContacted);
      const qs = p.toString() ? `?${p.toString()}` : "";
      const r = await apiRequest("GET", `/api/admin/ai-conversations/export/csv${qs}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = EXPORT_CSV_FILENAME;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      const count = exportCountData?.count;
      setExportDialogOpen(false);
      exportMutation.reset();
      setExportRetryCount(0);
      setExportStatus("all");
      setExportDateFrom("");
      setExportDateTo("");
      setExportMarkedContacted("all");
      setDebouncedExportFilters({ status: "all", dateFrom: "", dateTo: "", markedContacted: "all" });
      toast({
        title: "Export complete",
        description:
          count !== undefined
            ? `Exported ${count} conversation${count !== 1 ? "s" : ""}`
            : "Your CSV download has started",
      });
    },
    onError: () => {
      setExportRetryCount((prev) => prev + 1);
      toast({
        title: "Export failed",
        description: "The CSV export could not be completed. Please try again.",
        variant: "destructive",
      });
    },
  });

  const closeExportDialog = () => {
    setExportDialogOpen(false);
    exportMutation.reset();
    setExportRetryCount(0);
    setExportStatus("all");
    setExportDateFrom("");
    setExportDateTo("");
    setExportMarkedContacted("all");
    setDebouncedExportFilters({ status: "all", dateFrom: "", dateTo: "", markedContacted: "all" });
  };

  useEffect(() => {
    if (exportMutation.isError) {
      exportMutation.reset();
      setExportRetryCount(0);
    }
  }, [exportStatus, exportDateFrom, exportDateTo, exportMarkedContacted]);

  useEffect(() => {
    if (exportDialogOpen) {
      exportMutation.reset();
      setExportRetryCount(0);
    }
  }, [exportDialogOpen]);

  const handleViewTranscript = async (conv: AiConversationRow) => {
    try {
      const r = await apiRequest("GET", `/api/admin/ai-conversations/${conv.id}`);
      const data = await r.json();
      setTranscriptConv(data);
    } catch {
      toast({ title: "Error", description: "Failed to load transcript.", variant: "destructive" });
    }
  };

  const hasActiveFilters =
    statusFilter !== "all" ||
    contactFilter !== "all" ||
    v48Filter !== "all" ||
    !!dateFrom ||
    !!dateTo ||
    !!searchQuery.trim();

  const clearAllFilters = () => {
    setStatusFilter("all");
    setContactFilter("all");
    setV48Filter("all");
    setDateFrom("");
    setDateTo("");
    setSearchQuery("");
  };

  const needsFollowUpCount = (aiData?.conversations ?? []).filter(
    (conv) => !!conv.contact_phone && !conv.marked_contacted
  ).length;

  const visibleConversations = (aiData?.conversations ?? []).filter((conv) => {
    const hasContact = !!(conv.contact_name || conv.contact_phone);
    if (contactFilter === "with_contact" && !hasContact) return false;
    if (contactFilter === "no_contact" && hasContact) return false;
    if (contactFilter === "needs_followup") {
      if (!conv.contact_phone || conv.marked_contacted) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const nameMatch = conv.contact_name?.toLowerCase().includes(q) ?? false;
      const phoneMatch = conv.contact_phone?.toLowerCase().includes(q) ?? false;
      if (!nameMatch && !phoneMatch) return false;
    }
    return true;
  });

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

  if (aiError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-destructive text-sm">Failed to load — check your connection and try again</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-conversations">
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
        title="Max AI Conversations"
        description="Review all AI chat sessions from the Max van builder widget"
        statusIndicator={
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`w-1.5 h-1.5 rounded-full ${aiFetching ? "bg-amber-400 animate-pulse" : isActive ? "bg-[hsl(86_53%_51%)]" : "bg-muted-foreground/40"}`} />
            {aiFetching ? "Refreshing…" : isActive ? "Live" : "Paused"}
          </span>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setExportStatus(statusFilter);
              setExportDateFrom(dateFrom);
              setExportDateTo(dateTo);
              setExportDialogOpen(true);
            }}
            data-testid="button-export-ai-csv"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>
        }
      />

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Sessions (this month)</p>
                <p className="text-2xl font-bold" data-testid="stat-ai-total">
                  {aiData?.stats?.totalThisMonth ?? 0}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Completion rate</p>
                <p className="text-2xl font-bold" data-testid="stat-ai-completion">
                  {aiData?.stats?.completionRate ?? 0}%
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Percent className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">48V conversion</p>
                <p className="text-2xl font-bold" data-testid="stat-ai-48v">
                  {aiData?.stats?.fortyEightVConversionRate ?? 0}%
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Leads captured</p>
                <p className="text-2xl font-bold" data-testid="stat-ai-leads">
                  {aiData?.stats?.leadsCapturedThisMonth ?? 0}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    ({aiData?.stats?.leadCaptureRate ?? 0}%)
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-colors hover-elevate ${
              contactFilter === "needs_followup"
                ? "border-amber-500/50 bg-amber-500/5"
                : needsFollowUpCount > 0
                ? "border-amber-500/30"
                : ""
            }`}
            onClick={() =>
              setContactFilter(
                contactFilter === "needs_followup" ? "all" : "needs_followup"
              )
            }
            data-testid="stat-card-needs-followup"
          >
            <CardContent className="p-4 flex items-center gap-3">
              <Bell
                className={`w-4 h-4 shrink-0 ${
                  needsFollowUpCount > 0 ? "text-amber-400" : "text-muted-foreground"
                }`}
              />
              <div>
                <p className="text-xs text-muted-foreground">Needs follow-up</p>
                <p
                  className={`text-2xl font-bold ${
                    needsFollowUpCount > 0 ? "text-amber-400" : ""
                  }`}
                  data-testid="stat-ai-needs-followup"
                >
                  {needsFollowUpCount}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card data-testid="card-ai-filters">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Filter Conversations</CardTitle>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  data-testid="button-clear-all-filters"
                >
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Clear all filters
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
            <div className="relative">
              <Input
                type="search"
                placeholder="Search by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-ai-conversations"
                className={searchQuery ? "pr-8" : ""}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  data-testid="button-clear-search-ai-conversations"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-ai-status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="abandoned">Abandoned</SelectItem>
                </SelectContent>
              </Select>
              <Select value={contactFilter} onValueChange={setContactFilter}>
                <SelectTrigger data-testid="select-ai-contact">
                  <SelectValue placeholder="Contact details" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All conversations</SelectItem>
                  <SelectItem value="needs_followup">Needs follow-up</SelectItem>
                  <SelectItem value="with_contact">Has contact details</SelectItem>
                  <SelectItem value="no_contact">Anonymous only</SelectItem>
                </SelectContent>
              </Select>
              <Select value={v48Filter} onValueChange={setV48Filter}>
                <SelectTrigger data-testid="select-ai-48v">
                  <SelectValue placeholder="48V filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All (48V)</SelectItem>
                  <SelectItem value="true">48V included</SelectItem>
                  <SelectItem value="false">No 48V</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  placeholder="From date"
                  data-testid="input-ai-date-from"
                  className={dateFrom ? "pr-8" : ""}
                />
                {dateFrom && (
                  <button
                    type="button"
                    onClick={() => setDateFrom("")}
                    data-testid="button-clear-date-from"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Clear from date"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  placeholder="To date"
                  data-testid="input-ai-date-to"
                  className={dateTo ? "pr-8" : ""}
                />
                {dateTo && (
                  <button
                    type="button"
                    onClick={() => setDateTo("")}
                    data-testid="button-clear-date-to"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Clear to date"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            </div>
          </CardContent>
        </Card>

        {/* Results count */}
        {!aiLoading && aiData && hasActiveFilters && (
          <p className="text-sm text-muted-foreground" data-testid="text-ai-results-count">
            Showing{" "}
            <span className="font-medium text-foreground">{visibleConversations.length}</span>{" "}
            of{" "}
            <span className="font-medium text-foreground">{aiData.conversations.length}</span>{" "}
            conversation{aiData.conversations.length !== 1 ? "s" : ""}
          </p>
        )}

        {/* Conversations list */}
        {aiLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading conversations...</p>
            </CardContent>
          </Card>
        ) : visibleConversations.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Bot className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No conversations found</h3>
              <p className="text-muted-foreground">
                {statusFilter !== "all" ||
                contactFilter !== "all" ||
                v48Filter !== "all" ||
                dateFrom ||
                dateTo ||
                searchQuery.trim()
                  ? "Try adjusting your filters to see more sessions."
                  : "AI van builder conversations will appear here once customers use the chat widget."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {visibleConversations.map((conv) => (
              <Card
                key={conv.id}
                data-testid={`card-ai-conv-${conv.id}`}
                className={
                  conv.contact_phone && !conv.marked_contacted
                    ? "border-amber-500/40"
                    : conv.contact_name || conv.contact_phone
                    ? "border-accent/30"
                    : ""
                }
              >
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start gap-4 justify-between">
                    {/* Left: identity + meta */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full overflow-hidden ring-1 ring-border shrink-0">
                        <img
                          src={maxAvatarSrc}
                          alt="Max"
                          className="w-full h-full object-cover object-top"
                        />
                      </div>
                      <div className="min-w-0">
                        {/* Name + phone */}
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <span
                            className="font-semibold text-sm"
                            data-testid={`text-ai-name-${conv.id}`}
                          >
                            {conv.contact_name ?? "Anonymous"}
                          </span>
                          {(conv.contact_name || conv.contact_phone) && (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-accent/15 text-accent"
                            >
                              Contact captured
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <StatusBadge status={conv.status} />
                          {conv.contact_phone && !conv.marked_contacted && (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-amber-500/15 text-amber-400 border-amber-500/30"
                              data-testid={`badge-needs-followup-${conv.id}`}
                            >
                              <Bell className="w-2.5 h-2.5 mr-1" />
                              Needs follow-up
                            </Badge>
                          )}
                          {conv.includes_48v && (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-accent/15 text-accent"
                            >
                              48V
                            </Badge>
                          )}
                          {conv.config_completed && (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-green-500/15 text-green-400 border-green-500/30"
                            >
                              Config complete
                            </Badge>
                          )}
                          {conv.marked_contacted && (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-muted text-muted-foreground"
                            >
                              Contacted
                            </Badge>
                          )}
                        </div>
                        {conv.marked_contacted && conv.contacted_note && (
                          <div className="flex items-start gap-1.5 mt-1">
                            <p
                              className="text-xs text-muted-foreground italic flex-1"
                              data-testid={`text-contacted-note-${conv.id}`}
                            >
                              Note: {conv.contacted_note}
                            </p>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="shrink-0 opacity-60 hover:opacity-100"
                              onClick={() => openEditNoteDialog(conv)}
                              data-testid={`button-edit-note-${conv.id}`}
                              title="Edit note"
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                        {/* Config summary */}
                        <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                          {conv.van_size && <span>Size: {conv.van_size}</span>}
                          {conv.van_type && <span>Type: {conv.van_type}</span>}
                          {conv.spec_level && <span>Pack: {conv.spec_level}</span>}
                          {conv.finance_preference && (
                            <span>Finance: {conv.finance_preference}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(conv.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="flex flex-wrap gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewTranscript(conv)}
                          data-testid={`button-view-transcript-${conv.id}`}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Transcript
                        </Button>
                        {conv.linked_quote_id && (
                          <Link href={`/admin/quotes/${conv.linked_quote_id}`}>
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid={`button-view-quote-${conv.id}`}
                            >
                              <ExternalLink className="w-3.5 h-3.5 mr-1" />
                              View Quote
                            </Button>
                          </Link>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditContactDialog(conv)}
                          data-testid={`button-edit-contact-${conv.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1" />
                          Edit contact
                        </Button>
                        {!conv.marked_contacted && conv.contact_phone && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openContactNoteDialog(conv)}
                            data-testid={`button-mark-contacted-${conv.id}`}
                          >
                            <PhoneCall className="w-3.5 h-3.5 mr-1" />
                            Mark contacted
                          </Button>
                        )}
                      </div>
                      {conv.contact_phone && (
                        <a
                          href={`tel:${conv.contact_phone}`}
                          className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-accent transition-colors"
                          data-testid={`link-ai-phone-${conv.id}`}
                        >
                          <Phone className="w-3.5 h-3.5 text-accent" />
                          {conv.contact_phone}
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={exportDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeExportDialog();
          else exportMutation.reset();
        }}
      >
        <DialogContent className="max-w-sm" data-testid="dialog-export-csv">
          <DialogHeader>
            <DialogTitle>Export conversations</DialogTitle>
            <DialogDescription>
              Choose which conversations to include in the CSV. Leave filters unset to export all.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1">
              <Label htmlFor="export-status">Status</Label>
              <Select value={exportStatus} onValueChange={setExportStatus}>
                <SelectTrigger id="export-status" data-testid="select-export-status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="abandoned">Abandoned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="export-contacted">Contacted</Label>
              <Select value={exportMarkedContacted} onValueChange={setExportMarkedContacted}>
                <SelectTrigger id="export-contacted" data-testid="select-export-contacted">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">Contacted only</SelectItem>
                  <SelectItem value="no">Not yet contacted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="export-date-from">From date</Label>
                <Input
                  id="export-date-from"
                  type="date"
                  value={exportDateFrom}
                  onChange={(e) => setExportDateFrom(e.target.value)}
                  data-testid="input-export-date-from"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="export-date-to">To date</Label>
                <Input
                  id="export-date-to"
                  type="date"
                  value={exportDateTo}
                  onChange={(e) => setExportDateTo(e.target.value)}
                  data-testid="input-export-date-to"
                />
              </div>
            </div>
          </div>
          <div className="text-sm text-muted-foreground" data-testid="text-export-count">
            {exportCountFetching ? (
              <span className="animate-pulse">Counting...</span>
            ) : exportCountError ? (
              <span>Couldn't load count</span>
            ) : exportCountData !== undefined ? (
              <span>{exportCountData.count} conversation{exportCountData.count !== 1 ? "s" : ""} will be exported</span>
            ) : null}
          </div>
          {exportMutation.isError && (
            <Alert variant="destructive" data-testid="alert-export-error">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between gap-2">
                <span>
                  {exportRetryCount >= MAX_EXPORT_RETRIES
                    ? "Too many failed attempts. Please close and try again later."
                    : "Failed to export CSV. Please try again."}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => exportMutation.mutate()}
                  disabled={exportMutation.isPending || exportRetryCount >= MAX_EXPORT_RETRIES}
                  data-testid="button-export-retry"
                >
                  {exportMutation.isPending ? (
                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Retrying...</>
                  ) : (MAX_EXPORT_RETRIES - exportRetryCount) === 1 ? (
                    "Last attempt"
                  ) : (
                    `Retry (${MAX_EXPORT_RETRIES - exportRetryCount} left)`
                  )}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeExportDialog}
              data-testid="button-export-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
              data-testid="button-export-confirm"
            >
              <Download className="w-4 h-4 mr-2" />
              {exportMutation.isPending ? "Exporting..." : "Download CSV"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark contacted dialog */}
      <Dialog
        open={!!contactNoteDialogConv}
        onOpenChange={(open) => !open && setContactNoteDialogConv(null)}
      >
        <DialogContent className="max-w-md" data-testid="dialog-mark-contacted">
          <DialogHeader>
            <DialogTitle>
              What was said
              {contactNoteDialogConv?.contact_name
                ? ` — ${contactNoteDialogConv.contact_name}`
                : ""}?
            </DialogTitle>
            <DialogDescription>
              Record what happened on the call. This will be saved to the customer's timeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="contacted-note">
              Call note <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="contacted-note"
              placeholder="e.g. Left voicemail. / Spoke to customer — interested in Pack 2, calling back Thursday. / Not interested at this time."
              value={contactNoteText}
              onChange={(e) => setContactNoteText(e.target.value)}
              rows={4}
              data-testid="textarea-contacted-note"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Required — even a brief note helps the team follow up.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setContactNoteDialogConv(null)}
              data-testid="button-cancel-contacted"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitContacted}
              disabled={contactedMutation.isPending || !contactNoteText.trim()}
              data-testid="button-confirm-contacted"
            >
              <PhoneCall className="w-4 h-4 mr-2" />
              {contactedMutation.isPending ? "Saving..." : "Save & mark contacted"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit note dialog */}
      <Dialog
        open={!!editNoteDialogConv}
        onOpenChange={(open) => !open && setEditNoteDialogConv(null)}
      >
        <DialogContent className="max-w-md" data-testid="dialog-edit-note">
          <DialogHeader>
            <DialogTitle>Edit contact note</DialogTitle>
            <DialogDescription>
              Update the note for this contact
              {editNoteDialogConv?.contact_name
                ? ` with ${editNoteDialogConv.contact_name}`
                : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="edit-contacted-note">Call note</Label>
            <Textarea
              id="edit-contacted-note"
              placeholder="e.g. Left voicemail, Quoted £X, Not interested..."
              value={editNoteText}
              onChange={(e) => setEditNoteText(e.target.value)}
              rows={3}
              data-testid="textarea-edit-note"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditNoteDialogConv(null)}
              data-testid="button-cancel-edit-note"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitEditNote}
              disabled={editNoteMutation.isPending}
              data-testid="button-confirm-edit-note"
            >
              <Pencil className="w-4 h-4 mr-2" />
              {editNoteMutation.isPending ? "Saving..." : "Save note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit contact details dialog */}
      <Dialog
        open={!!editContactDialogConv}
        onOpenChange={(open) => !open && setEditContactDialogConv(null)}
      >
        <DialogContent className="max-w-md" data-testid="dialog-edit-contact">
          <DialogHeader>
            <DialogTitle>Edit contact details</DialogTitle>
            <DialogDescription>
              Update the contact information for this conversation. The customer link will be refreshed automatically.
            </DialogDescription>
          </DialogHeader>
          {editContactLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4 py-1">
              <div className="space-y-1.5">
                <Label htmlFor="edit-contact-name">Name</Label>
                <Input
                  id="edit-contact-name"
                  placeholder="Customer name"
                  value={editContactName}
                  onChange={(e) => setEditContactName(e.target.value)}
                  data-testid="input-edit-contact-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-contact-phone">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    id="edit-contact-phone"
                    placeholder="Phone number"
                    value={editContactPhone}
                    onChange={(e) => setEditContactPhone(e.target.value)}
                    className="pl-8"
                    data-testid="input-edit-contact-phone"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-contact-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    id="edit-contact-email"
                    type="email"
                    placeholder="Email address"
                    value={editContactEmail}
                    onChange={(e) => setEditContactEmail(e.target.value)}
                    className="pl-8"
                    data-testid="input-edit-contact-email"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditContactDialogConv(null)}
              data-testid="button-cancel-edit-contact"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitEditContact}
              disabled={editContactMutation.isPending || editContactLoading}
              data-testid="button-confirm-edit-contact"
            >
              <Pencil className="w-4 h-4 mr-2" />
              {editContactMutation.isPending ? "Saving..." : "Save contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transcript dialog */}
      <Dialog
        open={!!transcriptConv}
        onOpenChange={(open) => !open && setTranscriptConv(null)}
      >
        <DialogContent
          className="max-w-2xl w-[calc(100vw-2rem)] sm:w-full max-h-[85dvh] overflow-hidden flex flex-col gap-0 p-0"
          data-testid="dialog-transcript"
        >
          <DialogTitle className="sr-only">
            Chat transcript — {transcriptConv?.contact_name ?? "Anonymous"}
          </DialogTitle>

          {/* Dialog header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b shrink-0">
            <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-accent/30 shrink-0">
              <img
                src={maxAvatarSrc}
                alt="Max"
                className="w-full h-full object-cover object-top"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-none">
                Max — Chat with {transcriptConv?.contact_name ?? "Anonymous"}
              </p>
              {transcriptConv?.contact_phone && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {transcriptConv.contact_phone}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 shrink-0">
              {transcriptConv?.includes_48v && (
                <Badge
                  className="text-xs bg-accent/15 text-accent border-accent/30"
                  variant="outline"
                >
                  <Zap className="w-3 h-3 mr-1" />
                  48V
                </Badge>
              )}
              {transcriptConv?.status && (
                <StatusBadge status={transcriptConv.status} />
              )}
            </div>
          </div>
          {transcriptConv?.marked_contacted && transcriptConv.contacted_note && (
            <div
              className="px-5 py-2.5 bg-muted/40 border-b shrink-0 text-xs text-muted-foreground italic"
              data-testid="text-transcript-contacted-note"
            >
              <span className="font-medium not-italic text-foreground">Call note:</span>{" "}
              {transcriptConv.contacted_note}
            </div>
          )}

          {/* Reassignment history */}
          {Array.isArray(transcriptConv?.reassignment_history) && transcriptConv.reassignment_history.length > 0 && (
            <div className="px-5 py-3 bg-muted/20 border-b shrink-0" data-testid={`text-reassignment-history-conv-${transcriptConv.id}`}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <History className="w-3.5 h-3.5" /> Reassignment History
              </p>
              <div className="space-y-1.5">
                {transcriptConv.reassignment_history.map((entry, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">{entry.fromCustomerName}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-foreground font-medium">{entry.toCustomerName}</span>
                    <span className="text-muted-foreground ml-auto">
                      {new Date(entry.reassignedAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Config spec panel */}
          {transcriptConv?.mapped_config &&
            (() => {
              const cfg =
                typeof transcriptConv.mapped_config === "string"
                  ? JSON.parse(transcriptConv.mapped_config)
                  : transcriptConv.mapped_config;
              const hasSummary =
                cfg.serviceType ||
                cfg.vanSize ||
                cfg.machineType ||
                cfg.kitId ||
                cfg.packageId ||
                cfg.financePreference;
              if (!hasSummary) return null;

              const kit = kitsData.find((k) => k.id === cfg.kitId);
              const selectedUpgrades = upgradesData.filter(
                (u) => Array.isArray(cfg.upgradeIds) && cfg.upgradeIds.includes(u.id)
              );
              const serviceTypeLabel =
                cfg.serviceType === "hybrid"
                  ? "Cars + Commercials"
                  : cfg.serviceType === "commercial"
                  ? "Commercial only"
                  : "Cars & vans";
              const packageColour =
                cfg.packageId === "gold"
                  ? "text-amber-400 font-semibold"
                  : cfg.packageId === "silver"
                  ? "text-zinc-300 font-semibold"
                  : cfg.packageId === "bronze"
                  ? "text-amber-700 font-semibold"
                  : "font-medium";

              return (
                <div className="px-5 py-3 bg-muted/30 border-b shrink-0">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Captured configuration
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleOpenInConfigurator}
                      data-testid="button-open-in-configurator"
                      className="h-7 text-xs px-2.5"
                    >
                      <Settings className="w-3 h-3 mr-1.5" />
                      Edit in configurator
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mb-3 min-w-0">
                    {cfg.packageId && (
                      <>
                        <span className="text-muted-foreground shrink-0">Package</span>
                        <span className={`capitalize min-w-0 break-words ${packageColour}`}>{cfg.packageId}</span>
                      </>
                    )}
                    {cfg.serviceType && (
                      <>
                        <span className="text-muted-foreground shrink-0">Service type</span>
                        <span className="font-medium min-w-0 break-words">{serviceTypeLabel}</span>
                      </>
                    )}
                    {cfg.vanSize && (
                      <>
                        <span className="text-muted-foreground shrink-0">Van size</span>
                        <span className="font-medium min-w-0 break-words">{cfg.vanSize}</span>
                      </>
                    )}
                    {cfg.machineType && (
                      <>
                        <span className="text-muted-foreground shrink-0">Machine type</span>
                        <span className="font-medium capitalize min-w-0 break-words">
                          {cfg.machineType.replace("-", " ")}
                        </span>
                      </>
                    )}
                    {(cfg.kitId || kit) && (
                      <>
                        <span className="text-muted-foreground shrink-0">Kit</span>
                        <span className="font-medium min-w-0 break-words">{kit ? kit.name : cfg.kitId}</span>
                      </>
                    )}
                    {cfg.includes48v && (
                      <>
                        <span className="text-muted-foreground shrink-0">48V system</span>
                        <span className="font-medium text-accent">Yes</span>
                      </>
                    )}
                    {cfg.ownVan !== null && cfg.ownVan !== undefined && (
                      <>
                        <span className="text-muted-foreground shrink-0">Van supply</span>
                        <span className="font-medium min-w-0 break-words">
                          {cfg.ownVan
                            ? "Customer's own van"
                            : `${cfg.vanSize ?? ""} van from MTV`.trim()}
                        </span>
                      </>
                    )}
                    {cfg.financePreference && (
                      <>
                        <span className="text-muted-foreground shrink-0">Finance</span>
                        <span className="font-medium capitalize min-w-0 break-words">{cfg.financePreference}</span>
                      </>
                    )}
                  </div>
                  {selectedUpgrades.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                        Upgrades
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedUpgrades.map((u) => (
                          <Badge key={u.id} variant="outline" className="text-xs font-normal">
                            {((u as any).variantName && (u as any).variantName.trim()) || u.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {(transcriptConv?.messages ?? []).map(
              (m: { role: string; content: string }, i: number) => (
                <div
                  key={i}
                  className={`flex items-end gap-2 ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {m.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 mb-0.5">
                      <img
                        src={maxAvatarSrc}
                        alt="Max"
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-accent text-accent-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              )
            )}
            {!transcriptConv?.messages?.length && (
              <p className="text-muted-foreground text-sm text-center py-8">
                No messages recorded for this session
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
