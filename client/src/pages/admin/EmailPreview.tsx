import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Send, Monitor, Users, Building2, Warehouse, ChevronRight, ChevronDown, Zap, FileCode, Info, Link2, Copy, Check } from "lucide-react";

const SEND_TYPE_TOOLTIPS = {
  live: "Live send uses the real email function — the test email is identical to what the customer receives.",
  html: "HTML preview generates a static snapshot — minor formatting differences may exist.",
};

interface EmailTemplate {
  id: string;
  label: string;
  description: string;
  subject: string;
  recipient: "customer" | "admin" | "finance" | "depot";
  group: "Enquiry" | "Spec" | "Quote" | "Finance" | "Post-Sale" | "Account";
  liveSend: boolean;
}

const DUAL_RECIPIENT_TEMPLATE_IDS = new Set([
  "enquiry-received-customer",
  "enquiry-received-admin",
  "lead-received-customer",
  "lead-received-admin",
]);

const PAIRED_TEMPLATES: Record<string, string> = {
  "enquiry-received-customer": "enquiry-received-admin",
  "enquiry-received-admin": "enquiry-received-customer",
  "lead-received-customer": "lead-received-admin",
  "lead-received-admin": "lead-received-customer",
};

const GROUP_ORDER: EmailTemplate["group"][] = [
  "Enquiry",
  "Spec",
  "Quote",
  "Finance",
  "Post-Sale",
  "Account",
];

const recipientConfig: Record<
  EmailTemplate["recipient"],
  { label: string; icon: React.ElementType; className: string; tooltip: string }
> = {
  customer: { label: "Customer", icon: Users, className: "bg-blue-500/10 text-blue-400 border-blue-500/20", tooltip: "Sent to the customer who submitted the enquiry." },
  admin: { label: "Internal", icon: Monitor, className: "bg-amber-500/10 text-amber-400 border-amber-500/20", tooltip: "Sent to internal staff only — not visible to the customer." },
  finance: { label: "Finance Co.", icon: Building2, className: "bg-purple-500/10 text-purple-400 border-purple-500/20", tooltip: "Sent to the finance company handling the agreement." },
  depot: { label: "Depot", icon: Warehouse, className: "bg-orange-500/10 text-orange-400 border-orange-500/20", tooltip: "Sent to the supplying depot or dealer." },
};

export default function EmailPreview() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string>("enquiry-received-customer");
  const [testEmail, setTestEmail] = useState("");
  const [iframeSrc, setIframeSrc] = useState<string>(
    "/api/admin/email-preview/html/enquiry-received-customer"
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [lastSentTemplateId, setLastSentTemplateId] = useState<string | null>(null);
  const [justCopied, setJustCopied] = useState(false);

  const { data: templates = [], isLoading: templatesLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/admin/email-preview/templates"],
  });

  const sendMutation = useMutation({
    mutationFn: ({ to, templateId }: { to: string; templateId: string }) =>
      apiRequest("POST", "/api/admin/email-preview/send-test", { to, templateId }),
    onSuccess: async (res, variables) => {
      const data = await res.json();
      const label = data.templateLabel ? `${data.templateLabel} sent to ${variables.to}` : data.message;
      toast({ title: "Test email sent", description: label });
      setLastSentTemplateId(variables.templateId);
      setJustCopied(false);
    },
    onError: async (err: any) => {
      let msg = "Failed to send test email";
      try { msg = (await err.response?.json())?.error ?? msg; } catch {}
      toast({ title: "Failed to send", description: msg, variant: "destructive" });
      setLastSentTemplateId(null);
      setJustCopied(false);
    },
  });

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setIframeSrc(`/api/admin/email-preview/html/${id}`);
    setLastSentTemplateId(null);
    setJustCopied(false);
  };

  const handleCopyTemplateId = () => {
    if (!lastSentTemplateId) return;
    navigator.clipboard.writeText(lastSentTemplateId).then(() => {
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    }).catch(() => {
      toast({ title: "Copy failed", description: "Could not copy to clipboard — try selecting and copying the template ID manually.", variant: "destructive" });
    });
  };

  const handleSend = () => {
    if (!testEmail.trim()) {
      toast({ title: "Email address required", description: "Enter an address to send the test to.", variant: "destructive" });
      return;
    }
    sendMutation.mutate({ to: testEmail.trim(), templateId: selectedId });
  };

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const selected = templates.find((t) => t.id === selectedId);
  const selectedRc = selected ? recipientConfig[selected.recipient] : null;

  const grouped = GROUP_ORDER.reduce<Record<string, EmailTemplate[]>>((acc, g) => {
    const items = templates.filter((t) => t.group === g);
    if (items.length > 0) acc[g] = items;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      <AdminPageHeader
        title="Email Templates"
        description="Preview every outbound email and send test copies to any address"
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar — template list */}
        <aside className="w-64 shrink-0 border-r flex flex-col overflow-hidden bg-muted/30">
          <div className="p-3 border-b">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {templates.length} Templates
            </p>
          </div>
          <nav className="flex-1 overflow-y-auto py-2">
            {templatesLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-md bg-muted/50 animate-pulse mx-2 mb-1" />
                ))
              : GROUP_ORDER.filter((g) => grouped[g]).map((group) => {
                  const isCollapsed = collapsedGroups.has(group);
                  const items = grouped[group];
                  return (
                    <div key={group} className="mb-1">
                      <button
                        data-testid={`group-toggle-${group.toLowerCase()}`}
                        onClick={() => toggleGroup(group)}
                        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left hover-elevate"
                      >
                        {isCollapsed
                          ? <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />
                          : <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
                        }
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                          {group}
                        </span>
                        <span className="ml-auto text-[10px] text-muted-foreground/60 font-medium tabular-nums">
                          {items.length}
                        </span>
                      </button>

                      {!isCollapsed && (
                        <div className="px-2 space-y-0.5">
                          {items.map((t) => {
                            const rc = recipientConfig[t.recipient];
                            const isActive = t.id === selectedId;
                            return (
                              <button
                                key={t.id}
                                data-testid={`template-${t.id}`}
                                onClick={() => handleSelect(t.id)}
                                className={`w-full flex items-start gap-2 px-2.5 py-2.5 rounded-md text-left transition-colors ${
                                  isActive
                                    ? "bg-primary/10 text-foreground"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                }`}
                              >
                                <ChevronRight
                                  className={`w-3.5 h-3.5 mt-0.5 shrink-0 transition-opacity ${isActive ? "opacity-100 text-primary" : "opacity-0"}`}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className={`text-[12px] font-medium leading-snug truncate ${isActive ? "text-foreground" : ""}`}>
                                    {t.label}
                                  </p>
                                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge
                                          data-testid={`badge-recipient-${t.id}`}
                                          variant="outline"
                                          className={`text-[10px] px-1.5 py-0 h-4 font-medium border cursor-default ${rc.className}`}
                                        >
                                          <rc.icon className="w-2.5 h-2.5 mr-0.5 inline-block" />{rc.label}
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent side="right" className="max-w-xs">
                                        {rc.tooltip}
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge
                                          data-testid={`badge-send-type-${t.id}`}
                                          variant="outline"
                                          className={`text-[10px] px-1.5 py-0 h-4 font-medium border cursor-default ${
                                            t.liveSend
                                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                              : "bg-muted/60 text-muted-foreground border-border"
                                          }`}
                                        >
                                          {t.liveSend ? (
                                            <><Zap className="w-2.5 h-2.5 mr-0.5 inline-block" />Live</>
                                          ) : (
                                            <><FileCode className="w-2.5 h-2.5 mr-0.5 inline-block" />HTML</>
                                          )}
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent side="right" className="max-w-xs">
                                        {t.liveSend ? SEND_TYPE_TOOLTIPS.live : SEND_TYPE_TOOLTIPS.html}
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                  {PAIRED_TEMPLATES[t.id] && (() => {
                                    const pairedId = PAIRED_TEMPLATES[t.id];
                                    const paired = templates.find((p) => p.id === pairedId);
                                    if (!paired) return null;
                                    return (
                                      <div
                                        role="button"
                                        tabIndex={0}
                                        data-testid={`link-paired-${t.id}`}
                                        onClick={(e) => { e.stopPropagation(); handleSelect(pairedId); }}
                                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); handleSelect(pairedId); } }}
                                        className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground/70 hover:text-primary transition-colors group/pair cursor-pointer"
                                      >
                                        <Link2 className="w-2.5 h-2.5 shrink-0 group-hover/pair:text-primary" />
                                        <span className="truncate">Paired with <span className="font-medium">{paired.label}</span></span>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
          </nav>
        </aside>

        {/* Main — preview + send bar */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Info bar */}
          {selected && (
            <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b bg-background shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold truncate">{selected.label}</p>
                  {selectedRc && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        data-testid="badge-selected-recipient"
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-4 font-medium border shrink-0 cursor-default ${selectedRc.className}`}
                      >
                        <selectedRc.icon className="w-2.5 h-2.5 mr-0.5 inline-block" />{selectedRc.label}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      {selectedRc.tooltip}
                    </TooltipContent>
                  </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        data-testid="badge-selected-send-type"
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-4 font-medium border shrink-0 cursor-default ${
                          selected.liveSend
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-muted/60 text-muted-foreground border-border"
                        }`}
                      >
                        {selected.liveSend ? (
                          <><Zap className="w-2.5 h-2.5 mr-0.5 inline-block" />Live send</>
                        ) : (
                          <><FileCode className="w-2.5 h-2.5 mr-0.5 inline-block" />HTML preview</>
                        )}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      {selected.liveSend ? SEND_TYPE_TOOLTIPS.live : SEND_TYPE_TOOLTIPS.html}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-xs text-muted-foreground truncate">{selected.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Input
                  data-testid="input-test-email"
                  type="email"
                  placeholder="test@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  className="w-52 h-8 text-sm"
                />
                <Button
                  data-testid="button-send-test"
                  size="sm"
                  onClick={handleSend}
                  disabled={sendMutation.isPending}
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  {sendMutation.isPending ? "Sending…" : "Send test"}
                </Button>
                {lastSentTemplateId && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        data-testid="button-copy-template-id"
                        size="icon"
                        variant="ghost"
                        onClick={handleCopyTemplateId}
                      >
                        {justCopied
                          ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                          : <Copy className="w-3.5 h-3.5" />
                        }
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {justCopied ? "Copied!" : `Copy template ID: ${lastSentTemplateId}`}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          )}

          {/* Dual-recipient info */}
          {selected && DUAL_RECIPIENT_TEMPLATE_IDS.has(selected.id) && (
            <div
              data-testid="notice-dual-recipient"
              className="flex items-center gap-2.5 px-4 py-2 border-b bg-muted/40 text-muted-foreground shrink-0"
            >
              <Info className="w-3.5 h-3.5 shrink-0" />
              <p className="text-xs">
                Sends:{" "}
                <span className="font-medium text-foreground">
                  {selected.recipient === "customer" ? "customer confirmation only" : "admin notification only"}
                </span>
              </p>
            </div>
          )}

          {/* iFrame preview */}
          <div className="flex-1 min-h-0 bg-muted/20 overflow-hidden">
            <iframe
              key={iframeSrc}
              src={iframeSrc}
              data-testid="iframe-email-preview"
              title="Email preview"
              className="w-full h-full border-0"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
