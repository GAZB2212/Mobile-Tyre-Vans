import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Cookie, ChevronDown, ChevronUp } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { acceptAllCookies, rejectNonEssentialCookies, setCookieConsent } from "@/lib/utils";

interface CookieConsentBannerProps {
  onConsent: () => void;
}

export default function CookieConsentBanner({ onConsent }: CookieConsentBannerProps) {
  const [showPreferences, setShowPreferences] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [marketingEnabled, setMarketingEnabled] = useState(false);

  const handleAcceptAll = () => {
    acceptAllCookies();
    onConsent();
  };

  const handleRejectAll = () => {
    rejectNonEssentialCookies();
    onConsent();
  };

  const handleSavePreferences = () => {
    setCookieConsent(analyticsEnabled, marketingEnabled);
    onConsent();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 animate-in slide-in-from-bottom" data-testid="cookie-consent-banner">
      <div className="container mx-auto max-w-4xl">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Cookie className="w-5 h-5" />
              Cookie Preferences
            </CardTitle>
            <CardDescription>
              We use cookies to enhance your browsing experience and analyze our traffic. 
              Choose which cookies you're happy for us to use.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showPreferences ? (
              <>
                <p className="text-sm text-muted-foreground">
                  By clicking "Accept All", you consent to our use of cookies. You can customize your preferences or reject non-essential cookies.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    onClick={handleAcceptAll}
                    className="flex-1"
                    data-testid="button-accept-all-cookies"
                  >
                    Accept All
                  </Button>
                  <Button 
                    onClick={handleRejectAll}
                    variant="outline"
                    className="flex-1"
                    data-testid="button-reject-all-cookies"
                  >
                    Reject Non-Essential
                  </Button>
                  <Button 
                    onClick={() => setShowPreferences(true)}
                    variant="secondary"
                    className="flex-1"
                    data-testid="button-manage-preferences"
                  >
                    Manage Preferences
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  {/* Essential Cookies */}
                  <div className="flex items-start justify-between gap-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <Label className="text-base font-semibold">Essential Cookies</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Required for the website to function. These cannot be disabled.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={true} disabled data-testid="switch-essential-cookies" />
                      <span className="text-sm text-muted-foreground">Always On</span>
                    </div>
                  </div>

                  {/* Analytics Cookies */}
                  <Collapsible>
                    <div className="flex items-start justify-between gap-4 p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="analytics-cookies" className="text-base font-semibold cursor-pointer">
                            Analytics Cookies
                          </Label>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" data-testid="button-toggle-analytics-info">
                              {showPreferences ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Help us understand how visitors use our website.
                        </p>
                        <CollapsibleContent className="mt-2">
                          <p className="text-xs text-muted-foreground">
                            We use Google Analytics to collect anonymous information about page views, navigation patterns, and user interactions. This helps us improve our website and services.
                          </p>
                        </CollapsibleContent>
                      </div>
                      <Switch 
                        id="analytics-cookies"
                        checked={analyticsEnabled}
                        onCheckedChange={setAnalyticsEnabled}
                        data-testid="switch-analytics-cookies"
                      />
                    </div>
                  </Collapsible>

                  {/* Marketing Cookies */}
                  <Collapsible>
                    <div className="flex items-start justify-between gap-4 p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="marketing-cookies" className="text-base font-semibold cursor-pointer">
                            Marketing Cookies
                          </Label>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" data-testid="button-toggle-marketing-info">
                              {showPreferences ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Used to deliver personalized advertising.
                        </p>
                        <CollapsibleContent className="mt-2">
                          <p className="text-xs text-muted-foreground">
                            These cookies track your activity across websites to build a profile of your interests and show you relevant advertisements.
                          </p>
                        </CollapsibleContent>
                      </div>
                      <Switch 
                        id="marketing-cookies"
                        checked={marketingEnabled}
                        onCheckedChange={setMarketingEnabled}
                        data-testid="switch-marketing-cookies"
                      />
                    </div>
                  </Collapsible>
                </div>

                <Separator />

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    onClick={handleSavePreferences}
                    className="flex-1"
                    data-testid="button-save-preferences"
                  >
                    Save Preferences
                  </Button>
                  <Button 
                    onClick={() => setShowPreferences(false)}
                    variant="outline"
                    className="flex-1"
                    data-testid="button-back-to-simple"
                  >
                    Back
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
