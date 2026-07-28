import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Building2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Plug,
  PlugZap,
  Phone,
  Plus,
  Pencil,
  Trash2,
  PhoneCall,
  ChevronUp,
  ChevronDown,
  KeyRound,
  Mail,
  X,
  Settings2,
  AlertTriangle,
} from "lucide-react";
import type { User, StaffPhone } from "@shared/schema";

export default function AdminSettings() {
  const { user } = useAuth() as { user: User | undefined };
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const isFullAdmin = user?.adminRole === "full";

  // ── Accounting integrations (Sage / Xero / QuickBooks) ─────────────────────
  type AccountingStatus = {
    active: string;
    providers: Array<{ key: string; label: string; configured: boolean; connected: boolean }>;
  };
  const { data: accounting, isLoading: accountingLoading } = useQuery<AccountingStatus>({
    queryKey: ["/api/accounting/status"],
    enabled: isFullAdmin,
  });

  const setProviderMutation = useMutation({
    mutationFn: (provider: string) => apiRequest("POST", "/api/accounting/provider", { provider }),
    onSuccess: (_data, provider) => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/status"] });
      toast({ title: "Accounting provider updated", description: `Invoices will now be pushed to ${provider}.` });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to change accounting provider." });
    },
  });

  const disconnectProviderMutation = useMutation({
    mutationFn: (provider: string) => apiRequest("DELETE", `/api/accounting/${provider}/disconnect`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/status"] });
      toast({ title: "Disconnected", description: "The accounting connection has been unlinked." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "Failed to disconnect." });
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sageParam = params.get("sage");
    const accountingParam = params.get("accounting");
    if (sageParam === "connected" || accountingParam?.endsWith("-connected")) {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/status"] });
      toast({ title: "Accounting connected", description: "The accounting platform is now linked to your account." });
      setLocation("/admin/settings", { replace: true });
    } else if (sageParam === "error" || accountingParam?.endsWith("-error")) {
      toast({ variant: "destructive", title: "Accounting connection failed", description: "Something went wrong during authorisation. Please try again." });
      setLocation("/admin/settings", { replace: true });
    }
  }, []);

  // ── Twilio status ──────────────────────────────────────────────────────────
  const { data: twilioStatus } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/admin/twilio/status"],
    enabled: isFullAdmin,
  });
  const twilioConfigured = twilioStatus?.configured ?? false;

  // ── Staff phone numbers ────────────────────────────────────────────────────
  const { data: staffPhones = [], isLoading: phonesLoading } = useQuery<StaffPhone[]>({
    queryKey: ["/api/admin/staff-phones"],
  });

  const [phoneDialog, setPhoneDialog] = useState<{ open: boolean; editing: StaffPhone | null }>({ open: false, editing: null });
  const [phoneLabel, setPhoneLabel] = useState("Mobile");
  const [phoneNumber, setPhoneNumber] = useState("");

  function openAddPhone() {
    setPhoneLabel("Mobile");
    setPhoneNumber("");
    setPhoneDialog({ open: true, editing: null });
  }

  function openEditPhone(p: StaffPhone) {
    setPhoneLabel(p.label);
    setPhoneNumber(p.phone);
    setPhoneDialog({ open: true, editing: p });
  }

  const savePhoneMutation = useMutation({
    mutationFn: async () => {
      if (phoneDialog.editing) {
        const res = await apiRequest("PATCH", `/api/admin/staff-phones/${phoneDialog.editing.id}`, {
          label: phoneLabel.trim(),
          phone: phoneNumber.trim(),
        });
        if (!res.ok) throw new Error("Failed to update");
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/admin/staff-phones", {
          label: phoneLabel.trim(),
          phone: phoneNumber.trim(),
        });
        if (!res.ok) throw new Error("Failed to create");
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staff-phones"] });
      setPhoneDialog({ open: false, editing: null });
      toast({ title: phoneDialog.editing ? "Phone number updated" : "Phone number added" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to save phone number" }),
  });

  const deletePhoneMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/staff-phones/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staff-phones"] });
      toast({ title: "Phone number removed" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to remove phone number" }),
  });

  const reorderPhoneMutation = useMutation({
    mutationFn: async ({ id, newOrder }: { id: string; newOrder: number }) => {
      const res = await apiRequest("PATCH", `/api/admin/staff-phones/${id}`, { sortOrder: newOrder });
      if (!res.ok) throw new Error("Failed to reorder");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/staff-phones"] }),
    onError: () => toast({ variant: "destructive", title: "Failed to reorder" }),
  });

  const movePhone = (index: number, direction: "up" | "down") => {
    const phones = [...staffPhones];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= phones.length) return;
    const a = phones[index];
    const b = phones[targetIndex];
    reorderPhoneMutation.mutate({ id: a.id, newOrder: b.sortOrder });
    reorderPhoneMutation.mutate({ id: b.id, newOrder: a.sortOrder });
  };

  const isAdmin = user?.adminRole === "full" || user?.adminRole === "basic";
  if (!isAdmin) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground text-sm">You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage integrations and account configuration.</p>
      </div>

      <Separator />

      {/* Full-admin-only integrations */}
      {isFullAdmin && (
        <>
          {/* Staff phone numbers — managed by full admins; used by all admins for click-to-call */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <CardTitle className="text-base">Staff Phone Numbers</CardTitle>
                </div>
                <Button size="sm" variant="outline" onClick={openAddPhone} data-testid="button-add-phone">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Add number
                </Button>
              </div>
              <CardDescription className="mt-1">
                Phone numbers available for staff to use with the click-to-call bridge. When staff click "Call via bridge", Twilio rings the chosen number, then connects them to the customer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {phonesLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : staffPhones.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <PhoneCall className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No phone numbers added yet.</p>
                  <Button size="sm" variant="outline" onClick={openAddPhone} data-testid="button-add-phone-empty">
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Add the first number
                  </Button>
                </div>
              ) : (
                <ul className="space-y-2">
                  {staffPhones.map((p, idx) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2" data-testid={`staff-phone-${p.id}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">{p.phone}</span>
                        <span className="text-xs text-muted-foreground truncate">{p.label}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => movePhone(idx, "up")}
                          disabled={idx === 0 || reorderPhoneMutation.isPending}
                          data-testid={`button-move-phone-up-${p.id}`}
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => movePhone(idx, "down")}
                          disabled={idx === staffPhones.length - 1 || reorderPhoneMutation.isPending}
                          data-testid={`button-move-phone-down-${p.id}`}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditPhone(p)}
                          data-testid={`button-edit-phone-${p.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deletePhoneMutation.mutate(p.id)}
                          disabled={deletePhoneMutation.isPending}
                          data-testid={`button-delete-phone-${p.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Twilio click-to-call */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <PhoneCall className="w-5 h-5 text-muted-foreground" />
                  <CardTitle className="text-base">Twilio Click-to-Call</CardTitle>
                </div>
                {twilioStatus && (
                  twilioConfigured ? (
                    <Badge
                      className="bg-accent/15 text-accent border-accent/30 no-default-active-elevate"
                      variant="outline"
                      data-testid="badge-twilio-status"
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Configured
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-muted-foreground no-default-active-elevate"
                      data-testid="badge-twilio-status"
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      Not configured
                    </Badge>
                  )
                )}
              </div>
              <CardDescription className="mt-1">
                When configured, staff can click "Call Now" on any quote or lead — Twilio rings the staff phone first, then bridges the call to the customer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {twilioConfigured ? (
                <p className="text-sm text-muted-foreground">
                  Twilio is active. Staff can use the call bridge from the Quotes and Leads pages. Each call attempt is logged as a note automatically.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Add the following three secrets to your environment to enable click-to-call:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li><code className="text-foreground">TWILIO_ACCOUNT_SID</code> — from your Twilio console</li>
                    <li><code className="text-foreground">TWILIO_AUTH_TOKEN</code> — from your Twilio console</li>
                    <li><code className="text-foreground">TWILIO_FROM_NUMBER</code> — your Twilio phone number (e.g. <code>+441234567890</code>)</li>
                  </ul>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open("https://console.twilio.com", "_blank")}
                    data-testid="button-open-twilio"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Open Twilio Console
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Accounting integration — Sage / Xero / QuickBooks */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-muted-foreground" />
                <CardTitle className="text-base">Accounting Integration</CardTitle>
              </div>
              <CardDescription className="mt-1">
                Choose which accounting platform this deployment pushes invoices to, then connect it.
                The "Push invoice" button on quote pages uses the active platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {accountingLoading && (
                <p className="text-sm text-muted-foreground">Loading accounting status…</p>
              )}
              {accounting?.providers.map((p) => {
                const isActive = accounting.active === p.key;
                return (
                  <div
                    key={p.key}
                    className={`flex items-center justify-between gap-3 rounded-md border p-3 ${isActive ? "border-accent/60 bg-accent/5" : ""}`}
                    data-testid={`accounting-provider-${p.key}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{p.label}</span>
                        {isActive && (
                          <Badge className="bg-accent/15 text-accent border-accent/30 no-default-active-elevate" variant="outline">
                            Active
                          </Badge>
                        )}
                        {p.connected ? (
                          <Badge variant="outline" className="no-default-active-elevate" data-testid={`badge-${p.key}-status`}>
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Connected
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground no-default-active-elevate" data-testid={`badge-${p.key}-status`}>
                            <XCircle className="w-3 h-3 mr-1" />
                            {p.configured ? "Not connected" : "Credentials not configured"}
                          </Badge>
                        )}
                      </div>
                      {!p.configured && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Set this platform's API credentials as environment variables to enable it.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {!isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setProviderMutation.mutate(p.key)}
                          disabled={setProviderMutation.isPending}
                          data-testid={`button-activate-${p.key}`}
                        >
                          Use {p.label.split(" ")[0]}
                        </Button>
                      )}
                      {p.configured && !p.connected && (
                        <Button
                          size="sm"
                          className="bg-[#1c5f3a] text-white"
                          onClick={() => { window.location.href = `/api/accounting/${p.key}/auth`; }}
                          data-testid={`button-connect-${p.key}`}
                        >
                          <Plug className="w-3.5 h-3.5 mr-1.5" />
                          Connect
                        </Button>
                      )}
                      {p.connected && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => disconnectProviderMutation.mutate(p.key)}
                          disabled={disconnectProviderMutation.isPending}
                          data-testid={`button-disconnect-${p.key}`}
                        >
                          <PlugZap className="w-3.5 h-3.5 mr-1.5" />
                          Disconnect
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}

      {/* Notification recipients — who gets new-quote / spec / finance emails */}
      {isFullAdmin && (
        <>
          <Separator />
          <NotifyRecipientsCard />
        </>
      )}

      {/* Kiosk undo PINs — managed by full admins */}
      {isFullAdmin && (
        <>
          <Separator />
          <KioskPinsCard />
        </>
      )}

      {/* Add/Edit phone number dialog */}
      <Dialog open={phoneDialog.open} onOpenChange={(open) => { if (!open) setPhoneDialog({ open: false, editing: null }); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{phoneDialog.editing ? "Edit phone number" : "Add phone number"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone-label">Label</Label>
              <Input
                id="phone-label"
                value={phoneLabel}
                onChange={(e) => setPhoneLabel(e.target.value)}
                placeholder="Mobile, Office, etc."
                data-testid="input-phone-label"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone-number">Phone number</Label>
              <Input
                id="phone-number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+447700000000"
                data-testid="input-phone-number"
              />
              <p className="text-xs text-muted-foreground">Include the country code, e.g. +44 for UK.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPhoneDialog({ open: false, editing: null })}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => savePhoneMutation.mutate()}
              disabled={!phoneNumber.trim() || savePhoneMutation.isPending}
              data-testid="button-save-phone"
            >
              {savePhoneMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Admin notification recipients (per-channel) ──────────────────────────────
// Full-admin-only. Each internal email address can subscribe to any subset of
// the 8 notification channels — e.g. Beth can be subscribed only to the
// "Send to Admin" depot-invoice email and nothing else, while others stay on
// the full new-quote/spec/finance firehose. Save an empty list to restore the
// built-in defaults.

type NotifyChannelMeta = { id: string; label: string; description: string };
type NotifyRecipient = { email: string; channels: string[] };
type NotifyRecipientsResponse = {
  recipients: NotifyRecipient[];
  channels: NotifyChannelMeta[];
  isCustom: boolean;
  effectiveByChannel: Record<string, string[]>;
};

function NotifyRecipientsCard() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<NotifyRecipientsResponse>({
    queryKey: ["/api/admin/notify-recipients"],
  });
  const [recipients, setRecipients] = useState<NotifyRecipient[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const channels = data?.channels ?? [];
  const channelLabel = (id: string) => channels.find((c) => c.id === id)?.label ?? id;

  // Initialise the editable list from server data exactly once per fetch.
  // When nothing has been customised yet, prefill from the current effective
  // (built-in default) recipients so the list shows who is actually receiving
  // things today — far less confusing than an empty editor when emails are
  // still flowing out to default addresses.
  useEffect(() => {
    if (data && !hydrated) {
      if (data.recipients.length > 0) {
        setRecipients(data.recipients);
      } else if (data.effectiveByChannel) {
        const map = new Map<string, Set<string>>();
        for (const [channelId, emails] of Object.entries(data.effectiveByChannel)) {
          for (const e of emails) {
            const key = e.toLowerCase();
            if (!map.has(key)) map.set(key, new Set());
            map.get(key)!.add(channelId);
          }
        }
        const synthesised: NotifyRecipient[] = Array.from(map.entries())
          .map(([email, set]) => ({ email, channels: Array.from(set) }))
          .sort((a, b) => a.email.localeCompare(b.email));
        setRecipients(synthesised);
      }
      setHydrated(true);
    }
  }, [data, hydrated]);

  const saveMutation = useMutation({
    mutationFn: async (next: NotifyRecipient[]) => {
      const res = await apiRequest("PUT", "/api/admin/notify-recipients", { recipients: next });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Failed to save");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notify-recipients"] });
      setHydrated(false);
      toast({ title: "Recipients updated", description: "Future notifications will follow these subscriptions." });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Could not save", description: err?.message ?? "Unknown error" });
    },
  });

  const addRecipient = () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast({ variant: "destructive", title: "Invalid email", description: "Enter a valid address, e.g. name@company.co.uk." });
      return;
    }
    if (recipients.some((r) => r.email === trimmed)) {
      setNewEmail("");
      return;
    }
    // New people default to "all channels on" so legacy behaviour is preserved;
    // admins explicitly trim down (e.g. Beth → only depot_invoice).
    setRecipients([...recipients, { email: trimmed, channels: channels.map((c) => c.id) }]);
    setNewEmail("");
  };

  const removeRecipient = (email: string) =>
    setRecipients(recipients.filter((r) => r.email !== email));

  const toggleChannel = (email: string, channelId: string, on: boolean) =>
    setRecipients(recipients.map((r) => {
      if (r.email !== email) return r;
      const set = new Set(r.channels);
      if (on) set.add(channelId); else set.delete(channelId);
      return { ...r, channels: Array.from(set) };
    }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-base">Notification Recipients</CardTitle>
        </div>
        <CardDescription className="mt-1">
          Pick which automated emails each person should receive. Click <strong>Channels</strong> on a
          row to choose. Someone with no channels ticked will not receive anything. Save an empty
          list to fall back to the built-in defaults.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              {data?.isCustom ? (
                <Badge variant="outline" className="text-xs no-default-active-elevate">Custom list</Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground no-default-active-elevate">Using defaults</Badge>
              )}
            </div>
            {recipients.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No recipients — saving will fall back to the built-in default addresses.
              </p>
            ) : (
              <ul className="space-y-2">
                {recipients.map((r) => {
                  const count = r.channels.length;
                  const total = channels.length;
                  const noneSelected = count === 0;
                  const allSelected = count === total && total > 0;
                  return (
                    <li
                      key={r.email}
                      className="flex flex-col gap-2 rounded-md border px-3 py-2"
                      data-testid={`notify-recipient-${r.email}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate">{r.email}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {noneSelected && (
                            <span className="flex items-center gap-1 text-xs text-destructive" data-testid={`warning-no-channels-${r.email}`}>
                              <AlertTriangle className="w-3.5 h-3.5" />
                              No channels
                            </span>
                          )}
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                data-testid={`button-channels-${r.email}`}
                              >
                                <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                                Channels
                                <Badge variant="secondary" className="ml-2 no-default-active-elevate">
                                  {count}/{total}
                                </Badge>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-80 p-3">
                              <p className="text-sm font-medium mb-2">What should {r.email} receive?</p>
                              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                                {channels.map((c) => {
                                  const checked = r.channels.includes(c.id);
                                  return (
                                    <label
                                      key={c.id}
                                      className="flex gap-2 items-start cursor-pointer rounded-md p-2 hover-elevate"
                                      data-testid={`channel-row-${r.email}-${c.id}`}
                                    >
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={(v) => toggleChannel(r.email, c.id, Boolean(v))}
                                        className="mt-0.5"
                                        data-testid={`checkbox-${r.email}-${c.id}`}
                                      />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm leading-tight">{c.label}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </PopoverContent>
                          </Popover>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => removeRecipient(r.email)}
                            data-testid={`button-remove-recipient-${r.email}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      {/* Inline at-a-glance summary of what this person receives. */}
                      {!noneSelected && (
                        <div className="flex flex-wrap gap-1.5 pl-5" data-testid={`channel-summary-${r.email}`}>
                          {allSelected ? (
                            <Badge variant="secondary" className="text-xs no-default-active-elevate">
                              All notifications
                            </Badge>
                          ) : (
                            r.channels.map((cid) => (
                              <Badge
                                key={cid}
                                variant="secondary"
                                className="text-xs no-default-active-elevate"
                                data-testid={`channel-badge-${r.email}-${cid}`}
                              >
                                {channelLabel(cid)}
                              </Badge>
                            ))
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex items-center gap-2 pt-1">
              <Input
                type="email"
                placeholder="name@company.co.uk"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRecipient(); } }}
                data-testid="input-new-notify-email"
              />
              <Button size="sm" variant="outline" onClick={addRecipient} data-testid="button-add-notify-recipient">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add
              </Button>
            </div>
            <div className="flex items-center justify-end pt-2">
              <Button
                size="sm"
                onClick={() => saveMutation.mutate(recipients)}
                disabled={saveMutation.isPending}
                data-testid="button-save-notify-recipients"
              >
                {saveMutation.isPending ? "Saving…" : "Save recipients"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Kiosk PIN management ─────────────────────────────────────────────────────
// Full-admin-only. Each lad has a 4-digit PIN they enter on the kiosk to undo
// a stage tick. PINs persist in site_settings so a redeploy doesn't wipe them.
// Empty input clears the override — if a KIOSK_PIN_<INITIALS> env var was set
// (legacy / fallback), it will start being used again.

type KioskPinRow = { initials: string; name: string; hasPin: boolean; source: "db" | "env" | null };

function KioskPinsCard() {
  const { toast } = useToast();
  const { data: rows = [], isLoading } = useQuery<KioskPinRow[]>({
    queryKey: ["/api/admin/kiosk-pins"],
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const saveMutation = useMutation({
    mutationFn: async ({ initials, pin }: { initials: string; pin: string }) => {
      const res = await apiRequest("PUT", `/api/admin/kiosk-pins/${initials}`, { pin });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Failed to save PIN");
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kiosk-pins"] });
      setDrafts((d) => ({ ...d, [vars.initials]: "" }));
      toast({
        title: vars.pin ? "PIN updated" : "PIN cleared",
        description: vars.pin
          ? `${vars.initials} can now undo stages with their new PIN.`
          : `${vars.initials}'s override removed.`,
      });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Could not save", description: err?.message ?? "Unknown error" });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-base">Kiosk Undo PINs</CardTitle>
        </div>
        <CardDescription className="mt-1">
          Each lad has a 4-digit PIN they enter on the workshop kiosk to undo a stage tick. Set or rotate
          them here — changes apply instantly. Leave blank and save to clear an override.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const draft = drafts[r.initials] ?? "";
              return (
                <li
                  key={r.initials}
                  className="flex items-center gap-3 rounded-md border px-3 py-2"
                  data-testid={`kiosk-pin-row-${r.initials}`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-bold text-sm w-8 tabular-nums">{r.initials}</span>
                    <span className="text-sm truncate">{r.name}</span>
                    {r.hasPin ? (
                      <Badge variant="outline" className="ml-1 text-xs no-default-active-elevate">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        {r.source === "env" ? "Set (env)" : "Set"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="ml-1 text-xs text-muted-foreground no-default-active-elevate">
                        Not set
                      </Badge>
                    )}
                  </div>
                  <Input
                    inputMode="numeric"
                    pattern="\d{4}"
                    maxLength={4}
                    placeholder={r.hasPin ? "Replace…" : "4 digits"}
                    value={draft}
                    onChange={(e) => setDrafts((d) => ({ ...d, [r.initials]: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                    className="w-24 font-mono tabular-nums text-center"
                    data-testid={`input-pin-${r.initials}`}
                  />
                  <Button
                    size="sm"
                    disabled={saveMutation.isPending || (draft.length > 0 && draft.length !== 4)}
                    onClick={() => saveMutation.mutate({ initials: r.initials, pin: draft })}
                    data-testid={`button-save-pin-${r.initials}`}
                  >
                    {draft.length === 4 ? "Save" : "Clear"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          Tip: triple-tap a ticked stage on the kiosk to open the undo dialog. Only the lad who ticked it
          can undo it, and only with their PIN.
        </p>
      </CardContent>
    </Card>
  );
}
