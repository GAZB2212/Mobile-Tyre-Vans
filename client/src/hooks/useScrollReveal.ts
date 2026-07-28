import { useEffect, useRef } from "react";

export function useScrollReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reveal = () => el.classList.add("revealed");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal();
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0 }
    );

    observer.observe(el);

    // Safety fallback: reveal after 2s in case observer never fires
    const fallback = setTimeout(reveal, 2000);

    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, []);

  return ref;
}
