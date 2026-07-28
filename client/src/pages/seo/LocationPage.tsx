import { useParams, Link } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, MapPin, ChevronDown, CheckCircle2, Truck } from "lucide-react";
import { getLocationBySlug, locations } from "./data/locations";
import NotFound from "@/pages/not-found";
import { useState } from "react";

const SITE_URL = "https://www.mobiletyrevans.co.uk";

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

export default function LocationPage() {
  const { slug } = useParams<{ slug: string }>();
  const location = getLocationBySlug(slug);

  if (!location) return <NotFound />;

  const areaServedSchema = {
    "@context": "https://schema.org",
    "@type": "AreaServed",
    "@id": `${SITE_URL}/mobile-tyre-vans/${location.slug}#area`,
    name: location.name,
    description: `Mobile tyre van deliveries and conversions served in ${location.name}, ${location.county}, United Kingdom.`,
    containedInPlace: {
      "@type": "Country",
      name: "United Kingdom",
    },
  };

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Mobile Tyre Vans",
    url: SITE_URL,
    telephone: "+448000000000",
    image: `${SITE_URL}/favicon.png`,
    address: {
      "@type": "PostalAddress",
      streetAddress: "Unit 1, Example Business Park",
      addressLocality: "the North West",
      postalCode: "AA1 1AA",
      addressCountry: "GB",
    },
    areaServed: { "@id": `${SITE_URL}/mobile-tyre-vans/${location.slug}#area` },
    description: `Mobile tyre van conversions delivered to ${location.name}. Professional L3H3 tyre van builds with UK-wide delivery from Wirral.`,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Mobile Tyre Vans", item: `${SITE_URL}/mobile-tyre-vans` },
      { "@type": "ListItem", position: 3, name: location.name, item: `${SITE_URL}/mobile-tyre-vans/${location.slug}` },
    ],
  };

  const regionLocations = locations
    .filter((l) => l.region === location.region && l.slug !== location.slug)
    .slice(0, 6);

  return (
    <>
      <SEO
        title={`Mobile Tyre Van Conversions ${location.name} | UK Delivery & Build`}
        description={`Professional mobile tyre van conversions delivered to ${location.name}, ${location.county}. Custom L3H3 builds with full tyre equipment installed. Nationwide delivery from Wirral. Call 0800 000 0000.`}
        canonical={`/mobile-tyre-vans/${location.slug}`}
        keywords={`mobile tyre van ${location.name}, tyre van conversion ${location.county}, mobile tyre van delivery ${location.name}, mobile tyre business ${location.name}`}
        structuredData={[areaServedSchema, localBusinessSchema, breadcrumbSchema]}
      />

      <Header />

      <div>
        {/* ── Hero ── */}
        <section className="bg-[#191919] text-white py-16 md:py-24">
          <div className="container mx-auto px-4 max-w-5xl">
            <nav className="mb-6 text-sm text-white/50 flex items-center gap-1.5 flex-wrap">
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <Link href="/mobile-tyre-vans" className="hover:text-white transition-colors">Mobile Tyre Vans</Link>
              <span>/</span>
              <span className="text-white/80">{location.name}</span>
            </nav>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Badge className="bg-[#8bc440] text-[#191919] text-xs font-semibold flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {location.region}
              </Badge>
              <Badge variant="outline" className="border-white/30 text-white/80 text-xs">Nationwide Delivery</Badge>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">
              Mobile Tyre Van Conversions — {location.name}
            </h1>
            <p className="text-lg text-white/70 max-w-2xl mb-8">
              Professional L3H3 mobile tyre van builds delivered to {location.name}. Choose your van, select your equipment pack, and we deliver your completed conversion to your door.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-[#8bc440] text-[#191919] hover:bg-[#8bc440]/90 font-semibold">
                <Link href="/configurator/van">
                  Start Your Build <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10">
                <Link href="/contact">Speak to Our Team</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ── Content ── */}
        <section className="py-16">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="grid md:grid-cols-3 gap-10">
              <div className="md:col-span-2 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-4">
                    Mobile Tyre Van Delivery to {location.name}
                  </h2>
                  <p className="text-muted-foreground leading-relaxed">{location.intro}</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Delivery Information</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{location.deliveryNote}</p>
                </div>
                {location.nearbyAreas.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Nearby Areas We Also Serve</h3>
                    <div className="flex flex-wrap gap-2">
                      {location.nearbyAreas.map((area) => {
                        const found = locations.find(
                          (l) => l.name.toLowerCase() === area.toLowerCase()
                        );
                        return found ? (
                          <Link key={area} href={`/mobile-tyre-vans/${found.slug}`}>
                            <Badge
                              variant="outline"
                              className="cursor-pointer hover-elevate"
                              data-testid={`link-area-${area.toLowerCase().replace(/\s/g, "-")}`}
                            >
                              {area}
                            </Badge>
                          </Link>
                        ) : (
                          <Badge key={area} variant="outline">{area}</Badge>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Truck className="w-4 h-4 text-[#8bc440]" />
                      What's Included
                    </h3>
                    <ul className="space-y-2">
                      {[
                        "Base van sourced or customer-supplied",
                        "Professional tyre equipment installed",
                        "Racking and storage fitted",
                        "Compressor mounted and wired",
                        "Pre-delivery inspection",
                        "Delivery to your door",
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-[#8bc440] shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-2">Talk to Us</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Questions about delivery to {location.name} or the conversion process? Call us on{" "}
                      <a href="tel:08000000000" className="text-foreground font-medium">0800 000 0000</a>.
                    </p>
                    <Button asChild size="sm" variant="outline" className="w-full">
                      <Link href="/contact">Send an Enquiry</Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA Banner ── */}
        <section className="bg-[#8bc440] py-12">
          <div className="container mx-auto px-4 max-w-5xl text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-[#191919] mb-3">
              Ready to start your mobile tyre business in {location.name}?
            </h2>
            <p className="text-[#191919]/70 mb-6 max-w-xl mx-auto">
              Use our online configurator to build your perfect van, or call our team on 0800 000 0000 to discuss your requirements.
            </p>
            <Button asChild size="lg" className="bg-[#191919] text-white hover:bg-[#191919]/90 font-semibold">
              <Link href="/configurator/van">
                Build Your Van <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* ── FAQs ── */}
        <section className="py-16 container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-bold mb-8">
            FAQs — Mobile Tyre Vans in {location.name}
          </h2>
          <div className="divide-y divide-border border-t border-border">
            {location.faqs.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </section>

        {/* ── Region links ── */}
        {regionLocations.length > 0 && (
          <section className="bg-muted/30 py-12 border-t border-border">
            <div className="container mx-auto px-4 max-w-5xl">
              <h2 className="text-lg font-bold mb-4">
                Other {location.region} locations we deliver to
              </h2>
              <div className="flex flex-wrap gap-2">
                {regionLocations.map((l) => (
                  <Link key={l.slug} href={`/mobile-tyre-vans/${l.slug}`}>
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover-elevate"
                      data-testid={`link-region-${l.slug}`}
                    >
                      {l.name}
                    </Badge>
                  </Link>
                ))}
              </div>
              <div className="mt-4">
                <Link
                  href="/mobile-tyre-vans"
                  className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  View all UK delivery areas →
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>

      <Footer />
    </>
  );
}
