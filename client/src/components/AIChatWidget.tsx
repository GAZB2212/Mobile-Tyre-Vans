import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { X, Send, RotateCcw, ArrowRight, Check, Plus, AlertCircle, Zap, MessageCircle, CheckCircle, Phone } from "lucide-react";
import maxAvatarSrc from "@assets/max-avatar.png";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  AI_CHAT_STORAGE_KEY,
  CONFIGURATOR_STORAGE_KEY,
  buildConfiguratorState,
  defaultConfig,
  defaultTrackers,
  generateSessionId,
  type AIConfig,
  type AIMessage,
  type AIChatState,
  type AITrackers,
  type Stage,
} from "@/lib/aiConfiguratorMapping";

type Kit = { id: string; name: string; serviceType: string[] | string };
type Upgrade = { id: string; name: string; category: string; popular: boolean; forCommercial: boolean };

// Module-level flag so saveError survives component remounts within the same page session
// (e.g. when the user visits an admin page and navigates back, causing AIChatWidget to unmount/remount)
let _persistedSaveError = false;

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-white/10 rounded-xl px-4 py-3 flex items-center gap-1.5">
        <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce [animation-delay:120ms]" />
        <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce [animation-delay:240ms]" />
      </div>
    </div>
  );
}

function SummaryCard({
  config,
  trackers,
  kits,
  upgrades,
  onAddUpgrade,
  onViewConfig,
  onStartAgain,
}: {
  config: AIConfig;
  trackers: AITrackers;
  kits: Kit[];
  upgrades: Upgrade[];
  onAddUpgrade: (id: string) => void;
  onViewConfig: () => void;
  onStartAgain: () => void;
}) {
  const kitName = kits.find(k => k.id === config.kitId)?.name;
  const selectedUpgradeNames = config.upgradeIds.map(id => upgrades.find(u => u.id === id)?.name).filter(Boolean);

  const suggestedPopular = upgrades
    .filter(u => u.popular && !config.upgradeIds.includes(u.id))
    .slice(0, 3);

  const financeLabel: Record<string, string> = { outright: "Buy outright", lease: "Business lease", finance: "Spread the cost (finance)" };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Zap size={16} className="text-[#8bc440]" />
        <span className="text-white font-semibold text-sm">Your configuration</span>
      </div>

      <div className="space-y-2 text-sm">
        {config.ownVan !== null && (
          <div className="flex justify-between">
            <span className="text-white/50">Van</span>
            <span className="text-white">
              {config.ownVan ? "Customer's own van" : `${config.vanSize ?? "Panel van"} (supplied by us)`}
            </span>
          </div>
        )}
        {config.serviceType && (
          <div className="flex justify-between">
            <span className="text-white/50">Service type</span>
            <span className="text-white capitalize">{config.serviceType === "car" ? "Car tyres" : config.serviceType === "commercial" ? "Commercial tyres" : "Car & commercial"}</span>
          </div>
        )}
        {kitName && (
          <div className="flex justify-between">
            <span className="text-white/50">Kit</span>
            <span className="text-white">{kitName}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-white/50">48V silent compressor</span>
          <span className={config.includes48v ? "text-[#8bc440] font-medium" : "text-white/40"}>
            {config.includes48v ? "Included" : "Not included"}
          </span>
        </div>
        {selectedUpgradeNames.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-white/50">Extras</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {selectedUpgradeNames.map((name, i) => (
                <span key={i} className="bg-white/10 text-white/80 text-xs px-2 py-0.5 rounded-md">{name}</span>
              ))}
            </div>
          </div>
        )}
        {config.financePreference && (
          <div className="flex justify-between">
            <span className="text-white/50">Payment</span>
            <span className="text-white">{financeLabel[config.financePreference] ?? config.financePreference}</span>
          </div>
        )}
      </div>

      {!config.includes48v && trackers.responseToThis48v !== "hard_no" && (
        <div className="bg-[#8bc440]/10 border border-[#8bc440]/20 rounded-lg px-3 py-2 text-xs text-[#8bc440]">
          Most customers add the 48V silent compressor system — worth including for fuel savings alone.
        </div>
      )}

      {suggestedPopular.length > 0 && (
        <div className="space-y-2">
          <p className="text-white/50 text-xs">Customers like you also typically add:</p>
          {suggestedPopular.map(u => (
            <div key={u.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="text-white/80 text-xs truncate">{u.name}</span>
                <span
                  className="text-[9px] font-medium px-1.5 py-px rounded bg-[#8bc440]/15 text-[#8bc440] border border-[#8bc440]/25 shrink-0"
                  data-testid={`badge-popular-widget-${u.id}`}
                >
                  Popular choice
                </span>
              </div>
              <button
                onClick={() => onAddUpgrade(u.id)}
                data-testid={`button-add-upgrade-${u.id}`}
                className="flex items-center gap-1 text-xs text-[#8bc440] border border-[#8bc440]/30 px-2 py-0.5 rounded-md hover:bg-[#8bc440]/10 transition-colors shrink-0"
              >
                <Plus size={10} /> Add
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 pt-1">
        <Button
          onClick={onViewConfig}
          data-testid="button-view-configuration"
          className="w-full bg-[#8bc440] text-[#191919] font-semibold hover:bg-[#8bc440]/90"
        >
          View your configuration <ArrowRight size={16} className="ml-1" />
        </Button>
        <button
          onClick={onStartAgain}
          data-testid="button-start-again"
          className="text-white/40 text-xs text-center hover:text-white/70 transition-colors"
        >
          Start again
        </button>
      </div>
    </div>
  );
}

export default function AIChatWidget() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"choice" | "max" | "contact">("choice");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasResume, setHasResume] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [showContactCapture, setShowContactCapture] = useState(false);
  const [captureNameInput, setCaptureNameInput] = useState("");
  const [capturePhoneInput, setCapturePhoneInput] = useState("");

  // Contact form state (used when view === 'contact')
  const [ctName, setCtName] = useState("");
  const [ctEmail, setCtEmail] = useState("");
  const [ctPhone, setCtPhone] = useState("");
  const [ctMessage, setCtMessage] = useState("");
  const [ctSubmitted, setCtSubmitted] = useState(false);

  const contactMutation = useMutation({
    mutationFn: (data: { name: string; email: string; phone: string; message: string }) =>
      apiRequest("POST", "/api/leads", { ...data, phone: data.phone || null, source: "live_chat" }),
    onSuccess: () => setCtSubmitted(true),
    onError: () =>
      toast({ variant: "destructive", title: "Something went wrong", description: "Please call us on 0800 000 0000." }),
  });

  const [sessionId, setSessionId] = useState<string>(() => generateSessionId());
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [config, setConfig] = useState<AIConfig>(defaultConfig);
  const [trackers, setTrackers] = useState<AITrackers>(defaultTrackers);
  const [stage, setStage] = useState<Stage>("chat");
  const [saveError, setSaveError] = useState(() => _persistedSaveError);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Ref to avoid stale closure when reading messages inside event handlers
  const messagesRef = useRef<AIMessage[]>(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  // Ref for pre-chat captured contact details — avoids stale-closure issues in triggerGreeting
  const capturedContactRef = useRef<{ name: string | null; phone: string | null }>({ name: null, phone: null });
  // Always-current snapshot of session state — used by beforeunload to save on page exit
  const liveStateRef = useRef({ sessionId, messages, config, trackers, stage, captureNameInput, capturePhoneInput });

  const { data: kits = [] } = useQuery<Kit[]>({ queryKey: ["/api/kits"] });
  const { data: upgrades = [] } = useQuery<Upgrade[]>({ queryKey: ["/api/upgrades"] });

  // Trigger Max's greeting when the chat is opened with no existing conversation
  const triggerGreeting = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const resolvedName = capturedContactRef.current.name;
    const resolvedPhone = capturedContactRef.current.phone;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch("/api/ai-chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "__GREET__" }],
          sessionId,
          contactName: resolvedName,
          contactPhone: resolvedPhone,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Max is temporarily busy. Tap the chat bubble to try again.");
      const data = await res.json();
      const assistantMsg: AIMessage = { role: "assistant", content: data.message ?? "" };
      // Only add Max's response — the __GREET__ trigger is never shown in the UI
      setMessages([assistantMsg]);
      if (data.config) setConfig(prev => ({ ...prev, ...data.config }));
      if (data.trackers) setTrackers(prev => ({ ...prev, ...data.trackers }));
      if (data.stage) setStage(data.stage);
    } catch (err: any) {
      const msg = err?.name === "AbortError"
        ? "Max took too long to respond. Please try again."
        : (err?.message ?? "Max is temporarily unavailable. Please try again in a moment.");
      setErrorMsg(msg);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [sessionId]);

  // Listen for external "openAIChat" events (e.g. from the configurator idle modal)
  useEffect(() => {
    const handler = () => {
      setOpen(true);
      setView("max");
      // If there's no conversation yet, have Max introduce himself automatically
      if (messagesRef.current.length === 0) {
        triggerGreeting();
      }
    };
    window.addEventListener("openAIChat", handler);
    return () => window.removeEventListener("openAIChat", handler);
  }, [triggerGreeting]);

  // Don't render on admin or login pages
  if (location.startsWith("/admin") || location === "/login") return null;

  // Load saved state from localStorage on first mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AI_CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AIChatState;
        if (parsed.stage !== "complete" && parsed.messages.length > 0) {
          setHasResume(true);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (messages.length === 0 && stage === "chat") return;
    try {
      const state: AIChatState = { sessionId, messages, config, stage, trackers, savedAt: new Date().toISOString() };
      localStorage.setItem(AI_CHAT_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [messages, config, stage, trackers, sessionId]);

  // Keep liveStateRef in sync so beforeunload can read without stale closures
  useEffect(() => {
    liveStateRef.current = { sessionId, messages, config, trackers, stage, captureNameInput, capturePhoneInput };
  }, [sessionId, messages, config, trackers, stage, captureNameInput, capturePhoneInput]);

  // Persist saveError at module level so it survives unmount/remount within the same page session
  useEffect(() => {
    _persistedSaveError = saveError;
  }, [saveError]);

  // Save contact/conversation data if the user navigates away or closes the tab
  useEffect(() => {
    const handleBeforeUnload = () => {
      const s = liveStateRef.current;
      if (s.stage === "complete") return;
      // Nothing to save if there's no contact info at all
      const hasContact = s.config.contactName || s.config.contactPhone;
      const hasCapture = s.captureNameInput.trim() || s.capturePhoneInput.trim();
      if (!s.messages.length && !hasContact && !hasCapture) return;
      const saveConfig = hasContact
        ? s.config
        : { ...s.config, contactName: s.captureNameInput.trim() || null, contactPhone: s.capturePhoneInput.trim() || null };
      const payload = JSON.stringify({
        sessionId: s.sessionId,
        status: "abandoned",
        messages: s.messages,
        config: saveConfig,
        trackers: s.trackers,
      });
      navigator.sendBeacon("/api/ai-chat/save", new Blob([payload], { type: "application/json" }));
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []); // empty deps — always reads from liveStateRef which is kept current above

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, stage]);

  // Focus input when opened
  useEffect(() => {
    if (open && stage === "chat") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, stage]);

  const callAI = useCallback(async (msgs: AIMessage[]) => {
    setLoading(true);
    setErrorMsg(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch("/api/ai-chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: msgs,
          sessionId,
          contactName: config.contactName ?? null,
          contactPhone: config.contactPhone ?? null,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Max is temporarily busy. Please try again in a moment.");
      }

      const data = await res.json();

      const assistantMsg: AIMessage = { role: "assistant", content: data.message ?? "" };
      setMessages(prev => [...prev, assistantMsg]);
      const rawMerged = data.config ? { ...config, ...data.config } : config;
      // Never let an AI response null out already-captured contact info — the AI
      // sometimes omits or clears contactName/contactPhone in later messages, which
      // would cause the quote to be saved as "Via Max (name pending)" even after a
      // real name was captured.
      const newConfig: typeof config = {
        ...rawMerged,
        contactName: rawMerged.contactName || config.contactName || null,
        contactPhone: rawMerged.contactPhone || config.contactPhone || null,
      };
      const newTrackers = data.trackers ? { ...trackers, ...data.trackers } : trackers;
      if (data.config) setConfig(newConfig);
      if (data.trackers) setTrackers(newTrackers);
      if (data.stage) setStage(data.stage);

      // Save to DB when contact details first appear OR at summary stage
      const newMsgs = [...msgs, assistantMsg];
      const contactJustArrived =
        (data.config?.contactName && !config.contactName) ||
        (data.config?.contactPhone && !config.contactPhone);
      if (data.stage === "summary" || contactJustArrived) {
        saveToDb(newMsgs, newConfig, newTrackers, "in_progress");
      }
    } catch (err: any) {
      const msg = err?.name === "AbortError"
        ? "Max took too long to respond. Please try again."
        : (err?.message ?? "Max is temporarily unavailable. You can still use the configurator directly.");
      setErrorMsg(msg);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [sessionId, config, trackers]);

  const lastSaveErrorTimeRef = useRef<number>(0);
  const SAVE_ERROR_COOLDOWN_MS = 30_000;

  const saveToDb = useCallback(async (
    msgs: AIMessage[],
    cfg: AIConfig,
    trk: AITrackers,
    status: string,
  ) => {
    try {
      const res = await fetch("/api/ai-chat/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, status, messages: msgs, config: cfg, trackers: trk }),
      });
      if (!res.ok) {
        throw new Error(`Save failed with status ${res.status}`);
      }
      lastSaveErrorTimeRef.current = 0;
      setSaveError(false);
    } catch {
      setSaveError(true);
      const now = Date.now();
      if (now - lastSaveErrorTimeRef.current >= SAVE_ERROR_COOLDOWN_MS) {
        lastSaveErrorTimeRef.current = now;
        toast({
          title: "Session not saved",
          description: "Your conversation may not have been saved. Please check your connection and try again.",
          variant: "destructive",
        });
      }
    }
  }, [sessionId, toast]);

  const handleContactStart = (name: string, phone: string) => {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    // Write to ref FIRST so triggerGreeting (useCallback) always reads the latest value
    capturedContactRef.current = { name: trimmedName || null, phone: trimmedPhone || null };
    const updatedConfig = { ...config, contactName: trimmedName || null, contactPhone: trimmedPhone || null };
    if (trimmedName || trimmedPhone) setConfig(updatedConfig);
    setShowContactCapture(false);
    setCaptureNameInput("");
    setCapturePhoneInput("");
    // Persist the contact details to DB immediately — captures the lead even if they abandon
    if (trimmedName || trimmedPhone) {
      saveToDb([], updatedConfig, trackers, "in_progress");
    }
    triggerGreeting();
  };

  const handleOpen = () => {
    setOpen(true);
    setView("choice");
  };

  const handleChooseMax = () => {
    setView("max");
    if (hasResume && messages.length === 0) {
      setShowResumePrompt(true);
    } else if (messages.length === 0) {
      setShowContactCapture(true);
    }
  };

  const handleChooseContact = () => {
    setView("contact");
    setCtName("");
    setCtEmail("");
    setCtPhone("");
    setCtMessage("");
    setCtSubmitted(false);
  };

  const handleResume = () => {
    setShowResumePrompt(false);
    try {
      const saved = localStorage.getItem(AI_CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AIChatState;
        setSessionId(parsed.sessionId);
        setMessages(parsed.messages);
        setConfig(parsed.config);
        setTrackers(parsed.trackers);
        setStage(parsed.stage);
      }
    } catch {
      setShowResumePrompt(false);
      callAI([]);
    }
    setHasResume(false);
  };

  const handleFreshStart = () => {
    setShowResumePrompt(false);
    setHasResume(false);
    const newId = generateSessionId();
    setSessionId(newId);
    setMessages([]);
    setConfig(defaultConfig);
    setTrackers(defaultTrackers);
    setStage("chat");
    setCaptureNameInput("");
    setCapturePhoneInput("");
    capturedContactRef.current = { name: null, phone: null };
    setShowContactCapture(true);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: AIMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    await callAI(newMessages);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAddUpgrade = (upgradeId: string) => {
    setConfig(prev => ({
      ...prev,
      upgradeIds: prev.upgradeIds.includes(upgradeId) ? prev.upgradeIds : [...prev.upgradeIds, upgradeId],
    }));
    setTrackers(prev => ({
      ...prev,
      addedUpgradeIds: prev.addedUpgradeIds.includes(upgradeId) ? prev.addedUpgradeIds : [...prev.addedUpgradeIds, upgradeId],
    }));
  };

  const handleViewConfig = () => {
    // Write to configurator localStorage
    const configState = buildConfiguratorState(config);
    try {
      localStorage.setItem(CONFIGURATOR_STORAGE_KEY, JSON.stringify(configState));
    } catch {
      // ignore
    }

    // Write completed state to localStorage BEFORE navigating so the new page sees it immediately
    try {
      const state: AIChatState = { sessionId, messages, config, stage: "complete", trackers, savedAt: new Date().toISOString() };
      localStorage.setItem(AI_CHAT_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }

    // Synchronously update liveStateRef to "complete" BEFORE calling window.location.href.
    // window.location.href triggers beforeunload, which reads liveStateRef to decide whether
    // to fire a sendBeacon("abandoned"). Without this update, the ref still shows "summary"
    // (setStage is a queued React update, not synchronous), so the abandoned beacon would race
    // with and overwrite our completed save — preventing the auto-quote from being created.
    liveStateRef.current = { ...liveStateRef.current, stage: "complete" };
    setStage("complete");

    // Use sendBeacon instead of fetch for the completed save — regular fetch is cancelled
    // by the page navigation that follows immediately below.
    const completedPayload = JSON.stringify({ sessionId, status: "completed", messages, config, trackers });
    navigator.sendBeacon("/api/ai-chat/save", new Blob([completedPayload], { type: "application/json" }));

    // Navigate to the AI review page (dedicated review/adjust step)
    window.location.href = "/configurator/ai-review";
  };

  const handleStartAgain = () => {
    handleFreshStart();
  };

  const handleClose = () => {
    setOpen(false);
    setView("choice");
    if (stage === "complete") return;
    if (messages.length > 0) {
      // Mid-conversation abandon
      saveToDb(messages, config, trackers, "abandoned");
    } else if (config.contactName || config.contactPhone) {
      // Contact captured but no messages yet (e.g. closed while Max was loading)
      saveToDb([], config, trackers, "abandoned");
    } else if (captureNameInput.trim() || capturePhoneInput.trim()) {
      // User typed in the form but never clicked "Get started"
      const partialConfig = { ...config, contactName: captureNameInput.trim() || null, contactPhone: capturePhoneInput.trim() || null };
      saveToDb([], partialConfig, trackers, "abandoned");
    }
  };

  return (
    <>
      {/* Trigger — sticky bottom bar on mobile, floating pill on md+ */}
      {!open && (
        <>
          {/* Mobile: full-width sticky bar at the bottom */}
          <button
            onClick={handleOpen}
            data-testid="button-ai-chat-open"
            className="md:hidden fixed bottom-0 left-0 right-0 z-[10000] flex items-center gap-3 px-5 py-3.5 bg-[#8bc440] text-[#191919] shadow-[0_-4px_24px_rgba(0,0,0,0.3)] rounded-t-2xl active:bg-[#8bc440]/90 transition-colors"
          >
            <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 ring-2 ring-[#191919]/15 relative">
              <img src={maxAvatarSrc} alt="Max" className="w-full h-full object-cover object-top" />
              {hasResume && (
                <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-[#191919]/50 ring-1 ring-[#8bc440]" />
              )}
            </div>
            <div className="flex flex-col items-start flex-1">
              <span className="text-[10px] font-medium opacity-60 leading-none mb-0.5">Not sure where to start?</span>
              <span className="text-sm font-bold leading-none">Build your van with Max</span>
            </div>
            <ArrowRight className="w-5 h-5 opacity-60 shrink-0" />
          </button>

          {/* md+: original floating pill */}
          <button
            onClick={handleOpen}
            data-testid="button-ai-chat-open-desktop"
            className="hidden md:flex fixed bottom-24 right-5 z-[10000] items-center gap-3 pl-3 pr-4 py-2.5 rounded-xl bg-[#8bc440] text-[#191919] shadow-lg hover:bg-[#8bc440]/90 transition-colors"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 ring-2 ring-[#191919]/15">
              <img src={maxAvatarSrc} alt="Max" className="w-full h-full object-cover object-top" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-[10px] font-medium opacity-60 leading-none mb-0.5">Not sure where to start?</span>
              <span className="text-sm font-bold leading-none flex items-center gap-1.5">
                Build your van with Max
                {hasResume && (
                  <span className="w-2 h-2 rounded-full bg-[#191919]/40" />
                )}
              </span>
            </div>
          </button>
        </>
      )}

      {/* Chat panel */}
      {open && (
        <div
          data-testid="panel-ai-chat"
          className="fixed z-[10000] flex flex-col bg-[#141414] border border-white/10 shadow-2xl
            bottom-0 right-0 w-full h-full
            md:bottom-5 md:right-5 md:w-[400px] md:h-[620px] md:rounded-2xl"
        >

          {/* ── CHOICE VIEW ── */}
          {view === "choice" && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-[#8bc440]/40 shrink-0">
                    <img src={maxAvatarSrc} alt="Max" className="w-full h-full object-cover object-top" />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm leading-none">Mobile Tyre Vans</div>
                    <div className="text-white/40 text-xs mt-0.5">How can we help?</div>
                  </div>
                </div>
                <button onClick={handleClose} data-testid="button-ai-chat-close" className="text-white/40 hover:text-white/80 transition-colors p-1">
                  <X size={18} />
                </button>
              </div>

              {/* Tiles */}
              <div className="flex-1 flex flex-col justify-center gap-4 px-5 py-8">
                <button
                  onClick={handleChooseMax}
                  data-testid="button-choice-max"
                  className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl p-4 text-left hover:bg-white/10 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-[#8bc440]/40 shrink-0">
                    <img src={maxAvatarSrc} alt="Max" className="w-full h-full object-cover object-top" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold text-sm leading-none mb-1">Build my van with Max</div>
                    <div className="text-white/50 text-xs leading-relaxed">AI-guided configurator — Max walks you through everything step by step</div>
                  </div>
                  <ArrowRight size={16} className="text-[#8bc440] shrink-0" />
                </button>

                <button
                  onClick={handleChooseContact}
                  data-testid="button-choice-contact"
                  className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl p-4 text-left hover:bg-white/10 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    <MessageCircle size={22} className="text-[#8bc440]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold text-sm leading-none mb-1">Send us a message</div>
                    <div className="text-white/50 text-xs leading-relaxed">Quick question or enquiry — we'll get back to you as soon as we can</div>
                  </div>
                  <ArrowRight size={16} className="text-white/30 shrink-0" />
                </button>

                <p className="text-center text-white/25 text-xs pt-2">
                  Or call us: <a href="tel:08000000000" className="underline text-white/40 hover:text-white/60 transition-colors">0800 000 0000</a>
                </p>
              </div>
            </>
          )}

          {/* ── MAX CHAT VIEW ── */}
          {view === "max" && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                  <button onClick={() => setView("choice")} data-testid="button-back-to-choice" className="text-white/40 hover:text-white/80 transition-colors p-1 -ml-1">
                    <ArrowRight size={16} className="rotate-180" />
                  </button>
                  <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-[#8bc440]/40 shrink-0">
                    <img src={maxAvatarSrc} alt="Max" className="w-full h-full object-cover object-top" />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm leading-none">Max</div>
                    <div className="text-white/40 text-xs mt-0.5">AI Van Builder · Mobile Tyre Vans</div>
                  </div>
                </div>
                <button onClick={handleClose} data-testid="button-ai-chat-close" className="text-white/40 hover:text-white/80 transition-colors p-1">
                  <X size={18} />
                </button>
              </div>

              {/* Persistent save-error banner */}
              {saveError && (
                <div data-testid="banner-save-error" className="flex items-center gap-2 px-4 py-2 bg-red-500/15 border-b border-red-500/20 shrink-0">
                  <AlertCircle size={13} className="text-red-400 shrink-0" />
                  <p className="text-red-300 text-xs leading-snug flex-1">Your session is not being saved — check your connection.</p>
                  <button
                    data-testid="button-save-error-retry"
                    onClick={() => { lastSaveErrorTimeRef.current = 0; saveToDb(messages, config, trackers, "in_progress"); }}
                    className="text-red-300 text-xs underline underline-offset-2 shrink-0 hover:text-red-100 transition-colors"
                  >Retry</button>
                </div>
              )}

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {showContactCapture && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
                    <div>
                      <p className="text-white font-semibold text-sm leading-snug mb-1">Quick one before we get going</p>
                      <p className="text-white/50 text-xs leading-relaxed">
                        Leave your name and number — if you need to step away, one of the team can ring you back and pick up right where you left off.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <input
                        data-testid="input-capture-name"
                        type="text"
                        placeholder="Your name"
                        value={captureNameInput}
                        onChange={e => setCaptureNameInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleContactStart(captureNameInput, capturePhoneInput); }}
                        className="w-full bg-[#242424] text-white text-sm rounded-xl px-3.5 py-2.5 outline-none border border-white/10 focus:border-white/25 placeholder:text-white/30 transition-colors"
                        autoFocus
                      />
                      <input
                        data-testid="input-capture-phone"
                        type="tel"
                        placeholder="Mobile number"
                        value={capturePhoneInput}
                        onChange={e => setCapturePhoneInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleContactStart(captureNameInput, capturePhoneInput); }}
                        className="w-full bg-[#242424] text-white text-sm rounded-xl px-3.5 py-2.5 outline-none border border-white/10 focus:border-white/25 placeholder:text-white/30 transition-colors"
                      />
                    </div>
                    <Button onClick={() => handleContactStart(captureNameInput, capturePhoneInput)} disabled={!captureNameInput.trim() && !capturePhoneInput.trim()} data-testid="button-contact-capture-submit" className="w-full bg-[#8bc440] text-[#191919] font-semibold">
                      Get started <ArrowRight size={15} className="ml-1" />
                    </Button>
                    <button onClick={() => handleContactStart("", "")} data-testid="button-contact-capture-skip" className="w-full text-white/30 text-xs text-center hover:text-white/60 transition-colors pt-1">
                      Skip for now
                    </button>
                  </div>
                )}

                {showResumePrompt && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                    <p className="text-white text-sm">Welcome back — you have a saved configuration. Would you like to pick up where you left off?</p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleResume} data-testid="button-resume-conversation" className="bg-[#8bc440] text-[#191919] font-semibold flex-1">
                        <RotateCcw size={14} className="mr-1" /> Resume
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleFreshStart} data-testid="button-start-fresh" className="flex-1 border-white/20 text-white/70">
                        Start fresh
                      </Button>
                    </div>
                  </div>
                )}

                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      data-testid={`msg-${m.role}-${i}`}
                      className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        m.role === "user" ? "bg-[#8bc440] text-[#191919] font-medium rounded-br-sm" : "bg-white/10 text-white rounded-bl-sm"
                      }`}
                    >{m.content}</div>
                  </div>
                ))}

                {loading && <TypingIndicator />}

                {errorMsg && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-3 flex gap-2">
                    <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-red-300 text-sm">{errorMsg}</p>
                      <div className="flex items-center gap-3">
                        {messages.length === 0 && (
                          <button onClick={() => triggerGreeting()} className="text-[#8bc440] text-xs hover:underline">Try again →</button>
                        )}
                        <a href="/configurator/ai-review" className="text-white/40 text-xs hover:underline">Go to configurator directly</a>
                      </div>
                    </div>
                  </div>
                )}

                {stage === "summary" && !loading && (
                  <SummaryCard config={config} trackers={trackers} kits={kits} upgrades={upgrades} onAddUpgrade={handleAddUpgrade} onViewConfig={handleViewConfig} onStartAgain={handleStartAgain} />
                )}

                {stage === "complete" && (
                  <div className="bg-[#8bc440]/10 border border-[#8bc440]/20 rounded-xl px-3.5 py-3 flex items-center gap-2">
                    <Check size={14} className="text-[#8bc440]" />
                    <p className="text-[#8bc440] text-sm">Taking you to your review page...</p>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {stage === "chat" && !showResumePrompt && !showContactCapture && (
                <div className="px-3 py-3 border-t border-white/10 flex items-center gap-2 shrink-0">
                  <input
                    ref={inputRef}
                    data-testid="input-ai-chat"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your reply..."
                    disabled={loading}
                    className="flex-1 bg-[#242424] text-white text-sm rounded-xl px-3.5 py-2.5 outline-none border border-white/10 focus:border-white/25 placeholder:text-white/30 transition-colors disabled:opacity-50"
                  />
                  <button onClick={handleSend} disabled={!input.trim() || loading} data-testid="button-ai-chat-send" className="w-9 h-9 rounded-xl bg-[#8bc440] flex items-center justify-center text-[#191919] disabled:opacity-40 hover:bg-[#8bc440]/90 transition-colors shrink-0">
                    <Send size={15} />
                  </button>
                </div>
              )}

              {stage === "summary" && (
                <div className="px-4 pb-4 shrink-0">
                  <button onClick={handleStartAgain} data-testid="button-ai-chat-restart" className="w-full text-white/30 text-xs text-center hover:text-white/60 transition-colors py-2">
                    Start again
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── CONTACT FORM VIEW ── */}
          {view === "contact" && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                  <button onClick={() => setView("choice")} data-testid="button-back-to-choice-contact" className="text-white/40 hover:text-white/80 transition-colors p-1 -ml-1">
                    <ArrowRight size={16} className="rotate-180" />
                  </button>
                  <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                    <MessageCircle size={18} className="text-[#8bc440]" />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm leading-none">Send a message</div>
                    <div className="text-white/40 text-xs mt-0.5">Mobile Tyre Vans</div>
                  </div>
                </div>
                <button onClick={handleClose} data-testid="button-contact-close" className="text-white/40 hover:text-white/80 transition-colors p-1">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5">
                {ctSubmitted ? (
                  <div className="flex flex-col items-center text-center gap-4 pt-8">
                    <div className="w-14 h-14 rounded-full bg-[#8bc440]/15 flex items-center justify-center">
                      <CheckCircle size={28} className="text-[#8bc440]" />
                    </div>
                    <div>
                      <p className="text-white font-semibold mb-1">Message received</p>
                      <p className="text-white/50 text-sm leading-relaxed">We'll get back to you as soon as possible — usually within a few hours during business hours.</p>
                    </div>
                    <p className="text-white/30 text-xs flex items-center gap-1.5 pt-1">
                      <Phone size={11} /> Or call us: <a href="tel:08000000000" className="underline hover:text-white/60 transition-colors">0800 000 0000</a>
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setView("choice")} data-testid="button-contact-done" className="mt-2 border-white/20 text-white/60">
                      Back
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-white/50 text-sm mb-4">Send us a message and we'll get back to you as soon as we can.</p>
                    <div>
                      <label className="text-white/60 text-xs mb-1 block">Name *</label>
                      <input
                        data-testid="input-contact-name"
                        type="text"
                        placeholder="Your name"
                        value={ctName}
                        onChange={e => setCtName(e.target.value)}
                        className="w-full bg-[#242424] text-white text-sm rounded-xl px-3.5 py-2.5 outline-none border border-white/10 focus:border-white/25 placeholder:text-white/30 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-white/60 text-xs mb-1 block">Email *</label>
                      <input
                        data-testid="input-contact-email"
                        type="email"
                        placeholder="your@email.com"
                        value={ctEmail}
                        onChange={e => setCtEmail(e.target.value)}
                        className="w-full bg-[#242424] text-white text-sm rounded-xl px-3.5 py-2.5 outline-none border border-white/10 focus:border-white/25 placeholder:text-white/30 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-white/60 text-xs mb-1 block">Phone (optional)</label>
                      <input
                        data-testid="input-contact-phone"
                        type="tel"
                        placeholder="07700 000000"
                        value={ctPhone}
                        onChange={e => setCtPhone(e.target.value)}
                        className="w-full bg-[#242424] text-white text-sm rounded-xl px-3.5 py-2.5 outline-none border border-white/10 focus:border-white/25 placeholder:text-white/30 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-white/60 text-xs mb-1 block">Message *</label>
                      <textarea
                        data-testid="input-contact-message"
                        placeholder="How can we help?"
                        value={ctMessage}
                        onChange={e => setCtMessage(e.target.value)}
                        rows={4}
                        className="w-full bg-[#242424] text-white text-sm rounded-xl px-3.5 py-2.5 outline-none border border-white/10 focus:border-white/25 placeholder:text-white/30 transition-colors resize-none"
                      />
                    </div>
                    <Button
                      onClick={() => {
                        if (!ctName.trim() || !ctEmail.trim() || !ctMessage.trim()) {
                          toast({ variant: "destructive", title: "Please fill in all required fields." });
                          return;
                        }
                        contactMutation.mutate({ name: ctName.trim(), email: ctEmail.trim(), phone: ctPhone.trim(), message: ctMessage.trim() });
                      }}
                      disabled={contactMutation.isPending}
                      data-testid="button-contact-send"
                      className="w-full bg-[#8bc440] text-[#191919] font-semibold"
                    >
                      <Send size={14} className="mr-2" />
                      {contactMutation.isPending ? "Sending..." : "Send Message"}
                    </Button>
                    <p className="text-center text-white/25 text-xs pt-1">
                      Or call us: <a href="tel:08000000000" className="underline hover:text-white/40 transition-colors">0800 000 0000</a>
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      )}
    </>
  );
}
