import { Link } from "wouter";
import { Phone, Mail, MapPin, Shield } from "lucide-react";
import { SiFacebook, SiInstagram, SiTiktok, SiYoutube } from "react-icons/si";
import logoImage from "@assets/mtv-logo.svg";
import gajoLogo from "@assets/LOGO_1762356342150.webp";

export default function Footer() {
  const quickLinks = [
    { name: "Home", href: "/" },
    { name: "Stock", href: "/stock" },
    { name: "Configurator", href: "/configurator/van" },
    { name: "Finance", href: "/finance" },
    { name: "Gallery", href: "/gallery" },
    { name: "Blog", href: "/blog" },
    { name: "About", href: "/about" },
    { name: "Contact", href: "/contact" },
    { name: "Van Conversions", href: "/van-conversions" },
    { name: "UK Delivery Areas", href: "/mobile-tyre-vans" },
  ];

  const legalLinks = [
    { name: "Privacy Policy", href: "/privacy-policy" },
    { name: "Terms & Conditions", href: "/terms" },
    { name: "Cookie Policy", href: "/cookie-policy" }
  ];

  const services = [
    "Van Conversions",
    "Equipment Supply",
    "Finance Options", 
    "Nationwide Delivery",
    "After-Sales Support",
    "Training & Support"
  ];

  return (
    <footer className="bg-background text-foreground border-t border-border">
      <div className="container mx-auto px-4 pt-12 pb-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="lg:col-span-1">
            <div className="mb-4">
              <img 
                src={logoImage} 
                alt="Mobile Tyre Vans" 
                className="h-16 w-auto"
              />
            </div>
            <p className="text-primary-foreground/80 mb-4">
              UK's leading mobile tyre van conversion specialists. Custom-built solutions for your mobile tyre business.
            </p>
            <div className="flex gap-4">
              <a href="https://www.facebook.com/profile.php?id=61582819317320" target="_blank" rel="noopener noreferrer" aria-label="Facebook" data-testid="link-facebook" className="text-muted-foreground hover:text-accent transition-colors">
                <SiFacebook className="w-5 h-5" />
              </a>
              <a href="https://www.instagram.com/mobiletyrevans" target="_blank" rel="noopener noreferrer" aria-label="Instagram" data-testid="link-instagram" className="text-muted-foreground hover:text-accent transition-colors">
                <SiInstagram className="w-5 h-5" />
              </a>
              <a href="https://www.tiktok.com/@mobiletyrevans" target="_blank" rel="noopener noreferrer" aria-label="TikTok" data-testid="link-tiktok" className="text-muted-foreground hover:text-accent transition-colors">
                <SiTiktok className="w-5 h-5" />
              </a>
              <a href="https://www.youtube.com/@mobiletyrevans" target="_blank" rel="noopener noreferrer" aria-label="YouTube" data-testid="link-youtube" className="text-muted-foreground hover:text-accent transition-colors">
                <SiYoutube className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.name}>
                  <Link 
                    href={link.href}
                    className="text-primary-foreground/80 hover:text-accent transition-colors"
                    data-testid={`footer-link-${link.name.toLowerCase()}`}
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="font-semibold mb-4">Services</h3>
            <ul className="space-y-2">
              {services.map((service) => (
                <li key={service} className="text-primary-foreground/80">
                  {service}
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-semibold mb-4">Contact</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-2" data-testid="contact-phone">
                <Phone className="w-4 h-4" />
                <span className="text-primary-foreground/80">0800 000 0000</span>
              </div>
              <div className="flex items-center space-x-2" data-testid="contact-email">
                <Mail className="w-4 h-4" />
                <span className="text-primary-foreground/80">sales@mobiletyrevans.co.uk</span>
              </div>
              <div className="flex items-start space-x-2" data-testid="contact-address">
                <MapPin className="w-4 h-4 mt-0.5" />
                <span className="text-primary-foreground/80">
                  Unit 1, Example Business Park<br />
                  the North West<br />
                  AA1 1AA
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-primary-foreground/20 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-primary-foreground/80 text-sm">
              Website design &amp; development © 2025 GAJO Creative Ltd (Co. No. 16669280). All rights reserved.
            </div>
            <div className="flex flex-wrap justify-center items-center gap-4">
              {legalLinks.map((link) => (
                <Link 
                  key={link.name}
                  href={link.href}
                  className="text-primary-foreground/80 hover:text-accent transition-colors text-sm"
                  data-testid={`footer-legal-${link.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {link.name}
                </Link>
              ))}
              <button
                onClick={() => {
                  localStorage.removeItem('cookie_consent');
                  window.location.reload();
                }}
                className="text-primary-foreground/80 hover:text-accent transition-colors text-sm"
                data-testid="footer-cookie-settings"
              >
                Cookie Settings
              </button>
              <span className="text-primary-foreground/20">|</span>
              <Link
                href="/login"
                className="text-primary-foreground/80 hover:text-accent transition-colors text-sm flex items-center gap-1"
                data-testid="footer-admin-login"
              >
                <Shield className="w-3 h-3" />
                Admin Login
              </Link>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-primary-foreground/10 flex justify-center items-center">
            <a 
              href="https://www.gajocreative.co.uk" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              data-testid="link-gajo-creative"
            >
              <span className="text-primary-foreground/60 text-sm">Website owned and managed by</span>
              <img 
                src={gajoLogo} 
                alt="Gajo Creative" 
                className="h-8 w-auto"
              />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}