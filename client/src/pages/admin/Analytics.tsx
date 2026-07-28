import { useAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchJson } from "@/lib/queryClient";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  TrendingUp, Users, FileText, Car, Package,
  ArrowLeft, Activity, CalendarDays, Globe, Monitor,
  Smartphone, Tablet, MousePointer, Eye, Timer,
  BarChart2, RefreshCw, Zap, ChevronDown,
  Bot, Phone, CheckCircle2, XCircle, MessageSquare, Percent, Star, Layers, AlertTriangle
} from "lucide-react";

interface PackageTierStats {
  id: string;
  name: string;
  tier: number;
  count: number;
  pct: number;
}

interface VolumeSegmentStats {
  segment: "high" | "standard";
  label: string;
  totalQuotes: number;
  packageTierDistribution: PackageTierStats[];
  dominantPackageTier: PackageTierStats | null;
}

interface UpgradeSelectionStat {
  id: string;
  name: string;
  category: string;
  count: number;
  pct: number;
}

interface KitSelectionStat {
  id: string;
  name: string;
  count: number;
  pct: number;
}

interface PopularityData {
  totalMeaningfulQuotes: number;
  allKits: KitSelectionStat[];
  allUpgradesOverall: UpgradeSelectionStat[];
  rate48v: number;
  packageTierDistribution: PackageTierStats[];
  dominantPackageTier: PackageTierStats | null;
  volumeSegments: VolumeSegmentStats[];
}

interface BusinessAnalytics {
  overview: {
    totalQuotes: number;
    totalLeads: number;
    totalVans: number;
    publishedVans: number;
    recentQuotes: number;
    recentLeads: number;
  };
  quotesByStatus: Record<string, number>;
  popularVans: Array<{ vanId: string; title: string; count: number }>;
  popularKits: Array<{ kitId: string; count: number }>;
  volumeSegments: VolumeSegmentStats[];
  popularity: PopularityData;
  recentActivity: {
    quotes: Array<{ id: string; customerName: string; customerEmail: string; status: string; totalPrice: number; createdAt: string }>;
    leads: Array<{ id: string; name: string; email: string; subject: string; createdAt: string }>;
  };
}

interface WebAnalytics {
  overview: {
    totalSessions: number;
    totalPageviews: number;
    avgDuration: number;
    bounceRate: number;
    pagesPerSession: number;
  };
  dailyStats: Array<{ date: string; sessions: string; pageviews: string }>;
  trafficSources: Array<{ source: string; count: string }>;
  topPages: Array<{ url: string; views: string; unique_visitors: string }>;
  devices: Array<{ device: string; count: string }>;
  browsers: Array<{ browser: string; count: string }>;
  operatingSystems: Array<{ os: string; count: string }>;
  topEvents: Array<{ event_name: string; count: string }>;
  campaigns: Array<{ source: string; medium: string; campaign: string; sessions: string; pageviews: string; avg_duration: string }>;
  recentSessions: Array<{ session_id: string; device_type: string; browser: string; os: string; referrer: string; entry_page: string; exit_page: string; page_count: number; bounce: boolean; duration_seconds: number; utm_source: string; utm_medium: string; utm_campaign: string; started_at: string; last_seen_at: string }>;
  topReferrers: Array<{ domain: string; count: string }>;
}

const CHART_COLORS = ["#8bc440", "#60a5fa", "#f472b6", "#fb923c", "#a78bfa", "#34d399", "#facc15", "#f87171"];

const SOURCE_COLORS: Record<string, string> = {
  "Direct": "#8bc440",
  "Organic Search": "#60a5fa",
  "Social": "#f472b6",
  "Referral": "#fb923c",
  "Paid Search": "#a78bfa",
  "Campaign": "#34d399",
};

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0s";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatUrl(url: string): string {
  if (!url) return "/";
  return url.length > 40 ? url.substring(0, 40) + "…" : url;
}

interface AiPeriodStats {
  total: number; completed: number; abandoned: number; inProgress: number;
  leadsCapured: number; includes48v: number; pitched48v: number; configCompleted: number;
  completionRate: number; leadCaptureRate: number; v48PitchRate: number; v48ConvRate: number;
}
interface AiAnalytics {
  allTime: AiPeriodStats;
  thisMonth: AiPeriodStats;
  daily: Array<{ date: string; total: number; completed: number; abandoned: number; leads: number }>;
  statusBreakdown: Array<{ status: string; count: number }>;
}

export default function AdminAnalytics() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth() as {
    user: User | undefined;
    isAuthenticated: boolean;
    isLoading: boolean;
  };
  const [activeTab, setActiveTab] = useState<"web" | "business" | "configurators" | "max_ai" | "popularity">("web");
  const [days, setDays] = useState("30");

  // Configurators date range — default: last 30 days
  const defaultTo = new Date();
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 29);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: defaultFrom, to: defaultTo });
  const [calendarOpen, setCalendarOpen] = useState(false);

  const fmtDate = (d: Date | undefined) =>
    d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

  const configuratorFrom = dateRange?.from ? dateRange.from.toISOString().slice(0, 10) : "";
  const configuratorTo = dateRange?.to ? dateRange.to.toISOString().slice(0, 10) : "";

  const { data: configuratorData, isLoading: configuratorLoading, isError: configuratorError, isFetching: configuratorFetching, refetch: refetchConfigurator } = useQuery<{
    total: number;
    daily: Array<{ date: string; total: number; byStatus: Record<string, number> }>;
    statusTotals: Record<string, number>;
    from: string;
    to: string;
  }>({
    queryKey: ["/api/admin/analytics/configurators", configuratorFrom, configuratorTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (configuratorFrom) params.set("from", configuratorFrom);
      if (configuratorTo) params.set("to", configuratorTo);
      return fetchJson(`/api/admin/analytics/configurators?${params}`);
    },
    enabled: !!user?.adminRole && user.adminRole !== "none",
    placeholderData: keepPreviousData,
  });

  const { data: businessAnalytics, isLoading: businessLoading, isError: businessError, refetch: refetchBusiness } = useQuery<BusinessAnalytics>({
    queryKey: ["/api/admin/analytics"],
    enabled: !!user?.adminRole && user.adminRole !== "none",
  });

  const { data: aiAnalytics, isLoading: aiLoading, isError: aiAnalyticsError, refetch: refetchAi } = useQuery<AiAnalytics>({
    queryKey: ["/api/admin/analytics/ai"],
    enabled: !!user?.adminRole && user.adminRole !== "none",
  });

  const { data: webAnalytics, isLoading: webLoading, isError: webError, isFetching: webFetching, refetch: refetchWeb } = useQuery<WebAnalytics>({
    queryKey: ["/api/admin/analytics/web", days],
    queryFn: () => fetchJson(`/api/admin/analytics/web?days=${days}`),
    enabled: !!user?.adminRole && user.adminRole !== "none",
    placeholderData: keepPreviousData,
  });

  const formatPrice = (pence: number): string => {
    return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
      setTimeout(() => { window.location.href = "/login"; }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  useEffect(() => {
    if (user && (!user.adminRole || user.adminRole === "none")) {
      toast({ title: "Access Denied", description: "Admin access required.", variant: "destructive" });
      setTimeout(() => { window.location.href = "/admin"; }, 1000);
    }
  }, [user, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user?.adminRole || user.adminRole === "none") return null;


  const isWebLoading = webLoading;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/60 sticky top-0 bg-background/95 backdrop-blur-sm z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="ghost" size="sm" asChild data-testid="button-back-dashboard">
                <Link href="/admin">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Admin
                </Link>
              </Button>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
                <p className="text-muted-foreground text-sm">Visitor behaviour, traffic sources & business metrics</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                <Activity className="w-3 h-3 mr-1" />
                Live Data
              </Badge>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-1 mt-4">
            <Button
              variant={activeTab === "web" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("web")}
              data-testid="button-tab-web"
            >
              <Globe className="w-4 h-4 mr-2" />
              Web Analytics
            </Button>
            <Button
              variant={activeTab === "business" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("business")}
              data-testid="button-tab-business"
            >
              <BarChart2 className="w-4 h-4 mr-2" />
              Business Metrics
            </Button>
            <Button
              variant={activeTab === "configurators" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("configurators")}
              data-testid="button-tab-configurators"
            >
              <CalendarDays className="w-4 h-4 mr-2" />
              Configurator Activity
            </Button>
            <Button
              variant={activeTab === "max_ai" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("max_ai")}
              data-testid="button-tab-max-ai"
            >
              <Bot className="w-4 h-4 mr-2" />
              Max AI
            </Button>
            <Button
              variant={activeTab === "popularity" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("popularity")}
              data-testid="button-tab-popularity"
            >
              <Star className="w-4 h-4 mr-2" />
              Popularity
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">

        {/* ===== WEB ANALYTICS TAB ===== */}
        {activeTab === "web" && (
          <div className="space-y-6">
            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Visitor Analytics</h2>
              <div className="flex items-center gap-2">
                {webFetching && !webLoading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-muted-foreground" data-testid="spinner-web-refetch" />
                )}
                <Select value={days} onValueChange={setDays}>
                  <SelectTrigger className="w-36" data-testid="select-date-range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="14">Last 14 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={() => refetchWeb()} data-testid="button-refresh-analytics">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {isWebLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : webError ? (
              <Card>
                <CardContent className="py-16 text-center space-y-3">
                  <p className="text-destructive text-sm">Failed to load — check your connection and try again</p>
                  <Button variant="outline" size="sm" onClick={() => refetchWeb()} disabled={webFetching} data-testid="button-retry-web-analytics">
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${webFetching ? "animate-spin" : ""}`} />
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : !webAnalytics || webAnalytics.overview.totalSessions === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No visitor data yet</h3>
                  <p className="text-muted-foreground">Analytics data will appear here as visitors browse the site.</p>
                </CardContent>
              </Card>
            ) : (
              <div
                className="transition-opacity duration-300"
                style={{ opacity: webFetching && !webLoading ? 0.5 : 1 }}
                data-testid="web-chart-area"
              >
                {/* Overview KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <Card data-testid="card-sessions">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground">Sessions</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-sessions">{webAnalytics.overview.totalSessions.toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground mt-1">Last {days} days</p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-pageviews">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground">Page Views</CardTitle>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-pageviews">{webAnalytics.overview.totalPageviews.toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground mt-1">{webAnalytics.overview.pagesPerSession} pages/session</p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-bounce-rate">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground">Bounce Rate</CardTitle>
                      <MousePointer className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-bounce-rate">{webAnalytics.overview.bounceRate}%</div>
                      <p className="text-xs text-muted-foreground mt-1">Single page visits</p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-avg-duration">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground">Avg Duration</CardTitle>
                      <Timer className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-avg-duration">{formatDuration(webAnalytics.overview.avgDuration)}</div>
                      <p className="text-xs text-muted-foreground mt-1">Per session</p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-pages-session">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground">Pages/Session</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-pages-session">{webAnalytics.overview.pagesPerSession}</div>
                      <p className="text-xs text-muted-foreground mt-1">Engagement depth</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Daily visitors chart */}
                {webAnalytics.dailyStats && webAnalytics.dailyStats.length > 0 && (
                  <Card data-testid="card-daily-visitors">
                    <CardHeader>
                      <CardTitle>Daily Visitors</CardTitle>
                      <CardDescription>Sessions and page views over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={240}>
                        <AreaChart data={webAnalytics.dailyStats.map(d => ({
                          date: new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
                          sessions: parseInt(d.sessions),
                          pageviews: parseInt(d.pageviews),
                        }))}>
                          <defs>
                            <linearGradient id="sessions" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8bc440" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#8bc440" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="pviews" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                          />
                          <Legend />
                          <Area type="monotone" dataKey="sessions" stroke="#8bc440" fill="url(#sessions)" strokeWidth={2} name="Sessions" />
                          <Area type="monotone" dataKey="pageviews" stroke="#60a5fa" fill="url(#pviews)" strokeWidth={2} name="Page Views" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Traffic sources + Devices */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card data-testid="card-traffic-sources">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Globe className="w-5 h-5 text-primary" />
                        Traffic Sources
                      </CardTitle>
                      <CardDescription>Where visitors come from</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {webAnalytics.trafficSources && webAnalytics.trafficSources.length > 0 ? (
                        <div className="flex flex-col gap-4">
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie
                                data={webAnalytics.trafficSources.map(s => ({ name: s.source, value: parseInt(s.count) }))}
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                labelLine={false}
                              >
                                {webAnalytics.trafficSources.map((s, i) => (
                                  <Cell key={s.source} fill={SOURCE_COLORS[s.source] || CHART_COLORS[i % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="space-y-2">
                            {webAnalytics.trafficSources.map((s, i) => (
                              <div key={s.source} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SOURCE_COLORS[s.source] || CHART_COLORS[i % CHART_COLORS.length] }} />
                                  <span>{s.source}</span>
                                </div>
                                <Badge variant="secondary" data-testid={`badge-source-${i}`}>{parseInt(s.count).toLocaleString()}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground py-4">No traffic data yet</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card data-testid="card-devices">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-primary" />
                        Devices
                      </CardTitle>
                      <CardDescription>Device types used by visitors</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {webAnalytics.devices && webAnalytics.devices.length > 0 ? (
                        <div className="space-y-4">
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie
                                data={webAnalytics.devices.map(d => ({ name: d.device, value: parseInt(d.count) }))}
                                cx="50%" cy="50%"
                                innerRadius={50} outerRadius={80}
                                dataKey="value"
                              >
                                {webAnalytics.devices.map((d, i) => (
                                  <Cell key={d.device} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="space-y-2">
                            {webAnalytics.devices.map((d, i) => {
                              const total = webAnalytics.devices.reduce((s, x) => s + parseInt(x.count), 0);
                              const pct = Math.round((parseInt(d.count) / total) * 100);
                              const Icon = d.device === "Mobile" ? Smartphone : d.device === "Tablet" ? Tablet : Monitor;
                              return (
                                <div key={d.device} className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4 text-muted-foreground" />
                                    <span>{d.device}</span>
                                    <span className="text-muted-foreground">{pct}%</span>
                                  </div>
                                  <Badge variant="secondary" data-testid={`badge-device-${i}`}>{parseInt(d.count).toLocaleString()}</Badge>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground py-4">No device data yet</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Browsers + OS */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card data-testid="card-browsers">
                    <CardHeader>
                      <CardTitle>Browsers</CardTitle>
                      <CardDescription>Browser usage breakdown</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {webAnalytics.browsers && webAnalytics.browsers.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={webAnalytics.browsers.map(b => ({ name: b.browser, count: parseInt(b.count) }))} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis type="number" tick={{ fontSize: 11 }} />
                            <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                            <Bar dataKey="count" fill="#8bc440" radius={[0, 4, 4, 0]} name="Sessions" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-sm text-muted-foreground py-4">No browser data yet</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card data-testid="card-operating-systems">
                    <CardHeader>
                      <CardTitle>Operating Systems</CardTitle>
                      <CardDescription>OS usage breakdown</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {webAnalytics.operatingSystems && webAnalytics.operatingSystems.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={webAnalytics.operatingSystems.map(o => ({ name: o.os, count: parseInt(o.count) }))} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis type="number" tick={{ fontSize: 11 }} />
                            <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                            <Bar dataKey="count" fill="#60a5fa" radius={[0, 4, 4, 0]} name="Sessions" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-sm text-muted-foreground py-4">No OS data yet</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Top Pages */}
                <Card data-testid="card-top-pages">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="w-5 h-5 text-primary" />
                      Top Pages
                    </CardTitle>
                    <CardDescription>Most visited pages on the site</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {webAnalytics.topPages && webAnalytics.topPages.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-2 font-medium">Page</th>
                              <th className="pb-2 font-medium text-right">Views</th>
                              <th className="pb-2 font-medium text-right">Unique</th>
                            </tr>
                          </thead>
                          <tbody>
                            {webAnalytics.topPages.map((page, i) => (
                              <tr key={i} className="border-b last:border-0" data-testid={`row-page-${i}`}>
                                <td className="py-2 font-mono text-xs text-muted-foreground">{formatUrl(page.url)}</td>
                                <td className="py-2 text-right font-medium">{parseInt(page.views).toLocaleString()}</td>
                                <td className="py-2 text-right text-muted-foreground">{parseInt(page.unique_visitors).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No page data yet</p>
                    )}
                  </CardContent>
                </Card>

                {/* Top Referrers + Top Events */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card data-testid="card-referrers">
                    <CardHeader>
                      <CardTitle>Top Referrers</CardTitle>
                      <CardDescription>Sites sending visitors to you</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {webAnalytics.topReferrers && webAnalytics.topReferrers.length > 0 ? (
                        <div className="space-y-2">
                          {webAnalytics.topReferrers.map((r, i) => (
                            <div key={i} className="flex items-center justify-between text-sm" data-testid={`row-referrer-${i}`}>
                              <span className="truncate text-muted-foreground font-mono text-xs">{r.domain}</span>
                              <Badge variant="outline">{parseInt(r.count).toLocaleString()}</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground py-4">No referrer data yet</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card data-testid="card-top-events">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-primary" />
                        Top Events
                      </CardTitle>
                      <CardDescription>Most triggered visitor interactions</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {webAnalytics.topEvents && webAnalytics.topEvents.length > 0 ? (
                        <div className="space-y-2">
                          {webAnalytics.topEvents.map((e, i) => (
                            <div key={i} className="flex items-center justify-between text-sm" data-testid={`row-event-${i}`}>
                              <span className="font-mono text-xs">{e.event_name}</span>
                              <Badge variant="secondary">{parseInt(e.count).toLocaleString()}</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-4 text-center text-muted-foreground text-sm">
                          <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          No events tracked yet
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* UTM Campaigns */}
                {webAnalytics.campaigns && webAnalytics.campaigns.length > 0 && (
                  <Card data-testid="card-campaigns">
                    <CardHeader>
                      <CardTitle>UTM Campaigns</CardTitle>
                      <CardDescription>Tracked marketing campaigns</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-2 font-medium">Source</th>
                              <th className="pb-2 font-medium">Medium</th>
                              <th className="pb-2 font-medium">Campaign</th>
                              <th className="pb-2 font-medium text-right">Sessions</th>
                              <th className="pb-2 font-medium text-right">Page Views</th>
                              <th className="pb-2 font-medium text-right">Avg Duration</th>
                            </tr>
                          </thead>
                          <tbody>
                            {webAnalytics.campaigns.map((c, i) => (
                              <tr key={i} className="border-b last:border-0" data-testid={`row-campaign-${i}`}>
                                <td className="py-2">{c.source}</td>
                                <td className="py-2 text-muted-foreground">{c.medium}</td>
                                <td className="py-2 text-muted-foreground">{c.campaign}</td>
                                <td className="py-2 text-right font-medium">{parseInt(c.sessions).toLocaleString()}</td>
                                <td className="py-2 text-right text-muted-foreground">{parseInt(c.pageviews).toLocaleString()}</td>
                                <td className="py-2 text-right text-muted-foreground">{formatDuration(parseInt(c.avg_duration))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recent Sessions */}
                <Card data-testid="card-recent-sessions">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      Recent Sessions
                    </CardTitle>
                    <CardDescription>Last 50 visitor sessions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {webAnalytics.recentSessions && webAnalytics.recentSessions.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-2 font-medium">Time</th>
                              <th className="pb-2 font-medium">Device</th>
                              <th className="pb-2 font-medium">Browser</th>
                              <th className="pb-2 font-medium">OS</th>
                              <th className="pb-2 font-medium">Entry Page</th>
                              <th className="pb-2 font-medium text-right">Pages</th>
                              <th className="pb-2 font-medium text-right">Duration</th>
                              <th className="pb-2 font-medium text-right">Bounce</th>
                              <th className="pb-2 font-medium">Source</th>
                            </tr>
                          </thead>
                          <tbody>
                            {webAnalytics.recentSessions.map((s, i) => (
                              <tr key={i} className="border-b last:border-0 hover-elevate" data-testid={`row-session-${i}`}>
                                <td className="py-2 text-muted-foreground whitespace-nowrap">
                                  {new Date(s.started_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="py-2">
                                  {s.device_type === "Mobile" ? <Smartphone className="w-3 h-3 inline" /> :
                                   s.device_type === "Tablet" ? <Tablet className="w-3 h-3 inline" /> :
                                   <Monitor className="w-3 h-3 inline" />}
                                  {" "}{s.device_type || "—"}
                                </td>
                                <td className="py-2">{s.browser || "—"}</td>
                                <td className="py-2 text-muted-foreground">{s.os || "—"}</td>
                                <td className="py-2 font-mono text-muted-foreground">{formatUrl(s.entry_page || "/")}</td>
                                <td className="py-2 text-right">{s.page_count}</td>
                                <td className="py-2 text-right text-muted-foreground">{formatDuration(s.duration_seconds)}</td>
                                <td className="py-2 text-right">
                                  {s.bounce ? (
                                    <Badge variant="outline" className="text-xs">Yes</Badge>
                                  ) : (
                                    <Badge className="text-xs bg-primary/10 text-primary border-0">No</Badge>
                                  )}
                                </td>
                                <td className="py-2 text-muted-foreground">
                                  {s.utm_source ? `${s.utm_source}/${s.utm_medium || "?"}` : s.referrer ? "Referral" : "Direct"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No sessions recorded yet</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ===== BUSINESS METRICS TAB ===== */}
        {activeTab === "business" && (
          <div className="space-y-6">
            {businessLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : businessError ? (
              <Card>
                <CardContent className="py-16 text-center space-y-3">
                  <p className="text-destructive text-sm">Failed to load — check your connection and try again</p>
                  <Button variant="outline" size="sm" onClick={() => refetchBusiness()} data-testid="button-retry-business-analytics">
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Overview Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card data-testid="card-total-quotes">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Quotes</CardTitle>
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-total-quotes">{businessAnalytics?.overview.totalQuotes || 0}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="text-primary font-medium">{businessAnalytics?.overview.recentQuotes || 0}</span> in last 7 days
                      </p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-total-leads">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-total-leads">{businessAnalytics?.overview.totalLeads || 0}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="text-primary font-medium">{businessAnalytics?.overview.recentLeads || 0}</span> in last 7 days
                      </p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-total-vans">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Van Inventory</CardTitle>
                      <Car className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-total-vans">{businessAnalytics?.overview.totalVans || 0}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="text-primary font-medium">{businessAnalytics?.overview.publishedVans || 0}</span> published
                      </p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-quote-status">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Quote Pipeline</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        {businessAnalytics?.quotesByStatus && Object.entries(businessAnalytics.quotesByStatus).map(([status, count]) => (
                          <div key={status} className="flex justify-between text-sm">
                            <span className="text-muted-foreground capitalize">{status.replace(/_/g, ' ')}:</span>
                            <span className="font-medium" data-testid={`text-status-${status}`}>{count}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Popular Vans & Kits */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card data-testid="card-popular-vans">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Car className="w-5 h-5 text-primary" />
                        Most Popular Vans
                      </CardTitle>
                      <CardDescription>Top 5 vans selected in quotes</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {businessAnalytics?.popularVans && businessAnalytics.popularVans.length > 0 ? (
                        <div className="space-y-3">
                          {businessAnalytics.popularVans.map((van, index) => (
                            <div key={van.vanId} className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0">{index + 1}</Badge>
                                <span className="font-medium text-sm" data-testid={`text-popular-van-${index}`}>{van.title}</span>
                              </div>
                              <Badge data-testid={`badge-van-count-${index}`}>{van.count} {van.count === 1 ? 'quote' : 'quotes'}</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No data available yet</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card data-testid="card-popular-kits">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-primary" />
                        Most Popular Kits
                      </CardTitle>
                      <CardDescription>Top 5 kits selected in quotes</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {businessAnalytics?.popularKits && businessAnalytics.popularKits.length > 0 ? (
                        <div className="space-y-3">
                          {businessAnalytics.popularKits.map((kit, index) => (
                            <div key={kit.kitId} className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0">{index + 1}</Badge>
                                <span className="font-medium text-sm" data-testid={`text-popular-kit-${index}`}>Kit ID: {kit.kitId}</span>
                              </div>
                              <Badge data-testid={`badge-kit-count-${index}`}>{kit.count} {kit.count === 1 ? 'quote' : 'quotes'}</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No data available yet</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Package Choice by Operator Volume */}
                {businessAnalytics?.volumeSegments && businessAnalytics.volumeSegments.length > 0 && (
                  <Card data-testid="card-volume-segments">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart2 className="w-5 h-5 text-primary" />
                        Package Choice by Operator Volume
                      </CardTitle>
                      <CardDescription>Package tier distribution split by job volume segment (derived from kit choice)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {businessAnalytics.volumeSegments.map((seg) => {
                          const segLabel = seg.segment === "high" ? "High-Volume Operators" : "Standard-Volume Operators";
                          const activeTiers = seg.packageTierDistribution.filter(p => p.count > 0);
                          return (
                            <div key={seg.segment} data-testid={`card-volume-segment-${seg.segment}`} className="space-y-3">
                              <div>
                                <div className="font-medium text-sm" data-testid={`text-segment-label-${seg.segment}`}>{segLabel}</div>
                                <div className="text-xs text-muted-foreground capitalize">{seg.label}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {seg.totalQuotes} {seg.totalQuotes === 1 ? "quote" : "quotes"}
                                  {seg.dominantPackageTier && (
                                    <span className="ml-1">· dominant: <span className="font-medium text-foreground" data-testid={`text-segment-dominant-${seg.segment}`}>{seg.dominantPackageTier.name}</span></span>
                                  )}
                                </div>
                              </div>
                              {activeTiers.length > 0 ? (
                                <div className="space-y-2">
                                  {activeTiers.map((tier) => (
                                    <div key={tier.id} className="flex items-center gap-3" data-testid={`row-segment-tier-${seg.segment}-${tier.id}`}>
                                      <div className="w-24 text-xs text-muted-foreground truncate shrink-0">{tier.name}</div>
                                      <div className="flex-1 bg-muted rounded-full h-2">
                                        <div
                                          className="h-2 rounded-full bg-primary"
                                          style={{ width: `${tier.pct}%` }}
                                        />
                                      </div>
                                      <div className="w-8 text-right text-xs font-medium shrink-0">{tier.count}</div>
                                      <div className="w-9 text-right text-xs text-muted-foreground shrink-0">{tier.pct}%</div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">No package classifications yet</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recent Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card data-testid="card-recent-quotes">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        Recent Quotes
                      </CardTitle>
                      <CardDescription>Latest 5 quote requests</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {businessAnalytics?.recentActivity.quotes && businessAnalytics.recentActivity.quotes.length > 0 ? (
                        <div className="space-y-4">
                          {businessAnalytics.recentActivity.quotes.map((quote, index) => (
                            <div key={quote.id} className="border-b last:border-0 pb-3 last:pb-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate text-sm" data-testid={`text-quote-customer-${index}`}>{quote.customerName}</p>
                                  <p className="text-xs text-muted-foreground truncate">{quote.customerEmail}</p>
                                </div>
                                <Badge variant="outline" className="text-xs" data-testid={`badge-quote-status-${index}`}>{quote.status}</Badge>
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-sm font-medium" data-testid={`text-quote-price-${index}`}>{formatPrice(quote.totalPrice)}</span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <CalendarDays className="w-3 h-3" />
                                  {new Date(quote.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No quotes yet</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card data-testid="card-recent-leads">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" />
                        Recent Leads
                      </CardTitle>
                      <CardDescription>Latest 5 customer inquiries</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {businessAnalytics?.recentActivity.leads && businessAnalytics.recentActivity.leads.length > 0 ? (
                        <div className="space-y-4">
                          {businessAnalytics.recentActivity.leads.map((lead, index) => (
                            <div key={lead.id} className="border-b last:border-0 pb-3 last:pb-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate text-sm" data-testid={`text-lead-name-${index}`}>{lead.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                                </div>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <CalendarDays className="w-3 h-3" />
                                  {new Date(lead.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 truncate" data-testid={`text-lead-subject-${index}`}>{lead.subject}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No leads yet</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== POPULARITY TAB ===== */}
        {activeTab === "popularity" && (
          <div className="space-y-6">
            {businessLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : !businessAnalytics?.popularity || businessAnalytics.popularity.totalMeaningfulQuotes === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No popularity data yet</h3>
                  <p className="text-muted-foreground">Popularity intelligence will appear here as quotes are submitted.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Summary KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card data-testid="card-popularity-quotes">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground">Quotes Analysed</CardTitle>
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-popularity-quotes">{businessAnalytics.popularity.totalMeaningfulQuotes.toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground mt-1">Recent non-cancelled quotes</p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-48v-rate">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground">48V Selection Rate</CardTitle>
                      <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="text-48v-rate">{businessAnalytics.popularity.rate48v}%</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {businessAnalytics.popularity.rate48v >= 60
                          ? "Strong signal — majority choose 48V"
                          : businessAnalytics.popularity.rate48v >= 40
                          ? "Solid majority — recommend proactively"
                          : "Mention when relevant"}
                      </p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-dominant-tier">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-xs font-medium text-muted-foreground">Dominant Package</CardTitle>
                      <Layers className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold truncate" data-testid="text-dominant-tier">
                        {businessAnalytics.popularity.dominantPackageTier?.name ?? "—"}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {businessAnalytics.popularity.dominantPackageTier
                          ? `${businessAnalytics.popularity.dominantPackageTier.pct}% of classified quotes`
                          : "No classified quotes yet"}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Kit Frequency & Package Tier Distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Most Selected Kits */}
                  <Card data-testid="card-kit-frequency">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-primary" />
                        Kit Selection Frequency
                      </CardTitle>
                      <CardDescription>All kits chosen by customers, ranked by popularity</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {businessAnalytics.popularity.allKits.length > 0 ? (
                        <div className="space-y-3">
                          {businessAnalytics.popularity.allKits.map((kit, index) => (
                            <div key={kit.id} className="space-y-1" data-testid={`row-kit-freq-${index}`}>
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Badge variant="outline" className="shrink-0 w-6 h-6 flex items-center justify-center p-0 text-xs">{index + 1}</Badge>
                                  <span className="font-medium truncate" data-testid={`text-kit-name-${index}`}>{kit.name}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  <span className="text-xs text-muted-foreground">{kit.count} quotes</span>
                                  <Badge variant="secondary" data-testid={`badge-kit-pct-${index}`}>{kit.pct}%</Badge>
                                </div>
                              </div>
                              <div className="flex-1 bg-muted rounded-full h-1.5">
                                <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${kit.pct}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No kit data yet</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Package Tier Distribution */}
                  <Card data-testid="card-package-tier-dist">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-primary" />
                        Package Tier Distribution
                      </CardTitle>
                      <CardDescription>Overall breakdown of package tiers chosen across all quotes</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {businessAnalytics.popularity.packageTierDistribution.some(p => p.count > 0) ? (
                        <div className="space-y-3">
                          {businessAnalytics.popularity.packageTierDistribution.filter(p => p.count > 0).map((tier) => (
                            <div key={tier.id} className="flex items-center gap-3" data-testid={`row-pkg-tier-${tier.id}`}>
                              <div className="w-28 text-xs text-muted-foreground truncate shrink-0">{tier.name}</div>
                              <div className="flex-1 bg-muted rounded-full h-2">
                                <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${tier.pct}%` }} />
                              </div>
                              <div className="w-8 text-right text-xs font-medium shrink-0">{tier.count}</div>
                              <div className="w-9 text-right text-xs text-muted-foreground shrink-0">{tier.pct}%</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No package classifications yet</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Upgrades by Category */}
                {businessAnalytics.popularity.allUpgradesOverall.length > 0 && (() => {
                  const byCategory: Record<string, UpgradeSelectionStat[]> = {};
                  for (const u of businessAnalytics.popularity.allUpgradesOverall) {
                    if (!byCategory[u.category]) byCategory[u.category] = [];
                    byCategory[u.category].push(u);
                  }
                  const sortedCategories = Object.entries(byCategory)
                    .map(([cat, upgrades]) => [cat, [...upgrades].sort((a, b) => b.pct - a.pct)] as [string, UpgradeSelectionStat[]])
                    .sort((a, b) => b[1][0].pct - a[1][0].pct);
                  return (
                    <Card data-testid="card-upgrades-by-category">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Star className="w-5 h-5 text-primary" />
                          Upgrade Selection Rates by Category
                        </CardTitle>
                        <CardDescription>Every upgrade chosen by customers, grouped by category and sorted by popularity</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {sortedCategories.map(([category, upgrades]) => (
                            <div key={category} className="space-y-2" data-testid={`section-category-${category}`}>
                              <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{category}</div>
                              <div className="space-y-2">
                                {upgrades.map((u, i) => (
                                  <div key={u.id} className="space-y-1" data-testid={`row-upgrade-${u.id}`}>
                                    <div className="flex items-center justify-between text-sm">
                                      <span className="truncate text-sm" data-testid={`text-upgrade-name-${i}-${category}`}>{u.name}</span>
                                      <div className="flex items-center gap-2 shrink-0 ml-2">
                                        {u.pct >= 70 && <Badge variant="default" className="text-xs shrink-0">Very popular</Badge>}
                                        {u.pct >= 50 && u.pct < 70 && <Badge variant="secondary" className="text-xs shrink-0">Popular</Badge>}
                                        <span className="text-xs text-muted-foreground w-8 text-right">{u.pct}%</span>
                                      </div>
                                    </div>
                                    <div className="flex-1 bg-muted rounded-full h-1.5">
                                      <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${u.pct}%` }} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Volume Segments */}
                {businessAnalytics.popularity.volumeSegments.length > 0 && (
                  <Card data-testid="card-popularity-volume-segments">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart2 className="w-5 h-5 text-primary" />
                        Package Choice by Operator Volume
                      </CardTitle>
                      <CardDescription>Package tier distribution split by job volume segment (derived from kit choice)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {businessAnalytics.popularity.volumeSegments.map((seg) => {
                          const segLabel = seg.segment === "high" ? "High-Volume Operators" : "Standard-Volume Operators";
                          const activeTiers = seg.packageTierDistribution.filter(p => p.count > 0);
                          return (
                            <div key={seg.segment} data-testid={`card-pop-volume-segment-${seg.segment}`} className="space-y-3">
                              <div>
                                <div className="font-medium text-sm">{segLabel}</div>
                                <div className="text-xs text-muted-foreground capitalize">{seg.label}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {seg.totalQuotes} {seg.totalQuotes === 1 ? "quote" : "quotes"}
                                  {seg.dominantPackageTier && (
                                    <span className="ml-1">· dominant: <span className="font-medium text-foreground">{seg.dominantPackageTier.name}</span></span>
                                  )}
                                </div>
                              </div>
                              {activeTiers.length > 0 ? (
                                <div className="space-y-2">
                                  {activeTiers.map((tier) => (
                                    <div key={tier.id} className="flex items-center gap-3" data-testid={`row-pop-segment-tier-${seg.segment}-${tier.id}`}>
                                      <div className="w-24 text-xs text-muted-foreground truncate shrink-0">{tier.name}</div>
                                      <div className="flex-1 bg-muted rounded-full h-2">
                                        <div className="h-2 rounded-full bg-primary" style={{ width: `${tier.pct}%` }} />
                                      </div>
                                      <div className="w-8 text-right text-xs font-medium shrink-0">{tier.count}</div>
                                      <div className="w-9 text-right text-xs text-muted-foreground shrink-0">{tier.pct}%</div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">No package classifications yet</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        )}

        {/* ===== CONFIGURATOR ACTIVITY TAB ===== */}
        {activeTab === "configurators" && (
          <div className="space-y-6">
            {/* Date Range Picker */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Configurator Activity</h2>
                <div className="flex items-center gap-2">
                  {configuratorFetching && !configuratorLoading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-muted-foreground" data-testid="spinner-configurator-refetch" />
                  )}
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-date-range-picker">
                        <CalendarDays className="w-4 h-4 mr-2" />
                        {dateRange?.from && dateRange?.to
                          ? `${fmtDate(dateRange.from)} — ${fmtDate(dateRange.to)}`
                          : dateRange?.from
                          ? `From ${fmtDate(dateRange.from)}`
                          : "Select date range"}
                        <ChevronDown className="w-3 h-3 ml-2" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="range"
                        selected={dateRange}
                        onSelect={(range) => {
                          setDateRange(range);
                          if (range?.from && range?.to) setCalendarOpen(false);
                        }}
                        numberOfMonths={2}
                        disabled={{ after: new Date() }}
                        data-testid="calendar-date-range"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              {configuratorError && configuratorData && (
                <div className="flex items-center justify-end gap-2" data-testid="warning-configurator-date-range-error">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                  <span className="text-xs text-destructive">Failed to refresh — showing previous results</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchConfigurator()}
                    disabled={configuratorFetching}
                    data-testid="button-retry-configurator-date-range"
                    className="h-7 text-xs px-2"
                  >
                    <RefreshCw className={`w-3 h-3 mr-1 ${configuratorFetching ? "animate-spin" : ""}`} />
                    Retry
                  </Button>
                </div>
              )}
            </div>

            {configuratorLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : configuratorError && !configuratorData ? (
              <Card>
                <CardContent className="py-16 text-center space-y-3">
                  <p className="text-destructive text-sm">Failed to load — check your connection and try again</p>
                  <Button variant="outline" size="sm" onClick={() => refetchConfigurator()} data-testid="button-retry-configurator-analytics">
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div
                className="transition-opacity duration-300"
                style={{ opacity: configuratorFetching && !configuratorLoading ? 0.5 : 1 }}
                data-testid="configurator-chart-area"
              >
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Configurators</CardDescription>
                      <CardTitle className="text-3xl">{configuratorData?.total ?? 0}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {configuratorData?.from && configuratorData?.to
                          ? `${fmtDate(new Date(configuratorData.from + "T12:00:00"))} — ${fmtDate(new Date(configuratorData.to + "T12:00:00"))}`
                          : "Selected period"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Peak Day</CardDescription>
                      <CardTitle className="text-3xl">
                        {configuratorData?.daily && configuratorData.daily.length > 0
                          ? Math.max(...configuratorData.daily.map(d => d.total))
                          : 0}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {(() => {
                          if (!configuratorData?.daily?.length) return "No data";
                          const peak = configuratorData.daily.reduce((a, b) => b.total > a.total ? b : a);
                          return peak.total > 0
                            ? fmtDate(new Date(peak.date + "T12:00:00"))
                            : "No activity";
                        })()}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Daily Average</CardDescription>
                      <CardTitle className="text-3xl">
                        {configuratorData?.daily && configuratorData.daily.length > 0
                          ? (configuratorData.total / configuratorData.daily.length).toFixed(1)
                          : "0"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">Configurators per day</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Daily Bar Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Configurator Submissions</CardTitle>
                    <CardDescription>Number of configurators submitted each day in the selected range</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {configuratorData?.total === 0 ? (
                      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                        No configurators submitted in this date range
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={configuratorData?.daily ?? []} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) => {
                              const d = new Date(v + "T12:00:00");
                              return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                            }}
                            interval={Math.max(0, Math.floor((configuratorData?.daily?.length ?? 1) / 10) - 1)}
                          />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip
                            formatter={(value: number) => [value, "Configurators"]}
                            labelFormatter={(label) => {
                              const d = new Date(label + "T12:00:00");
                              return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
                            }}
                          />
                          <Bar dataKey="total" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Status Breakdown */}
                {configuratorData?.total > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Status Breakdown</CardTitle>
                      <CardDescription>How configurators are progressing across the pipeline</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(configuratorData?.statusTotals ?? {})
                          .sort(([, a], [, b]) => b - a)
                          .map(([status, count]) => {
                            const pct = configuratorData.total > 0 ? Math.round((count / configuratorData.total) * 100) : 0;
                            const label = status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                            return (
                              <div key={status} className="flex items-center gap-3" data-testid={`row-status-${status}`}>
                                <div className="w-32 text-sm text-muted-foreground truncate shrink-0">{label}</div>
                                <div className="flex-1 bg-muted rounded-full h-2">
                                  <div
                                    className="h-2 rounded-full bg-primary"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <div className="w-12 text-right text-sm font-medium shrink-0">{count}</div>
                                <div className="w-10 text-right text-xs text-muted-foreground shrink-0">{pct}%</div>
                              </div>
                            );
                          })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== MAX AI TAB ===== */}
        {activeTab === "max_ai" && (
          <div className="space-y-6">
            {aiLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                  <p className="mt-2 text-muted-foreground">Loading Max AI data...</p>
                </div>
              </div>
            ) : aiAnalyticsError ? (
              <Card>
                <CardContent className="py-16 text-center space-y-3">
                  <p className="text-destructive text-sm">Failed to load — check your connection and try again</p>
                  <Button variant="outline" size="sm" onClick={() => refetchAi()} data-testid="button-retry-ai-analytics">
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : !aiAnalytics ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">No AI analytics data available.</CardContent>
              </Card>
            ) : (
              <>
                {/* This Month headline cards */}
                <div>
                  <h2 className="text-lg font-semibold mb-3">This Month</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card data-testid="card-ai-sessions-month">
                      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Sessions</CardTitle>
                        <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" data-testid="value-ai-sessions-month">{aiAnalytics.thisMonth.total}</div>
                      </CardContent>
                    </Card>
                    <Card data-testid="card-ai-completion-month">
                      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
                        <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" data-testid="value-ai-completion-month">{aiAnalytics.thisMonth.completionRate}%</div>
                        <p className="text-xs text-muted-foreground mt-1">{aiAnalytics.thisMonth.completed} completed</p>
                      </CardContent>
                    </Card>
                    <Card data-testid="card-ai-leads-month">
                      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Lead Capture Rate</CardTitle>
                        <Phone className="w-4 h-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" data-testid="value-ai-leads-month">{aiAnalytics.thisMonth.leadCaptureRate}%</div>
                        <p className="text-xs text-muted-foreground mt-1">{aiAnalytics.thisMonth.leadsCapured} leads captured</p>
                      </CardContent>
                    </Card>
                    <Card data-testid="card-ai-48v-month">
                      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">48V Conversion</CardTitle>
                        <Zap className="w-4 h-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" data-testid="value-ai-48v-month">{aiAnalytics.thisMonth.v48ConvRate}%</div>
                        <p className="text-xs text-muted-foreground mt-1">{aiAnalytics.thisMonth.pitched48v} pitched · {aiAnalytics.thisMonth.includes48v} converted</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* All-time summary row */}
                <div>
                  <h2 className="text-lg font-semibold mb-3">All Time</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card data-testid="card-ai-sessions-all">
                      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Sessions</CardTitle>
                        <MessageSquare className="w-4 h-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" data-testid="value-ai-sessions-all">{aiAnalytics.allTime.total}</div>
                      </CardContent>
                    </Card>
                    <Card data-testid="card-ai-completion-all">
                      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Completion Rate</CardTitle>
                        <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" data-testid="value-ai-completion-all">{aiAnalytics.allTime.completionRate}%</div>
                        <p className="text-xs text-muted-foreground mt-1">{aiAnalytics.allTime.completed} completed</p>
                      </CardContent>
                    </Card>
                    <Card data-testid="card-ai-leads-all">
                      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Lead Capture Rate</CardTitle>
                        <Phone className="w-4 h-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" data-testid="value-ai-leads-all">{aiAnalytics.allTime.leadCaptureRate}%</div>
                        <p className="text-xs text-muted-foreground mt-1">{aiAnalytics.allTime.leadsCapured} leads captured</p>
                      </CardContent>
                    </Card>
                    <Card data-testid="card-ai-48v-all">
                      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">48V Conversion</CardTitle>
                        <Zap className="w-4 h-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold" data-testid="value-ai-48v-all">{aiAnalytics.allTime.v48ConvRate}%</div>
                        <p className="text-xs text-muted-foreground mt-1">{aiAnalytics.allTime.pitched48v} pitched · {aiAnalytics.allTime.includes48v} converted</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Daily sessions — last 30 days */}
                {aiAnalytics.daily.length > 0 && (
                  <Card data-testid="card-ai-daily-chart">
                    <CardHeader>
                      <CardTitle>Sessions — Last 30 Days</CardTitle>
                      <CardDescription>Daily breakdown of total sessions, completions, and leads captured</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={aiAnalytics.daily} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(d) => {
                              const dt = new Date(d);
                              return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                            }}
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip
                            labelFormatter={(d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                          />
                          <Legend />
                          <Area type="monotone" dataKey="total"     name="Sessions"   stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} />
                          <Area type="monotone" dataKey="completed" name="Completed"  stroke="hsl(var(--chart-2, 142 76% 36%))" fill="hsl(var(--chart-2, 142 76% 36%) / 0.1)" strokeWidth={2} />
                          <Area type="monotone" dataKey="leads"     name="Leads"      stroke="hsl(var(--chart-3, 27 96% 61%))" fill="hsl(var(--chart-3, 27 96% 61%) / 0.1)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Status breakdown */}
                {aiAnalytics.statusBreakdown.length > 0 && (
                  <Card data-testid="card-ai-status-breakdown">
                    <CardHeader>
                      <CardTitle>Session Status Breakdown</CardTitle>
                      <CardDescription>All-time distribution across session statuses</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {aiAnalytics.statusBreakdown.map(({ status, count }) => {
                          const pct = aiAnalytics.allTime.total > 0
                            ? Math.round((count / aiAnalytics.allTime.total) * 100)
                            : 0;
                          const label = status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                          const colorClass =
                            status === "completed"   ? "bg-green-500" :
                            status === "abandoned"   ? "bg-red-400"   :
                                                       "bg-primary";
                          return (
                            <div key={status} className="flex items-center gap-3" data-testid={`row-ai-status-${status}`}>
                              <div className="w-28 text-sm text-muted-foreground truncate shrink-0">{label}</div>
                              <div className="flex-1 bg-muted rounded-full h-2">
                                <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
                              </div>
                              <div className="w-10 text-right text-sm font-medium shrink-0">{count}</div>
                              <div className="w-10 text-right text-xs text-muted-foreground shrink-0">{pct}%</div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 48V pitch detail */}
                <Card data-testid="card-ai-48v-detail">
                  <CardHeader>
                    <CardTitle>48V Upsell Performance</CardTitle>
                    <CardDescription>How often Max pitches 48V and how many customers go for it</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      {[
                        {
                          label: "Sessions where 48V was pitched",
                          value: aiAnalytics.allTime.pitched48v,
                          rate: aiAnalytics.allTime.v48PitchRate,
                          sub: "of all sessions",
                          testid: "stat-48v-pitched",
                        },
                        {
                          label: "Sessions that included 48V",
                          value: aiAnalytics.allTime.includes48v,
                          rate: aiAnalytics.allTime.v48ConvRate,
                          sub: "of pitched sessions",
                          testid: "stat-48v-included",
                        },
                        {
                          label: "Config completed with 48V",
                          value: aiAnalytics.allTime.configCompleted,
                          rate: aiAnalytics.allTime.total > 0 ? Math.round((aiAnalytics.allTime.configCompleted / aiAnalytics.allTime.total) * 100) : 0,
                          sub: "config completion rate",
                          testid: "stat-config-completed",
                        },
                      ].map(({ label, value, rate, sub, testid }) => (
                        <div key={testid} data-testid={testid} className="text-center">
                          <div className="text-3xl font-bold">{value}</div>
                          <div className="text-sm font-medium mt-1">{label}</div>
                          <div className="text-xs text-muted-foreground mt-1">{rate}% {sub}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
