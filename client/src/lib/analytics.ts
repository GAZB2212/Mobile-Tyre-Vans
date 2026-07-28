const SESSION_KEY = "mtv_analytics_session";

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

function getSessionId(): string {
  if (typeof sessionStorage === 'undefined') return generateSessionId();
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = generateSessionId();
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

function detectDevice(ua: string): string {
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "Tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) return "Mobile";
  return "Desktop";
}

function detectBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\//i.test(ua) || /opera/i.test(ua)) return "Opera";
  if (/chrome/i.test(ua) && !/chromium/i.test(ua)) return "Chrome";
  if (/chromium/i.test(ua)) return "Chromium";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return "Safari";
  if (/msie|trident/i.test(ua)) return "IE";
  return "Other";
}

function detectOS(ua: string): string {
  if (/windows nt/i.test(ua)) return "Windows";
  if (/mac os x/i.test(ua)) return "macOS";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/android/i.test(ua)) return "Android";
  if (/linux/i.test(ua)) return "Linux";
  if (/chromeos/i.test(ua)) return "ChromeOS";
  return "Other";
}

function getUtmParams(): Record<string, string | undefined> {
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get("utm_source") || undefined,
    utmMedium: params.get("utm_medium") || undefined,
    utmCampaign: params.get("utm_campaign") || undefined,
    utmTerm: params.get("utm_term") || undefined,
    utmContent: params.get("utm_content") || undefined,
  };
}

let sessionInitialized = false;

export async function initSession(): Promise<string> {
  const sessionId = getSessionId();
  if (sessionInitialized) return sessionId;
  sessionInitialized = true;

  const ua = navigator.userAgent;
  const utms = getUtmParams();

  try {
    await fetch("/api/analytics/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        userAgent: ua,
        deviceType: detectDevice(ua),
        browser: detectBrowser(ua),
        os: detectOS(ua),
        referrer: document.referrer || null,
        entryPage: window.location.pathname + window.location.search,
        ...utms,
      }),
      keepalive: true,
    });
  } catch {
    // silent fail
  }

  return sessionId;
}

export async function trackPageview(url: string, title: string): Promise<void> {
  const sessionId = getSessionId();
  try {
    await fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        url,
        title,
        referrer: document.referrer || null,
      }),
      keepalive: true,
    });
  } catch {
    // silent fail
  }
}

export async function markSessionAsAdmin(): Promise<void> {
  const sessionId = getSessionId();
  try {
    await fetch("/api/analytics/mark-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
      keepalive: true,
    });
  } catch {
    // silent fail
  }
}

export async function trackEvent(eventName: string, eventData?: Record<string, unknown>): Promise<void> {
  const sessionId = getSessionId();
  try {
    await fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        eventName,
        eventData: eventData || {},
        url: window.location.pathname + window.location.search,
      }),
      keepalive: true,
    });
  } catch {
    // silent fail
  }
}
