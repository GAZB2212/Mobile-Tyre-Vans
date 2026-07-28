import { Switch, Route, useLocation, Redirect } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfiguratorProvider } from "@/lib/ConfiguratorContext";
import ScrollRestoration from "@/components/ScrollRestoration";
import LoadingScreen from "@/components/LoadingScreen";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import ChatBubble from "@/components/ChatBubble";
import { useState, useEffect, Suspense } from "react";
import { initializeBucketName, hasGivenConsent } from "@/lib/utils";
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
import Login from "@/pages/Login";
import QuoteConfirmation from "@/pages/QuoteConfirmation";
import SpecApproval from "@/pages/SpecApproval";
import Blog from "@/pages/Blog";
import BlogPost from "@/pages/BlogPost";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsConditions from "@/pages/TermsConditions";
import CookiePolicy from "@/pages/CookiePolicy";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/not-found";
import VanConversionsHub from "@/pages/seo/VanConversionsHub";
import VanModelPage from "@/pages/seo/VanModelPage";
import LocationsHub from "@/pages/seo/LocationsHub";
import LocationPage from "@/pages/seo/LocationPage";

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
      <Route path="/training" component={Training} />
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
      <Route path="/configurator/quote" component={RequestQuote} />
      <Route path="/login" component={Login} />
      <Route path="/quote/confirm/:token" component={QuoteConfirmation} />
      <Route path="/spec-approval/:token" component={SpecApproval} />
      <Route path="/blog" component={Blog} />
      <Route path="/blog/:slug" component={BlogPost} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms" component={TermsConditions} />
      <Route path="/cookie-policy" component={CookiePolicy} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password/:token" component={ResetPassword} />
      <Route path="/van-conversions" component={VanConversionsHub} />
      <Route path="/van-conversions/:slug" component={VanModelPage} />
      <Route path="/mobile-tyre-vans" component={LocationsHub} />
      <Route path="/mobile-tyre-vans/:slug" component={LocationPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function PublicChatBubble() {
  const [location] = useLocation();
  if (location.startsWith("/admin") || location === "/login") return null;
  return <ChatBubble />;
}

function ConditionalLoadingScreen() {
  const [location] = useLocation();
  if (location.startsWith("/spec-approval/") || location.startsWith("/quote/confirm/")) {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("hasLoadedBefore", "true");
    }
    return null;
  }
  return <LoadingScreen />;
}

function AppServer() {
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
    <ConfiguratorProvider>
      <TooltipProvider>
        <ConditionalLoadingScreen />
        <ScrollRestoration />
        <Toaster />
        <AnalyticsProvider>
          <Suspense fallback={null}>
            <Router />
          </Suspense>
        </AnalyticsProvider>
        <PublicChatBubble />
        {showCookieBanner && <CookieConsentBanner onConsent={handleConsent} />}
      </TooltipProvider>
    </ConfiguratorProvider>
  );
}

export default AppServer;
