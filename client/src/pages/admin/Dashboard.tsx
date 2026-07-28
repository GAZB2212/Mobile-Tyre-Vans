import { useAuth } from "@/hooks/useAuth";
import type { User, Quote, Testimonial } from "@shared/schema";
import { useEffect, useRef, useState } from "react";
import { useIdlePolling } from "@/hooks/useIdlePolling";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { EnquiryFeed, type EnquiryLead, type EnquiryQuote } from "@/components/EnquiryFeed";
import { 
  Car, 
  Package, 
  Wrench, 
  FileText, 
  Users, 
  Shield,
  Globe,
  Settings,
  Calculator,
  GraduationCap,
  BarChart3,
  Image,
  Video,
  UserRound,
  Layers,
  TrendingUp,
  CheckCircle2,
  PoundSterling,
  LayoutDashboard,
  Star as QuoteIcon,
  ExternalLink,
  Mail,
  Inbox,
  Bell,
  BellOff,
  BellRing,
  AlertTriangle,
  Printer,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const COMMITTED_STATUSES = new Set(["deposit_taken", "finance_approved", "in_build", "in_workshop"]);
const COMMITTED_LABEL: Record<string, string> = {
  deposit_taken: "Deposit Taken",
  finance_approved: "Finance Approved",
  in_build: "In Build",
  in_workshop: "In Workshop",
};
const COMMITTED_BADGE: Record<string, string> = {
  deposit_taken: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300",
  finance_approved: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300",
  in_build: "bg-red-600 text-white",
  in_workshop: "bg-red-500 text-white",
};

function fmtGBP(pence: number) {
  return "£" + (pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function customerName(q: Quote): string {
  return q.userName || q.email || "Unknown";
}

const POLL_INTERVAL_MS = 60_000;

export default function AdminDashboard() {
  const { toast } = useToast();
  const isActive = useIdlePolling();
  const { user, isAuthenticated, isLoading } = useAuth() as {
    user: User | undefined;
    isAuthenticated: boolean;
    isLoading: boolean;
  };
  const [activeTab, setActiveTab] = useState<"overview" | "pipeline" | "enquiries">(() => {
    const saved = localStorage.getItem("adminDashboardActiveTab");
    if (saved === "overview" || saved === "pipeline" || saved === "enquiries") return saved;
    return "overview";
  });

  // Once the user profile loads, apply their server-side tab preference so the
  // correct tab is restored across devices and browsers.
  const serverTabApplied = useRef(false);
  useEffect(() => {
    if (serverTabApplied.current) return;
    const serverTab = user?.dashboardTab;
    if (serverTab === "overview" || serverTab === "pipeline" || serverTab === "enquiries") {
      serverTabApplied.current = true;
      setActiveTab(serverTab);
      localStorage.setItem("adminDashboardActiveTab", serverTab);
    } else if (user && !isLoading) {
      // User loaded but no server preference yet — mark as applied so we don't re-run
      serverTabApplied.current = true;
    }
  }, [user, isLoading]);

  const handleTabChange = (tab: "overview" | "pipeline" | "enquiries") => {
    setActiveTab(tab);
    localStorage.setItem("adminDashboardActiveTab", tab);
    // Persist preference to server (fire-and-forget)
    apiRequest("PATCH", "/api/auth/preferences", { dashboardTab: tab }).catch(() => {
      // Non-critical — local state already updated
    });
  };

  const { data: quotes = [] } = useQuery<Quote[]>({
    queryKey: ["/api/admin/quotes"],
    enabled: !!(user?.adminRole && user.adminRole !== "none"),
    refetchInterval: isActive ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });

  const { data: testimonials = [] } = useQuery<Testimonial[]>({
    queryKey: ["/api/admin/testimonials"],
    enabled: !!(user?.adminRole && user.adminRole === "full"),
  });

  const { data: lowStockData } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/stock/low-stock-count"],
    enabled: !!(user?.adminRole && user.adminRole !== "none"),
  });
  const lowStockCount = lowStockData?.count ?? 0;

  // The polling and toast/browser notification logic is handled globally by
  // useEnquiryNotifications inside AdminLayout.  Here we just read the cached
  // data (same query key) for display purposes — no extra refetch interval needed.
  const { data: recentEnquiries } = useQuery<{
    leads: EnquiryLead[];
    quotes: EnquiryQuote[];
    todayNewLeadCount: number;
    todayNewQuoteCount: number;
  }>({
    queryKey: ["/api/admin/enquiries/recent"],
    enabled: !!(user?.adminRole && user.adminRole !== "none"),
  });

  const enquiryLeads = recentEnquiries?.leads ?? [];
  const enquiryQuotes = recentEnquiries?.quotes ?? [];

  // Use server-computed counts (covers all items, not just the limited feed page)
  const unreadCount = (recentEnquiries?.todayNewLeadCount ?? 0) + (recentEnquiries?.todayNewQuoteCount ?? 0);


  // ── Notification permission bell (task-301 / task-312) ──────────────────────
  // Track the current browser notification permission state so the bell icon
  // stays in sync even when the user changes settings in the browser.
  // Polling and toast/browser-notification firing are handled globally by
  // useEnquiryNotifications inside AdminLayout — this is only the UI state.
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(() => {
    if (typeof Notification === "undefined") return "unsupported";
    return Notification.permission;
  });

  // In-app mute toggle — stored in localStorage so it persists across sessions.
  // When muted, useEnquiryNotifications skips firing toasts and browser alerts.
  const MUTE_KEY = "enquiry-notif-muted";
  const MUTE_EVENT = "enquiry-mute-changed";
  const [notifMuted, setNotifMuted] = useState<boolean>(() => localStorage.getItem(MUTE_KEY) === "1");

  // Keep mute state in sync when AdminLayout (or the header bell) toggles it
  useEffect(() => {
    const sync = () => setNotifMuted(localStorage.getItem(MUTE_KEY) === "1");
    window.addEventListener(MUTE_EVENT, sync);
    return () => window.removeEventListener(MUTE_EVENT, sync);
  }, []);

  // Keep the bell icon in sync when the mute flag is toggled in another tab.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "enquiry-notif-muted") {
        setNotifMuted(e.newValue === "1");
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Re-read the permission whenever the tab becomes visible (e.g. after the
  // user opens browser settings and comes back).
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setNotifPermission(Notification.permission);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Handler for the notification bell button in the enquiries header.
  const handleNotifBellClick = async () => {
    if (typeof Notification === "undefined") {
      toast({ title: "Not supported", description: "Your browser does not support desktop notifications.", variant: "destructive" });
      return;
    }
    if (Notification.permission === "denied") {
      toast({
        title: "Notifications blocked",
        description: "Open your browser settings and allow notifications for this site, then return here.",
      });
      return;
    }
    if (Notification.permission === "granted") {
      // Toggle the in-app mute preference; notify sibling components via event.
      if (notifMuted) {
        localStorage.removeItem(MUTE_KEY);
        setNotifMuted(false);
        window.dispatchEvent(new Event(MUTE_EVENT));
        toast({ title: "Notifications unmuted", description: "You will receive alerts when new enquiries arrive." });
      } else {
        localStorage.setItem(MUTE_KEY, "1");
        setNotifMuted(true);
        window.dispatchEvent(new Event(MUTE_EVENT));
        toast({ title: "Notifications muted", description: "Alerts are paused. Click the bell again to re-enable them." });
      }
      return;
    }
    // "default" — ask for permission
    localStorage.setItem("enquiry-notif-asked", "1");
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    if (result === "granted") {
      toast({ title: "Notifications enabled", description: "You will now receive browser alerts when new enquiries arrive." });
    } else if (result === "denied") {
      toast({
        title: "Notifications blocked",
        description: "Open your browser settings and allow notifications for this site to re-enable them.",
        variant: "destructive",
      });
    }
  };
  // ──────────────────────────────────────────────────────────────────────────

  const publishedTestimonialsCount = testimonials.filter(t => t.published).length;

  const committedQuotes = quotes.filter(q => COMMITTED_STATUSES.has(q.status));
  const committedTotal = committedQuotes.reduce((sum, q) => sum + (q.estTotal ?? 0), 0);

  const completedQuotes = quotes.filter(q => q.status === "completed");
  const completedTotal = completedQuotes.reduce((sum, q) => sum + (q.estTotal ?? 0), 0);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => { window.location.href = "/login"; }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  useEffect(() => {
    if (user && (!user.adminRole || user.adminRole === "none")) {
      toast({
        title: "Access Denied",
        description: "Admin access required.",
        variant: "destructive",
      });
      setTimeout(() => { window.location.href = "/"; }, 1000);
    }
  }, [user, toast]);

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

  if (!isAuthenticated || !user?.adminRole || user.adminRole === "none") return null;

  const allManagementItems = [
    { title: "Analytics Dashboard", description: "Track site performance and customer activity", icon: BarChart3, href: "/admin/analytics", badge: "Analytics", requiredRole: "basic" as const },
    { title: "Manage Vans", description: "Add, edit, and manage van inventory", icon: Car, href: "/admin/vans", badge: "Inventory", requiredRole: "basic" as const },
    { title: "Manage Packs", description: "Configure equipment packages and pricing", icon: Package, href: "/admin/kits", badge: "Products", requiredRole: "full" as const },
    { title: "Manage Upgrades", description: "Add and organize upgrade options", icon: Wrench, href: "/admin/upgrades", badge: "Options", requiredRole: "full" as const },
    { title: "Manage Finance Plans", description: "Configure financing options for customers", icon: Calculator, href: "/admin/finance-plans", badge: "Finance", requiredRole: "full" as const },
    { title: "Manage Training Options", description: "Configure training programmes for configurator", icon: GraduationCap, href: "/admin/training-options", badge: "Training", requiredRole: "full" as const },
    { title: "Manage Gallery Items", description: "Upload and manage gallery images and videos", icon: Image, href: "/admin/gallery-items", badge: "Content", requiredRole: "full" as const },
    { title: "Manage Blog", description: "Write and publish blog posts and articles", icon: Globe, href: "/admin/blog", badge: "Blog", requiredRole: "full" as const },
    { title: "Manage Site Videos", description: "Upload hero video and 360° render videos — changes go live instantly", icon: Video, href: "/admin/videos", badge: "Videos", requiredRole: "full" as const },
    { title: "AI Packages", description: "Configure Bronze, Silver and Gold package tiers for the AI assistant to recommend", icon: Layers, href: "/admin/ai-packages", badge: "AI", requiredRole: "full" as const },
    { title: "Manage Testimonials", description: "Add, edit, and manage customer testimonials on the homepage", icon: QuoteIcon, href: "/admin/testimonials", badge: "Content", requiredRole: "basic" as const },
    { title: "Manage Users", description: "Assign roles and manage admin access", icon: Shield, href: "/admin/users", badge: "Security", requiredRole: "full" as const },
    { title: "Email Preview", description: "Send branded preview emails to any address so the team can sign off the design", icon: Mail, href: "/admin/email-preview", badge: "Email", requiredRole: "full" as const },
  ];

  const salesToolItems = [
    { title: "Admin Configurator", description: "Build a spec live on a call — compare vans, add kit and upgrades, calculate monthly payments in real time, then save as a quote", icon: UserRound, href: "/admin/configurator", badge: "Sales Tool", requiredRole: "basic" as const },
    { title: "Finance Calculator", description: "Quick standalone finance calculator — enter price, deposit and term to get instant monthly and weekly repayment figures", icon: Calculator, href: "/admin/finance-calculator", badge: "Sales Tool", requiredRole: "basic" as const },
  ];

  const allLeadsItems = [
    { title: "Configurators", description: "Review and manage all customer quote requests", icon: FileText, href: "/admin/quotes", badge: "Sales", requiredRole: "basic" as const },
    { title: "Leads", description: "Manage customer inquiries and contact form submissions", icon: Users, href: "/admin/leads", badge: "CRM", requiredRole: "basic" as const },
  ];

  const managementItems = allManagementItems.filter(item => {
    if (!user?.adminRole) return false;
    if (user.adminRole === "full") return true;
    return item.requiredRole === "basic";
  });

  const leadsItems = allLeadsItems.filter(item => {
    if (!user?.adminRole) return false;
    if (user.adminRole === "full") return true;
    return item.requiredRole === "basic";
  });

  return (
    <div className="min-h-full">
      <AdminPageHeader
        title="Dashboard"
        description={`Welcome back, ${user?.firstName || user?.email}`}
        actions={
          <div className="flex gap-1">
            <Button
              variant={activeTab === "overview" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleTabChange("overview")}
              data-testid="button-tab-overview"
            >
              <LayoutDashboard className="w-3.5 h-3.5 mr-1.5" />
              Overview
            </Button>
            <Button
              variant={activeTab === "pipeline" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleTabChange("pipeline")}
              data-testid="button-tab-pipeline"
            >
              <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
              Pipeline
              {committedQuotes.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 no-default-active-elevate">{committedQuotes.length}</Badge>
              )}
            </Button>
            <Button
              variant={activeTab === "enquiries" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleTabChange("enquiries")}
              data-testid="button-tab-enquiries"
            >
              <Inbox className="w-3.5 h-3.5 mr-1.5" />
              Enquiries
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 no-default-active-elevate">{unreadCount}</Badge>
              )}
            </Button>
          </div>
        }
      />

      <div className="container mx-auto px-4 py-6 space-y-8">

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <div className="space-y-10">

            {/* Low stock warning */}
            {lowStockCount > 0 && (
              <Link href="/admin/stock">
                <div className="flex items-center gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 cursor-pointer hover-elevate">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-sm flex-1">
                    <strong>{lowStockCount}</strong> component{lowStockCount !== 1 ? "s are" : " is"} at or below the low stock threshold.
                    <span className="ml-2 underline underline-offset-2 text-muted-foreground">View stock levels →</span>
                  </p>
                </div>
              </Link>
            )}

            {/* Sales Tools */}
            {user?.adminRole && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <UserRound className="w-5 h-5 text-accent" />
                  Sales Tools
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {salesToolItems.map(item => (
                    <Card key={item.href} className="hover-elevate cursor-pointer transition-all">
                      <Link href={item.href} className="block h-full" data-testid={`link-admin-${item.href.split('/').pop()}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center space-x-2">
                              <item.icon className="w-5 h-5 text-accent" />
                              <CardTitle className="text-lg">{item.title}</CardTitle>
                            </div>
                            <Badge variant="outline">{item.badge}</Badge>
                          </div>
                          <CardDescription>{item.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <span>Click to open →</span>
                          </div>
                        </CardContent>
                      </Link>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Leads & CRM */}
            {leadsItems.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-accent" />
                  Leads
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {leadsItems.map((item) => (
                    <Card key={item.href} className="hover-elevate cursor-pointer transition-all">
                      <Link href={item.href} className="block h-full" data-testid={`link-admin-${item.href.split('/').pop()}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center space-x-2">
                              <item.icon className="w-5 h-5 text-accent" />
                              <CardTitle className="text-lg">{item.title}</CardTitle>
                            </div>
                            <Badge variant="outline">{item.badge}</Badge>
                          </div>
                          <CardDescription>{item.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <span>Click to open →</span>
                          </div>
                        </CardContent>
                      </Link>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Site Management */}
            {managementItems.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-accent" />
                  Site Management
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {managementItems.map((item) => (
                    <Card key={item.href} className="hover-elevate cursor-pointer transition-all">
                      <Link href={item.href} className="block h-full" data-testid={`link-admin-${item.href.split('/').pop()}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center space-x-2">
                              <item.icon className="w-5 h-5 text-accent" />
                              <CardTitle className="text-lg">{item.title}</CardTitle>
                            </div>
                            <Badge variant="outline">{item.badge}</Badge>
                          </div>
                          <CardDescription>{item.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <span>Click to manage →</span>
                          </div>
                        </CardContent>
                      </Link>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Getting Started</CardTitle>
                <CardDescription>
                  Use this admin panel to manage your mobile tyre van business content
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 className="font-medium mb-2">Content Management</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Add and edit van inventory</li>
                      <li>• Configure equipment packages</li>
                      <li>• Manage upgrade options and pricing</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Customer Data</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Review customer quotes</li>
                      <li>• Manage leads and inquiries</li>
                      <li>• Track sales and conversions</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── PIPELINE & JOBS TAB ── */}
        {activeTab === "pipeline" && (
          <div className="space-y-10">

            {/* Committed Pipeline */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-accent" />
                Committed Pipeline
                {committedQuotes.length > 0 && (
                  <Badge variant="outline" className="ml-1">{committedQuotes.length} job{committedQuotes.length !== 1 ? "s" : ""}</Badge>
                )}
              </h2>

              {committedQuotes.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground text-sm">
                    No committed jobs at the moment.
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <CardDescription>Jobs with deposit taken, finance approved, or in build</CardDescription>
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        <PoundSterling className="w-4 h-4 text-accent" />
                        <span>Pipeline value: <span className="text-accent">{fmtGBP(committedTotal)}</span></span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {committedQuotes.map((q) => (
                        <div
                          key={q.id}
                          className="flex items-center gap-3 px-4 py-3"
                          data-testid={`row-pipeline-quote-${q.id}`}
                        >
                          <span className={`shrink-0 inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${COMMITTED_BADGE[q.status] ?? "bg-muted text-muted-foreground"}`}>
                            {COMMITTED_LABEL[q.status] ?? q.status}
                          </span>
                          <Link
                            href={`/admin/quotes/${q.id}?from=quotes`}
                            className="flex-1 min-w-0 hover:underline underline-offset-2 cursor-pointer"
                            data-testid={`link-pipeline-quote-${q.id}`}
                          >
                            <p className="text-sm font-medium truncate">{customerName(q)}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {q.company ? q.company : <span className="italic">No company</span>}
                            </p>
                            {q.vanTitle && (
                              <p className="text-xs text-muted-foreground truncate">{q.vanTitle}</p>
                            )}
                          </Link>
                          {q.estTotal != null && q.estTotal > 0 && (
                            <span className="shrink-0 text-sm font-semibold tabular-nums">
                              {fmtGBP(q.estTotal)}
                            </span>
                          )}
                          <div className="shrink-0 flex items-center gap-1">
                            <Link
                              href={`/admin/quotes/${q.id}?tab=configuration&from=quotes`}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover-elevate"
                              data-testid={`link-pipeline-edit-config-${q.id}`}
                              title="Edit configuration"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Edit Config
                            </Link>
                            <Link
                              href={`/admin/quotes/${q.id}/build-sheet`}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover-elevate"
                              data-testid={`link-pipeline-build-sheet-${q.id}`}
                              title="Build sheet"
                            >
                              <Printer className="w-3 h-3" />
                              Build Sheet
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Completed Jobs */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-accent" />
                Completed Jobs
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="flex items-center gap-4 py-5">
                    <div className="rounded-md bg-accent/10 p-2.5">
                      <CheckCircle2 className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Completed</p>
                      <p className="text-2xl font-bold" data-testid="text-completed-count">{completedQuotes.length}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-4 py-5">
                    <div className="rounded-md bg-accent/10 p-2.5">
                      <PoundSterling className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Value</p>
                      <p className="text-2xl font-bold text-accent" data-testid="text-completed-total">{fmtGBP(completedTotal)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

          </div>
        )}

        {/* ── ENQUIRIES TAB ── */}
        {activeTab === "enquiries" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Inbox className="w-5 h-5 text-accent" />
                  Live Enquiry Inbox
                  {/* Notification permission bell */}
                  {notifPermission !== "unsupported" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleNotifBellClick}
                          data-testid="button-notif-permission"
                          className={
                            notifPermission === "granted" && !notifMuted
                              ? "text-accent"
                              : notifPermission === "denied"
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }
                        >
                          {notifPermission === "granted" && !notifMuted ? (
                            <BellRing className="w-4 h-4" />
                          ) : notifPermission === "granted" && notifMuted ? (
                            <BellOff className="w-4 h-4" />
                          ) : notifPermission === "denied" ? (
                            <BellOff className="w-4 h-4" />
                          ) : (
                            <Bell className="w-4 h-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {notifPermission === "granted" && !notifMuted
                          ? "Notifications are on — click to mute"
                          : notifPermission === "granted" && notifMuted
                          ? "Notifications muted — click to re-enable"
                          : notifPermission === "denied"
                          ? "Notifications blocked — click for instructions"
                          : "Click to enable browser notifications"}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Auto-refreshes every 30 seconds. Items received in the last 24 hours are highlighted.
                </p>
              </div>
              {unreadCount > 0 && (
                <Badge className="no-default-active-elevate">
                  {unreadCount} new today
                </Badge>
              )}
            </div>

            <Card>
              <CardContent className="pt-6">
                <EnquiryFeed leads={enquiryLeads} quotes={enquiryQuotes} />
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}
