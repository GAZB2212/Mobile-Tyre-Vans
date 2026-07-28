import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Phone,
  MessageSquare,
  Globe,
  FileText,
  Users,
  ArrowRight,
  Car,
  CheckCheck,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export type EnquiryLead = {
  kind: "lead";
  id: string;
  name: string;
  phone: string | null;
  email: string;
  source: string;
  status: string;
  createdAt: Date | string | null;
};

export type EnquiryQuote = {
  kind: "quote";
  id: string;
  name: string;
  phone: string | null;
  email: string;
  source: string;
  status: string;
  createdAt: Date | string | null;
  vanTitle: string | null;
  kitName: string | null;
  estTotal: number;
};

type EnquiryItem = EnquiryLead | EnquiryQuote;

const SOURCE_LABELS: Record<string, string> = {
  live_chat: "Live Chat",
  contact_form: "Contact Form",
  home_enquiry: "Home Enquiry",
  configurator: "Configurator",
};

const LEAD_STATUS_COLOURS: Record<string, string> = {
  new:       "bg-blue-500/15 text-blue-400 border-blue-500/25",
  contacted: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  qualified: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  converted: "bg-green-500/15 text-green-400 border-green-500/25",
  closed:    "bg-muted/60 text-muted-foreground border-border/60",
  dead:      "bg-red-500/10 text-red-400 border-red-500/20",
};

const QUOTE_STATUS_COLOURS: Record<string, string> = {
  new:               "bg-blue-500/10 text-blue-400 border-blue-500/20",
  contacted:         "bg-violet-500/10 text-violet-400 border-violet-500/20",
  awaiting_deposit:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  awaiting_finance:  "bg-orange-500/10 text-orange-400 border-orange-500/20",
  finance_declined:  "bg-red-500/10 text-red-400 border-red-500/20",
  deposit_taken:     "bg-lime-500/10 text-lime-400 border-lime-500/20",
  finance_approved:  "bg-lime-500/10 text-lime-400 border-lime-500/20",
  in_build:          "bg-[hsl(86_45%_51%/0.15)] text-[hsl(86_53%_60%)] border-[hsl(86_53%_51%/0.25)]",
  in_workshop:       "bg-red-500/15 text-red-300 border-red-500/30",
  completed:         "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  cancelled:         "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "New", contacted: "Contacted", qualified: "Qualified",
  converted: "Converted", closed: "Closed", dead: "Dead Lead",
};

const QUOTE_STATUS_LABELS: Record<string, string> = {
  new: "New", contacted: "Contacted", awaiting_deposit: "Awaiting Deposit",
  awaiting_finance: "Finance Submitted", finance_declined: "Finance Declined",
  deposit_taken: "Deposit Taken", finance_approved: "Finance Approved",
  in_build: "In Build", in_workshop: "In Workshop", completed: "Completed", cancelled: "Cancelled",
};

function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return "Unknown";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function isNewToday(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  return Date.now() - new Date(date).getTime() < 24 * 60 * 60 * 1000;
}

function fmtGBP(pence: number): string {
  return "£" + (pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function SourceIcon({ source }: { source: string }) {
  if (source === "live_chat") return <MessageSquare className="w-3.5 h-3.5" />;
  if (source === "contact_form") return <FileText className="w-3.5 h-3.5" />;
  if (source === "home_enquiry") return <Globe className="w-3.5 h-3.5" />;
  if (source === "configurator") return <Car className="w-3.5 h-3.5" />;
  return <Globe className="w-3.5 h-3.5" />;
}

function EnquiryCard({ item }: { item: EnquiryItem }) {
  const fresh = isNewToday(item.createdAt);
  const isLead = item.kind === "lead";
  const isNew = item.status === "new";

  const statusColour = isLead
    ? (LEAD_STATUS_COLOURS[item.status] ?? "bg-muted/60 text-muted-foreground border-border/60")
    : (QUOTE_STATUS_COLOURS[item.status] ?? "bg-muted/60 text-muted-foreground border-border/60");

  const statusLabel = isLead
    ? (LEAD_STATUS_LABELS[item.status] ?? item.status)
    : (QUOTE_STATUS_LABELS[item.status] ?? item.status);

  const href = isLead
    ? `/admin/leads?focus=${item.id}`
    : `/admin/quotes/${item.id}?from=dashboard`;

  const endpoint = isLead
    ? `/api/admin/leads/${item.id}`
    : `/api/admin/quotes/${item.id}`;

  type RecentEnquiries = {
    leads: EnquiryLead[];
    quotes: EnquiryQuote[];
    todayNewLeadCount: number;
    todayNewQuoteCount: number;
  };

  const markContacted = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", endpoint, { status: "contacted" }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["/api/admin/enquiries/recent"] });
      const previous = queryClient.getQueryData<RecentEnquiries>(["/api/admin/enquiries/recent"]);
      queryClient.setQueryData<RecentEnquiries>(["/api/admin/enquiries/recent"], (old) => {
        if (!old) return old;
        if (isLead) {
          return {
            ...old,
            leads: old.leads.map(l => l.id === item.id ? { ...l, status: "contacted" } : l),
            todayNewLeadCount: fresh ? Math.max(0, old.todayNewLeadCount - 1) : old.todayNewLeadCount,
          };
        }
        return {
          ...old,
          quotes: old.quotes.map(q => q.id === item.id ? { ...q, status: "contacted" } : q),
          todayNewQuoteCount: fresh ? Math.max(0, old.todayNewQuoteCount - 1) : old.todayNewQuoteCount,
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/admin/enquiries/recent"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/enquiries/recent"] });
      queryClient.invalidateQueries({ queryKey: [isLead ? "/api/admin/leads" : "/api/admin/quotes"] });
    },
  });

  return (
    <Link
      href={href}
      data-testid={`link-enquiry-${item.kind}-${item.id}`}
      className={[
        "block rounded-md border px-4 py-3 transition-colors hover-elevate cursor-pointer",
        fresh && isNew
          ? "bg-accent/5 border-accent/20"
          : "bg-card border-border/50",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5 rounded-md bg-muted/60 p-1.5">
          <SourceIcon source={item.source} />
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{item.name || "Unknown"}</span>
            {fresh && isNew && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">New</span>
            )}
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 no-default-active-elevate">
              {isLead ? "Lead" : "Configurator"}
            </Badge>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 border ${statusColour} no-default-active-elevate`}
            >
              {statusLabel}
            </Badge>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 no-default-active-elevate">
              <SourceIcon source={item.source} />
              <span className="ml-1">{SOURCE_LABELS[item.source] ?? item.source.replace(/_/g, " ")}</span>
            </Badge>
          </div>

          {item.kind === "quote" && (item.vanTitle || item.kitName) && (
            <p className="text-xs text-muted-foreground truncate">
              {[item.vanTitle, item.kitName].filter(Boolean).join(" · ")}
            </p>
          )}

          {item.phone && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="w-3 h-3 shrink-0" />
              {item.phone}
            </p>
          )}
        </div>

        <div className="shrink-0 text-right space-y-1">
          <p className="text-xs text-muted-foreground whitespace-nowrap">{relativeTime(item.createdAt)}</p>
          {item.kind === "quote" && item.estTotal > 0 && (
            <p className="text-xs font-semibold tabular-nums text-accent">{fmtGBP(item.estTotal)}</p>
          )}
          {isNew && (
            <Button
              variant="outline"
              size="sm"
              data-testid={`button-mark-contacted-${item.kind}-${item.id}`}
              disabled={markContacted.isPending}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                markContacted.mutate();
              }}
              className="text-[10px] h-6 px-2 mt-1 whitespace-nowrap"
            >
              <CheckCheck className="w-3 h-3 mr-1" />
              {markContacted.isPending ? "Saving…" : "Mark Contacted"}
            </Button>
          )}
        </div>
      </div>
    </Link>
  );
}

interface EnquiryFeedProps {
  leads: EnquiryLead[];
  quotes: EnquiryQuote[];
}

export function EnquiryFeed({ leads, quotes }: EnquiryFeedProps) {
  const combined: EnquiryItem[] = [...leads, ...quotes].sort((a, b) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bt - at;
  });

  return (
    <div className="space-y-3">
      {combined.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No recent enquiries.</p>
      ) : (
        combined.map(item => <EnquiryCard key={`${item.kind}-${item.id}`} item={item} />)
      )}

      {/* Footer view-all links */}
      {(leads.length > 0 || quotes.length > 0) && (
        <div className="flex items-center justify-between gap-4 pt-3 border-t border-border/50 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/leads" data-testid="link-view-all-leads">
              <Users className="w-3.5 h-3.5 mr-1.5" />
              View all leads
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/quotes" data-testid="link-view-all-quotes">
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              View all configurators
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
