import { type ReactNode } from "react";
import { useLocation } from "wouter";

export function PublicMain({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isExcluded =
    location.startsWith("/admin") || location.startsWith("/finance-portal");
  if (isExcluded) return <>{children}</>;
  return <main>{children}</main>;
}
