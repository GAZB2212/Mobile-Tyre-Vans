import { Link } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, MapPin, Truck } from "lucide-react";
import { locationsByRegion } from "./data/locations";

const SITE_URL = "https://www.mobiletyrevans.co.uk";

const regionOrder = [
  "Northwest England",
  "Yorkshire & Humber",
  "West Midlands",
  "East Midlands",
  "East of England",
  "London & Southeast",
  "Southwest England",
  "Northeast England",
  "Scotland",
  "Wales",
];

export default function LocationsHub() {
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Mobile Tyre Vans", item: `${SITE_URL}/mobile-tyre-vans` },
    ],
  };

  const orderedRegions = regionOrder
    .filter((r) => locationsByRegion[r])
    .map((r) => ({ region: r, locs: locationsByRegion[r] }));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <Header />

      <div>
        {/* ── Hero ── */}
        <section className="bg-[#191919] text-white py-16 md:py-24">
          <div className="container mx-auto px-4 max-w-5xl">
            <nav className="mb-6 text-sm text-white/50 flex items-center gap-1.5">
              <Link href="/" className="hover:text-white transition-colors">Home</Link>
              <span>/</span>
              <span className="text-white/80">Mobile Tyre Vans</span>
            </nav>
            <Badge className="bg-[#8bc440] text-[#191919] mb-4 text-xs font-semibold flex items-center gap-1 w-fit">
              <Truck className="w-3 h-3" />
              UK-Wide Delivery
            </Badge>
            <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">
              Mobile Tyre Vans Delivered Across the UK
            </h1>
            <p className="text-lg md:text-xl text-white/70 max-w-2xl mb-8">
              We deliver completed mobile tyre van conversions to customers throughout England, Scotland, and Wales. Browse the areas we cover below, or use our configurator to get a quote.
            </p>
            <Button asChild size="lg" className="bg-[#8bc440] text-[#191919] hover:bg-[#8bc440]/90 font-semibold">
              <Link href="/configurator/van">
                Start Your Build <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* ── Delivery Info Banner ── */}
        <section className="bg-muted/30 border-b border-border py-8">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="grid sm:grid-cols-3 gap-6 text-sm">
              {[
                { icon: MapPin, title: "76 UK locations covered", desc: "From Liverpool to Inverness, we deliver nationwide." },
                { icon: Truck, title: "Delivery included", desc: "All conversions delivered to your door after sign-off." },
                { icon: ArrowRight, title: "Or collect from Wirral", desc: "Visit our workshop for a personal handover." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3">
                  <Icon className="w-5 h-5 text-[#8bc440] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">{title}</div>
                    <div className="text-muted-foreground">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Regions ── */}
        <section className="py-16">
          <div className="container mx-auto px-4 max-w-5xl space-y-12">
            {orderedRegions.map(({ region, locs }) => (
              <div key={region}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#8bc440]" />
                  {region}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {locs.map((loc) => (
                    <Link key={loc.slug} href={`/mobile-tyre-vans/${loc.slug}`}>
                      <Badge
                        variant="outline"
                        className="cursor-pointer text-sm py-1.5 px-3 hover-elevate"
                        data-testid={`link-location-${loc.slug}`}
                      >
                        {loc.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="bg-[#8bc440] py-12">
          <div className="container mx-auto px-4 max-w-5xl text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-[#191919] mb-3">
              Ready to start your mobile tyre business?
            </h2>
            <p className="text-[#191919]/70 mb-6 max-w-xl mx-auto">
              Use our online configurator to choose your van, equipment pack, and upgrades — then we deliver it to your door, wherever you are in the UK.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="bg-[#191919] text-white hover:bg-[#191919]/90 font-semibold">
                <Link href="/configurator/van">
                  Use the Configurator <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-[#191919]/40 text-[#191919] hover:bg-[#191919]/10">
                <Link href="/contact">Contact Us</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ── Van conversion hub link ── */}
        <section className="py-10 border-t border-border">
          <div className="container mx-auto px-4 max-w-5xl text-center">
            <p className="text-muted-foreground text-sm">
              Want to know which van model is best for your conversion?{" "}
              <Link href="/van-conversions" className="text-foreground underline underline-offset-2 hover:text-[#8bc440]">
                Browse van models →
              </Link>
            </p>
          </div>
        </section>
      </div>

      <Footer />
    </>
  );
}
