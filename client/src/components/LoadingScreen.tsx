import { useEffect, useState } from "react";
import BrandLogo from "@/components/BrandLogo";

const DEFAULT_HERO_VIDEO = "/media/hero_vid_optimised.mp4";
const CACHE_KEY = "heroVideoUrl";

function setCachedVideoUrl(url: string) {
  try {
    sessionStorage.setItem(CACHE_KEY, url);
  } catch {}
}

export default function LoadingScreen() {
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window !== 'undefined') {
      return !sessionStorage.getItem('hasLoadedBefore');
    }
    return true;
  });
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    "Choose your van",
    "Choose your kit",
    "Choose your upgrades",
    "Choose your finance"
  ];

  // Fetch real URL in background and cache it for NEXT load; the Hero
  // component owns actually loading the video.
  useEffect(() => {
    fetch("/api/site-settings")
      .then(r => r.json())
      .then((s: Record<string, string>) => {
        setCachedVideoUrl(s?.hero_video_url ?? DEFAULT_HERO_VIDEO);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    sessionStorage.setItem('hasLoadedBefore', 'true');

    const stepTimers = steps.map((_, index) =>
      setTimeout(() => setActiveStep(index + 1), (index + 1) * 300)
    );

    const hideTimer = setTimeout(() => setIsVisible(false), 1800);

    return () => {
      stepTimers.forEach(clearTimeout);
      clearTimeout(hideTimer);
    };
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-opacity duration-700"
      style={{ opacity: isVisible ? 1 : 0 }}
      data-testid="loading-screen"
    >
      <BrandLogo size={96} stacked className="mb-16" />

      <div className="flex flex-col items-center gap-4">
        {steps.map((step, index) => (
          <div
            key={step}
            className="text-xl md:text-2xl font-semibold text-foreground transition-opacity duration-500"
            style={{ opacity: activeStep > index ? 1 : 0 }}
            data-testid={`text-loading-step-${index}`}
          >
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}
