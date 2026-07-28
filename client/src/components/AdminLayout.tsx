import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";
import { apiRequest, clearAuthToken } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import mtvLogoWide from "@assets/mtv-logo.svg";
import mtvLogoRound from "@assets/mtv-logo-round.svg";
import { useState, useEffect, useRef } from "react";
import { useEnquiryNotifications } from "@/hooks/useEnquiryNotifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AdminProfileModal } from "@/components/AdminProfileModal";
import { AdminHelpWidget } from "@/components/AdminHelpWidget";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  BarChart3,
  Bot,
  Car,
  Package,
  Wrench,
  FileText,
  Users,
  Shield,
  Globe,
  LogOut,
  Calculator,
  GraduationCap,
  Image,
  Video,
  Layers,
  UserRound,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  BookOpen,
  Menu,
  RefreshCw,
  Mail,
  Settings,
  Calendar,
  Phone,
  Clock,
  BookUser,
  Bell,
  BellOff,
  X,
  Tags,
  Palette,
  MonitorPlay,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  requiredRole: "basic" | "full";
}

const navGroups: { label: string; items: NavItem[]; collapsible?: boolean; defaultCollapsed?: boolean }[] = [
  {
    label: "Sales Tools",
    items: [
      { title: "Dashboard", href: "/admin", icon: LayoutDashboard, requiredRole: "basic" },
      { title: "Admin Configurator", href: "/admin/configurator", icon: UserRound, requiredRole: "basic" },
      { title: "Finance Calculator", href: "/admin/finance-calculator", icon: Calculator, requiredRole: "basic" },
    ],
  },
  {
    label: "CRM",
    items: [
      { title: "Customers", href: "/admin/customers", icon: BookUser, requiredRole: "basic" },
      { title: "Quote Requests", href: "/admin/quotes", icon: FileText, requiredRole: "basic" },
      { title: "Leads", href: "/admin/leads", icon: Users, requiredRole: "basic" },
      { title: "AI Conversations", href: "/admin/ai-conversations", icon: Bot, requiredRole: "basic" },
      { title: "Calendar", href: "/admin/calendar", icon: Calendar, requiredRole: "basic" },
      { title: "Analytics", href: "/admin/analytics", icon: BarChart3, requiredRole: "basic" },
      { title: "Artwork Approvals", href: "/admin/artwork-approvals", icon: Palette, requiredRole: "full" },
      { title: "Pipeline Board", href: "/admin/pipeline-board", icon: MonitorPlay, requiredRole: "basic" },
    ],
  },
  {
    label: "Content",
    items: [
      { title: "Vans", href: "/admin/vans", icon: Car, requiredRole: "basic" },
      { title: "Packs", href: "/admin/kits", icon: Package, requiredRole: "full" },
      { title: "Upgrades", href: "/admin/upgrades", icon: Wrench, requiredRole: "full" },
      { title: "SKU Manager", href: "/admin/sku-manager", icon: Tags, requiredRole: "full" },
      { title: "Stock Levels", href: "/admin/stock", icon: Package, requiredRole: "full" },
      { title: "Finance Plans", href: "/admin/finance-plans", icon: Calculator, requiredRole: "full" },
      { title: "Training", href: "/admin/training-options", icon: GraduationCap, requiredRole: "full" },
      { title: "Gallery", href: "/admin/gallery-items", icon: Image, requiredRole: "full" },
      { title: "Videos", href: "/admin/videos", icon: Video, requiredRole: "full" },
      { title: "Blog", href: "/admin/blog", icon: BookOpen, requiredRole: "full" },
      { title: "AI Packages", href: "/admin/ai-packages", icon: Layers, requiredRole: "full" },
      { title: "Max AI Settings", href: "/admin/max-settings", icon: Bot, requiredRole: "full" },
      { title: "Users", href: "/admin/users", icon: Shield, requiredRole: "full" },
      { title: "Email Templates", href: "/admin/email-preview", icon: Mail, requiredRole: "full" },
      { title: "Settings", href: "/admin/settings", icon: Settings, requiredRole: "full" },
    ],
  },
];

function NavLink({
  item,
  collapsed,
  isActive,
  badge,
}: {
  item: NavItem;
  collapsed: boolean;
  isActive: boolean;
  badge?: number;
}) {
  const Icon = item.icon;
  const inner = (
    <Link
      href={item.href}
      data-testid={`nav-admin-${item.href.split("/").pop()}`}
      className={`
        relative flex items-center gap-2.5 rounded-md text-[13px] font-medium
        transition-colors duration-150 cursor-pointer select-none
        ${collapsed ? "h-9 w-9 justify-center px-0" : "h-9 px-2.5"}
        ${isActive
          ? "bg-[hsl(86_45%_51%/0.12)] text-[hsl(86_53%_60%)]"
          : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]"
        }
      `}
    >
      {/* Left accent bar for active item */}
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-[hsl(var(--admin-nav-active-bar))]" />
      )}

      <div className="relative shrink-0 flex items-center justify-center">
        <Icon
          className={`${isActive ? "text-[hsl(86_53%_60%)]" : "text-zinc-500"}`}
          size={16}
        />
        {collapsed && badge != null && badge > 0 && (
          <span
            data-testid={`badge-nav-${item.href.split("/").pop()}-collapsed`}
            className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-[hsl(86_53%_51%)] text-black text-[9px] font-bold px-0.5 leading-none"
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>

      {!collapsed && <span className="truncate flex-1">{item.title}</span>}

      {!collapsed && badge != null && badge > 0 && (
        <Badge
          data-testid={`badge-nav-${item.href.split("/").pop()}`}
          className="ml-auto shrink-0 bg-[hsl(86_53%_51%/0.15)] text-[hsl(86_53%_60%)] border-[hsl(86_53%_51%/0.25)] text-[10px] font-semibold px-1.5 py-0 h-4.5 no-default-active-elevate"
        >
          {badge > 99 ? "99+" : badge}
        </Badge>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {item.title}
          {badge != null && badge > 0 && ` (${badge} new)`}
        </TooltipContent>
      </Tooltip>
    );
  }

  return inner;
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user } = useAuth() as { user: User | undefined };

  // Global enquiry polling — fires toast/browser notifications on any admin page
  const { isSnoozed, snoozeUntil, snooze, cancelSnooze } = useEnquiryNotifications();

  // In-app mute toggle — mirrors the dashboard bell; stored in localStorage
  const MUTE_KEY = "enquiry-notif-muted";
  const MUTE_EVENT = "enquiry-mute-changed";
  const [notifMuted, setNotifMuted] = useState<boolean>(() => localStorage.getItem(MUTE_KEY) === "1");

  // Keep state in sync when Dashboard (or another tab opener) toggles mute
  useEffect(() => {
    const sync = () => setNotifMuted(localStorage.getItem(MUTE_KEY) === "1");
    window.addEventListener(MUTE_EVENT, sync);
    return () => window.removeEventListener(MUTE_EVENT, sync);
  }, []);

  const toggleMute = () => {
    if (notifMuted) {
      localStorage.removeItem(MUTE_KEY);
    } else {
      localStorage.setItem(MUTE_KEY, "1");
    }
    setNotifMuted((m) => !m);
    window.dispatchEvent(new Event(MUTE_EVENT));
  };

  // Force a re-render every 30 s while snoozed so the remaining-time label updates
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isSnoozed) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [isSnoozed]);

  // Track which collapsible nav groups are open (keyed by label)
  // Content group starts collapsed; auto-expand if current route is inside it
  const isContentRoute = location.startsWith("/admin/vans") || location.startsWith("/admin/kits") ||
    location.startsWith("/admin/upgrades") || location.startsWith("/admin/finance-plans") ||
    location.startsWith("/admin/training-options") || location.startsWith("/admin/gallery-items") ||
    location.startsWith("/admin/videos") || location.startsWith("/admin/blog") ||
    location.startsWith("/admin/ai-packages") || location.startsWith("/admin/users") ||
    location.startsWith("/admin/email-preview") || location.startsWith("/admin/settings") ||
    location.startsWith("/admin/testimonials");

  const CONTENT_GROUP_KEY = "adminSidebar_Content_collapsed";

  const getInitialCollapsedState = (): boolean => {
    if (isContentRoute) return false;
    const saved = localStorage.getItem(CONTENT_GROUP_KEY);
    if (saved !== null) return saved === "true";
    return false;
  };

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    Content: getInitialCollapsedState(),
  });
  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      if (label === "Content") {
        localStorage.setItem(CONTENT_GROUP_KEY, String(next[label]));
      }
      return next;
    });
  };

  // Server version polling — detects when the backend has restarted (new deployment).
  // Uses sessionStorage so the baseline survives Vite-triggered page reloads in dev
  // and still works in production where the page doesn't auto-reload.
  const ADMIN_VERSION_KEY = "admin-initial-version";
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // Today's follow-up reminder modal
  const TODAY_MODAL_KEY = `followup-shown-${new Date().toISOString().split("T")[0]}`;
  const [todayModalOpen, setTodayModalOpen] = useState(false);
  const { data: todayFollowUps = [] } = useQuery<{
    id: string; customerName: string; customerPhone?: string | null;
    assignedToName?: string | null; notes?: string | null;
    completed?: boolean; leadId?: string | null; quoteId?: string | null;
  }[]>({
    queryKey: ["/api/admin/follow-ups/today"],
    enabled: !!(user?.adminRole && user.adminRole !== "none"),
  });
  const pendingTodayFus = todayFollowUps.filter((f) => !f.completed);

  useEffect(() => {
    if (pendingTodayFus.length > 0 && !sessionStorage.getItem(TODAY_MODAL_KEY)) {
      setTodayModalOpen(true);
      sessionStorage.setItem(TODAY_MODAL_KEY, "1");
    }
  }, [pendingTodayFus.length]);

  const { data: versionData } = useQuery<{ version: string }>({
    queryKey: ["/api/version"],
    refetchInterval: 30_000,
    staleTime: 0,
    enabled: !!(user?.adminRole && user.adminRole !== "none"),
  });

  useEffect(() => {
    if (!versionData?.version) return;
    const stored = sessionStorage.getItem(ADMIN_VERSION_KEY);
    if (!stored) {
      // First load — record this as the baseline
      sessionStorage.setItem(ADMIN_VERSION_KEY, versionData.version);
    } else if (versionData.version !== stored) {
      // Server has restarted with a new version since we loaded
      setUpdateAvailable(true);
    }
  }, [versionData]);

  // One tiny counts endpoint instead of polling the full quotes/leads/
  // conversations tables every minute just to render sidebar badges.
  const { data: countsData } = useQuery<{
    newQuotes: number;
    newLeads: number;
    uncontactedConversations: number;
  }>({
    queryKey: ["/api/admin/counts"],
    refetchInterval: 60_000,
    enabled: !!(user?.adminRole && user.adminRole !== "none"),
  });

  const NEW_CUSTOMERS_KEY = "new-customers-count";
  const [newCustomersCount, setNewCustomersCount] = useState<number>(() => {
    const val = sessionStorage.getItem(NEW_CUSTOMERS_KEY);
    return val ? parseInt(val, 10) : 0;
  });

  useEffect(() => {
    const handler = () => {
      const val = sessionStorage.getItem(NEW_CUSTOMERS_KEY);
      setNewCustomersCount(val ? parseInt(val, 10) : 0);
    };
    window.addEventListener("new-customers-updated", handler);
    return () => window.removeEventListener("new-customers-updated", handler);
  }, []);

  const uncontactedCount = countsData?.uncontactedConversations ?? 0;
  const newQuotesCount = countsData?.newQuotes ?? 0;
  const newLeadsCount = countsData?.newLeads ?? 0;

  const handleLogout = async () => {
    try { await apiRequest("POST", "/api/auth/logout"); } catch {}
    clearAuthToken();
    window.location.href = "/login";
  };

  const isActive = (href: string) => {
    if (href === "/admin") return location === "/admin";
    return location.startsWith(href);
  };

  const canSee = (role: "basic" | "full") => {
    if (!user?.adminRole || user.adminRole === "none") return false;
    if (user.adminRole === "full") return true;
    return role === "basic";
  };

  const sidebarContent = (isMobile = false) => (
    <div
      className={`
        flex flex-col h-full admin-sidebar-bg
        border-r admin-sidebar-border
        ${!isMobile ? (collapsed ? "w-[56px]" : "w-[220px]") : "w-[220px]"}
        transition-all duration-200
      `}
    >
      {/* Brand header */}
      {collapsed && !isMobile ? (
        <div className="flex items-center justify-center border-b admin-sidebar-border py-3.5">
          <button
            onClick={() => setCollapsed(false)}
            className="w-8 h-8 rounded-full overflow-hidden opacity-80 hover:opacity-100 transition-opacity shrink-0"
            data-testid="button-toggle-sidebar"
            title="Expand sidebar"
          >
            <img src={mtvLogoRound} alt="MTV" className="w-full h-full object-cover" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-3.5 border-b admin-sidebar-border">
          <img
            src={mtvLogoWide}
            alt="Mobile Tyre Vans"
            className="h-8 w-auto object-contain shrink-0"
            style={{ maxWidth: "115px" }}
          />
          <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.12em] leading-none">
              Admin
            </span>
            {!isMobile && (
              <button
                onClick={() => setCollapsed(true)}
                className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0 p-0.5"
                data-testid="button-toggle-sidebar"
              >
                <ChevronLeft size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navGroups.map((group, gi) => {
          const visible = group.items.filter((i) => canSee(i.requiredRole));
          if (!visible.length) return null;
          const isGroupCollapsed = group.collapsible && collapsedGroups[group.label];
          return (
            <div key={group.label} className={gi > 0 ? "pt-4" : ""}>
              {(!collapsed || isMobile) && (
                <button
                  className={`w-full flex items-center justify-between px-2.5 mb-1.5 ${group.collapsible ? "cursor-pointer hover:text-zinc-300 transition-colors" : "cursor-default"}`}
                  onClick={group.collapsible ? () => toggleGroup(group.label) : undefined}
                  data-testid={`nav-group-${group.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <p className="text-[10px] font-medium text-zinc-600 tracking-[0.08em]">
                    {group.label}
                  </p>
                  {group.collapsible && (
                    isGroupCollapsed
                      ? <ChevronRight size={11} className="text-zinc-600" />
                      : <ChevronLeft size={11} className="text-zinc-600" />
                  )}
                </button>
              )}
              {collapsed && !isMobile && gi > 0 && (
                <div className="border-t admin-sidebar-border mx-1 mb-2" />
              )}
              {!isGroupCollapsed && (
                <div className="space-y-0.5">
                  {visible.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      collapsed={collapsed && !isMobile}
                      isActive={isActive(item.href)}
                      badge={
                        item.href === "/admin/ai-conversations" ? uncontactedCount :
                        item.href === "/admin/quotes" ? newQuotesCount :
                        item.href === "/admin/leads" ? newLeadsCount :
                        item.href === "/admin/customers" ? newCustomersCount :
                        undefined
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t admin-sidebar-border p-2 space-y-0.5">
        {/* User profile row */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setProfileOpen(true)}
              className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] transition-colors ${collapsed && !isMobile ? "justify-center" : ""}`}
              data-testid="button-open-profile"
            >
              <Avatar className="w-6 h-6 shrink-0 ring-1 ring-white/10">
                <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || user?.username} />
                <AvatarFallback className="text-[9px] font-semibold bg-[hsl(86_45%_51%/0.15)] text-[hsl(86_53%_60%)]">
                  {user?.firstName?.[0] || user?.email?.[0] || "A"}
                </AvatarFallback>
              </Avatar>
              {(!collapsed || isMobile) && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[12px] font-medium text-zinc-300 truncate leading-tight">
                    {user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user?.email}
                  </p>
                  <p className="text-[10px] text-zinc-600 leading-tight">Edit profile</p>
                </div>
              )}
            </button>
          </TooltipTrigger>
          {(collapsed && !isMobile) && <TooltipContent side="right">Edit Profile</TooltipContent>}
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => window.open("/", "_blank")}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12px] text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05] transition-colors ${collapsed && !isMobile ? "justify-center" : ""}`}
              data-testid="button-view-main-site"
            >
              <Globe size={14} className="shrink-0" />
              {(!collapsed || isMobile) && <span>View Main Site</span>}
            </button>
          </TooltipTrigger>
          {(collapsed && !isMobile) && <TooltipContent side="right">View Main Site</TooltipContent>}
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12px] text-zinc-500 hover:text-red-400 hover:bg-red-500/[0.08] transition-colors ${collapsed && !isMobile ? "justify-center" : ""}`}
              data-testid="button-logout"
            >
              <LogOut size={14} className="shrink-0" />
              {(!collapsed || isMobile) && <span>Log Out</span>}
            </button>
          </TooltipTrigger>
          {(collapsed && !isMobile) && <TooltipContent side="right">Log Out</TooltipContent>}
        </Tooltip>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col shrink-0 no-print" style={{ transition: "width 200ms" }}>
        {sidebarContent(false)}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 flex flex-col h-full">
            {sidebarContent(true)}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center h-11 px-4 border-b admin-topbar-bg admin-topbar-border shrink-0 no-print gap-2">
          <button
            className="md:hidden text-zinc-400 hover:text-zinc-100 mr-3"
            onClick={() => setMobileOpen(true)}
            data-testid="button-mobile-menu"
          >
            <Menu size={18} />
          </button>
          <div className="flex-1" />

          {/* Snooze / mute notifications control */}
          {isSnoozed && snoozeUntil ? (
            <div className="flex items-center gap-1.5" data-testid="snooze-active-indicator">
              <BellOff size={13} className="text-amber-400 shrink-0" />
              <span className="text-[11px] text-amber-400 hidden sm:block whitespace-nowrap">
                Alerts snoozed until {new Date(snoozeUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={cancelSnooze}
                    className="text-zinc-500 hover:text-zinc-200 transition-colors"
                    data-testid="button-cancel-snooze"
                    aria-label="Cancel snooze"
                  >
                    <X size={13} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Cancel snooze</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button
                      className={`transition-colors p-1 rounded-md ${notifMuted ? "text-amber-400 hover:text-amber-300" : "text-zinc-500 hover:text-zinc-200"}`}
                      data-testid="button-snooze-notifications"
                      aria-label={notifMuted ? "Notifications muted" : "Snooze new-enquiry alerts"}
                    >
                      {notifMuted ? <BellOff size={14} /> : <Bell size={14} />}
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {notifMuted ? "Notifications muted — click to manage" : "Snooze or mute alerts"}
                </TooltipContent>
              </Tooltip>
              <PopoverContent
                side="bottom"
                align="end"
                className="w-52 p-1.5 space-y-0.5"
                data-testid="popover-snooze-options"
              >
                <p className="text-[10px] font-medium text-zinc-500 px-2 py-1 uppercase tracking-wide">
                  Snooze alerts for…
                </p>
                {([
                  { label: "30 minutes", ms: 30 * 60 * 1000 },
                  { label: "1 hour",     ms: 60 * 60 * 1000 },
                  { label: "4 hours",    ms: 4 * 60 * 60 * 1000 },
                ] as const).map(({ label, ms }) => (
                  <button
                    key={label}
                    onClick={() => snooze(ms)}
                    className="w-full text-left text-[13px] px-2 py-1.5 rounded-md text-zinc-300 hover:bg-white/[0.07] transition-colors"
                    data-testid={`button-snooze-${label.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    {label}
                  </button>
                ))}
                <div className="border-t border-white/[0.08] my-1" />
                <button
                  onClick={toggleMute}
                  className="w-full flex items-center gap-2 text-left text-[13px] px-2 py-1.5 rounded-md text-zinc-300 hover:bg-white/[0.07] transition-colors"
                  data-testid="button-toggle-mute-notifications"
                >
                  {notifMuted ? <Bell size={13} className="shrink-0 text-zinc-400" /> : <BellOff size={13} className="shrink-0 text-zinc-400" />}
                  {notifMuted ? "Unmute notifications" : "Mute notifications"}
                </button>
              </PopoverContent>
            </Popover>
          )}

          <span className="text-[11px] text-zinc-600 hidden sm:block">
            {user?.email}
          </span>
        </header>

        {/* Today's follow-up reminder modal */}
        <Dialog open={todayModalOpen} onOpenChange={setTodayModalOpen}>
          <DialogContent className="max-w-sm" data-testid="modal-today-followups">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-amber-400" />
                <DialogTitle>Follow-ups due today</DialogTitle>
              </div>
              <DialogDescription>
                You have {pendingTodayFus.length} customer follow-up{pendingTodayFus.length !== 1 ? "s" : ""} scheduled for today.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
              {pendingTodayFus.map((fu) => (
                <div key={fu.id} className="flex items-start gap-2 p-2.5 rounded-md bg-muted/50 border border-border/60">
                  <Phone className="w-3.5 h-3.5 mt-0.5 text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{fu.customerName}</p>
                    {fu.customerPhone && (
                      <a href={`tel:${fu.customerPhone}`} className="text-xs text-muted-foreground hover:text-foreground">
                        {fu.customerPhone}
                      </a>
                    )}
                    {fu.assignedToName && (
                      <p className="text-xs text-muted-foreground">Assigned: {fu.assignedToName}</p>
                    )}
                    {fu.notes && (
                      <p className="text-xs text-muted-foreground italic truncate">{fu.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setTodayModalOpen(false)} data-testid="button-dismiss-followups">
                Dismiss
              </Button>
              <Button
                onClick={() => {
                  setTodayModalOpen(false);
                  window.location.href = "/admin/calendar";
                }}
                data-testid="button-view-calendar"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Open Calendar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Update available modal */}
        <Dialog open={updateAvailable} onOpenChange={() => {}}>
          <DialogContent
            className="max-w-sm"
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
            data-testid="modal-update-available"
          >
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw className="w-4 h-4 text-amber-400" />
                <DialogTitle>Update available</DialogTitle>
              </div>
              <DialogDescription>
                The software has been updated. Refresh your browser now to get the latest version — some actions may not save correctly until you do.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                onClick={() => {
                  sessionStorage.removeItem(ADMIN_VERSION_KEY);
                  window.location.reload();
                }}
                data-testid="button-refresh-now"
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh now
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Page content */}
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto outline-none">
          {children}
        </main>
      </div>

      {/* Profile modal */}
      {user && (
        <AdminProfileModal
          user={user}
          open={profileOpen}
          onOpenChange={setProfileOpen}
        />
      )}

      {/* Admin Help AI Assistant — floating bottom-right */}
      <AdminHelpWidget />
    </div>
  );
}
