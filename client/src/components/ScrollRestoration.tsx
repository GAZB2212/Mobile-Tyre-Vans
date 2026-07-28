import { useEffect } from "react";
import { useLocation } from "wouter";

export default function ScrollRestoration() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location]);

  return null;
}
