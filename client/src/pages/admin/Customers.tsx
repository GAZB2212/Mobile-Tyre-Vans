import { useAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";
import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchJson, apiRequest, queryClient, parseMutationJson } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { AdminBackButton } from "@/components/AdminBackButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  Search,
  Mail,
  Phone,
  Building2,
  ChevronRight,
  FileText,
  Bot,
  AlertCircle,
  UserCheck,
  X,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ExternalLink,
  StickyNote,
  PhoneCall,
  Coffee,
  CalendarDays,
  MoveRight,
  Loader2,
  Scissors,
  History,
  ArrowRightLeft,
  UserCircle,
  HelpCircle,
  Trash2,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface StaffMember {
  id: string;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName: string;
}

interface CustomerListItem {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  primaryStaffId?: string | null;
  primaryStaffName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  leadCount: number;
  quoteCount: number;
  convoCount: number;
  openFollowUpCount: number;
  lastActivityAt?: string | null;
  pipelineStatus?: string | null;
}

interface LinkedCustomerSummary {
  id: string;
  name: string;
  isNew: boolean;
  leadsLinked: number;
  quotesLinked: number;
  convosLinked: number;
}

interface CustomerNote {
  id: string;
  noteType: string;
  text: string;
  authorName?: string | null;
  createdAt?: string | null;
}

interface CustomerProfileData {
  customer: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    primaryStaffName?: string | null;
    createdAt?: string | null;
  };
  leads: Array<{ id: string; name?: string | null; status?: string | null; source?: string | null; created_at?: string | null; reassignment_history?: Array<{customerName: string; timestamp: string; staffName?: string}> | null }>;
  quotes: Array<{ id: string; user_name?: string | null; status?: string | null; created_at?: string | null; reassignment_history?: Array<{customerName: string; timestamp: string; staffName?: string}> | null }>;
  conversations: Array<{ id: string; contact_name?: string | null; status?: string | null; created_at?: string | null; reassignment_history?: Array<{customerName: string; timestamp: string; staffName?: string}> | null }>;
  notes: CustomerNote[];
}

const NOTE_TYPE_ICONS: Record<string, React.ElementType> = {
  call: PhoneCall,
  email: Mail,
  meeting: Coffee,
  general: StickyNote,
};

type RecordType = "lead" | "quote" | "conversation";

function MoveRecordDialog({
  recordType,
  recordId,
  recordLabel,
  sourceCustomerId,
  sourceCustomerName,
  sourceCustomerCompany,
  sourceCustomerEmail,
  sourceCustomerPhone,
  onMoved,
  onClose,
}: {
  recordType: RecordType;
  recordId: string;
  recordLabel: string;
  sourceCustomerId: string;
  sourceCustomerName: string;
  sourceCustomerCompany?: string | null;
  sourceCustomerEmail?: string | null;
  sourceCustomerPhone?: string | null;
  onMoved: (targetCustomerId: string) => void;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingCustomer, setPendingCustomer] = useState<{ id: string; name: string; email?: string | null; company?: string | null; phone?: string | null } | null>(null);

  useEffect(() => {
    if (!pendingCustomer) {
      inputRef.current?.focus();
    }
  }, [pendingCustomer]);

  const { data: customers = [], isLoading: searchLoading } = useQuery<CustomerListItem[]>({
    queryKey: ["/api/admin/customers", debouncedSearch],
    queryFn: () => {
      const params = debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : "";
      return fetchJson(`/api/admin/customers${params}`);
    },
    enabled: debouncedSearch.length >= 2,
  });

  const reassignMutation = useMutation({
    mutationFn: (targetCustomerId: string) =>
      apiRequest("PATCH", `/api/admin/records/${recordType}/${recordId}/reassign`, { targetCustomerId }).then(parseMutationJson),
    onSuccess: (_data: unknown, targetCustomerId: string) => {
      toast({ title: "Record moved", description: `${recordLabel} has been reassigned.` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers", sourceCustomerId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers", targetCustomerId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      onMoved(targetCustomerId);
    },
    onError: () => {
      toast({ title: "Failed to move record", description: "Please try again.", variant: "destructive" });
    },
  });

  const filteredCandidates = customers.filter(c => c.id !== sourceCustomerId);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-[60]"
        onClick={onClose}
        aria-hidden="true"
        data-testid="backdrop-move-dialog"
      />
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-full max-w-sm bg-background border rounded-md shadow-xl flex flex-col"
        role="dialog"
        aria-label="Move record to customer"
        data-testid="dialog-move-record"
      >
        <div className="flex items-start justify-between gap-3 p-4 border-b">
          <div>
            <p className="text-sm font-semibold">
              {pendingCustomer ? "Confirm move" : "Move to another customer"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[240px]">{recordLabel}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-move-dialog">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        {pendingCustomer ? (
          <div className="p-4 space-y-4" data-testid="section-move-confirm">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground w-8 shrink-0 pt-0.5">From:</span>
                <div className="rounded-md border px-3 py-2 flex-1 bg-muted/40">
                  <p className="text-sm font-medium" data-testid="text-move-source-customer">{sourceCustomerName}</p>
                  {(sourceCustomerCompany || sourceCustomerEmail || sourceCustomerPhone) && (
                    <p className="text-xs text-muted-foreground mt-0.5">{sourceCustomerCompany ?? sourceCustomerEmail ?? sourceCustomerPhone}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground w-8 shrink-0 pt-0.5">To:</span>
                <div className="rounded-md border px-3 py-2 flex-1">
                  <p className="text-sm font-medium" data-testid="text-move-target-customer">{pendingCustomer.name}</p>
                  {(pendingCustomer.company || pendingCustomer.email || pendingCustomer.phone) && (
                    <p className="text-xs text-muted-foreground mt-0.5">{pendingCustomer.company ?? pendingCustomer.email ?? pendingCustomer.phone}</p>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">This cannot be undone from this screen. Are you sure?</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPendingCustomer(null)}
                disabled={reassignMutation.isPending}
                data-testid="button-move-confirm-back"
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={() => reassignMutation.mutate(pendingCustomer.id)}
                disabled={reassignMutation.isPending}
                data-testid="button-move-confirm-submit"
              >
                {reassignMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  "Confirm Move"
                )}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  placeholder="Search customers…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="input-move-customer-search"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto max-h-64 px-3 pb-3 space-y-1">
              {debouncedSearch.length < 2 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Type at least 2 characters to search</p>
              ) : searchLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : filteredCandidates.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No customers found</p>
              ) : (
                filteredCandidates.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left rounded-md px-3 py-2 hover-elevate active-elevate-2 transition-colors"
                    onClick={() => setPendingCustomer({ id: c.id, name: c.name, email: c.email, company: c.company, phone: c.phone })}
                    data-testid={`button-move-to-customer-${c.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        {(c.company || c.email || c.phone) && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.company ?? c.email ?? c.phone}</p>
                        )}
                      </div>
                      <MoveRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function formatReviewDate(date: string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function CustomerReviewSheet({
  customerId,
  onClose,
}: {
  customerId: string;
  onClose: () => void;
}) {
  const [, navigate] = useLocation();
  const [moveTarget, setMoveTarget] = useState<{ type: RecordType; id: string; label: string } | null>(null);

  const { data, isLoading } = useQuery<CustomerProfileData>({
    queryKey: ["/api/admin/customers", customerId],
    queryFn: () => fetchJson(`/api/admin/customers/${customerId}`),
  });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      if (moveTarget) { setMoveTarget(null); return; }
      onClose();
    }
  }, [onClose, moveTarget]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const customer = data?.customer;
  const leads = data?.leads ?? [];
  const quotes = data?.quotes ?? [];
  const conversations = data?.conversations ?? [];
  const notes = data?.notes ?? [];
  const recentNotes = notes.slice(0, 3);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
        data-testid="backdrop-review-sheet"
      />

      {/* Side panel */}
      <div
        className="fixed top-0 right-0 h-full w-full max-w-md bg-background border-l shadow-xl z-50 flex flex-col"
        role="dialog"
        aria-label="Customer review"
        data-testid="panel-customer-review"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 border-b shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[hsl(86_45%_51%/0.12)] flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-[hsl(86_53%_60%)]">
                {customer ? customer.name.charAt(0).toUpperCase() : "?"}
              </span>
            </div>
            <div className="min-w-0">
              {customer ? (
                <>
                  <p className="font-semibold text-sm truncate" data-testid="text-review-customer-name">{customer.name}</p>
                  {(customer.company || customer.email || customer.phone) && (
                    <p className="text-xs text-muted-foreground truncate">{customer.company || customer.email || customer.phone}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Loading…</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/admin/customers/${customerId}`)}
              data-testid="button-open-full-profile"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Full profile
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              data-testid="button-close-review-sheet"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : !customer ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">Could not load customer details.</p>
            </div>
          ) : (
            <>
              {/* Contact info */}
              <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Contact</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-2">
                  {customer.email && (
                    <a
                      href={`mailto:${customer.email}`}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="link-review-email"
                    >
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{customer.email}</span>
                    </a>
                  )}
                  {customer.phone && (
                    <a
                      href={`tel:${customer.phone}`}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="link-review-phone"
                    >
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      {customer.phone}
                    </a>
                  )}
                  {!customer.email && !customer.phone && (
                    <p className="text-xs text-muted-foreground italic">No contact details on file</p>
                  )}
                  {customer.primaryStaffName && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <UserCheck className="w-3.5 h-3.5 shrink-0" />
                      {customer.primaryStaffName}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Linked records */}
              <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Linked Records</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-1">
                  {leads.length === 0 && quotes.length === 0 && conversations.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No linked records yet</p>
                  )}

                  {leads.map(lead => (
                    <div
                      key={lead.id}
                      className="flex items-start justify-between gap-2 py-1"
                      data-testid={`row-review-lead-${lead.id}`}
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <Users className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm truncate">{lead.name ?? "Lead"}</span>
                            {lead.status && (
                              <Badge className="text-[10px] shrink-0 no-default-active-elevate">
                                {lead.status.replace(/_/g, " ")}
                              </Badge>
                            )}
                          </div>
                          {Array.isArray(lead.reassignment_history) && lead.reassignment_history.length > 0 && (
                            <div className="mt-0.5 space-y-0.5" data-testid={`text-reassignment-history-lead-${lead.id}`}>
                              {lead.reassignment_history.map((entry, i) => (
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-xs h-7 px-2"
                        onClick={() => setMoveTarget({ type: "lead", id: lead.id, label: `Lead — ${lead.name ?? lead.id}` })}
                        data-testid={`button-move-lead-${lead.id}`}
                      >
                        <MoveRight className="w-3 h-3 mr-1" />
                        Move to…
                      </Button>
                    </div>
                  ))}

                  {quotes.map(quote => (
                    <div
                      key={quote.id}
                      className="flex items-start justify-between gap-2 py-1"
                      data-testid={`row-review-quote-${quote.id}`}
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm truncate">{quote.user_name ?? "Quote"}</span>
                            {quote.status && (
                              <Badge className="text-[10px] shrink-0 no-default-active-elevate">
                                {quote.status.replace(/_/g, " ")}
                              </Badge>
                            )}
                          </div>
                          {Array.isArray(quote.reassignment_history) && quote.reassignment_history.length > 0 && (
                            <div className="mt-0.5 space-y-0.5" data-testid={`text-reassignment-history-quote-${quote.id}`}>
                              {quote.reassignment_history.map((entry, i) => (
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-xs h-7 px-2"
                        onClick={() => setMoveTarget({ type: "quote", id: quote.id, label: `Quote — ${quote.user_name ?? quote.id}` })}
                        data-testid={`button-move-quote-${quote.id}`}
                      >
                        <MoveRight className="w-3 h-3 mr-1" />
                        Move to…
                      </Button>
                    </div>
                  ))}

                  {conversations.map(convo => (
                    <div
                      key={convo.id}
                      className="flex items-start justify-between gap-2 py-1"
                      data-testid={`row-review-convo-${convo.id}`}
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <Bot className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm truncate">{convo.contact_name ?? "AI chat"}</span>
                            {convo.status && (
                              <Badge className="text-[10px] shrink-0 no-default-active-elevate">
                                {convo.status.replace(/_/g, " ")}
                              </Badge>
                            )}
                          </div>
                          {Array.isArray(convo.reassignment_history) && convo.reassignment_history.length > 0 && (
                            <div className="mt-0.5 space-y-0.5" data-testid={`text-reassignment-history-convo-${convo.id}`}>
                              {convo.reassignment_history.map((entry, i) => (
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-xs h-7 px-2"
                        onClick={() => setMoveTarget({ type: "conversation", id: convo.id, label: `Chat — ${convo.contact_name ?? convo.id}` })}
                        data-testid={`button-move-convo-${convo.id}`}
                      >
                        <MoveRight className="w-3 h-3 mr-1" />
                        Move to…
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Recent notes */}
              <Card>
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Recent Notes</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 space-y-2">
                  {recentNotes.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No notes yet</p>
                  ) : (
                    recentNotes.map(note => {
                      const NoteIcon = NOTE_TYPE_ICONS[note.noteType] ?? StickyNote;
                      return (
                        <div key={note.id} className="space-y-0.5" data-testid={`note-review-${note.id}`}>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <NoteIcon className="w-3 h-3 shrink-0" />
                            <span>{note.authorName ?? "Staff"}</span>
                            <span>·</span>
                            <span>{formatReviewDate(note.createdAt)}</span>
                          </div>
                          <p className="text-xs text-foreground line-clamp-2">{note.text}</p>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <div className="pt-1">
                <p className="text-[11px] text-muted-foreground text-center">
                  Customer since {formatReviewDate(customer.createdAt)}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer CTA */}
        <div className="p-4 border-t shrink-0">
          <Button
            className="w-full"
            onClick={() => navigate(`/admin/customers/${customerId}`)}
            data-testid="button-review-open-profile"
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            Open full profile
          </Button>
        </div>
      </div>

      {/* Move record dialog — rendered outside the side panel so it stacks above z-50 */}
      {moveTarget && (
        <MoveRecordDialog
          recordType={moveTarget.type}
          recordId={moveTarget.id}
          recordLabel={moveTarget.label}
          sourceCustomerId={customerId}
          sourceCustomerName={customer?.name ?? "Unknown"}
          sourceCustomerCompany={customer?.company}
          sourceCustomerEmail={customer?.email}
          sourceCustomerPhone={customer?.phone}
          onMoved={() => setMoveTarget(null)}
          onClose={() => setMoveTarget(null)}
        />
      )}
    </>
  );
}

interface BackfillResult {
  ok: boolean;
  customersCreated: number;
  leadsLinked: number;
  quotesLinked: number;
  convosLinked: number;
  failedCount: number;
  linkedCustomers: LinkedCustomerSummary[];
}

interface MergedCustomerEntry {
  id: string;
  name: string;
  duplicatesAbsorbed: number;
  leadsRepointed: number;
  quotesRepointed: number;
  convosRepointed: number;
}

interface DeduplicateResult {
  ok: boolean;
  mergedCount: number;
  failedCount: number;
  errors: string[];
  mergedCustomers: MergedCustomerEntry[];
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
  splitBy: string | null;
  mergedAt: string | null;
  splitAt: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  contacted: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  qualified: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  converted: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  awaiting_deposit: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  deposit_taken: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  in_build: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  in_workshop: "bg-red-500/15 text-red-300 border-red-500/30",
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  closed: "bg-muted text-muted-foreground border-border",
  dead: "bg-red-500/10 text-red-400 border-red-500/20",
};

function formatDate(date: string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function AdminCustomers() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth() as {
    user: User | undefined;
    isAuthenticated: boolean;
    isLoading: boolean;
  };
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [staffFilter, setStaffFilter] = useState<string>("");
  const [syncSummary, setSyncSummary] = useState<BackfillResult | null>(null);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [showAllSyncedCustomers, setShowAllSyncedCustomers] = useState(false);
  const [mergeSummary, setMergeSummary] = useState<DeduplicateResult | null>(null);
  const [mergeSummaryExpanded, setMergeSummaryExpanded] = useState(false);
  const [showAllMergedCustomers, setShowAllMergedCustomers] = useState(false);
  const [reviewCustomerId, setReviewCustomerId] = useState<string | null>(null);
  const [attentionFilter, setAttentionFilter] = useState(false);
  const [showMergeHistory, setShowMergeHistory] = useState(false);
  const [splittingId, setSplittingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerListItem | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const NEW_CUSTOMERS_KEY = "new-customers-count";

  useEffect(() => {
    sessionStorage.removeItem(NEW_CUSTOMERS_KEY);
    window.dispatchEvent(new Event("new-customers-updated"));
  }, []);

  const SYNC_LIST_CAP = 20;
  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({ title: "Unauthorized", variant: "destructive" });
      setTimeout(() => { window.location.href = "/login"; }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  useEffect(() => {
    if (user && (!user.adminRole || user.adminRole === "none")) {
      toast({ title: "Access Denied", variant: "destructive" });
      setTimeout(() => { window.location.href = "/"; }, 1000);
    }
  }, [user, toast]);

  const { data: staffList = [] } = useQuery<StaffMember[]>({
    queryKey: ["/api/admin/staff"],
    enabled: !!(user?.adminRole && user.adminRole !== "none"),
  });

  const MERGE_LIST_CAP = 20;

  const { data: mergeHistory = [], isLoading: mergeHistoryLoading } = useQuery<MergeHistoryEntry[]>({
    queryKey: ["/api/admin/customers/merge-history"],
    queryFn: () => fetchJson("/api/admin/customers/merge-history"),
    enabled: !!(user?.adminRole && user.adminRole !== "none") && showMergeHistory,
  });

  const splitMutation = useMutation<{ ok: boolean; newCustomerId: string }, Error, string>({
    mutationFn: (historyId: string) =>
      apiRequest("POST", `/api/admin/customers/split/${historyId}`).then(parseMutationJson),
    onSuccess: (data) => {
      setSplittingId(null);
      toast({
        title: "Merge reversed",
        description: "The customer has been recreated and their records re-linked.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers/merge-history"] });
      setReviewCustomerId(data.newCustomerId);
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

  const deleteCustomerMutation = useMutation<{ ok: boolean }, Error, string>({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/admin/customers/${id}`).then(parseMutationJson),
    onSuccess: () => {
      setDeleteTarget(null);
      setDeleteConfirmText("");
      toast({ title: "Customer deleted", description: "The customer profile has been permanently removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
    },
    onError: () => {
      toast({ title: "Delete failed", description: "Could not delete the customer. Please try again.", variant: "destructive" });
    },
  });

  const deduplicateMutation = useMutation<DeduplicateResult, Error>({
    mutationFn: () =>
      apiRequest("POST", "/api/admin/customers/deduplicate").then(parseMutationJson<DeduplicateResult>),
    onSuccess: (data) => {
      setMergeSummary(data);
      setMergeSummaryExpanded(true);
      setShowAllMergedCustomers(false);
      if (data.failedCount > 0) {
        toast({
          title: "Merge complete with errors",
          description: `${data.failedCount} record${data.failedCount !== 1 ? "s" : ""} could not be merged (see summary below).`,
          variant: "destructive",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers/merge-history"] });
    },
    onError: () => {
      toast({ title: "Deduplication failed", description: "Could not run deduplication. Please try again.", variant: "destructive" });
    },
  });

  const backfillMutation = useMutation<BackfillResult, Error>({
    mutationFn: () =>
      apiRequest("POST", "/api/admin/customers/backfill").then(parseMutationJson<BackfillResult>),
    onSuccess: (data) => {
      const hasFailed = data.failedCount > 0;
      if (hasFailed) {
        toast({
          title: "Sync complete with errors",
          description: `${data.failedCount} record${data.failedCount !== 1 ? "s" : ""} could not be linked (see server logs).`,
          variant: "destructive",
        });
      }
      setSyncSummary(data);
      setSummaryExpanded(true);
      setShowAllSyncedCustomers(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      if (data.customersCreated > 0) {
        sessionStorage.setItem(NEW_CUSTOMERS_KEY, String(data.customersCreated));
        window.dispatchEvent(new Event("new-customers-updated"));
      }
    },
    onError: () => {
      toast({ title: "Sync failed", description: "Could not run the backfill. Please try again.", variant: "destructive" });
    },
  });

  const queryParams = new URLSearchParams();
  if (debouncedSearch) queryParams.set("search", debouncedSearch);
  if (staffFilter) queryParams.set("staffId", staffFilter);
  const queryString = queryParams.toString();

  const queryKey = ["/api/admin/customers", debouncedSearch, staffFilter].filter(Boolean);

  const { data: customers = [], isLoading: customersLoading, isError: customersError, refetch: refetchCustomers } = useQuery<CustomerListItem[]>({
    queryKey,
    queryFn: () => fetchJson(`/api/admin/customers${queryString ? `?${queryString}` : ""}`),
    enabled: !!(user?.adminRole && user.adminRole !== "none"),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const hasFilters = !!debouncedSearch || !!staffFilter || attentionFilter;

  const clearFilters = () => {
    setSearchTerm("");
    setStaffFilter("");
    setAttentionFilter(false);
  };

  const filteredCustomers = attentionFilter
    ? customers.filter(c => c.openFollowUpCount > 0)
    : customers;

  const attentionCount = customers.filter(c => c.openFollowUpCount > 0).length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
      </div>
    );
  }

  if (!isAuthenticated || !user?.adminRole || user.adminRole === "none") return null;

  return (
    <div className="min-h-screen bg-background">
      <AdminPageHeader
        title="Customers"
        description="Unified customer profiles across leads, quotes, and conversations"
      />

      <div className="w-full px-4 py-6">
        <AdminBackButton />

        <div className="space-y-5">
          {/* Filters row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-customers"
              />
            </div>
            <Select value={staffFilter || "all"} onValueChange={v => setStaffFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-52" data-testid="select-staff-filter">
                <UserCheck className="w-3.5 h-3.5 mr-1.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="All staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All customers</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {staffList.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                data-testid="button-clear-filters"
              >
                <X className="w-3.5 h-3.5 mr-1.5" />
                Clear
              </Button>
            )}
          </div>

          {/* Quick filter row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={attentionFilter ? "default" : "outline"}
              size="sm"
              onClick={() => setAttentionFilter(v => !v)}
              data-testid="button-filter-needs-attention"
            >
              <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
              Needs attention
              {attentionCount > 0 && (
                <Badge className="ml-1.5 text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30 no-default-active-elevate">
                  {attentionCount}
                </Badge>
              )}
            </Button>
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>
                {customersLoading ? "Loading..." : `${filteredCustomers.length} customer${filteredCustomers.length !== 1 ? "s" : ""}${hasFilters ? " found" : " total"}`}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => deduplicateMutation.mutate()}
                disabled={deduplicateMutation.isPending || backfillMutation.isPending}
                data-testid="button-deduplicate-customers"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${deduplicateMutation.isPending ? "animate-spin" : ""}`} />
                {deduplicateMutation.isPending ? "Merging..." : "Merge Duplicates"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => backfillMutation.mutate()}
                disabled={backfillMutation.isPending || deduplicateMutation.isPending}
                data-testid="button-sync-customers"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${backfillMutation.isPending ? "animate-spin" : ""}`} />
                {backfillMutation.isPending ? "Syncing..." : "Sync Records"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMergeHistory(v => !v)}
                data-testid="button-toggle-merge-history"
              >
                <History className="w-3.5 h-3.5 mr-1.5" />
                Merge History
              </Button>
            </div>
          </div>

          {/* Merge history panel */}
          {showMergeHistory && (
            <Card data-testid="panel-merge-history">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">Merge History</CardTitle>
                    <span className="text-xs text-muted-foreground">(most recent first)</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowMergeHistory(false)}
                    data-testid="button-close-merge-history"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {mergeHistoryLoading ? (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                    <span className="text-sm text-muted-foreground">Loading history...</span>
                  </div>
                ) : mergeHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3 text-center">
                    No merges recorded yet. Merge history will appear here after running "Merge Duplicates".
                  </p>
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
                          className="flex items-start gap-3 py-3 border-t first:border-t-0 flex-wrap"
                          data-testid={`row-merge-history-${entry.id}`}
                        >
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate" data-testid={`text-merge-keep-${entry.id}`}>
                                {entry.keepSnapshotName ?? "Unknown"}
                              </span>
                              <span className="text-xs text-muted-foreground">absorbed</span>
                              <span className="text-sm font-medium truncate" data-testid={`text-merge-removed-${entry.id}`}>
                                {entry.removedSnapshotName ?? "Unknown"}
                              </span>
                              {alreadySplit && (
                                <Badge className="text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/25 no-default-active-elevate shrink-0">
                                  <Scissors className="w-2.5 h-2.5 mr-1" />
                                  split
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
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
                                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground" data-testid={`text-merge-triggered-by-${entry.id}`}>
                                    <UserCircle className="w-3 h-3 shrink-0" />
                                    {name}
                                  </span>
                                );
                              })() : (
                                <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60 italic" data-testid={`text-merge-triggered-by-${entry.id}`}>
                                  <UserCircle className="w-3 h-3 shrink-0" />
                                  system / automated
                                </span>
                              )}
                              {alreadySplit && (() => {
                                const splitTimestamp = entry.splitAt
                                  ? ` · ${formatDate(entry.splitAt)}`
                                  : null;
                                const missingTimestamp = !entry.splitAt ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <HelpCircle className="w-3 h-3 shrink-0 cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>Split timestamp not recorded</TooltipContent>
                                  </Tooltip>
                                ) : null;
                                if (entry.splitBy) {
                                  const staff = staffList.find(s => s.id === entry.splitBy);
                                  const name = staff?.displayName ?? staff?.username ?? entry.splitBy;
                                  return (
                                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground" data-testid={`text-merge-split-by-${entry.id}`}>
                                      <Scissors className="w-3 h-3 shrink-0" />
                                      split by {name}{splitTimestamp}
                                      {missingTimestamp}
                                    </span>
                                  );
                                }
                                return (
                                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60 italic" data-testid={`text-merge-split-by-${entry.id}`}>
                                    <Scissors className="w-3 h-3 shrink-0" />
                                    split by system / automated{splitTimestamp}
                                    {missingTimestamp}
                                  </span>
                                );
                              })()}
                              {entry.mergedAt && (
                                <span className="text-[11px] text-muted-foreground">
                                  {formatDate(entry.mergedAt)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setReviewCustomerId(entry.keepId)}
                              data-testid={`button-review-keep-${entry.id}`}
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              View
                            </Button>
                            {!alreadySplit && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSplittingId(entry.id);
                                  splitMutation.mutate(entry.id);
                                }}
                                disabled={isSplitting || splitMutation.isPending}
                                data-testid={`button-split-merge-${entry.id}`}
                              >
                                <Scissors className={`w-3 h-3 mr-1 ${isSplitting ? "animate-pulse" : ""}`} />
                                {isSplitting ? "Splitting..." : "Split"}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Merge duplicates summary panel */}
          {mergeSummary && (
            <Card data-testid="panel-merge-summary">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {mergeSummary.failedCount > 0 && mergeSummary.mergedCount === 0
                      ? <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      : <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    }
                    <span className="text-sm font-medium">
                      {mergeSummary.mergedCount === 0 && mergeSummary.failedCount === 0
                        ? "No duplicates found"
                        : mergeSummary.mergedCount === 0 && mergeSummary.failedCount > 0
                        ? "Merge failed"
                        : "Merge complete"}
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {mergeSummary.mergedCount > 0 && (
                        <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/25 no-default-active-elevate">
                          {mergeSummary.mergedCount} duplicate{mergeSummary.mergedCount !== 1 ? "s" : ""} merged
                        </Badge>
                      )}
                      {mergeSummary.failedCount > 0 && (
                        <Badge className="text-[10px] bg-red-500/15 text-red-400 border-red-500/25 no-default-active-elevate">
                          <AlertCircle className="w-2.5 h-2.5 mr-1" />
                          {mergeSummary.failedCount} failed
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {mergeSummary.mergedCustomers?.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMergeSummaryExpanded(v => !v)}
                        data-testid="button-toggle-merge-summary"
                      >
                        {mergeSummaryExpanded ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
                        {mergeSummaryExpanded ? "Hide" : "Show"} details
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setMergeSummary(null)}
                      data-testid="button-dismiss-merge-summary"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {mergeSummaryExpanded && mergeSummary.mergedCustomers?.length > 0 && (
                  <div className="mt-3 border-t pt-3 space-y-1.5">
                    <p className="text-xs text-muted-foreground mb-2">
                      Customer profiles that absorbed duplicates:
                    </p>
                    {(showAllMergedCustomers
                      ? mergeSummary.mergedCustomers
                      : mergeSummary.mergedCustomers.slice(0, MERGE_LIST_CAP)
                    ).map(c => (
                      <div key={c.id} className="flex items-center justify-between gap-3 flex-wrap py-1" data-testid={`row-merged-customer-${c.id}`}>
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium truncate">{c.name}</span>
                            <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/25 no-default-active-elevate shrink-0">
                              absorbed {c.duplicatesAbsorbed} duplicate{c.duplicatesAbsorbed !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {c.leadsRepointed > 0 && (
                              <Badge className="text-[10px] bg-blue-500/15 text-blue-400 border-blue-500/25 no-default-active-elevate shrink-0" data-testid={`badge-leads-repointed-${c.id}`}>
                                {c.leadsRepointed} lead{c.leadsRepointed !== 1 ? "s" : ""}
                              </Badge>
                            )}
                            {c.quotesRepointed > 0 && (
                              <Badge className="text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/25 no-default-active-elevate shrink-0" data-testid={`badge-quotes-repointed-${c.id}`}>
                                {c.quotesRepointed} quote{c.quotesRepointed !== 1 ? "s" : ""}
                              </Badge>
                            )}
                            {c.convosRepointed > 0 && (
                              <Badge className="text-[10px] bg-purple-500/15 text-purple-400 border-purple-500/25 no-default-active-elevate shrink-0" data-testid={`badge-convos-repointed-${c.id}`}>
                                {c.convosRepointed} chat{c.convosRepointed !== 1 ? "s" : ""}
                              </Badge>
                            )}
                            {c.leadsRepointed === 0 && c.quotesRepointed === 0 && c.convosRepointed === 0 && (
                              <span className="text-[10px] text-muted-foreground">no records re-pointed</span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReviewCustomerId(c.id)}
                          data-testid={`button-review-merged-customer-${c.id}`}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Review
                        </Button>
                      </div>
                    ))}
                    {mergeSummary.mergedCustomers.length > MERGE_LIST_CAP && (
                      <button
                        className="mt-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                        onClick={() => setShowAllMergedCustomers(v => !v)}
                        data-testid="button-toggle-show-all-merged"
                      >
                        {showAllMergedCustomers
                          ? "Show fewer"
                          : `Show all ${mergeSummary.mergedCustomers.length} customers`}
                      </button>
                    )}
                  </div>
                )}

                {mergeSummary.mergedCount === 0 && (
                  <p className="text-xs text-muted-foreground mt-2">All customer records are already unique.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Sync summary panel */}
          {syncSummary && (
            <Card data-testid="panel-sync-summary">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-sm font-medium">
                      {syncSummary.leadsLinked > 0 || syncSummary.quotesLinked > 0 || syncSummary.convosLinked > 0
                        ? "Sync complete"
                        : "Already up to date"}
                    </span>
                    {(syncSummary.customersCreated > 0 || syncSummary.leadsLinked > 0 || syncSummary.quotesLinked > 0 || syncSummary.convosLinked > 0) && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {syncSummary.customersCreated > 0 && (
                          <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/25 no-default-active-elevate">
                            {syncSummary.customersCreated} new customer{syncSummary.customersCreated !== 1 ? "s" : ""}
                          </Badge>
                        )}
                        {syncSummary.leadsLinked > 0 && (
                          <Badge className="text-[10px] bg-blue-500/15 text-blue-400 border-blue-500/25 no-default-active-elevate">
                            {syncSummary.leadsLinked} lead{syncSummary.leadsLinked !== 1 ? "s" : ""} linked
                          </Badge>
                        )}
                        {syncSummary.quotesLinked > 0 && (
                          <Badge className="text-[10px] bg-purple-500/15 text-purple-400 border-purple-500/25 no-default-active-elevate">
                            {syncSummary.quotesLinked} quote{syncSummary.quotesLinked !== 1 ? "s" : ""} linked
                          </Badge>
                        )}
                        {syncSummary.convosLinked > 0 && (
                          <Badge className="text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/25 no-default-active-elevate">
                            {syncSummary.convosLinked} chat{syncSummary.convosLinked !== 1 ? "s" : ""} linked
                          </Badge>
                        )}
                        {syncSummary.failedCount > 0 && (
                          <Badge className="text-[10px] bg-red-500/15 text-red-400 border-red-500/25 no-default-active-elevate">
                            <AlertCircle className="w-2.5 h-2.5 mr-1" />
                            {syncSummary.failedCount} failed
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {syncSummary.linkedCustomers.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSummaryExpanded(v => !v)}
                        data-testid="button-toggle-sync-summary"
                      >
                        {summaryExpanded ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
                        {summaryExpanded ? "Hide" : "Show"} details
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSyncSummary(null);
                        sessionStorage.removeItem(NEW_CUSTOMERS_KEY);
                        window.dispatchEvent(new Event("new-customers-updated"));
                      }}
                      data-testid="button-dismiss-sync-summary"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {summaryExpanded && syncSummary.linkedCustomers.length > 0 && (
                  <div className="mt-3 border-t pt-3 space-y-1.5">
                    <p className="text-xs text-muted-foreground mb-2">
                      Customer profiles updated by this sync:
                    </p>
                    {(showAllSyncedCustomers
                      ? syncSummary.linkedCustomers
                      : syncSummary.linkedCustomers.slice(0, SYNC_LIST_CAP)
                    ).map(c => (
                      <div key={c.id} className="flex items-center justify-between gap-3 flex-wrap py-1" data-testid={`row-synced-customer-${c.id}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium">{c.name}</span>
                          {c.isNew && (
                            <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/25 no-default-active-elevate shrink-0">
                              new
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {c.leadsLinked > 0 && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Users className="w-3 h-3" />
                              {c.leadsLinked} lead{c.leadsLinked !== 1 ? "s" : ""}
                            </span>
                          )}
                          {c.quotesLinked > 0 && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <FileText className="w-3 h-3" />
                              {c.quotesLinked} quote{c.quotesLinked !== 1 ? "s" : ""}
                            </span>
                          )}
                          {c.convosLinked > 0 && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Bot className="w-3 h-3" />
                              {c.convosLinked} chat{c.convosLinked !== 1 ? "s" : ""}
                            </span>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setReviewCustomerId(c.id)}
                            data-testid={`button-review-customer-${c.id}`}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Review
                          </Button>
                        </div>
                      </div>
                    ))}
                    {syncSummary.linkedCustomers.length > SYNC_LIST_CAP && (
                      <button
                        className="mt-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                        onClick={() => setShowAllSyncedCustomers(v => !v)}
                        data-testid="button-toggle-show-all-synced"
                      >
                        {showAllSyncedCustomers
                          ? "Show fewer"
                          : `Show all ${syncSummary.linkedCustomers.length} customers`}
                      </button>
                    )}
                  </div>
                )}

                {syncSummary.linkedCustomers.length === 0 && syncSummary.leadsLinked === 0 && syncSummary.quotesLinked === 0 && syncSummary.convosLinked === 0 && (
                  <p className="text-xs text-muted-foreground mt-2">All records were already linked to customer profiles.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* List */}
          {customersLoading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Loading customers...</p>
              </CardContent>
            </Card>
          ) : customersError ? (
            <Card>
              <CardContent className="p-8 text-center space-y-3">
                <p className="text-destructive text-sm">Failed to load — check your connection and try again</p>
                <Button variant="outline" size="sm" onClick={() => refetchCustomers()} data-testid="button-retry-customers">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : filteredCustomers.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No customers found</h3>
                <p className="text-muted-foreground text-sm">
                  {attentionFilter
                    ? "No customers currently need attention — great work."
                    : hasFilters
                    ? "Try adjusting the filters."
                    : "Customers are created automatically when leads, quotes, or AI conversations are linked by email or phone."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredCustomers.map(c => (
                <Link key={c.id} href={`/admin/customers/${c.id}`} data-testid={`link-customer-${c.id}`}>
                  <Card className="hover-elevate cursor-pointer transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4 flex-wrap">
                        {/* Avatar / initials */}
                        <div className="w-9 h-9 rounded-full bg-[hsl(86_45%_51%/0.12)] flex items-center justify-center shrink-0">
                          <span className="text-sm font-semibold text-[hsl(86_53%_60%)]">
                            {c.name.charAt(0).toUpperCase()}
                          </span>
                        </div>

                        {/* Main details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm" data-testid={`text-customer-name-${c.id}`}>{c.name}</span>
                            {(c.company || c.email || c.phone) && (
                              <span className="text-xs text-muted-foreground">· {c.company || c.email || c.phone}</span>
                            )}
                            {c.pipelineStatus && (
                              <Badge
                                className={`text-[10px] border no-default-active-elevate ${STATUS_COLORS[c.pipelineStatus] ?? STATUS_COLORS.new}`}
                                data-testid={`badge-status-${c.id}`}
                              >
                                {c.pipelineStatus.replace(/_/g, " ")}
                              </Badge>
                            )}
                            {c.openFollowUpCount > 0 && (
                              <Badge className="text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/30 no-default-active-elevate">
                                <AlertCircle className="w-2.5 h-2.5 mr-1" />
                                {c.openFollowUpCount} follow-up{c.openFollowUpCount !== 1 ? "s" : ""}
                              </Badge>
                            )}
                            {c.primaryStaffName && (
                              <Badge
                                className="text-[10px] bg-[hsl(86_45%_51%/0.12)] text-[hsl(86_53%_60%)] border-[hsl(86_53%_51%/0.25)] no-default-active-elevate"
                                data-testid={`badge-staff-${c.id}`}
                              >
                                <UserCheck className="w-2.5 h-2.5 mr-1" />
                                {c.primaryStaffName}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 mt-1 flex-wrap">
                            {c.email && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="w-3 h-3 shrink-0" />
                                {c.email}
                              </span>
                            )}
                            {c.phone && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="w-3 h-3 shrink-0" />
                                {c.phone}
                              </span>
                            )}
                          </div>

                          {/* Record counts */}
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {c.leadCount > 0 && (
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Users className="w-3 h-3" />
                                {c.leadCount} lead{c.leadCount !== 1 ? "s" : ""}
                              </span>
                            )}
                            {c.quoteCount > 0 && (
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <FileText className="w-3 h-3" />
                                {c.quoteCount} quote{c.quoteCount !== 1 ? "s" : ""}
                              </span>
                            )}
                            {c.convoCount > 0 && (
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Bot className="w-3 h-3" />
                                {c.convoCount} chat{c.convoCount !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right side: last activity + delete + arrow */}
                        <div className="flex items-center gap-3 shrink-0">
                          {c.lastActivityAt && (
                            <div className="text-right hidden sm:block">
                              <p className="text-[10px] text-muted-foreground">Last activity</p>
                              <p className="text-xs text-foreground">{formatDate(c.lastActivityAt)}</p>
                            </div>
                          )}
                          {user?.adminRole === "full" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-red-400"
                              onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDeleteTarget(c);
                                setDeleteConfirmText("");
                              }}
                              data-testid={`button-delete-customer-${c.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {reviewCustomerId && (
        <CustomerReviewSheet
          customerId={reviewCustomerId}
          onClose={() => setReviewCustomerId(null)}
        />
      )}

      {deleteTarget && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-[60]"
            onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}
            aria-hidden="true"
            data-testid="backdrop-delete-customer"
          />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-full max-w-sm bg-background border rounded-md shadow-xl flex flex-col"
            role="dialog"
            aria-label="Delete customer"
            data-testid="dialog-delete-customer"
          >
            <div className="flex items-start justify-between gap-3 p-4 border-b">
              <div className="flex items-start gap-2.5 min-w-0">
                <Trash2 className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Delete customer profile</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[220px]" data-testid="text-delete-customer-name">{deleteTarget.name}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}
                data-testid="button-close-delete-dialog"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                This permanently deletes the customer profile and all their notes.
                {(deleteTarget.leadCount > 0 || deleteTarget.quoteCount > 0 || deleteTarget.convoCount > 0) && (
                  <span> Their {[
                    deleteTarget.leadCount > 0 && `${deleteTarget.leadCount} lead${deleteTarget.leadCount !== 1 ? "s" : ""}`,
                    deleteTarget.quoteCount > 0 && `${deleteTarget.quoteCount} quote${deleteTarget.quoteCount !== 1 ? "s" : ""}`,
                    deleteTarget.convoCount > 0 && `${deleteTarget.convoCount} chat${deleteTarget.convoCount !== 1 ? "s" : ""}`,
                  ].filter(Boolean).join(", ")} will be unlinked but not deleted.</span>
                )}
              </p>

              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Type <span className="font-mono font-semibold text-foreground">DELETE</span> to confirm
                </p>
                <Input
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  autoComplete="off"
                  data-testid="input-delete-confirm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 pt-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}
                data-testid="button-cancel-delete-customer"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteConfirmText !== "DELETE" || deleteCustomerMutation.isPending}
                onClick={() => deleteCustomerMutation.mutate(deleteTarget.id)}
                data-testid="button-confirm-delete-customer"
              >
                {deleteCustomerMutation.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Deleting...</>
                ) : (
                  <><Trash2 className="w-3.5 h-3.5 mr-1.5" />Delete permanently</>
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
