import { useAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchJson, getAuthToken, parseMutationJson } from "@/lib/queryClient";
import { useParams, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Mail, Phone, Building2, Pencil, Save, X,
  FileText, Bot, Users, CheckCircle2, Clock,
  CalendarDays, StickyNote, PhoneCall, Coffee, ExternalLink,
  AlertCircle, ChevronRight, Plus, Check, UserCheck, UserX, ArrowRightLeft,
  Merge, Search, ShieldAlert, Scissors, UserCircle,
  ImageIcon, Upload, Send, ZoomIn, ChevronDown, ChevronUp,
  MessageCircle, RefreshCw, Copy, Loader2, CheckCircle, Zap,
  PlugZap, Power, BatteryCharging, Thermometer, Cpu, Gauge, Activity,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface StaffMember {
  id: string;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName: string;
}

interface MergeHistoryEntry {
  id: string;
  keepId: string;
  keepSnapshotName: string | null;
  keepSnapshotEmail: string | null;
  keepSnapshotPhone: string | null;
  keepSnapshotCompany: string | null;
  removedId: string;
  removedSnapshotName: string | null;
  removedSnapshotEmail: string | null;
  removedSnapshotPhone: string | null;
  removedSnapshotCompany: string | null;
  leadsRelinked: string[];
  quotesRelinked: string[];
  conversationsRelinked: string[];
  notesRelinked: string[];
  triggeredBy: string | null;
  mergedAt: string | null;
  splitAt: string | null;
}

interface Customer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  primaryStaffId?: string | null;
  primaryStaffName?: string | null;
  vrmInstallationId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface CustomerNote {
  id: string;
  customerId: string;
  authorId?: string | null;
  authorName?: string | null;
  noteType: string;
  text: string;
  createdAt?: string | null;
}

interface ArtworkProof {
  id: string;
  customerId: string;
  quoteId?: string | null;
  uploadedById?: string | null;
  files: Array<{ url: string; name: string }>;
  status: string;
  token: string;
  adminNotes?: string | null;
  customerNotes?: string | null;
  sentAt?: string | null;
  respondedAt?: string | null;
  createdAt?: string | null;
}

interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description?: string;
  author?: string;
  timestamp: string;
  entityId?: string;
  entityType?: string;
  relatedCustomerId?: string;
  relatedCustomerName?: string;
}

interface HandoffData {
  currentStatus: string;
  lastContactAt?: string | null;
  lastNote?: { text?: string; author?: string; timestamp: string } | null;
  openFollowUps: Array<{ id: string; scheduledDate: string; notes?: string; assignedToName?: string }>;
}

interface CustomerProfileData {
  customer: Customer;
  is48v?: boolean;
  leads: any[];
  quotes: any[];
  conversations: any[];
  followUps: any[];
  notes: CustomerNote[];
  timeline: TimelineEvent[];
  handoff: HandoffData;
}

const NOTE_TYPE_ICONS: Record<string, React.ElementType> = {
  call: PhoneCall,
  email: Mail,
  meeting: Coffee,
  general: StickyNote,
};

const NOTE_TYPE_LABELS: Record<string, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  general: "General",
};

const TIMELINE_ICONS: Record<string, React.ElementType> = {
  lead_created: Users,
  lead_status_changed: CheckCircle2,
  quote_created: FileText,
  quote_status: CheckCircle2,
  chat_started: Bot,
  chat_completed: CheckCircle2,
  note: StickyNote,
  customer_note: StickyNote,
  followup_scheduled: CalendarDays,
  followup_completed: CheckCircle2,
  record_reassigned_in: ArrowRightLeft,
  record_reassigned_out: ArrowRightLeft,
  artwork_proof_created: ImageIcon,
  artwork_proof_sent: Send,
  artwork_proof_approved: CheckCircle2,
  artwork_proof_changes: RefreshCw,
  artwork_message_admin: MessageCircle,
  artwork_message_customer: MessageCircle,
};

const TIMELINE_COLORS: Record<string, string> = {
  lead_created: "bg-blue-500/20 text-blue-400",
  lead_status_changed: "bg-blue-500/20 text-blue-400",
  quote_created: "bg-purple-500/20 text-purple-400",
  quote_status: "bg-emerald-500/20 text-emerald-400",
  chat_started: "bg-cyan-500/20 text-cyan-400",
  chat_completed: "bg-emerald-500/20 text-emerald-400",
  note: "bg-amber-500/20 text-amber-400",
  customer_note: "bg-[hsl(86_45%_51%/0.15)] text-[hsl(86_53%_60%)]",
  followup_scheduled: "bg-orange-500/20 text-orange-400",
  followup_completed: "bg-emerald-500/20 text-emerald-400",
  record_reassigned_in: "bg-violet-500/20 text-violet-400",
  record_reassigned_out: "bg-slate-500/20 text-slate-400",
  artwork_proof_created: "bg-pink-500/20 text-pink-400",
  artwork_proof_sent: "bg-pink-500/20 text-pink-400",
  artwork_proof_approved: "bg-emerald-500/20 text-emerald-400",
  artwork_proof_changes: "bg-amber-500/20 text-amber-400",
  artwork_message_admin: "bg-pink-500/20 text-pink-400",
  artwork_message_customer: "bg-slate-500/20 text-slate-300",
};

function formatDate(date: string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDateShort(date: string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

interface ArtworkProofMessage {
  id: string;
  proofId: string;
  senderType: "admin" | "customer";
  senderName: string;
  message: string;
  createdAt: string;
}

function ProofChatPanel({ proofId, customerName }: { proofId: string; customerName: string }) {
  const { toast } = useToast();
  const [compose, setCompose] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], refetch: refetchMessages } = useQuery<ArtworkProofMessage[]>({
    queryKey: [`/api/admin/artwork-proofs/${proofId}/messages`],
    refetchInterval: 30000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      const token = getAuthToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const r = await fetch(`/api/admin/artwork-proofs/${proofId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ message: text }),
      });
      if (!r.ok) throw new Error("Failed to send");
      return parseMutationJson(r);
    },
    onSuccess: () => { setCompose(""); refetchMessages(); },
    onError: () => toast({ variant: "destructive", title: "Failed to send message" }),
  });

  const handleSend = () => {
    if (compose.trim()) sendMutation.mutate(compose.trim());
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <MessageCircle className="w-3.5 h-3.5" />
        Discussion
        {messages.length > 0 && (
          <span className="text-[10px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">
            {messages.length}
          </span>
        )}
      </p>

      {messages.length > 0 && (
        <div className="max-h-56 overflow-y-auto space-y-2 pr-0.5">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex flex-col gap-0.5 ${msg.senderType === "admin" ? "items-end" : "items-start"}`}
            >
              <div className={`max-w-[88%] rounded-md px-3 py-2 text-xs leading-relaxed ${
                msg.senderType === "admin"
                  ? "bg-[hsl(86_45%_51%/0.12)] text-foreground"
                  : "bg-muted text-foreground"
              }`}>
                <p className="text-[10px] font-semibold text-muted-foreground mb-1">
                  {msg.senderType === "admin" ? msg.senderName : customerName}
                </p>
                <p className="whitespace-pre-wrap break-words">{msg.message}</p>
              </div>
              <p className="text-[10px] text-muted-foreground px-1">
                {new Date(msg.createdAt).toLocaleString("en-GB", {
                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {messages.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic">
          No messages yet — start a discussion below. Messages are emailed to the customer.
        </p>
      )}

      <div className="flex gap-2 items-end">
        <Textarea
          className="resize-none text-xs flex-1"
          style={{ minHeight: "56px" }}
          placeholder={`Message ${customerName}…`}
          value={compose}
          onChange={e => setCompose(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && compose.trim()) {
              e.preventDefault();
              handleSend();
            }
          }}
          data-testid={`textarea-proof-message-${proofId}`}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!compose.trim() || sendMutation.isPending}
          data-testid={`button-send-proof-message-${proofId}`}
        >
          {sendMutation.isPending
            ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            : <Send className="w-3.5 h-3.5" />
          }
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">Ctrl+Enter to send</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    contacted: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    qualified: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    converted: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    awaiting_deposit: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    deposit_taken: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    in_build: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    in_workshop: "bg-red-500/20 text-red-300 border-red-500/30",
    completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
    closed: "bg-muted text-muted-foreground border-border",
    dead: "bg-red-500/15 text-red-400 border-red-500/30",
    unknown: "bg-muted text-muted-foreground border-border",
  };
  const label = status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return (
    <Badge className={`text-[10px] border ${map[status] ?? map.unknown} no-default-active-elevate`}>
      {label}
    </Badge>
  );
}

export default function CustomerProfile() {
  const { id } = useParams();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth() as {
    user: User | undefined;
    isAuthenticated: boolean;
    isLoading: boolean;
  };

  // Inline edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editPrimaryStaffId, setEditPrimaryStaffId] = useState<string | null>(null);
  const [editVrmId, setEditVrmId] = useState("");
  const [vrmDrawerOpen, setVrmDrawerOpen] = useState(false);

  // Note form state
  type NoteType = "call" | "email" | "meeting" | "general";
  const [noteType, setNoteType] = useState<NoteType>("general");
  const [noteText, setNoteText] = useState("");

  const mergeRedirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (mergeRedirectTimer.current !== null) {
        clearTimeout(mergeRedirectTimer.current);
      }
    };
  }, []);

  // Artwork proofs state
  const [artworkExpanded, setArtworkExpanded] = useState<Record<string, boolean>>({});
  const [artworkAdminNotes, setArtworkAdminNotes] = useState<Record<string, string>>({});
  const [artworkLightbox, setArtworkLightbox] = useState<string | null>(null);
  const [artworkSelectedFiles, setArtworkSelectedFiles] = useState<File[]>([]);
  const [artworkUploading, setArtworkUploading] = useState(false);
  const artworkInputRef = useRef<HTMLInputElement>(null);
  const [showEarlierRounds, setShowEarlierRounds] = useState(false);

  // WrapGen 3D render state
  const [wrapgenEditUrls, setWrapgenEditUrls] = useState<Record<string, string>>({});
  const [wrapgenQuoteInputs, setWrapgenQuoteInputs] = useState<Record<string, string>>({});
  const [openingWrapgenForQuoteId, setOpeningWrapgenForQuoteId] = useState<string | null>(null);
  const [wrapgenSelectedQuoteId, setWrapgenSelectedQuoteId] = useState<string>("");

  // Manual merge state
  const [showMergePanel, setShowMergePanel] = useState(false);
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeSearchInput, setMergeSearchInput] = useState("");
  const [selectedMergeTarget, setSelectedMergeTarget] = useState<{ id: string; name: string; email?: string | null; phone?: string | null } | null>(null);
  const [splittingId, setSplittingId] = useState<string | null>(null);
  const [mergeKeepId, setMergeKeepId] = useState<string | null>(null);
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [isAuthenticated, isLoading]);

  const { data, isLoading: profileLoading, isError: profileError, refetch: refetchProfile } = useQuery<CustomerProfileData>({
    queryKey: ["/api/admin/customers", id],
    queryFn: async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/admin/customers/${id}`, {
        credentials: "include",
        headers,
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json() as Promise<CustomerProfileData>;
    },
    enabled: !!(user?.adminRole && user.adminRole !== "none") && !!id,
    staleTime: 0,
  });

  const { data: staffList = [] } = useQuery<StaffMember[]>({
    queryKey: ["/api/admin/staff"],
    enabled: !!(user?.adminRole && user.adminRole !== "none"),
  });

  // Debounce merge search input
  useEffect(() => {
    const timer = setTimeout(() => setMergeSearch(mergeSearchInput), 350);
    return () => clearTimeout(timer);
  }, [mergeSearchInput]);

  const { data: mergeSearchResults = [], isFetching: mergeSearchFetching } = useQuery<Array<{ id: string; name: string; email?: string | null; phone?: string | null }>>({
    queryKey: ["/api/admin/customers", { search: mergeSearch }],
    queryFn: async () => {
      if (!mergeSearch.trim()) return [];
      const all = await fetchJson<Array<{ id: string; name: string; email?: string | null; phone?: string | null }>>(
        `/api/admin/customers?search=${encodeURIComponent(mergeSearch.trim())}`
      );
      return all.filter(c => c.id !== id);
    },
    enabled: !!(user?.adminRole && user.adminRole !== "none") && showMergePanel && mergeSearch.trim().length > 0,
  });

  const { data: mergeHistory = [], isLoading: mergeHistoryLoading } = useQuery<MergeHistoryEntry[]>({
    queryKey: ["/api/admin/customers/merge-history", id],
    queryFn: () => fetchJson(`/api/admin/customers/merge-history?keepId=${encodeURIComponent(id ?? "")}`),
    enabled: !!(user?.adminRole && user.adminRole !== "none") && !!id,
  });

  const splitMutation = useMutation<{ ok: boolean; newCustomerId: string }, Error, string>({
    mutationFn: (historyId: string) =>
      apiRequest("POST", `/api/admin/customers/split/${historyId}`).then(parseMutationJson),
    onSuccess: () => {
      setSplittingId(null);
      toast({
        title: "Merge reversed",
        description: "The customer has been recreated and their records re-linked.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers/merge-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers", id] });
    },
    onError: (err) => {
      setSplittingId(null);
      let msg = "Could not reverse the merge. Please try again.";
      if (err.message?.includes("already been split")) {
        msg = "This merge has already been reversed.";
      } else if (err.message?.includes("email or phone already exists")) {
        msg = "A customer with that email/phone already exists. This split cannot be completed.";
      }
      toast({ title: "Split failed", description: msg, variant: "destructive" });
    },
  });

  const undoMergeMutation = useMutation({
    mutationFn: (historyId: string) =>
      apiRequest("POST", `/api/admin/customers/split/${historyId}`).then(parseMutationJson),
    onSuccess: (data: { ok: boolean; newCustomerId: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers/merge-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers", id] });
      toast({
        title: "Merge undone",
        description: "The customer has been recreated and their records re-linked.",
      });
      if (data.newCustomerId) {
        navigate(`/admin/customers/${data.newCustomerId}`);
      }
    },
    onError: () => toast({ variant: "destructive", title: "Undo failed", description: "Could not reverse the merge. Please try again." }),
  });

  const mergeMutation = useMutation({
    mutationFn: ({ mergeWithId, keepId }: { mergeWithId: string; keepId: string }) =>
      apiRequest("POST", `/api/admin/customers/${id}/merge`, { mergeWithId, keepId }).then(parseMutationJson),
    onSuccess: (result: { ok: boolean; survivingId: string; historyId: string }) => {
      setShowMergeConfirm(false);
      setShowMergePanel(false);
      const isCurrentRemoved = result.survivingId !== id;
      const survivingName = isCurrentRemoved ? selectedMergeTarget?.name : null;
      setSelectedMergeTarget(null);
      setMergeSearchInput("");
      setMergeSearch("");
      setMergeKeepId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers/merge-history"] });
      const historyId = result.historyId;
      if (isCurrentRemoved) {
        mergeRedirectTimer.current = setTimeout(() => {
          mergeRedirectTimer.current = null;
          navigate(`/admin/customers/${result.survivingId}`);
        }, 4000);
        toast({
          title: "Profile merged",
          description: `This profile has been merged into ${survivingName ?? "the other customer"}.`,
          action: historyId ? (
            <ToastAction
              altText="Undo merge"
              data-testid="button-undo-merge"
              onClick={() => {
                if (mergeRedirectTimer.current !== null) {
                  clearTimeout(mergeRedirectTimer.current);
                  mergeRedirectTimer.current = null;
                }
                undoMergeMutation.mutate(historyId);
              }}
            >
              Undo
            </ToastAction>
          ) : undefined,
        });
      } else {
        toast({
          title: "Customers merged",
          description: "The merge has been logged and can be reversed.",
          action: historyId ? (
            <ToastAction
              altText="Undo merge"
              data-testid="button-undo-merge"
              onClick={() => undoMergeMutation.mutate(historyId)}
            >
              Undo
            </ToastAction>
          ) : undefined,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/customers", id] });
      }
    },
    onError: () => toast({ variant: "destructive", title: "Merge failed", description: "Could not merge the customers. Please try again." }),
  });

  const handleMergeConfirm = () => {
    if (!selectedMergeTarget || !mergeKeepId) return;
    mergeMutation.mutate({ mergeWithId: selectedMergeTarget.id, keepId: mergeKeepId });
  };

  // Artwork proofs query
  const { data: artworkProofs = [], refetch: refetchProofs } = useQuery<ArtworkProof[]>({
    queryKey: ["/api/admin/customers", id, "artwork-proofs"],
    queryFn: async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const r = await fetch(`/api/admin/customers/${id}/artwork-proofs`, { credentials: "include", headers });
      if (!r.ok) throw new Error(`${r.status}`);
      return r.json();
    },
    enabled: !!(user?.adminRole && user.adminRole !== "none") && !!id,
  });

  // Sync admin notes from loaded proofs
  useEffect(() => {
    if (artworkProofs.length > 0) {
      setArtworkAdminNotes(prev => {
        const next = { ...prev };
        for (const proof of artworkProofs) {
          if (!(proof.id in next)) next[proof.id] = proof.adminNotes ?? "";
        }
        return next;
      });
    }
  }, [artworkProofs]);

  const sendProofEmailMutation = useMutation({
    mutationFn: (proofId: string) =>
      apiRequest("POST", `/api/admin/artwork-proofs/${proofId}/send`).then(parseMutationJson),
    onSuccess: () => {
      refetchProofs();
      toast({ title: "Proof email sent", description: "The customer has been emailed with a link to review the artwork." });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to send email" }),
  });

  const updateProofNotesMutation = useMutation({
    mutationFn: ({ proofId, adminNotes }: { proofId: string; adminNotes: string }) =>
      apiRequest("PATCH", `/api/admin/artwork-proofs/${proofId}`, { adminNotes }),
    onSuccess: () => {
      refetchProofs();
      toast({ title: "Notes saved" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to save notes" }),
  });

  const saveWrapgenUrlMutation = useMutation({
    mutationFn: ({ quoteId, previewUrl }: { quoteId: string; previewUrl: string }) =>
      apiRequest("PATCH", `/api/admin/quotes/${quoteId}/wrapgen-proof`, { previewUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers", id] });
      setWrapgenQuoteInputs({});
      setWrapgenEditUrls({});
      toast({ title: "WrapGen render linked", description: "The 3D preview URL has been saved to the quote." });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to save WrapGen URL" }),
  });

  const generateWrapgenLinkMutation = useMutation({
    mutationFn: (quoteId: string) =>
      apiRequest("POST", `/api/admin/quotes/${quoteId}/wrapgen-link-token`).then(parseMutationJson),
    onSuccess: (data: { token: string; wrapgenUrl: string }, quoteId: string) => {
      window.open(data.wrapgenUrl, "_blank");
      setOpeningWrapgenForQuoteId(quoteId);
    },
    onError: () => toast({ variant: "destructive", title: "Failed to generate WrapGen link" }),
  });

  // Poll every 5 s while waiting for WrapGen to fire back
  useEffect(() => {
    if (!openingWrapgenForQuoteId) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers", id] });
    }, 5000);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setOpeningWrapgenForQuoteId(null);
    }, 5 * 60 * 1000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [openingWrapgenForQuoteId, id]);

  // Stop polling once the quote gets a wrapgen URL
  useEffect(() => {
    if (!openingWrapgenForQuoteId) return;
    const q = (data as any)?.quotes?.find((q: any) => q.id === openingWrapgenForQuoteId);
    if (q?.wrapgen_preview_url) {
      setOpeningWrapgenForQuoteId(null);
      toast({ title: "WrapGen linked!", description: "The render has been automatically linked to this quote." });
    }
  }, [data, openingWrapgenForQuoteId]);

  const handleArtworkCreateProof = async () => {
    if (artworkSelectedFiles.length === 0) return;
    setArtworkUploading(true);
    try {
      const uploadedFiles: Array<{ url: string; name: string }> = [];
      const token = getAuthToken();
      const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      for (const file of artworkSelectedFiles) {
        const urlRes = await fetch("/api/admin/artwork-proofs/upload-url", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ filename: file.name, contentType: file.type }),
        });
        if (!urlRes.ok) throw new Error("Failed to get upload URL");
        const { uploadURL, objectPath } = await urlRes.json();

        const putRes = await fetch(uploadURL, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!putRes.ok) throw new Error("Upload failed");
        uploadedFiles.push({ url: objectPath, name: file.name });
      }

      const createRes = await fetch(`/api/admin/customers/${id}/artwork-proofs`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ files: uploadedFiles }),
      });
      if (!createRes.ok) throw new Error("Create failed");

      refetchProofs();
      setArtworkSelectedFiles([]);
      if (artworkInputRef.current) artworkInputRef.current.value = "";
      toast({ title: "Proof round created", description: `${uploadedFiles.length} file${uploadedFiles.length !== 1 ? "s" : ""} uploaded successfully.` });
    } catch {
      toast({ variant: "destructive", title: "Upload failed", description: "Could not upload artwork. Please try again." });
    } finally {
      setArtworkUploading(false);
    }
  };

  // Populate edit fields when data loads, but never while the user is actively
  // editing — a background refetch (window focus, polling, invalidation) would
  // otherwise overwrite whatever they have just typed.
  useEffect(() => {
    if (editing) return;
    if (data?.customer) {
      setEditName(data.customer.name ?? "");
      setEditEmail(data.customer.email ?? "");
      setEditPhone(data.customer.phone ?? "");
      setEditCompany(data.customer.company ?? "");
      setEditPrimaryStaffId(data.customer.primaryStaffId ?? null);
      setEditVrmId(data.customer.vrmInstallationId ?? "");
    }
  }, [data?.customer, editing]);

  const updateMutation = useMutation({
    mutationFn: (body: object) => apiRequest("PATCH", `/api/admin/customers/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      setEditing(false);
      toast({ title: "Customer updated" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to update customer" }),
  });

  const addNoteMutation = useMutation({
    mutationFn: (body: object) => apiRequest("POST", `/api/admin/customers/${id}/notes`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers", id] });
      setNoteText("");
      toast({ title: "Note added to customer and all linked records" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to add note" }),
  });

  const vrmQuery = useQuery<{
    installationId: string;
    dashboardUrl: string;
    updatedAt: number | null;
    dashboard: {
      systemState: string | null;
      grid: { power: string | null; voltage: string | null; current: string | null; frequency: string | null };
      acLoads: { power: string | null; frequency: string | null };
      battery: { temperature: string | null; soc: string | null; voltage: string | null; current: string | null; power: string | null };
      dcPower: { power: string | null; voltage: string | null; current: string | null };
    };
    metrics: Array<{ code: string | null; label: string; value: any; timestamp: string | null }>;
  }>({
    queryKey: ["/api/admin/customers", id, "vrm"],
    enabled: vrmDrawerOpen,
    refetchInterval: vrmDrawerOpen ? 30000 : false,
    queryFn: async () => {
      const token = getAuthToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const r = await fetch(`/api/admin/customers/${id}/vrm`, { credentials: "include", headers });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.error || "Failed to load power data");
      return body;
    },
  });

  const handleSaveEdit = () => {
    updateMutation.mutate({
      name: editName.trim(),
      email: editEmail.trim() || null,
      phone: editPhone.trim() || null,
      company: editCompany.trim() || null,
      primaryStaffId: editPrimaryStaffId || null,
      vrmInstallationId: editVrmId.trim() || null,
    });
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addNoteMutation.mutate({ noteType, text: noteText.trim() });
  };

  const handleAssignToMe = () => {
    if (!user?.id) return;
    updateMutation.mutate({ primaryStaffId: user.id });
  };

  const handleUnassign = () => {
    updateMutation.mutate({ primaryStaffId: null });
  };

  if (isLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-destructive text-sm">Failed to load — check your connection and try again</p>
          <Button variant="outline" size="sm" onClick={() => refetchProfile()} data-testid="button-retry-profile">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Customer not found.</p>
      </div>
    );
  }

  const { customer, leads, quotes, conversations, notes, timeline, handoff } = data;
  const is48v = data.is48v ?? false;
  const isAssignedToMe = customer.primaryStaffId === user?.id;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 px-4 py-4">
        <div className="w-full">
          <Link href="/admin/customers">
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3" data-testid="button-back-customers">
              <ArrowLeft className="w-3.5 h-3.5" />
              All Customers
            </button>
          </Link>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[hsl(86_45%_51%/0.12)] flex items-center justify-center shrink-0">
                <span className="text-base font-bold text-[hsl(86_53%_60%)]">
                  {customer.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-xl font-bold" data-testid="text-customer-name">{customer.name}</h1>
                {customer.company && (
                  <p className="text-sm text-muted-foreground">{customer.company}</p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(!editing)}
              data-testid="button-edit-customer"
            >
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              {editing ? "Cancel" : "Edit"}
            </Button>
          </div>
        </div>
      </div>

      {/* Status summary bar */}
      <div className="border-b bg-card/30 px-4 py-3">
        <div className="w-full flex items-center gap-5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Status</span>
            <StatusBadge status={handoff.currentStatus} />
          </div>
          <div className="flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Owner:</span>
            <span className="text-xs font-medium" data-testid="text-status-bar-owner">
              {customer.primaryStaffName ?? "Unassigned"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Last contact:</span>
            <span className="text-xs font-medium" data-testid="text-status-bar-last-contact">
              {handoff.lastContactAt ? formatDate(handoff.lastContactAt) : "Never"}
            </span>
          </div>
          {handoff.openFollowUps.length > 0 && (
            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-xs text-muted-foreground">Next action:</span>
              <span className="text-xs font-medium text-amber-400" data-testid="text-status-bar-next-action">
                {formatDateShort(handoff.openFollowUps[0].scheduledDate)}
              </span>
              {handoff.openFollowUps[0].notes && (
                <span className="text-xs text-muted-foreground truncate max-w-[180px] hidden sm:inline">
                  — {handoff.openFollowUps[0].notes}
                </span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            {customer.phone && (
              <Button variant="outline" size="sm" asChild data-testid="button-quick-call">
                <a href={`tel:${customer.phone}`}>
                  <Phone className="w-3.5 h-3.5 mr-1.5" />
                  Call
                </a>
              </Button>
            )}
            {customer.email && (
              <Button variant="outline" size="sm" asChild data-testid="button-quick-email">
                <a href={`mailto:${customer.email}`}>
                  <Mail className="w-3.5 h-3.5 mr-1.5" />
                  Email
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="w-full px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: contact info + handoff card + notes form */}
          <div className="space-y-5">
            {/* Contact Info Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Contact Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {editing ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input value={editName} onChange={e => setEditName(e.target.value)} data-testid="input-edit-name" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Email</Label>
                      <Input value={editEmail} onChange={e => setEditEmail(e.target.value)} type="email" data-testid="input-edit-email" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Phone</Label>
                      <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} data-testid="input-edit-phone" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Company</Label>
                      <Input value={editCompany} onChange={e => setEditCompany(e.target.value)} data-testid="input-edit-company" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Assigned Staff</Label>
                      <Select
                        value={editPrimaryStaffId ?? "none"}
                        onValueChange={v => setEditPrimaryStaffId(v === "none" ? null : v)}
                      >
                        <SelectTrigger data-testid="select-assigned-staff">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {staffList.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.displayName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {is48v && (
                      <div className="space-y-1">
                        <Label className="text-xs">VRM Installation ID</Label>
                        <Input value={editVrmId} onChange={e => setEditVrmId(e.target.value)} placeholder="e.g. 123456" data-testid="input-edit-vrm-id" />
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending} data-testid="button-save-customer">
                        <Save className="w-3.5 h-3.5 mr-1" />
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(false)} data-testid="button-cancel-edit">
                        <X className="w-3.5 h-3.5 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customer.email && (
                      <a href={`mailto:${customer.email}`} className="flex items-center gap-2 text-sm hover:text-foreground text-muted-foreground transition-colors" data-testid="link-customer-email">
                        <Mail className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{customer.email}</span>
                      </a>
                    )}
                    {customer.phone && (
                      <a href={`tel:${customer.phone}`} className="flex items-center gap-2 text-sm hover:text-foreground text-muted-foreground transition-colors" data-testid="link-customer-phone">
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        {customer.phone}
                      </a>
                    )}
                    {customer.company && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        {customer.company}
                      </div>
                    )}
                    {!customer.email && !customer.phone && !customer.company && (
                      <p className="text-xs text-muted-foreground italic">No contact details</p>
                    )}
                    <div className="pt-1 text-[11px] text-muted-foreground">
                      Customer since {formatDateShort(customer.createdAt)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 48V Power System Card */}
            {is48v && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[hsl(86_53%_60%)]" />
                    48V Power System
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <span className="text-xs text-muted-foreground">VRM Installation ID:</span>
                    <span className="font-medium text-foreground" data-testid="text-vrm-id">
                      {customer.vrmInstallationId || "Not set"}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!customer.vrmInstallationId}
                    onClick={() => setVrmDrawerOpen(true)}
                    data-testid="button-open-power-system"
                  >
                    <Zap className="w-3.5 h-3.5 mr-1.5" />
                    Power System
                  </Button>
                  {!customer.vrmInstallationId && (
                    <p className="text-[11px] text-muted-foreground italic">
                      Add a VRM Installation ID (via Edit) to view live power data.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Handoff Card */}
            <Card className="border-[hsl(86_53%_51%/0.25)] bg-[hsl(86_45%_51%/0.04)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-[hsl(86_53%_60%)]" />
                  Staff Handoff
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Assigned Staff */}
                <div className="rounded-md bg-card border border-border/60 p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-[hsl(86_53%_60%)] shrink-0" />
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Owner</span>
                    </div>
                    {customer.primaryStaffId && (
                      <button
                        onClick={handleUnassign}
                        disabled={updateMutation.isPending}
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                        data-testid="button-unassign-staff"
                      >
                        <UserX className="w-3 h-3" />
                        Unassign
                      </button>
                    )}
                  </div>
                  {customer.primaryStaffName ? (
                    <p className="text-sm font-semibold text-foreground" data-testid="text-assigned-staff">
                      {customer.primaryStaffName}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Unassigned</p>
                  )}
                  {!isAssignedToMe && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAssignToMe}
                      disabled={updateMutation.isPending}
                      className="w-full"
                      data-testid="button-assign-to-me"
                    >
                      {updateMutation.isPending ? (
                        <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
                      ) : (
                        <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Assign to me
                    </Button>
                  )}
                  {isAssignedToMe && (
                    <p className="text-[11px] text-[hsl(86_53%_60%)] flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Assigned to you
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground text-xs">Current status</span>
                  <StatusBadge status={handoff.currentStatus} />
                </div>
                <div className="text-xs text-muted-foreground">
                  <span>Last contact: </span>
                  <span className="text-foreground">{formatDate(handoff.lastContactAt)}</span>
                </div>

                {handoff.lastNote ? (
                  <div className="rounded-md bg-card border border-border/60 p-2.5 space-y-1">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Last Note</p>
                    <p className="text-xs leading-relaxed">{handoff.lastNote.text}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {handoff.lastNote.author} · {formatDate(handoff.lastNote.timestamp)}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No notes yet</p>
                )}

                {handoff.openFollowUps.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Open Follow-ups</p>
                    {handoff.openFollowUps.map(fu => (
                      <div key={fu.id} className="flex items-start gap-2 text-xs">
                        <CalendarDays className="w-3 h-3 mt-0.5 text-amber-400 shrink-0" />
                        <div>
                          <p className="font-medium">{formatDateShort(fu.scheduledDate)}</p>
                          {fu.notes && <p className="text-muted-foreground">{fu.notes}</p>}
                          {fu.assignedToName && <p className="text-muted-foreground">→ {fu.assignedToName}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Merge with another customer */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Merge className="w-3.5 h-3.5" />
                  Merge Customer
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!showMergePanel ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Combine this customer with a duplicate record. All linked leads, quotes, and conversations will be reassigned to the surviving customer, and the merge can be reversed from the Merge History panel.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowMergePanel(true)}
                      data-testid="button-open-merge-panel"
                    >
                      <Merge className="w-3.5 h-3.5 mr-1.5" />
                      Merge with another customer
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        placeholder="Search by name, email or phone..."
                        value={mergeSearchInput}
                        onChange={e => {
                          setMergeSearchInput(e.target.value);
                          setSelectedMergeTarget(null);
                          setMergeKeepId(null);
                        }}
                        className="pl-8 text-sm"
                        data-testid="input-merge-search"
                      />
                    </div>

                    {/* Search results */}
                    {mergeSearch.trim().length > 0 && (
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {mergeSearchFetching ? (
                          <p className="text-xs text-muted-foreground text-center py-3">Searching...</p>
                        ) : mergeSearchResults.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-3 italic">No other customers found</p>
                        ) : (
                          mergeSearchResults.map(c => (
                            <button
                              key={c.id}
                              onClick={() => {
                                setSelectedMergeTarget(c);
                                setMergeKeepId(id ?? null);
                              }}
                              className={`w-full text-left rounded-md px-2.5 py-2 hover-elevate transition-colors ${selectedMergeTarget?.id === c.id ? "bg-muted" : ""}`}
                              data-testid={`button-select-merge-target-${c.id}`}
                            >
                              <p className="text-xs font-medium truncate">{c.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {[c.email, c.phone].filter(Boolean).join(" · ") || "No contact details"}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    )}

                    {/* Keep which customer choice */}
                    {selectedMergeTarget && (
                      <div className="space-y-2 pt-1">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Keep which record?</p>
                        <div className="space-y-1.5">
                          {/* Current customer option */}
                          <button
                            onClick={() => setMergeKeepId(id ?? null)}
                            className={`w-full text-left rounded-md border px-2.5 py-2 transition-colors ${mergeKeepId === id ? "border-[hsl(86_53%_51%/0.5)] bg-[hsl(86_45%_51%/0.08)]" : mergeKeepId === selectedMergeTarget.id ? "border-destructive/40 bg-destructive/5" : "border-border hover-elevate"}`}
                            data-testid="button-keep-current"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <p className="text-xs font-medium truncate">{data?.customer.name} <span className="text-muted-foreground font-normal">(this profile)</span></p>
                              {mergeKeepId === id && (
                                <span className="shrink-0 inline-flex items-center gap-0.5 rounded-sm bg-[hsl(86_45%_51%/0.15)] text-[hsl(86_53%_60%)] text-[10px] font-semibold px-1.5 py-0.5">
                                  <Check className="w-2.5 h-2.5" />
                                  Keep
                                </span>
                              )}
                              {mergeKeepId === selectedMergeTarget.id && (
                                <span className="shrink-0 inline-flex items-center gap-0.5 rounded-sm bg-destructive/10 text-destructive text-[10px] font-semibold px-1.5 py-0.5">
                                  <X className="w-2.5 h-2.5" />
                                  Remove
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                              {[data?.customer.email, data?.customer.phone].filter(Boolean).join(" · ") || "No contact details"}
                            </p>
                          </button>
                          {/* Other customer option */}
                          <button
                            onClick={() => setMergeKeepId(selectedMergeTarget.id)}
                            className={`w-full text-left rounded-md border px-2.5 py-2 transition-colors ${mergeKeepId === selectedMergeTarget.id ? "border-[hsl(86_53%_51%/0.5)] bg-[hsl(86_45%_51%/0.08)]" : mergeKeepId === id ? "border-destructive/40 bg-destructive/5" : "border-border hover-elevate"}`}
                            data-testid="button-keep-other"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <p className="text-xs font-medium truncate">{selectedMergeTarget.name}</p>
                              {mergeKeepId === selectedMergeTarget.id && (
                                <span className="shrink-0 inline-flex items-center gap-0.5 rounded-sm bg-[hsl(86_45%_51%/0.15)] text-[hsl(86_53%_60%)] text-[10px] font-semibold px-1.5 py-0.5">
                                  <Check className="w-2.5 h-2.5" />
                                  Keep
                                </span>
                              )}
                              {mergeKeepId === id && (
                                <span className="shrink-0 inline-flex items-center gap-0.5 rounded-sm bg-destructive/10 text-destructive text-[10px] font-semibold px-1.5 py-0.5">
                                  <X className="w-2.5 h-2.5" />
                                  Remove
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                              {[selectedMergeTarget.email, selectedMergeTarget.phone].filter(Boolean).join(" · ") || "No contact details"}
                            </p>
                          </button>
                        </div>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => setShowMergeConfirm(true)}
                          disabled={!mergeKeepId}
                          data-testid="button-merge-confirm-open"
                        >
                          <Merge className="w-3.5 h-3.5 mr-1.5" />
                          Merge customers
                        </Button>
                      </div>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setShowMergePanel(false);
                        setSelectedMergeTarget(null);
                        setMergeSearchInput("");
                        setMergeSearch("");
                        setMergeKeepId(null);
                      }}
                      data-testid="button-cancel-merge"
                    >
                      <X className="w-3.5 h-3.5 mr-1.5" />
                      Cancel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Merge History — only shown when there are entries for this customer */}
            {(mergeHistoryLoading || mergeHistory.length > 0) && (
              <Card data-testid="panel-merge-history-profile">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">Merge History</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {mergeHistoryLoading ? (
                    <div className="flex items-center gap-2 py-3 justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                      <span className="text-xs text-muted-foreground">Loading...</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {mergeHistory.map((entry) => {
                        const recordCount =
                          (entry.leadsRelinked?.length ?? 0) +
                          (entry.quotesRelinked?.length ?? 0) +
                          (entry.conversationsRelinked?.length ?? 0) +
                          (entry.notesRelinked?.length ?? 0);
                        const alreadySplit = !!entry.splitAt;
                        const isSplitting = splittingId === entry.id;
                        return (
                          <div
                            key={entry.id}
                            className="py-3 border-t first:border-t-0 space-y-1.5"
                            data-testid={`row-profile-merge-history-${entry.id}`}
                          >
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-medium truncate" data-testid={`text-profile-merge-removed-${entry.id}`}>
                                {entry.removedSnapshotName ?? "Unknown"}
                              </span>
                              <span className="text-[10px] text-muted-foreground">absorbed</span>
                              {alreadySplit && (
                                <Badge className="text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/25 no-default-active-elevate shrink-0">
                                  <Scissors className="w-2.5 h-2.5 mr-1" />
                                  split
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                              {entry.removedSnapshotEmail && (
                                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <Mail className="w-3 h-3 shrink-0" />
                                  {entry.removedSnapshotEmail}
                                </span>
                              )}
                              {entry.removedSnapshotPhone && (
                                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <Phone className="w-3 h-3 shrink-0" />
                                  {entry.removedSnapshotPhone}
                                </span>
                              )}
                              {recordCount > 0 && (
                                <span className="text-[11px] text-muted-foreground">
                                  {recordCount} record{recordCount !== 1 ? "s" : ""} re-linked
                                </span>
                              )}
                              {entry.triggeredBy ? (() => {
                                const staff = staffList.find(s => s.id === entry.triggeredBy);
                                const name = staff?.displayName ?? staff?.username ?? entry.triggeredBy;
                                return (
                                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <UserCircle className="w-3 h-3 shrink-0" />
                                    {name}
                                  </span>
                                );
                              })() : (
                                <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60 italic">
                                  <UserCircle className="w-3 h-3 shrink-0" />
                                  system / automated
                                </span>
                              )}
                              {entry.mergedAt && (
                                <span className="text-[11px] text-muted-foreground">
                                  {formatDate(entry.mergedAt)}
                                </span>
                              )}
                            </div>
                            {!alreadySplit && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full mt-1"
                                onClick={() => {
                                  setSplittingId(entry.id);
                                  splitMutation.mutate(entry.id);
                                }}
                                disabled={isSplitting || splitMutation.isPending}
                                data-testid={`button-profile-split-merge-${entry.id}`}
                              >
                                <Scissors className={`w-3 h-3 mr-1 ${isSplitting ? "animate-pulse" : ""}`} />
                                {isSplitting ? "Reversing..." : "Reverse merge"}
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Linked records */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Linked Records</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {leads.map((l: any) => (
                  <Link key={l.id} href={`/admin/leads`} data-testid={`link-lead-${l.id}`}>
                    <div className="flex items-center justify-between rounded-md hover-elevate px-2.5 py-2 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-blue-400" />
                        <div>
                          <p className="text-xs font-medium">Lead · {l.source?.replace(/_/g, " ")}</p>
                          <p className="text-[10px] text-muted-foreground">{formatDateShort(l.created_at)}</p>
                          {Array.isArray(l.reassignment_history) && l.reassignment_history.length > 0 && (
                            <div className="mt-0.5 space-y-0.5" data-testid={`text-reassignment-history-lead-${l.id}`}>
                              {l.reassignment_history.map((entry: {customerName: string; timestamp: string; staffName?: string}, i: number) => (
                                <p key={i} className="text-[10px] text-amber-500 dark:text-amber-400">
                                  Previously: {entry.customerName}
                                  <span className="text-muted-foreground ml-1">
                                    ({new Date(entry.timestamp).toLocaleDateString()}{entry.staffName ? ` · ${entry.staffName}` : ""})
                                  </span>
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={l.status ?? "new"} />
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                ))}
                {quotes.map((q: any) => (
                  <Link key={q.id} href={`/admin/quotes/${q.id}`} data-testid={`link-quote-${q.id}`}>
                    <div className="flex items-center justify-between rounded-md hover-elevate px-2.5 py-2 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-purple-400" />
                        <div>
                          <p className="text-xs font-medium">Quote · £{Math.round((q.est_total ?? 0) / 100).toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">{formatDateShort(q.created_at)}</p>
                          {Array.isArray(q.reassignment_history) && q.reassignment_history.length > 0 && (
                            <div className="mt-0.5 space-y-0.5" data-testid={`text-reassignment-history-quote-${q.id}`}>
                              {q.reassignment_history.map((entry: {customerName: string; timestamp: string; staffName?: string}, i: number) => (
                                <p key={i} className="text-[10px] text-amber-500 dark:text-amber-400">
                                  Previously: {entry.customerName}
                                  <span className="text-muted-foreground ml-1">
                                    ({new Date(entry.timestamp).toLocaleDateString()}{entry.staffName ? ` · ${entry.staffName}` : ""})
                                  </span>
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={q.status ?? "new"} />
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                ))}
                {conversations.map((c: any) => (
                  <Link key={c.id} href={`/admin/ai-conversations?session=${c.session_id}`} data-testid={`link-convo-${c.id}`}>
                    <div className="flex items-center justify-between rounded-md hover-elevate px-2.5 py-2 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Bot className="w-3.5 h-3.5 text-cyan-400" />
                        <div>
                          <p className="text-xs font-medium">AI Chat · {c.status?.replace(/_/g, " ")}</p>
                          <p className="text-[10px] text-muted-foreground">{formatDateShort(c.created_at)}</p>
                          {Array.isArray(c.reassignment_history) && c.reassignment_history.length > 0 && (
                            <div className="mt-0.5 space-y-0.5" data-testid={`text-reassignment-history-convo-${c.id}`}>
                              {c.reassignment_history.map((entry: {customerName: string; timestamp: string; staffName?: string}, i: number) => (
                                <p key={i} className="text-[10px] text-amber-500 dark:text-amber-400">
                                  Previously: {entry.customerName}
                                  <span className="text-muted-foreground ml-1">
                                    ({new Date(entry.timestamp).toLocaleDateString()}{entry.staffName ? ` · ${entry.staffName}` : ""})
                                  </span>
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
                {leads.length === 0 && quotes.length === 0 && conversations.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No linked records yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column: timeline + notes panel */}
          <div className="lg:col-span-2 space-y-5">
            {/* Add note form */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5" />
                  Add Note
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Select value={noteType} onValueChange={v => setNoteType(v as NoteType)}>
                    <SelectTrigger data-testid="select-note-type" className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Note will be added to all linked leads and quotes automatically.
                  </p>
                </div>

                <Textarea
                  placeholder="Write a note..."
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  className="resize-none min-h-[80px]"
                  data-testid="textarea-note"
                />
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={!noteText.trim() || addNoteMutation.isPending}
                  data-testid="button-add-note"
                >
                  {addNoteMutation.isPending ? (
                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
                  ) : (
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Save Note
                </Button>
              </CardContent>
            </Card>

            {/* Notes Panel */}
            {notes.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <StickyNote className="w-3.5 h-3.5" />
                    Notes
                    <Badge className="ml-auto text-[10px] bg-muted text-muted-foreground no-default-active-elevate">
                      {notes.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {notes.map(n => {
                    const NoteIcon = NOTE_TYPE_ICONS[n.noteType] ?? StickyNote;
                    return (
                      <div key={n.id} className="flex gap-3 group" data-testid={`note-item-${n.id}`}>
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                          <NoteIcon className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <Badge className="text-[10px] bg-muted text-muted-foreground no-default-active-elevate capitalize">
                              {NOTE_TYPE_LABELS[n.noteType] ?? n.noteType}
                            </Badge>
                            {n.authorName && (
                              <span className="text-[11px] text-muted-foreground">by {n.authorName}</span>
                            )}
                            <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                              {n.createdAt ? new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}
                            </span>
                          </div>
                          <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{n.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Artwork Proofs */}
            <Card data-testid="panel-artwork-proofs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Artwork Proofs
                  {artworkProofs.length > 0 && (
                    <Badge className="ml-auto text-[10px] bg-muted text-muted-foreground no-default-active-elevate">
                      {artworkProofs.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload new proof */}
                <div className="space-y-2">
                  <input
                    ref={artworkInputRef}
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/jpg"
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      setArtworkSelectedFiles(prev => {
                        const existing = new Set(prev.map(f => f.name + f.size));
                        return [...prev, ...files.filter(f => !existing.has(f.name + f.size))];
                      });
                    }}
                    data-testid="input-artwork-files"
                  />

                  {artworkSelectedFiles.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => artworkInputRef.current?.click()}
                      className="w-full flex flex-col items-center gap-2 py-5 rounded-md border-2 border-dashed border-border text-muted-foreground hover-elevate transition-colors"
                      data-testid="button-artwork-upload"
                    >
                      <Upload className="w-5 h-5" />
                      <span className="text-xs font-medium">Click to choose artwork files</span>
                      <span className="text-[11px]">PNG or JPEG · up to 20 MB each</span>
                    </button>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{artworkSelectedFiles.length} file{artworkSelectedFiles.length !== 1 ? "s" : ""} selected</span>
                        <button
                          type="button"
                          onClick={() => artworkInputRef.current?.click()}
                          className="text-[11px] text-[hsl(86_53%_60%)] hover:underline"
                          data-testid="button-artwork-add-more"
                        >
                          + Add more
                        </button>
                      </div>
                      <div className="space-y-1">
                        {artworkSelectedFiles.map((file, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md bg-muted/50 border">
                            <ImageIcon className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="flex-1 truncate font-medium">{file.name}</span>
                            <span className="text-muted-foreground shrink-0 text-[11px]">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                            <button
                              type="button"
                              onClick={() => setArtworkSelectedFiles(prev => prev.filter((_, j) => j !== i))}
                              className="text-muted-foreground hover:text-foreground shrink-0"
                              data-testid={`button-remove-artwork-file-${i}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={handleArtworkCreateProof}
                          disabled={artworkUploading}
                          data-testid="button-create-proof-round"
                        >
                          {artworkUploading ? (
                            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
                          ) : (
                            <Upload className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          {artworkUploading ? "Uploading…" : "Create proof round"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setArtworkSelectedFiles([]); if (artworkInputRef.current) artworkInputRef.current.value = ""; }}
                          disabled={artworkUploading}
                          data-testid="button-cancel-artwork-upload"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Existing proof rounds */}
                {artworkProofs.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No artwork proofs yet. Upload files above to create the first proof round.</p>
                ) : (
                  <div className="space-y-3">
                    {(showEarlierRounds ? artworkProofs : artworkProofs.slice(0, 1)).map((proof, idx) => {
                      const isExpanded = artworkExpanded[proof.id] ?? (showEarlierRounds ? false : true);
                      const proofStatusMap: Record<string, string> = {
                        pending_review: "bg-amber-500/20 text-amber-400 border-amber-500/30",
                        sent: "bg-blue-500/20 text-blue-400 border-blue-500/30",
                        approved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                        changes_requested: "bg-red-500/15 text-red-400 border-red-500/30",
                      };
                      const statusLabel: Record<string, string> = {
                        pending_review: "Pending Review",
                        sent: "Sent to Customer",
                        approved: "Approved",
                        changes_requested: "Changes Requested",
                      };
                      return (
                        <div key={proof.id} className="border rounded-md" data-testid={`panel-proof-${proof.id}`}>
                          {/* Proof header row */}
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover-elevate rounded-md"
                            onClick={() => setArtworkExpanded(prev => ({ ...prev, [proof.id]: !isExpanded }))}
                            data-testid={`button-proof-toggle-${proof.id}`}
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs font-medium flex-1">
                              Round {artworkProofs.length - idx} · {proof.files.length} file{proof.files.length !== 1 ? "s" : ""}
                            </span>
                            <Badge className={`text-[10px] border no-default-active-elevate ${proofStatusMap[proof.status] ?? "bg-muted text-muted-foreground border-border"}`}>
                              {statusLabel[proof.status] ?? proof.status}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
                              {formatDateShort(proof.createdAt)}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="px-3 pb-3 space-y-3 border-t">
                              {/* Send to customer — primary action, shown at the top */}
                              <div className="pt-3 flex items-center gap-2 flex-wrap">
                                <Button
                                  size="sm"
                                  onClick={() => sendProofEmailMutation.mutate(proof.id)}
                                  disabled={!customer.email || sendProofEmailMutation.isPending}
                                  title={!customer.email ? "Customer has no email address — add one to their profile first" : undefined}
                                  data-testid={`button-send-proof-email-${proof.id}`}
                                >
                                  {sendProofEmailMutation.isPending ? (
                                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
                                  ) : (
                                    <Send className="w-3.5 h-3.5 mr-1.5" />
                                  )}
                                  {proof.sentAt ? "Resend to customer" : "Send to customer"}
                                </Button>
                                {proof.sentAt && (
                                  <span className="text-[11px] text-muted-foreground">
                                    Last sent {formatDate(proof.sentAt)}
                                  </span>
                                )}
                                {!customer.email && (
                                  <span className="text-[11px] text-amber-400">
                                    No email address on record
                                  </span>
                                )}
                                <a
                                  href={`/artwork-approval/${proof.token}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-[hsl(86_53%_60%)] hover:underline ml-auto"
                                  data-testid={`link-proof-preview-${proof.id}`}
                                >
                                  Preview customer view <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              </div>

                              {/* Thumbnail strip */}
                              <div className="flex flex-wrap gap-2">
                                {proof.files.map((file, fi) => {
                                  const isPdf = file.name.toLowerCase().endsWith(".pdf");
                                  return (
                                    <div key={fi} className="relative group" data-testid={`thumb-proof-${proof.id}-${fi}`}>
                                      {isPdf ? (
                                        <a
                                          href={file.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          title={file.name}
                                          className="flex flex-col items-center justify-center w-28 h-28 rounded-md border bg-muted text-muted-foreground hover-elevate gap-1"
                                        >
                                          <FileText className="w-6 h-6" />
                                          <span className="text-[9px] truncate w-full text-center px-1">{file.name}</span>
                                        </a>
                                      ) : (
                                        <button
                                          className="relative w-28 h-28 rounded-md border overflow-hidden bg-muted focus:outline-none"
                                          onClick={() => setArtworkLightbox(file.url)}
                                          title={file.name}
                                          data-testid={`button-lightbox-${proof.id}-${fi}`}
                                        >
                                          <img
                                            src={file.url}
                                            alt={file.name}
                                            className="w-full h-full object-cover"
                                          />
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <ZoomIn className="w-5 h-5 text-white" />
                                          </div>
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Customer approval response */}
                              {proof.customerNotes && (
                                <div className="rounded-md bg-muted/50 px-3 py-2 space-y-1">
                                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Customer response</p>
                                  <p className="text-xs leading-relaxed" data-testid={`text-customer-response-${proof.id}`}>{proof.customerNotes}</p>
                                  {proof.respondedAt && (
                                    <p className="text-[11px] text-muted-foreground">{formatDate(proof.respondedAt)}</p>
                                  )}
                                </div>
                              )}

                              {/* Discussion thread */}
                              <div className="border-t pt-3">
                                <ProofChatPanel proofId={proof.id} customerName={customer.name} />
                              </div>

                              {/* Admin notes */}
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Admin notes (internal only)</Label>
                                <Textarea
                                  className="resize-none text-xs min-h-[60px]"
                                  placeholder="Internal notes for this proof round..."
                                  value={artworkAdminNotes[proof.id] ?? ""}
                                  onChange={e => setArtworkAdminNotes(prev => ({ ...prev, [proof.id]: e.target.value }))}
                                  data-testid={`textarea-proof-notes-${proof.id}`}
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateProofNotesMutation.mutate({ proofId: proof.id, adminNotes: artworkAdminNotes[proof.id] ?? "" })}
                                  disabled={updateProofNotesMutation.isPending}
                                  data-testid={`button-save-proof-notes-${proof.id}`}
                                >
                                  <Save className="w-3.5 h-3.5 mr-1.5" />
                                  Save notes
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {artworkProofs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setShowEarlierRounds(v => !v)}
                        className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 py-1"
                        data-testid="button-toggle-earlier-rounds"
                      >
                        {showEarlierRounds ? (
                          <><ChevronUp className="w-3.5 h-3.5" /> Hide earlier rounds</>
                        ) : (
                          <><ChevronDown className="w-3.5 h-3.5" /> Show {artworkProofs.length - 1} earlier round{artworkProofs.length - 1 !== 1 ? "s" : ""}</>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* WrapGen 3D Renders */}
            {(() => {
              const quotesWithWrapgen = quotes.filter((q: any) => q.wrapgen_preview_url);
              const quotesWithoutWrapgen = quotes.filter((q: any) => !q.wrapgen_preview_url);
              return (
                <Card data-testid="panel-wrapgen-renders">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ExternalLink className="w-3.5 h-3.5" />
                      WrapGen 3D Renders
                      {quotesWithWrapgen.length > 0 && (
                        <Badge className="ml-auto text-[10px] bg-muted text-muted-foreground no-default-active-elevate">
                          {quotesWithWrapgen.length}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">

                    {/* Existing linked renders */}
                    {quotesWithWrapgen.length > 0 && (
                      <div className="space-y-3">
                        {quotesWithWrapgen.map((q: any) => (
                          <div key={q.id} className="border rounded-md p-3 space-y-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link href={`/admin/quotes/${q.id}`} className="text-xs font-medium hover:underline">
                                {q.user_name || q.email || "Quote"}
                              </Link>
                              <Badge variant="secondary" className="text-[10px] no-default-active-elevate capitalize">
                                {(q.status ?? "").replace(/_/g, " ")}
                              </Badge>
                              {q.artwork_approved_at ? (
                                <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 no-default-active-elevate gap-1 ml-auto">
                                  <CheckCircle className="w-3 h-3" />
                                  Approved
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] no-default-active-elevate gap-1.5 ml-auto">
                                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                                  Awaiting Approval
                                </Badge>
                              )}
                            </div>
                            {q.artwork_approved_at && (
                              <p className="text-[11px] text-muted-foreground">
                                Approved by {q.artwork_approved_by || "customer"} ·{" "}
                                {new Date(q.artwork_approved_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                              </p>
                            )}
                            <div className="flex gap-2">
                              <Input
                                readOnly={q.artwork_approved_at}
                                value={q.artwork_approved_at ? q.wrapgen_preview_url : (wrapgenEditUrls[q.id] ?? q.wrapgen_preview_url)}
                                onChange={e => !q.artwork_approved_at && setWrapgenEditUrls(prev => ({ ...prev, [q.id]: e.target.value }))}
                                className="text-xs font-mono"
                                data-testid={`input-wrapgen-url-${q.id}`}
                              />
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => { navigator.clipboard.writeText(q.wrapgen_preview_url); toast({ title: "URL copied" }); }}
                                data-testid={`button-copy-wrapgen-${q.id}`}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                              <a href={q.wrapgen_preview_url} target="_blank" rel="noopener noreferrer">
                                <Button size="icon" variant="outline" data-testid={`button-open-wrapgen-${q.id}`}>
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                              </a>
                              {!q.artwork_approved_at && (wrapgenEditUrls[q.id] ?? "") !== q.wrapgen_preview_url && (wrapgenEditUrls[q.id] ?? "") !== "" && (
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() => saveWrapgenUrlMutation.mutate({ quoteId: q.id, previewUrl: wrapgenEditUrls[q.id] })}
                                  disabled={saveWrapgenUrlMutation.isPending}
                                  data-testid={`button-save-wrapgen-${q.id}`}
                                >
                                  {saveWrapgenUrlMutation.isPending
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <Save className="w-4 h-4" />}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Link new render — single button, dropdown only when multiple unlinked quotes */}
                    {(() => {
                      if (quotesWithoutWrapgen.length === 0 && quotes.length > 0) return null;

                      const targetQuoteId = quotesWithoutWrapgen.length === 1
                        ? quotesWithoutWrapgen[0].id
                        : wrapgenSelectedQuoteId;

                      return (
                        <div className="space-y-3">
                          {quotes.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              No quotes linked yet. Open WrapGen to start the artwork — once a quote is created for this customer, it will auto-link back here.
                            </p>
                          ) : quotesWithoutWrapgen.length > 1 && (
                            <Select value={wrapgenSelectedQuoteId} onValueChange={setWrapgenSelectedQuoteId}>
                              <SelectTrigger className="text-xs" data-testid="select-wrapgen-quote">
                                <SelectValue placeholder="Select which quote to link…" />
                              </SelectTrigger>
                              <SelectContent>
                                {quotesWithoutWrapgen.map((q: any) => (
                                  <SelectItem key={q.id} value={q.id} className="text-xs">
                                    {q.user_name || q.email || "Quote"} — £{Number(q.est_total ?? 0).toLocaleString("en-GB")} · {(q.status ?? "").replace(/_/g, " ")}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}

                          <div className="flex gap-2">
                            {openingWrapgenForQuoteId && openingWrapgenForQuoteId === targetQuoteId ? (
                              <Badge className="text-[11px] gap-1.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 no-default-active-elevate py-1.5 px-3">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Waiting for WrapGen to call back…
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => targetQuoteId
                                  ? generateWrapgenLinkMutation.mutate(targetQuoteId)
                                  : window.open("http://wrapgen.co.uk", "_blank")}
                                disabled={generateWrapgenLinkMutation.isPending || (quotesWithoutWrapgen.length > 1 && !wrapgenSelectedQuoteId)}
                                data-testid="button-open-wrapgen"
                              >
                                {generateWrapgenLinkMutation.isPending
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                  : <ExternalLink className="w-3.5 h-3.5 mr-1.5" />}
                                Open in WrapGen
                              </Button>
                            )}
                          </div>

                          {/* Manual paste fallback */}
                          {quotes.length > 0 && (
                            <details className="group">
                              <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground select-none list-none flex items-center gap-1">
                                <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                                Paste URL manually instead
                              </summary>
                              <div className="flex gap-2 mt-1.5">
                                <Input
                                  placeholder="https://www.wrapgen.co.uk/preview/..."
                                  value={wrapgenQuoteInputs[targetQuoteId] ?? ""}
                                  onChange={e => targetQuoteId && setWrapgenQuoteInputs(prev => ({ ...prev, [targetQuoteId]: e.target.value }))}
                                  className="text-xs"
                                  data-testid="input-wrapgen-manual"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => saveWrapgenUrlMutation.mutate({ quoteId: targetQuoteId, previewUrl: wrapgenQuoteInputs[targetQuoteId] ?? "" })}
                                  disabled={!targetQuoteId || !wrapgenQuoteInputs[targetQuoteId] || saveWrapgenUrlMutation.isPending}
                                  data-testid="button-save-wrapgen-manual"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </details>
                          )}
                        </div>
                      );
                    })()}

                  </CardContent>
                </Card>
              );
            })()}

            {/* Activity Timeline */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  Activity Timeline
                  <Badge className="ml-auto text-[10px] bg-muted text-muted-foreground no-default-active-elevate">
                    {timeline.length} events
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No activity recorded yet</p>
                ) : (
                  <div className="relative space-y-0">
                    {/* Vertical line */}
                    <div className="absolute left-[18px] top-0 bottom-0 w-px bg-border" />

                    {timeline.map((event, i) => {
                      const Icon = TIMELINE_ICONS[event.type] ?? StickyNote;
                      const colorClass = TIMELINE_COLORS[event.type] ?? "bg-muted text-muted-foreground";

                      return (
                        <div key={event.id} className="relative flex gap-3 pb-5" data-testid={`timeline-event-${i}`}>
                          {/* Icon bubble */}
                          <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 pt-1.5">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              {(event.type === "record_reassigned_in" || event.type === "record_reassigned_out") && event.relatedCustomerId && event.relatedCustomerName ? (
                                <p className="text-sm font-medium leading-tight" data-testid={`text-reassignment-title-${event.id}`}>
                                  {event.entityType === "lead" ? "Lead" : event.entityType === "quote" ? "Quote" : "AI chat"}
                                  {" "}
                                  {event.type === "record_reassigned_in" ? "moved from" : "moved to"}
                                  {" "}
                                  <Link
                                    href={`/admin/customers/${event.relatedCustomerId}`}
                                    className="text-[hsl(86_53%_60%)] hover:underline"
                                    data-testid={`link-reassignment-customer-${event.id}`}
                                  >
                                    {event.relatedCustomerName}
                                  </Link>
                                </p>
                              ) : (
                                <p className="text-sm font-medium leading-tight">{event.title}</p>
                              )}
                              <p className="text-[11px] text-muted-foreground shrink-0">{formatDate(event.timestamp)}</p>
                            </div>
                            {event.description && (
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-3">
                                {event.description}
                              </p>
                            )}
                            {event.author && (
                              <p className="text-[11px] text-muted-foreground mt-1">by {event.author}</p>
                            )}
                            {(event.entityType === "quote" || event.entityType === "lead") && event.entityId && event.type !== "record_reassigned_in" && event.type !== "record_reassigned_out" && (
                              <Link
                                href={event.entityType === "quote" ? `/admin/quotes/${event.entityId}` : `/admin/leads`}
                                className="inline-flex items-center gap-1 text-[11px] text-[hsl(86_53%_60%)] hover:underline mt-1"
                              >
                                View {event.entityType} <ExternalLink className="w-2.5 h-2.5" />
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Artwork lightbox */}
      {artworkLightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setArtworkLightbox(null)}
          data-testid="overlay-artwork-lightbox"
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <img
              src={artworkLightbox}
              alt="Artwork preview"
              className="max-w-full max-h-[85vh] object-contain rounded-md shadow-2xl"
              data-testid="img-artwork-lightbox"
            />
            <button
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover-elevate"
              onClick={() => setArtworkLightbox(null)}
              data-testid="button-close-lightbox"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Merge confirmation dialog */}
      <Dialog open={showMergeConfirm} onOpenChange={setShowMergeConfirm}>
        <DialogContent data-testid="dialog-merge-confirm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Confirm customer merge
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-1" asChild>
              <div className="space-y-1">
                {selectedMergeTarget && mergeKeepId && (
                  <p className="font-medium text-foreground">
                    <span className="text-destructive">
                      {mergeKeepId === id ? selectedMergeTarget.name : data?.customer.name}
                    </span>
                    {" will be removed. All records will move to "}
                    <span className="text-[hsl(86_53%_60%)]">
                      {mergeKeepId === id ? data?.customer.name : selectedMergeTarget.name}
                    </span>
                    .
                  </p>
                )}
                <p>This will permanently combine two customer records into one. The merge can be reversed from the Merge History panel.</p>
              </div>
            </DialogDescription>
          </DialogHeader>

          {selectedMergeTarget && mergeKeepId && (
            <div className="space-y-3 py-1">
              <div className="rounded-md bg-muted/50 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-[hsl(86_53%_60%)] shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-[hsl(86_53%_60%)]">Keep (surviving record)</p>
                    <p className="text-sm font-semibold">
                      {mergeKeepId === id ? data?.customer.name : selectedMergeTarget.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {mergeKeepId === id
                        ? [data?.customer.email, data?.customer.phone].filter(Boolean).join(" · ") || "No contact details"
                        : [selectedMergeTarget.email, selectedMergeTarget.phone].filter(Boolean).join(" · ") || "No contact details"
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-destructive shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-destructive">Remove (will be deleted)</p>
                    <p className="text-sm font-semibold">
                      {mergeKeepId === id ? selectedMergeTarget.name : data?.customer.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {mergeKeepId === id
                        ? [selectedMergeTarget.email, selectedMergeTarget.phone].filter(Boolean).join(" · ") || "No contact details"
                        : [data?.customer.email, data?.customer.phone].filter(Boolean).join(" · ") || "No contact details"
                      }
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                All leads, quotes, and conversations from the removed record will be reassigned to the surviving record. Contact details will be merged automatically.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMergeConfirm(false)}
              disabled={mergeMutation.isPending}
              data-testid="button-merge-cancel"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleMergeConfirm}
              disabled={mergeMutation.isPending}
              data-testid="button-merge-execute"
            >
              {mergeMutation.isPending ? (
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
              ) : (
                <Merge className="w-3.5 h-3.5 mr-1.5" />
              )}
              {mergeMutation.isPending ? "Merging..." : "Confirm merge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Live VRM Power System drawer */}
      <Sheet open={vrmDrawerOpen} onOpenChange={setVrmDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="drawer-power-system">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[hsl(86_53%_60%)]" />
              48V Power System
            </SheetTitle>
            <SheetDescription>
              Live data from Victron VRM
              {customer.vrmInstallationId ? ` · Installation ${customer.vrmInstallationId}` : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-4">
            {vrmQuery.isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="status-vrm-loading">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading live power data...
              </div>
            )}

            {vrmQuery.isError && (
              <div className="space-y-3" data-testid="status-vrm-error">
                <div className="flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{(vrmQuery.error as Error)?.message || "Could not load power data."}</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => vrmQuery.refetch()} data-testid="button-vrm-retry">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Try again
                </Button>
              </div>
            )}

            {vrmQuery.isSuccess && (() => {
              const d = vrmQuery.data.dashboard;
              const hasAny = d && [
                d.grid.power, d.acLoads.power, d.battery.temperature, d.battery.soc, d.dcPower.power,
              ].some((v) => v !== null && v !== undefined);

              if (!hasAny) {
                return (
                  <p className="text-sm text-muted-foreground" data-testid="status-vrm-empty">
                    No live readings are currently available for this installation.
                  </p>
                );
              }

              return (
                <div className="space-y-4" data-testid="vrm-dashboard">
                  {/* Top row: Grid -> System -> Battery */}
                  <div className="grid grid-cols-3 items-stretch gap-2">
                    <Card className="p-3 flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <PlugZap className="w-3.5 h-3.5" />
                        <span className="text-xs">Grid</span>
                      </div>
                      <div className="text-xl font-semibold leading-none" data-testid="text-vrm-grid-power">
                        {d.grid.power ?? "—"}
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-tight">
                        {[d.grid.voltage, d.grid.current].filter(Boolean).join(" · ") || "\u00A0"}
                      </div>
                    </Card>

                    <div className="flex flex-col items-center justify-center gap-1.5 px-1">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[hsl(86_53%_60%)]/40 bg-[hsl(86_53%_60%)]/10">
                        <Cpu className="w-5 h-5 text-[hsl(86_53%_60%)]" />
                      </div>
                      {d.systemState && (
                        <Badge variant="secondary" className="text-[10px]" data-testid="badge-vrm-state">
                          {d.systemState}
                        </Badge>
                      )}
                    </div>

                    <Card className="p-3 flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Thermometer className="w-3.5 h-3.5" />
                        <span className="text-xs">Battery</span>
                      </div>
                      <div className="text-xl font-semibold leading-none" data-testid="text-vrm-battery-temp">
                        {d.battery.temperature ?? d.battery.soc ?? "—"}
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-tight">
                        {d.battery.soc ? `${d.battery.soc} charge` : "\u00A0"}
                      </div>
                    </Card>
                  </div>

                  {/* Flow connector */}
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <div className="h-px flex-1 bg-border" />
                    <Activity className="w-3.5 h-3.5" />
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  {/* Bottom row: AC Loads · Charging · DC Power */}
                  <div className="grid grid-cols-3 gap-2">
                    <Card className="p-3 flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Power className="w-3.5 h-3.5" />
                        <span className="text-xs">AC Loads</span>
                      </div>
                      <div className="text-xl font-semibold leading-none" data-testid="text-vrm-ac-loads">
                        {d.acLoads.power ?? "—"}
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-tight">
                        {d.acLoads.frequency ?? "\u00A0"}
                      </div>
                    </Card>

                    <Card className="p-3 flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <BatteryCharging className="w-3.5 h-3.5" />
                        <span className="text-xs">Charging</span>
                      </div>
                      <div className="text-xl font-semibold leading-none" data-testid="text-vrm-charging">
                        {d.battery.soc ?? "—"}
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-tight">
                        {d.battery.power ?? "\u00A0"}
                      </div>
                    </Card>

                    <Card className="p-3 flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Gauge className="w-3.5 h-3.5" />
                        <span className="text-xs">DC Power</span>
                      </div>
                      <div className="text-xl font-semibold leading-none" data-testid="text-vrm-dc-power">
                        {d.dcPower.power ?? "—"}
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-tight">
                        {[d.dcPower.voltage, d.dcPower.current].filter(Boolean).join(" · ") || "\u00A0"}
                      </div>
                    </Card>
                  </div>

                  {/* Detail rows */}
                  <div className="rounded-md border divide-y">
                    {[
                      { label: "Battery state of charge", value: d.battery.soc },
                      { label: "Battery voltage", value: d.battery.voltage },
                      { label: "Battery current", value: d.battery.current },
                      { label: "Battery temperature", value: d.battery.temperature },
                      { label: "Grid frequency", value: d.grid.frequency },
                    ].filter((r) => r.value).map((r) => (
                      <div key={r.label} className="flex items-center justify-between gap-3 px-3 py-2">
                        <span className="text-xs text-muted-foreground">{r.label}</span>
                        <span className="text-sm font-medium text-foreground shrink-0">{r.value}</span>
                      </div>
                    ))}
                  </div>

                  {vrmQuery.data.updatedAt && (() => {
                    const ageMs = Date.now() - vrmQuery.data.updatedAt * 1000;
                    const stale = ageMs > 2 * 60 * 60 * 1000;
                    return (
                      <div
                        className={`flex items-center justify-center gap-1.5 text-center font-medium ${stale ? "text-orange-500 dark:text-orange-400" : "text-muted-foreground"}`}
                        data-testid="text-vrm-updated"
                      >
                        {stale && <AlertCircle className="w-4 h-4 shrink-0" />}
                        <span className="text-sm">
                          Last connected {new Date(vrmQuery.data.updatedAt * 1000).toLocaleString("en-GB")}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {vrmQuery.isSuccess && vrmQuery.data.dashboardUrl && (
              <Button variant="outline" size="sm" asChild className="w-full" data-testid="button-vrm-dashboard">
                <a href={vrmQuery.data.dashboardUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Open full VRM dashboard
                </a>
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
