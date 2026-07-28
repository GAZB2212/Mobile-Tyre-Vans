import { BRAND } from "@shared/brand";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight, X } from "lucide-react";
import maxAvatarSrc from "@assets/max-avatar.png";

const IDLE_DELAY_MS = 90_000; // 90 seconds
const SESSION_KEY = "configurator-idle-modal-shown";

export default function ConfiguratorIdleModal() {
  const [location] = useLocation();
  const [show, setShow] = useState(false);

  const isInConfigurator =
    location.startsWith("/configurator/") && location !== "/configurator/quote";

  useEffect(() => {
    if (!isInConfigurator) return;

    // Only show once per browser session
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const timer = setTimeout(() => {
      if (!sessionStorage.getItem(SESSION_KEY)) {
        // Don't interrupt if the user already has the AI chat open
        const aiChatOpen = !!document.querySelector('[data-testid="panel-ai-chat"]');
        if (!aiChatOpen) {
          setShow(true);
          sessionStorage.setItem(SESSION_KEY, "1");
        }
      }
    }, IDLE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isInConfigurator]);

  const handleOpenAI = () => {
    setShow(false);
    // Give the dialog time to close before the AI panel opens
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("openAIChat"));
    }, 200);
  };

  const handleDismiss = () => {
    setShow(false);
  };

  return (
    <Dialog open={show} onOpenChange={open => { if (!open) handleDismiss(); }}>
      <DialogContent
        className="max-w-md text-center p-0 overflow-hidden border-0"
        data-testid="modal-configurator-idle"
      >
        {/* Header strip */}
        <div className="bg-accent px-6 pt-8 pb-6">
          <div className="flex justify-center mb-4">
            <img
              src={maxAvatarSrc}
              alt="Max"
              className="w-20 h-20 rounded-full object-cover ring-4 ring-white/30"
            />
          </div>
          <h2 className="text-xl font-bold text-white leading-snug">
            Struggling with the configurator?
          </h2>
          <p className="text-white/90 text-sm mt-2">
            Let Max build your van spec for you — just answer a few quick questions.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-3 bg-card">
          <p className="text-sm text-muted-foreground">
            Max will ask about your daily jobs, van preference and budget — then put together
            a complete, priced build in minutes.
          </p>

          <Button
            onClick={handleOpenAI}
            className="w-full bg-accent/90 text-accent-foreground hover:bg-accent gap-2"
            data-testid="button-idle-open-ai"
          >
            Chat with {BRAND.assistantName}
            <ArrowRight className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            onClick={handleDismiss}
            className="w-full text-muted-foreground gap-1"
            data-testid="button-idle-dismiss"
          >
            <X className="w-3.5 h-3.5" />
            I'll carry on myself
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
