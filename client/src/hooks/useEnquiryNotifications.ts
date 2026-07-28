import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";
import type { EnquiryLead, EnquiryQuote } from "@/components/EnquiryFeed";

export interface RecentEnquiriesData {
  leads: EnquiryLead[];
  quotes: EnquiryQuote[];
  todayNewLeadCount: number;
  todayNewQuoteCount: number;
}

const SNOOZE_KEY = "enquiry-snooze-until";
const MUTE_KEY = "enquiry-notif-muted";

function readMuted(): boolean {
  return localStorage.getItem(MUTE_KEY) === "1";
}

function readSnoozeUntil(): number | null {
  const val = localStorage.getItem(SNOOZE_KEY);
  if (!val) return null;
  const ts = parseInt(val, 10);
  if (isNaN(ts)) return null;
  if (Date.now() >= ts) {
    localStorage.removeItem(SNOOZE_KEY);
    return null;
  }
  return ts;
}

export function useEnquiryNotifications() {
  const { toast } = useToast();
  const { user } = useAuth() as { user: User | undefined };
  const isAdmin = !!(user?.adminRole && user.adminRole !== "none");

  // Mute state — initialised from localStorage and kept in sync across tabs
  // via the `storage` event so changes in one tab propagate to all others.
  const [isMuted, setIsMuted] = useState<boolean>(readMuted);

  // Snooze state — initialised from localStorage so it survives page reloads
  const [snoozeUntil, setSnoozeUntilState] = useState<number | null>(readSnoozeUntil);

  // Sync mute state within the same tab via the custom event that AdminLayout
  // and Dashboard dispatch whenever the toggle is clicked. The storage event
  // does NOT fire in the tab that wrote the value, so this custom event is the
  // only way to learn about same-tab mute changes.
  const MUTE_EVENT = "enquiry-mute-changed";
  useEffect(() => {
    const syncMute = () => setIsMuted(readMuted());
    window.addEventListener(MUTE_EVENT, syncMute);
    return () => window.removeEventListener(MUTE_EVENT, syncMute);
  }, []);

  // Sync both mute and snooze state across tabs via the storage event.
  // The storage event only fires in tabs *other* than the one that wrote the
  // value, so cross-tab changes are handled here while same-tab mute changes
  // are handled by the enquiry-mute-changed listener above.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === MUTE_KEY) {
        setIsMuted(e.newValue === "1");
      }
      if (e.key === SNOOZE_KEY) {
        if (!e.newValue) {
          setSnoozeUntilState(null);
        } else {
          const ts = parseInt(e.newValue, 10);
          if (!isNaN(ts) && Date.now() < ts) {
            setSnoozeUntilState(ts);
          } else {
            setSnoozeUntilState(null);
          }
        }
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const snooze = useCallback((durationMs: number) => {
    const until = Date.now() + durationMs;
    localStorage.setItem(SNOOZE_KEY, String(until));
    setSnoozeUntilState(until);
  }, []);

  const cancelSnooze = useCallback(() => {
    localStorage.removeItem(SNOOZE_KEY);
    setSnoozeUntilState(null);
  }, []);

  const isSnoozed = snoozeUntil != null && Date.now() < snoozeUntil;

  // Auto-expire the snooze when the timer runs out
  useEffect(() => {
    if (!snoozeUntil) return;
    const remaining = snoozeUntil - Date.now();
    if (remaining <= 0) {
      localStorage.removeItem(SNOOZE_KEY);
      setSnoozeUntilState(null);
      return;
    }
    const timer = setTimeout(() => {
      localStorage.removeItem(SNOOZE_KEY);
      setSnoozeUntilState(null);
    }, remaining);
    return () => clearTimeout(timer);
  }, [snoozeUntil]);

  const { data: recentEnquiries } = useQuery<RecentEnquiriesData>({
    queryKey: ["/api/admin/enquiries/recent"],
    enabled: isAdmin,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });

  const unreadCount =
    (recentEnquiries?.todayNewLeadCount ?? 0) +
    (recentEnquiries?.todayNewQuoteCount ?? 0);

  // Request browser notification permission once after the first successful
  // data load, but only if the user has not already been asked.
  useEffect(() => {
    if (!recentEnquiries) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      const alreadyAsked = localStorage.getItem("enquiry-notif-asked");
      if (!alreadyAsked) {
        localStorage.setItem("enquiry-notif-asked", "1");
        Notification.requestPermission();
      }
    }
  }, [!!recentEnquiries]);

  // Fire a toast (and optionally a browser notification) whenever the unread
  // count grows since the last poll. The very first load just sets the
  // baseline — no alert on page load. Notifications are suppressed while snoozed.
  const prevUnreadRef = useRef<number | null>(null);

  useEffect(() => {
    if (!recentEnquiries) return;
    const current =
      (recentEnquiries.todayNewLeadCount ?? 0) +
      (recentEnquiries.todayNewQuoteCount ?? 0);

    if (prevUnreadRef.current === null) {
      prevUnreadRef.current = current;
      return;
    }

    const delta = current - prevUnreadRef.current;
    if (delta > 0) {
      prevUnreadRef.current = current;

      // Check snooze directly from localStorage so we always use the latest value
      const snoozedUntil = readSnoozeUntil();
      if (snoozedUntil != null && Date.now() < snoozedUntil) {
        return;
      }

      // Respect the in-app mute preference. Use the isMuted state value which
      // is kept in sync for same-tab changes (via the enquiry-mute-changed
      // custom event handler above) and for cross-tab changes (via the storage
      // event handler above), so cancelling mute anywhere lifts suppression
      // immediately without waiting for the next poll cycle.
      if (isMuted) return;

      const title =
        delta === 1 ? "New enquiry received" : `${delta} new enquiries received`;
      const body =
        delta === 1
          ? "A new lead or quote has just come in."
          : `${delta} new leads or quotes have just come in.`;

      toast({ title, description: body });

      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification(title, {
            body,
            icon: "/favicon.ico",
            tag: "new-enquiry",
          });
        } catch {
          // silently ignore — browser may block notifications in some contexts
        }
      }
    } else {
      prevUnreadRef.current = current;
    }
  }, [recentEnquiries, toast, isMuted]);

  return { recentEnquiries, unreadCount, isSnoozed, snoozeUntil, snooze, cancelSnooze, isMuted };
}
