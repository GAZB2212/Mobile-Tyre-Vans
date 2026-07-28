import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { BRAND } from "@shared/brand";

const DEFAULT_HERO_VIDEO = "/media/hero_vid_optimised.mp4";
const CACHE_KEY = "heroVideoUrl";

function getCachedVideoUrl(): string {
  try {
    return sessionStorage.getItem(CACHE_KEY) ?? DEFAULT_HERO_VIDEO;
  } catch {
    return DEFAULT_HERO_VIDEO;
  }
}

function useCountUp(target: number, duration = 1500) {
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);

  return value;
}

const stats = [
  { value: 150, suffix: "+", label: "Vans Built" },
  { value: 25, suffix: "+", label: "Years Experience" },
  { value: 1, suffix: "", label: "Rated No.1", format: "ordinal" },
];

function StatCounter({ value, suffix, label, format }: typeof stats[0] & { format?: string }) {
  const count = useCountUp(value);
  const display = format === "ordinal" ? `#${count}` : `${count}${suffix}`;

  return (
    <div className="flex-1 text-center px-4 py-5" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-tight tabular-nums">
        {display}
      </div>
      <div className="text-xs sm:text-sm text-white/60 mt-1.5 font-medium tracking-widest uppercase">
        {label}
      </div>
    </div>
  );
}

export default function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoSrc, setVideoSrc] = useState<string>(getCachedVideoUrl);

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/site-settings"],
  });

  useEffect(() => {
    const url = settings?.hero_video_url;
    if (!url) return;
    try { sessionStorage.setItem(CACHE_KEY, url); } catch {}
    setVideoSrc(url);
  }, [settings?.hero_video_url]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.volume = 0;
    video.play().catch(() => {
      const retry = () => {
        video.play().catch(() => {});
        window.removeEventListener("pointerdown", retry);
        window.removeEventListener("scroll", retry);
      };
      window.addEventListener("pointerdown", retry, { once: true });
      window.addEventListener("scroll", retry, { once: true });
    });
  }, [videoSrc]);

  return (
    <section className="relative bg-[#1a1a1a] overflow-hidden flex flex-col" style={{ minHeight: "80vh" }}>
      <video
        key={videoSrc}
        ref={videoRef}
        src={videoSrc}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster="/og-image.jpg"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ WebkitBackfaceVisibility: "hidden" } as React.CSSProperties}
      />

      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-black/20 pointer-events-none" />

      {/* Hero text + CTAs */}
      <div className="flex-1 flex items-center relative z-10">
        <div className="container mx-auto px-4 py-14 sm:py-24">
          <div className="max-w-2xl">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold mb-6 sm:mb-8 leading-tight text-white" data-testid="text-hero-headline">
              {BRAND.vertical.heroTitle}
            </h1>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/configurator/van">
                <Button
                  size="lg"
                  variant="default"
                  className="w-full sm:w-auto border-accent font-semibold bg-accent/90 text-accent-foreground"
                  data-testid="button-configure-van"
                >
                  Configure Your Van
                </Button>
              </Link>
              <Link href="/business-opportunity" aria-label="Learn more about the mobile tyre van business opportunity">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto bg-background/10 backdrop-blur-sm hover:bg-background/20 text-white border-white/30 font-semibold"
                  data-testid="button-learn-more"
                >
                  The Opportunity
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Full-width stat strip at the bottom of the hero */}
      <div className="relative z-10 w-full bg-black/50 backdrop-blur-sm border-t border-white/10" data-testid="hero-stat-counters">
        <div className="flex divide-x divide-white/10">
          {stats.map((stat) => (
            <StatCounter key={stat.label} {...stat} />
          ))}
        </div>
      </div>
    </section>
  );
}
