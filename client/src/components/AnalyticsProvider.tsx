import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { initSession, trackPageview, markSessionAsAdmin } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const initialized = useRef(false);
  const lastLocation = useRef<string>("");
  const adminMarked = useRef(false);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Fire-and-forget — don't block rendering waiting for analytics
    initSession().then(() => { initialized.current = true; }).catch(() => {});
  }, []);

  useEffect(() => {
    if (isAuthenticated && !adminMarked.current) {
      adminMarked.current = true;
      markSessionAsAdmin();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (location === lastLocation.current) return;
    lastLocation.current = location;

    const firePageview = () => {
      const fullUrl = location + window.location.search;
      // Fire-and-forget — don't await analytics writes
      trackPageview(fullUrl, document.title).catch(() => {});
    };

    const t = setTimeout(firePageview, 300);
    return () => clearTimeout(t);
  }, [location]);

  return <>{children}</>;
}
