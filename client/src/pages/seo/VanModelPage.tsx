import { useParams, Link } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  ArrowRight,
  Truck,
  Weight,
  Ruler,
  Leaf,
  ChevronDown,
} from "lucide-react";
import { vanModels, getVanBySlug } from "./data/vanModels";
import NotFound from "@/pages/not-found";
import { useState } from "react";

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left gap-4"
        data-testid={`faq-toggle-${q.slice(0, 20).replace(/\s/g, "-").toLowerCase()}`}
      >
        <span className="font-medium text-sm md:text-base">{q}</span>
        <ChevronDown
          className={`w-5 h-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <p className="pb-4 text-sm text-muted-foreground leading-relaxed">{a}</p>
      )}
    </div>
  );
}

export default function VanModelPage() {
  const { slug } = useParams<{ slug: string }>();
  const van = getVanBySlug(slug);

  if (!van) return <NotFound />;

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: van.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.mobiletyrevans.co.uk/" },
      { "@type": "ListItem", position: 2, name: "Van Conversions", item: "https://www.mobiletyrevans.co.uk/van-conversions" },
      { "@type": "ListItem", position: 3, name: van.displayName, item: `https://www.mobiletyrevans.co.uk/van-conversions/${van.slug}` },
    ],
  };

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": `${van.displayName} Mobile Tyre Van Conversion`,
    "description": `Professional mobile tyre van conversion service for the ${van.displayName}. ${van.tagline} Full L3H3 build with tyre equipment, racking, compressor, and nationwide delivery included.`,
    "url": `https://www.mobiletyrevans.co.uk/van-conversions/${van.slug}`,
    "provider": {
      "@type": "AutomotiveBusiness",
      "name": "Mobile Tyre Vans",
      "url": "https://www.mobiletyrevans.co.uk",
      "telephone": "+448000000000",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Unit 1, Example Business Park",
        "addressLocality": "Your Town",
        "addressRegion": "Your Region",
        "postalCode": "AA1 1AA",
        "addressCountry": "GB",
      },
    },
    "areaServed": { "@type": "Country", "name": "United Kingdom" },
    "serviceType": "Van Conversion",
    "termsOfService": "https://www.mobiletyrevans.co.uk/contact",
  };

  return (
    <>
      <SEO
        title={`${van.displayName} Mobile Tyre Van Conversion | Specs & Pricing`}
        description={`${van.tagline} Professional ${van.displayName} mobile tyre van conversion — ${van.loadVolumeCubicM}m³ load volume, ${van.payloadKg.toLocaleString()}kg payload. Built and delivered by Mobile Tyre Vans. Call 0800 000 0000.`}
        canonical={`/van-conversions/${van.slug}`}
        keywords={`${van.displayName} mobile tyre van, ${van.make} ${van.model} tyre van conversion, ${van.displayName} van conversion UK, mobile tyre van ${van.make}`}
        structuredData={[faqSchema, breadcrumbSchema, serviceSchema]}
      />

      <Header />

      <div>
        {/* ── Hero ── */}
        <section className="bg-primary text-white py-16 md:py-24">
          <div className="container mx-auto px-4 max-w-5xl">
            <nav className="mb-6 text-sm text-white/50 flex items-center gap-1.5 flex-wrap">
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <Link href="/van-conversions" className="hover:text-white transition-colors">Van Conversions</Link>
              <span>/</span>
              <span className="text-white/80">{van.displayName}</span>
            </nav>
            <div className="flex flex-wrap items-start gap-3 mb-4">
              <Badge className="bg-accent text-accent-foreground text-xs font-semibold">{van.roofSpec}</Badge>
              {van.euroSix && (
                <Badge variant="outline" className="border-white/30 text-white/80 text-xs">Euro 6 Compliant</Badge>
              )}
            </div>
            <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">
              {van.displayName} Mobile Tyre Van Conversion
            </h1>
            <p className="text-lg md:text-xl text-white/70 max-w-2xl mb-8">
              {van.tagline}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                <Link href="/configurator/van">
                  Build Your {van.make} Conversion
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10">
                <Link href="/contact">Talk to Our Team</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ── Specs ── */}
        <section className="bg-muted/30 border-b border-border py-10">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Truck, label: "Load Volume", value: `${van.loadVolumeCubicM} m³` },
                { icon: Weight, label: "Max Payload", value: `${van.payloadKg.toLocaleString()} kg` },
                { icon: Ruler, label: "Cargo Length", value: `${(van.cargoLengthMm / 1000).toFixed(2)} m` },
                { icon: Leaf, label: "Euro Standard", value: van.euroSix ? "Euro 6" : "Pre-Euro 6" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-background rounded-md p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
                  </div>
                  <span className="text-xl font-bold">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Overview ── */}
        <section className="py-16 container mx-auto px-4 max-w-5xl">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-2xl font-bold mb-4">
                Why the {van.displayName} Works for Mobile Tyre Fitting
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">{van.overview}</p>
              <ul className="space-y-3">
                {van.whyItWorks.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                    <span className="text-sm">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-3">Platform</h3>
                  <p className="text-sm text-muted-foreground">{van.platform}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-3">Interior Dimensions</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cargo Length</span>
                      <span className="font-medium">{van.cargoLengthMm.toLocaleString()} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Floor Width</span>
                      <span className="font-medium">{van.floorWidthMm.toLocaleString()} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Internal Height</span>
                      <span className="font-medium">{van.internalHeightMm.toLocaleString()} mm</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-3">Compatible Equipment Packs</h3>
                  <ul className="space-y-1.5">
                    {van.popularKits.map((kit) => (
                      <li key={kit} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="text-accent font-bold mt-0.5">·</span>
                        {kit}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* ── CTA Banner ── */}
        <section className="bg-accent py-12">
          <div className="container mx-auto px-4 max-w-5xl text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-accent-foreground mb-3">
              Ready to build your {van.make} mobile tyre van?
            </h2>
            <p className="text-accent-foreground/70 mb-6 max-w-xl mx-auto">
              Use our online configurator to choose your equipment pack, upgrades, and get an instant quote — or call us on 0800 000 0000.
            </p>
            <Button asChild size="lg" className="bg-primary text-white hover:bg-primary/90 font-semibold">
              <Link href="/configurator/van">
                Start Configurator <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* ── FAQs ── */}
        <section className="py-16 container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-bold mb-8">
            Frequently Asked Questions — {van.displayName}
          </h2>
          <div className="divide-y divide-border border-t border-border">
            {van.faqs.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </section>

        {/* ── Other vans ── */}
        <section className="bg-muted/30 py-16 border-t border-border">
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="text-xl font-bold mb-6">Also available for conversion</h2>
            <div className="flex flex-wrap gap-3">
              {vanModels
                .filter((v) => v.slug !== van.slug)
                .map((v) => (
                  <Link key={v.slug} href={`/van-conversions/${v.slug}`}>
                    <Badge
                      variant="outline"
                      className="cursor-pointer text-sm py-1.5 px-3 hover-elevate"
                      data-testid={`link-van-${v.slug}`}
                    >
                      {v.displayName}
                    </Badge>
                  </Link>
                ))}
            </div>
            <div className="mt-6">
              <Link href="/van-conversions" className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2">
                View all van conversions →
              </Link>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </>
  );
}
