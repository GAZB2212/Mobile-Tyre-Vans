import { Switch, Route, useLocation, Redirect } from "wouter";
import { BRAND } from "@shared/brand";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfiguratorProvider } from "@/lib/ConfiguratorContext";
import ScrollRestoration from "@/components/ScrollRestoration";
import LoadingScreen from "@/components/LoadingScreen";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import ChatBubble from "@/components/ChatBubble";
import AIChatWidget from "@/components/AIChatWidget";
import ConfiguratorIdleModal from "@/components/ConfiguratorIdleModal";
import { PublicMain } from "@/lib/PublicMain";
import { useState, useEffect, lazy, Suspense } from "react";
import { initializeBucketName, hasGivenConsent } from "@/lib/utils";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import Home from "@/pages/Home";
import Stock from "@/pages/Stock";
import VanDetails from "@/pages/VanDetails";
import Finance from "@/pages/Finance";
import Gallery from "@/pages/Gallery";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import HowItWorks from "@/pages/HowItWorks";
import Training from "@/pages/Training";
import BusinessOpportunity from "@/pages/BusinessOpportunity";
import SelectVan from "@/pages/configurator/SelectVan";
import SelectServiceType from "@/pages/configurator/SelectServiceType";
import SelectKit from "@/pages/configurator/SelectKit";
import SelectUpgrades from "@/pages/configurator/SelectUpgrades";
import SelectTraining from "@/pages/configurator/SelectTraining";
import SelectFinance from "@/pages/configurator/SelectFinance";
import RequestQuote from "@/pages/configurator/RequestQuote";
import AIReview from "@/pages/configurator/AIReview";
import Login from "@/pages/Login";
import QuoteConfirmation from "@/pages/QuoteConfirmation";
import SpecApproval from "@/pages/SpecApproval";
import ArtworkApproval from "@/pages/ArtworkApproval";
import Blog from "@/pages/Blog";
import BlogPost from "@/pages/BlogPost";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsConditions from "@/pages/TermsConditions";
import CookiePolicy from "@/pages/CookiePolicy";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/not-found";
import TestimonialRequest from "@/pages/TestimonialRequest";
import { AdminLayout } from "@/components/AdminLayout";
import VanConversionsHub from "@/pages/seo/VanConversionsHub";
import VanModelPage from "@/pages/seo/VanModelPage";
import LocationsHub from "@/pages/seo/LocationsHub";
import LocationPage from "@/pages/seo/LocationPage";

// Admin pages are SSR-bypassed, so lazy-load them to keep the public bundle small
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminConfigurator = lazy(() => import("@/pages/admin/AdminConfigurator"));
const AdminVans = lazy(() => import("@/pages/admin/Vans"));
const AdminKits = lazy(() => import("@/pages/admin/Kits"));
const AdminUpgrades = lazy(() => import("@/pages/admin/Upgrades"));
const AdminQuotes = lazy(() => import("@/pages/admin/Quotes"));
const AdminQuoteDetail = lazy(() => import("@/pages/admin/QuoteDetail"));
const AdminLeads = lazy(() => import("@/pages/admin/Leads"));
const AdminUsers = lazy(() => import("@/pages/admin/Users"));
const AdminFinancePlans = lazy(() => import("@/pages/admin/FinancePlans"));
const AdminTrainingOptions = lazy(() => import("@/pages/admin/TrainingOptions"));
const AdminGalleryItems = lazy(() => import("@/pages/admin/GalleryItems"));
const AdminAnalytics = lazy(() => import("@/pages/admin/Analytics"));
const AdminVideos = lazy(() => import("@/pages/admin/Videos"));
const BuildSheet = lazy(() => import("@/pages/admin/BuildSheet"));
const BuildProgress = lazy(() => import("@/pages/admin/BuildProgress"));
const AdminBlog = lazy(() => import("@/pages/admin/Blog"));
const AdminAIPackages = lazy(() => import("@/pages/admin/AIPackages"));
const AdminFinanceCalculator = lazy(() => import("@/pages/admin/FinanceCalculator"));
const AdminAIConversations = lazy(() => import("@/pages/admin/AIConversations"));
const AdminTestimonials = lazy(() => import("@/pages/admin/Testimonials"));
const AdminEmailPreview = lazy(() => import("@/pages/admin/EmailPreview"));
const AdminSettings = lazy(() => import("@/pages/admin/Settings"));
const AdminMaxSettings = lazy(() => import("@/pages/admin/MaxSettings"));
const AdminCalendar = lazy(() => import("@/pages/admin/Calendar"));
const AdminCustomers = lazy(() => import("@/pages/admin/Customers"));
const AdminCustomerProfile = lazy(() => import("@/pages/admin/CustomerProfile"));
const AdminSkuManager = lazy(() => import("@/pages/admin/SkuManager"));
const AdminStockLevels = lazy(() => import("@/pages/admin/StockLevels"));
const AdminArtworkApprovals = lazy(() => import("@/pages/admin/ArtworkApprovals"));
const AdminPipelineBoard = lazy(() => import("@/pages/admin/PipelineBoard"));
const KioskPipelineBoard = lazy(() => import("@/pages/KioskPipelineBoard"));
const CustomerBuildProgress = lazy(() => import("@/pages/BuildProgress"));
const WorkshopProgress = lazy(() => import("@/pages/WorkshopProgress"));
const QrLabel = lazy(() => import("@/pages/admin/QrLabel"));
const FinancePortal = lazy(() => import("@/pages/FinancePortal"));

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/stock" component={Stock} />
      <Route path="/stock/:slug" component={VanDetails} />
      <Route path="/finance" component={Finance} />
      <Route path="/gallery" component={Gallery} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />
      <Route path="/how-it-works" component={HowItWorks} />
      {BRAND.vertical.features.training && <Route path="/training" component={Training} />}
      <Route path="/business-opportunity" component={BusinessOpportunity} />
      <Route path="/configurator">
        <Redirect to="/configurator/van" />
      </Route>
      <Route path="/configurator/van" component={SelectVan} />
      <Route path="/configurator/service-type" component={SelectServiceType} />
      <Route path="/configurator/kit" component={SelectKit} />
      <Route path="/configurator/upgrades" component={SelectUpgrades} />
      <Route path="/configurator/training" component={SelectTraining} />
      <Route path="/configurator/finance" component={SelectFinance} />
      <Route path="/configurator/ai-review" component={AIReview} />
      <Route path="/configurator/quote" component={RequestQuote} />
      <Route path="/login" component={Login} />
      <Route path="/quote/confirm/:token" component={QuoteConfirmation} />
      <Route path="/spec-approval/:token" component={SpecApproval} />
      <Route path="/artwork-approval/:token" component={ArtworkApproval} />
      <Route path="/build-progress/:token" component={CustomerBuildProgress} />
      <Route path="/workshop/:token" component={WorkshopProgress} />
      <Route path="/blog" component={Blog} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms" component={TermsConditions} />
      <Route path="/cookie-policy" component={CookiePolicy} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password/:token" component={ResetPassword} />
      <Route path="/testimonial/:token" component={TestimonialRequest} />
      <Route path="/van-conversions" component={VanConversionsHub} />
      <Route path="/van-conversions/:slug" component={VanModelPage} />
      <Route path="/mobile-tyre-vans" component={LocationsHub} />
      <Route path="/mobile-tyre-vans/:slug" component={LocationPage} />
      {/* Finance partner portal — standalone, no AdminLayout */}
      <Route path="/finance-portal">{() => <FinancePortal />}</Route>
      {/* Admin routes — bypassed by SSR, loaded lazily, wrapped in AdminLayout */}
      <Route path="/admin">{() => <AdminLayout><AdminDashboard /></AdminLayout>}</Route>
      <Route path="/admin/configurator">{() => <AdminLayout><AdminConfigurator /></AdminLayout>}</Route>
      <Route path="/admin/analytics">{() => <AdminLayout><AdminAnalytics /></AdminLayout>}</Route>
      <Route path="/admin/vans">{() => <AdminLayout><AdminVans /></AdminLayout>}</Route>
      <Route path="/admin/kits">{() => <AdminLayout><AdminKits /></AdminLayout>}</Route>
      <Route path="/admin/upgrades">{() => <AdminLayout><AdminUpgrades /></AdminLayout>}</Route>
      <Route path="/admin/finance-plans">{() => <AdminLayout><AdminFinancePlans /></AdminLayout>}</Route>
      <Route path="/admin/training-options">{() => <AdminLayout><AdminTrainingOptions /></AdminLayout>}</Route>
      <Route path="/admin/gallery-items">{() => <AdminLayout><AdminGalleryItems /></AdminLayout>}</Route>
      <Route path="/admin/videos">{() => <AdminLayout><AdminVideos /></AdminLayout>}</Route>
      <Route path="/admin/quotes">{() => <AdminLayout><AdminQuotes /></AdminLayout>}</Route>
      <Route path="/admin/quotes/:id/build-sheet">{(params) => <AdminLayout><BuildSheet /></AdminLayout>}</Route>
      <Route path="/admin/quotes/:id/build-progress">{(params) => <AdminLayout><BuildProgress /></AdminLayout>}</Route>
      <Route path="/admin/quotes/:id/qr-label">{() => <QrLabel />}</Route>
      <Route path="/admin/quotes/:id">{(params) => <AdminLayout><AdminQuoteDetail /></AdminLayout>}</Route>
      <Route path="/admin/leads">{() => <AdminLayout><AdminLeads /></AdminLayout>}</Route>
      <Route path="/admin/users">{() => <AdminLayout><AdminUsers /></AdminLayout>}</Route>
      <Route path="/admin/blog">{() => <AdminLayout><AdminBlog /></AdminLayout>}</Route>
      <Route path="/admin/finance-calculator">{() => <AdminLayout><AdminFinanceCalculator /></AdminLayout>}</Route>
      <Route path="/admin/ai-packages">{() => <AdminLayout><AdminAIPackages /></AdminLayout>}</Route>
      <Route path="/admin/ai-conversations">{() => <AdminLayout><AdminAIConversations /></AdminLayout>}</Route>
      <Route path="/admin/testimonials">{() => <AdminLayout><AdminTestimonials /></AdminLayout>}</Route>
      <Route path="/admin/email-preview">{() => <AdminLayout><AdminEmailPreview /></AdminLayout>}</Route>
      <Route path="/admin/settings">{() => <AdminLayout><AdminSettings /></AdminLayout>}</Route>
      <Route path="/admin/max-settings">{() => <AdminLayout><AdminMaxSettings /></AdminLayout>}</Route>
      <Route path="/admin/calendar">{() => <AdminLayout><AdminCalendar /></AdminLayout>}</Route>
      <Route path="/admin/customers/:id">{() => <AdminLayout><AdminCustomerProfile /></AdminLayout>}</Route>
      <Route path="/admin/customers">{() => <AdminLayout><AdminCustomers /></AdminLayout>}</Route>
      <Route path="/admin/sku-manager">{() => <AdminLayout><AdminSkuManager /></AdminLayout>}</Route>
      <Route path="/admin/stock">{() => <AdminLayout><AdminStockLevels /></AdminLayout>}</Route>
      <Route path="/admin/artwork-approvals">{() => <AdminLayout><AdminArtworkApprovals /></AdminLayout>}</Route>
      <Route path="/admin/pipeline-board">{() => <AdminPipelineBoard />}</Route>
      <Route path="/pipeline-board/:token">{(params) => <KioskPipelineBoard />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function PublicChatBubble() {
  const [location] = useLocation();
  if (location.startsWith("/admin") || location === "/login" || location.startsWith("/finance-portal") || location.startsWith("/pipeline-board") || location.startsWith("/workshop/")) return null;
  return <ChatBubble />;
}

function AIWidget() {
  const [location] = useLocation();
  if (location.startsWith("/admin") || location === "/login" || location.startsWith("/finance-portal") || location.startsWith("/pipeline-board") || location.startsWith("/workshop/")) return null;
  return <AIChatWidget />;
}

function ConditionalLoadingScreen() {
  const [location] = useLocation();
  if (location.startsWith("/spec-approval/") || location.startsWith("/quote/confirm/") || location.startsWith("/artwork-approval/") || location.startsWith("/finance-portal")) {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("hasLoadedBefore", "true");
    }
    return null;
  }
  return <LoadingScreen />;
}

function App() {
  const [showCookieBanner, setShowCookieBanner] = useState(false);

  useEffect(() => {
    initializeBucketName();
  }, []);

  useEffect(() => {
    setShowCookieBanner(!hasGivenConsent());
  }, []);

  const handleConsent = () => {
    setShowCookieBanner(false);
  };

  return (
    <AppErrorBoundary>
      <ConfiguratorProvider>
        <TooltipProvider>
          <ConditionalLoadingScreen />
          <ScrollRestoration />
          <Toaster />
          <AnalyticsProvider>
            <PublicMain>
              <Suspense fallback={null}>
                <Router />
              </Suspense>
            </PublicMain>
          </AnalyticsProvider>
          <PublicChatBubble />
          <AIWidget />
          <ConfiguratorIdleModal />
          {showCookieBanner && <CookieConsentBanner onConsent={handleConsent} />}
        </TooltipProvider>
      </ConfiguratorProvider>
    </AppErrorBoundary>
  );
}

export default App;
