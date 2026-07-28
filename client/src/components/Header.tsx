import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut, Shield, Phone, Clock } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, clearAuthToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import logoImage from "@assets/mtv-logo.svg";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        if (currentScrollY < 80) {
          setHeaderVisible(true);
        } else if (window.innerWidth < 1024 && currentScrollY > lastScrollY.current + 4) {
          setHeaderVisible(false);
        } else if (currentScrollY < lastScrollY.current - 4) {
          setHeaderVisible(true);
        }
        lastScrollY.current = currentScrollY;
        ticking.current = false;
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const navigation = [
    { name: "Home", href: "/" },
    { name: "Stock", href: "/stock" },
    { name: "Conversions", href: "/van-conversions" },
    { name: "Finance", href: "/finance" },
    { name: "Gallery", href: "/gallery" },
    { name: "Opportunity", href: "/business-opportunity" },
    { name: "Training", href: "/training" },
    { name: "About", href: "/about" },
    { name: "Contact", href: "/contact" },
  ];

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      clearAuthToken();
      window.location.href = "/login";
    },
    onError: () => {
      clearAuthToken();
      window.location.href = "/login";
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <>
    <header
      className="sticky top-0 z-50 bg-background/70 backdrop-blur-md border-b border-white/10 transition-transform duration-300 will-change-transform"
      style={{ transform: (headerVisible || isMenuOpen) ? "translateY(0)" : "translateY(-100%)" }}
    >
      {/* Top Utility Bar */}
      <div className="border-b border-white/10">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-10 text-xs">
            <div className="flex items-center gap-6 text-muted-foreground">
              <a href="tel:08000000000" className="flex items-center gap-2 hover:text-foreground transition-colors" data-testid="link-phone-header">
                <Phone className="w-3 h-3" />
                <span>0800 000 0000</span>
              </a>
              <div className="hidden md:flex items-center gap-2">
                <Clock className="w-3 h-3" />
                <span>Mon-Fri 9am-5:30pm</span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-muted-foreground">
              <span className="hidden sm:inline">FCA Authorised Finance</span>
              {!isLoading && isAuthenticated && user?.adminRole && user.adminRole !== "none" && (
                <Link href="/admin" className="text-accent hover:text-accent/80 font-medium flex items-center gap-1" data-testid="link-admin-header">
                  <Shield className="w-3 h-3" />
                  {user.adminRole === "full" ? "Admin" : "Basic Admin"}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-3 md:py-4 gap-3 md:gap-4">
          <Link href="/" className="flex items-center flex-shrink-0" data-testid="link-home">
            <img
              src={logoImage}
              alt="Mobile Tyre Vans"
              className="h-20 sm:h-24 md:h-16 lg:h-24 xl:h-32 w-auto"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-4 xl:space-x-6">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-sm font-medium text-foreground hover:text-accent transition-colors tracking-wide uppercase"
                data-testid={`link-${item.name.toLowerCase()}`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-shrink-0">
            <Button
              variant="default"
              size="lg"
              className="hidden lg:flex bg-accent hover:bg-accent/90 text-accent-foreground font-semibold whitespace-nowrap text-sm xl:text-base px-4 xl:px-6"
              data-testid="button-configure"
              asChild
            >
              <Link href="/configurator/van">Configure Your Van</Link>
            </Button>

            {!isLoading && isAuthenticated && user?.adminRole && user.adminRole !== "none" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
                data-testid="button-logout"
                className="hidden lg:flex"
              >
                <LogOut className="w-4 h-4 mr-1" />
                {logoutMutation.isPending ? "Logging out..." : "Logout"}
              </Button>
            )}

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden flex-shrink-0"
              onClick={() => setIsMenuOpen(true)}
              data-testid="button-menu-toggle"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

    </header>

    {/* Mobile Slide-in Drawer — rendered outside <header> so backdrop-blur doesn't trap the fixed stacking context */}
    {/* Backdrop */}
    <div
      className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
      style={{
        opacity: isMenuOpen ? 1 : 0,
        pointerEvents: isMenuOpen ? "auto" : "none",
      }}
      onClick={closeMenu}
      aria-hidden="true"
    />

    {/* Drawer Panel */}
    <div
      className="lg:hidden fixed top-0 right-0 z-50 h-full w-80 max-w-[90vw] bg-background border-l border-border shadow-2xl flex flex-col transition-transform duration-300"
      style={{ transform: isMenuOpen ? "translateX(0)" : "translateX(100%)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <Link href="/" onClick={closeMenu} data-testid="mobile-nav-logo">
          <img
            src={logoImage}
            alt="Mobile Tyre Vans"
            className="h-14 w-auto"
          />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={closeMenu}
          data-testid="button-mobile-close"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 overflow-y-auto px-5 py-6 space-y-1">
        {navigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="block px-3 py-3 rounded-md text-foreground hover:text-accent font-medium transition-colors text-base"
            onClick={closeMenu}
            data-testid={`mobile-link-${item.name.toLowerCase()}`}
          >
            {item.name}
          </Link>
        ))}

        {!isLoading && isAuthenticated && user?.adminRole && user.adminRole !== "none" && (
          <div className="pt-4 mt-4 border-t border-border space-y-1">
            <Link
              href="/admin"
              className="flex items-center gap-2 px-3 py-3 rounded-md text-foreground hover:text-accent font-medium transition-colors text-base"
              onClick={closeMenu}
              data-testid="mobile-link-admin"
            >
              <Shield className="w-4 h-4" />
              {user.adminRole === "full" ? "Admin Panel" : "Basic Admin Panel"}
            </Link>
            <button
              className="flex items-center gap-2 px-3 py-3 rounded-md text-foreground hover:text-accent font-medium transition-colors text-base w-full text-left"
              onClick={() => { handleLogout(); closeMenu(); }}
              disabled={logoutMutation.isPending}
              data-testid="mobile-button-logout"
            >
              <LogOut className="w-4 h-4" />
              {logoutMutation.isPending ? "Logging out..." : "Logout"}
            </button>
          </div>
        )}
      </nav>

      {/* CTA at bottom */}
      <div className="px-5 py-5 border-t border-border">
        <Button
          size="lg"
          className="bg-accent text-accent-foreground font-semibold w-full"
          data-testid="mobile-button-configure"
          asChild
          onClick={closeMenu}
        >
          <Link href="/configurator/van">Configure Your Van</Link>
        </Button>
      </div>
    </div>
    </>
  );
}
