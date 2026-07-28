import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { FollowUp, User, Quote, Van } from "@shared/schema";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Phone,
  Mail,
  CheckCircle2,
  Circle,
  Pencil,
  Trash2,
  CalendarDays,
  User as UserIcon,
  Clock,
  ExternalLink,
  Truck,
  PackageCheck,
} from "lucide-react";
import { Link } from "wouter";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function todayStr(): string {
  return toDateStr(new Date());
}

interface FollowUpForm {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  scheduledDate: string;
  notes: string;
  assignedToUserId: string;
  assignedToName: string;
  assignedToEmail: string;
  leadId: string;
  quoteId: string;
}

const EMPTY_FORM: FollowUpForm = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  scheduledDate: todayStr(),
  notes: "",
  assignedToUserId: "",
  assignedToName: "",
  assignedToEmail: "",
  leadId: "",
  quoteId: "",
};

export default function AdminCalendar() {
  const { user } = useAuth() as { user: User | undefined };
  const { toast } = useToast();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FollowUpForm>(EMPTY_FORM);

  const { data: followUps = [], isLoading } = useQuery<FollowUp[]>({
    queryKey: ["/api/admin/follow-ups"],
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  // Quotes with a target completion date = finished-van collection events
  const { data: quotes = [] } = useQuery<Quote[]>({
    queryKey: ["/api/admin/quotes"],
  });

  // Vans with an expected arrival date = incoming-van events
  const { data: vans = [] } = useQuery<Van[]>({
    queryKey: ["/api/admin/vans"],
  });

  // Build a date-string → events map covering collections + arrivals.
  type VanEvent = {
    kind: "collection" | "arrival";
    id: string;
    label: string;
    sub?: string;
    href: string;
  };
  const eventsByDate: Record<string, VanEvent[]> = {};
  const pushEvent = (dateStr: string, ev: VanEvent) => {
    (eventsByDate[dateStr] ??= []).push(ev);
  };
  const isoDayOnly = (d: Date | string | null | undefined): string | null => {
    if (!d) return null;
    const dt = typeof d === "string" ? new Date(d) : d;
    if (isNaN(dt.getTime())) return null;
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  };
  for (const q of quotes) {
    const dateStr = isoDayOnly(q.targetCompletionDate as any);
    if (!dateStr) continue;
    // Hide collections for cancelled / completed quotes — they're not on the floor any more
    if (q.status === "cancelled" || q.status === "completed") continue;
    pushEvent(dateStr, {
      kind: "collection",
      id: q.id,
      label: q.userName || "Unnamed customer",
      sub: q.vanRegistration || q.company || undefined,
      href: `/admin/quotes/${q.id}`,
    });
  }
  for (const v of vans) {
    const dateStr = isoDayOnly((v as any).expectedArrivalDate);
    if (!dateStr) continue;
    pushEvent(dateStr, {
      kind: "arrival",
      id: v.id,
      label: `${v.make} ${v.model}`.trim(),
      sub: v.reg || (v.year ? String(v.year) : undefined),
      href: `/admin/vans`,
    });
  }
  const vanEventsForDate = (dateStr: string): VanEvent[] => eventsByDate[dateStr] ?? [];

  const createMutation = useMutation({
    mutationFn: (data: Partial<FollowUpForm>) => apiRequest("POST", "/api/admin/follow-ups", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/follow-ups"] });
      setDialogOpen(false);
      toast({ title: "Follow-up scheduled" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to save follow-up" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FollowUp> }) =>
      apiRequest("PATCH", `/api/admin/follow-ups/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/follow-ups"] });
      setDialogOpen(false);
      toast({ title: "Follow-up updated" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to update" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/follow-ups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/follow-ups"] });
      toast({ title: "Follow-up removed" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to delete" }),
  });

  const toggleComplete = (fu: FollowUp) => {
    updateMutation.mutate({
      id: fu.id,
      data: {
        completed: !fu.completed,
        completedAt: !fu.completed ? new Date() : null,
      } as any,
    });
  };

  function openNew(date?: string) {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      scheduledDate: date || selectedDate,
      assignedToUserId: user?.id || "",
      assignedToName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username : "",
      assignedToEmail: user?.email || "",
    });
    setDialogOpen(true);
  }

  function openEdit(fu: FollowUp) {
    setEditingId(fu.id);
    setForm({
      customerName: fu.customerName || "",
      customerPhone: fu.customerPhone || "",
      customerEmail: fu.customerEmail || "",
      scheduledDate: fu.scheduledDate,
      notes: fu.notes || "",
      assignedToUserId: fu.assignedToUserId || "",
      assignedToName: fu.assignedToName || "",
      assignedToEmail: fu.assignedToEmail || "",
      leadId: fu.leadId || "",
      quoteId: fu.quoteId || "",
    });
    setDialogOpen(true);
  }

  function handleSave() {
    const payload: Record<string, any> = {
      customerName: form.customerName,
      scheduledDate: form.scheduledDate,
    };
    if (form.customerPhone) payload.customerPhone = form.customerPhone;
    if (form.customerEmail) payload.customerEmail = form.customerEmail;
    if (form.notes) payload.notes = form.notes;
    if (form.assignedToUserId) payload.assignedToUserId = form.assignedToUserId;
    if (form.assignedToName) payload.assignedToName = form.assignedToName;
    if (form.assignedToEmail) payload.assignedToEmail = form.assignedToEmail;
    if (form.leadId) payload.leadId = form.leadId;
    if (form.quoteId) payload.quoteId = form.quoteId;
    payload.createdBy = user?.username || "admin";

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleUserSelect(userId: string) {
    const selectedUser = users.find((u) => u.id === userId);
    setForm((prev) => ({
      ...prev,
      assignedToUserId: userId,
      assignedToName: selectedUser
        ? `${selectedUser.firstName || ""} ${selectedUser.lastName || ""}`.trim() || selectedUser.username
        : prev.assignedToName,
      assignedToEmail: selectedUser?.email || prev.assignedToEmail,
    }));
  }

  // Build calendar days
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0);
  const startDow = (firstDayOfMonth.getDay() + 6) % 7; // Monday=0
  const daysInMonth = lastDayOfMonth.getDate();

  const calendarCells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  function cellDateStr(day: number) {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function fuForDate(dateStr: string) {
    return followUps.filter((f) => f.scheduledDate === dateStr);
  }

  const selectedFollowUps = fuForDate(selectedDate);
  const todayFuCount = followUps.filter((f) => f.scheduledDate === todayStr() && !f.completed).length;

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const selectedDateDisplay = new Date(selectedDate + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const isToday = (dateStr: string) => dateStr === todayStr();

  return (
    <div className="flex flex-col h-full">
      <AdminPageHeader
        title="Follow-up Calendar"
        description="Schedule and track customer follow-up calls"
        actions={
          <Button onClick={() => openNew()} data-testid="button-new-followup">
            <Plus className="w-4 h-4 mr-2" />
            New Follow-up
          </Button>
        }
      />

      {todayFuCount > 0 && (
        <div className="mx-4 mt-3 px-4 py-3 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-sm text-amber-300">
            You have <strong>{todayFuCount}</strong> pending follow-up{todayFuCount !== 1 ? "s" : ""} due today.
          </span>
          <button
            className="ml-auto text-xs text-amber-400 underline"
            onClick={() => {
              setSelectedDate(todayStr());
              setViewYear(today.getFullYear());
              setViewMonth(today.getMonth());
            }}
          >
            View
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden gap-0 p-4">
        {/* Calendar panel */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <Button size="icon" variant="ghost" onClick={prevMonth} data-testid="button-prev-month">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-base font-semibold">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </h2>
            <Button size="icon" variant="ghost" onClick={nextMonth} data-testid="button-next-month">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden flex-1">
            {calendarCells.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="bg-background/30 min-h-[80px]" />;
              }
              const dateStr = cellDateStr(day);
              const dayFus = fuForDate(dateStr);
              const dayVanEvents = vanEventsForDate(dateStr);
              const collections = dayVanEvents.filter((e) => e.kind === "collection");
              const arrivals = dayVanEvents.filter((e) => e.kind === "arrival");
              const pending = dayFus.filter((f) => !f.completed);
              const done = dayFus.filter((f) => f.completed);
              const isSelected = dateStr === selectedDate;
              const isTod = isToday(dateStr);
              const totalItems = pending.length + done.length + dayVanEvents.length;
              const slotsForFus = Math.max(0, 3 - dayVanEvents.length);

              return (
                <div
                  key={dateStr}
                  className={`min-h-[80px] p-1.5 cursor-pointer transition-colors bg-card hover-elevate
                    ${isSelected ? "ring-2 ring-inset ring-primary" : ""}
                  `}
                  onClick={() => setSelectedDate(dateStr)}
                  data-testid={`cell-date-${dateStr}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full
                        ${isTod ? "bg-primary text-primary-foreground" : "text-foreground"}
                      `}
                    >
                      {day}
                    </span>
                    {totalItems > 0 && (
                      <button
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); openNew(dateStr); }}
                        title="Add follow-up"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {arrivals.slice(0, 2).map((ev) => (
                      <div
                        key={`a-${ev.id}`}
                        className="text-[10px] truncate px-1 py-0.5 rounded bg-blue-500/20 text-blue-300 leading-tight flex items-center gap-1"
                        title={`Van arriving: ${ev.label}${ev.sub ? ` (${ev.sub})` : ""}`}
                        data-testid={`cell-arrival-${ev.id}`}
                      >
                        <Truck className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{ev.label}</span>
                      </div>
                    ))}
                    {collections.slice(0, 2).map((ev) => (
                      <div
                        key={`c-${ev.id}`}
                        className="text-[10px] truncate px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300 leading-tight flex items-center gap-1"
                        title={`Customer collection: ${ev.label}${ev.sub ? ` (${ev.sub})` : ""}`}
                        data-testid={`cell-collection-${ev.id}`}
                      >
                        <PackageCheck className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{ev.label}</span>
                      </div>
                    ))}
                    {pending.slice(0, slotsForFus).map((fu) => (
                      <div
                        key={fu.id}
                        className="text-[10px] truncate px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 leading-tight"
                        title={fu.customerName}
                      >
                        {fu.customerName}
                      </div>
                    ))}
                    {done.length > 0 && (
                      <div className="text-[10px] truncate px-1 py-0.5 rounded bg-green-500/20 text-green-400 leading-tight">
                        {done.length} done
                      </div>
                    )}
                    {(pending.length > slotsForFus || dayVanEvents.length > 4) && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{Math.max(0, totalItems - 4)} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Day detail panel */}
        <div className="w-72 ml-4 shrink-0 flex flex-col overflow-hidden">
          {(() => {
            const selectedVanEvents = vanEventsForDate(selectedDate);
            const summaryParts: string[] = [];
            if (selectedVanEvents.filter((e) => e.kind === "arrival").length > 0) {
              const n = selectedVanEvents.filter((e) => e.kind === "arrival").length;
              summaryParts.push(`${n} arrival${n !== 1 ? "s" : ""}`);
            }
            if (selectedVanEvents.filter((e) => e.kind === "collection").length > 0) {
              const n = selectedVanEvents.filter((e) => e.kind === "collection").length;
              summaryParts.push(`${n} collection${n !== 1 ? "s" : ""}`);
            }
            if (selectedFollowUps.length > 0) {
              summaryParts.push(`${selectedFollowUps.length} follow-up${selectedFollowUps.length !== 1 ? "s" : ""}`);
            }
            return (
              <div className="flex items-center justify-between mb-3 gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{selectedDateDisplay}</p>
                  <p className="text-xs text-muted-foreground">
                    {summaryParts.length === 0 ? "Nothing scheduled" : summaryParts.join(" · ")}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => openNew(selectedDate)} data-testid="button-add-for-date">
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>
            );
          })()}

          <div className="overflow-y-auto flex flex-col gap-2 pb-2">
            {/* Van events: arrivals + collections for the selected day */}
            {vanEventsForDate(selectedDate).map((ev) => (
              <Link key={`${ev.kind}-${ev.id}`} href={ev.href}>
                <Card className="hover-elevate cursor-pointer" data-testid={`event-${ev.kind}-${ev.id}`}>
                  <CardContent className="p-3 flex items-start gap-2">
                    <div className={`mt-0.5 shrink-0 ${ev.kind === "arrival" ? "text-blue-400" : "text-emerald-400"}`}>
                      {ev.kind === "arrival" ? <Truck className="w-4 h-4" /> : <PackageCheck className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ev.label}</p>
                      {ev.sub && (
                        <p className="text-xs text-muted-foreground truncate">{ev.sub}</p>
                      )}
                      <Badge
                        variant="secondary"
                        className={`text-[10px] mt-1 ${ev.kind === "arrival" ? "bg-blue-500/20 text-blue-300 border-blue-500/30" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"}`}
                      >
                        {ev.kind === "arrival" ? "Van arriving" : "Customer collection"}
                      </Badge>
                    </div>
                    <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0 mt-1" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Loading...</div>
          ) : selectedFollowUps.length === 0 ? (
            vanEventsForDate(selectedDate).length > 0 ? null : (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                <CalendarDays className="w-8 h-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No follow-ups for this day</p>
                <Button size="sm" variant="outline" onClick={() => openNew(selectedDate)}>
                  Schedule one
                </Button>
              </div>
            )
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto">
              {selectedFollowUps.map((fu) => (
                <Card key={fu.id} className={`${fu.completed ? "opacity-60" : ""}`}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => toggleComplete(fu)}
                        className="mt-0.5 shrink-0 text-muted-foreground hover:text-green-400 transition-colors"
                        title={fu.completed ? "Mark incomplete" : "Mark complete"}
                        data-testid={`button-complete-${fu.id}`}
                      >
                        {fu.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${fu.completed ? "line-through text-muted-foreground" : ""}`}>
                          {fu.customerName}
                        </p>
                        {fu.customerPhone && (
                          <a
                            href={`tel:${fu.customerPhone}`}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-0.5"
                          >
                            <Phone className="w-3 h-3" />
                            {fu.customerPhone}
                          </a>
                        )}
                        {fu.customerEmail && (
                          <a
                            href={`mailto:${fu.customerEmail}`}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-0.5"
                          >
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{fu.customerEmail}</span>
                          </a>
                        )}
                        {fu.assignedToName && (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <UserIcon className="w-3 h-3" />
                            {fu.assignedToName}
                          </p>
                        )}
                        {fu.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic leading-tight line-clamp-2">
                            {fu.notes}
                          </p>
                        )}
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {fu.leadId && (
                            <Link href="/admin/leads">
                              <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer">
                                <ExternalLink className="w-2.5 h-2.5" />
                                Lead
                              </Badge>
                            </Link>
                          )}
                          {fu.quoteId && (
                            <Link href={`/admin/quotes/${fu.quoteId}`}>
                              <Badge variant="secondary" className="text-[10px] gap-1 cursor-pointer">
                                <ExternalLink className="w-2.5 h-2.5" />
                                Configurator
                              </Badge>
                            </Link>
                          )}
                          {fu.completed && (
                            <Badge variant="secondary" className="text-[10px] bg-green-500/20 text-green-400 border-green-500/30">
                              Done
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          onClick={() => openEdit(fu)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          data-testid={`button-edit-followup-${fu.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Remove follow-up for ${fu.customerName}?`)) {
                              deleteMutation.mutate(fu.id);
                            }
                          }}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          data-testid={`button-delete-followup-${fu.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Follow-up" : "Schedule Follow-up"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="fu-customer">Customer name *</Label>
                <Input
                  id="fu-customer"
                  value={form.customerName}
                  onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))}
                  placeholder="e.g. John Smith"
                  data-testid="input-customer-name"
                />
              </div>
              <div>
                <Label htmlFor="fu-phone">Phone</Label>
                <Input
                  id="fu-phone"
                  value={form.customerPhone}
                  onChange={(e) => setForm((p) => ({ ...p, customerPhone: e.target.value }))}
                  placeholder="07xxx xxxxxx"
                  data-testid="input-customer-phone"
                />
              </div>
              <div>
                <Label htmlFor="fu-email">Email</Label>
                <Input
                  id="fu-email"
                  type="email"
                  value={form.customerEmail}
                  onChange={(e) => setForm((p) => ({ ...p, customerEmail: e.target.value }))}
                  placeholder="customer@email.com"
                  data-testid="input-customer-email"
                />
              </div>
              <div>
                <Label htmlFor="fu-date">Follow-up date *</Label>
                <Input
                  id="fu-date"
                  type="date"
                  value={form.scheduledDate}
                  onChange={(e) => setForm((p) => ({ ...p, scheduledDate: e.target.value }))}
                  data-testid="input-scheduled-date"
                />
              </div>
              <div>
                <Label htmlFor="fu-assigned">Assigned to</Label>
                <Select value={form.assignedToUserId} onValueChange={handleUserSelect}>
                  <SelectTrigger id="fu-assigned" data-testid="select-assigned-to">
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {users
                      .filter((u) => u.adminRole && u.adminRole !== "none")
                      .map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {`${u.firstName || ""} ${u.lastName || ""}`.trim() || u.username}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="fu-notes">Notes / purpose of call</Label>
                <Textarea
                  id="fu-notes"
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="What to discuss or follow up on..."
                  rows={3}
                  data-testid="textarea-notes"
                />
              </div>
              <div>
                <Label htmlFor="fu-lead">Lead ID (optional)</Label>
                <Input
                  id="fu-lead"
                  value={form.leadId}
                  onChange={(e) => setForm((p) => ({ ...p, leadId: e.target.value }))}
                  placeholder="Lead ID"
                  data-testid="input-lead-id"
                />
              </div>
              <div>
                <Label htmlFor="fu-quote">Configurator ID (optional)</Label>
                <Input
                  id="fu-quote"
                  value={form.quoteId}
                  onChange={(e) => setForm((p) => ({ ...p, quoteId: e.target.value }))}
                  placeholder="Configurator ID"
                  data-testid="input-quote-id"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.customerName || !form.scheduledDate || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-followup"
            >
              {editingId ? "Save changes" : "Schedule follow-up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
