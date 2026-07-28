import { Link } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle2, Truck } from "lucide-react";
import { vanModels } from "./data/vanModels";

const benefits = [
  "All conversions fully built in-house at our UK workshop",
  "Professional tyre fitting equipment installed and tested before handover",
  "Euro 6 compliant base vehicles — exempt from UK Clean Air Zones",
  "Finance available on van and conversion as a single package",
  "Nationwide delivery to your door",
  "After-sales support and warranty on all installed equipment",
];

export default function VanConversionsHub() {
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://www.mobiletyrevans.co.uk/" },
      { "@type": "ListItem", position: 2, name: "Van Conversions", item: "https://www.mobiletyrevans.co.uk/van-conversions" },
    ],
  };

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
              <span className="text-white/80">Van Conversions</span>
            </nav>
            <Badge className="bg-[#8bc440] text-[#191919] mb-4 text-xs font-semibold">L3H3 &amp; L3H4 Specialist Builds</Badge>
            <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">
              Mobile Tyre Van Conversions
            </h1>
            <p className="text-lg md:text-xl text-white/70 max-w-2xl mb-8">
              We convert all major long-wheelbase, high-roof panel vans into professional mobile tyre fitting vehicles. Choose your preferred base van and configure your ideal build.
            </p>
            <Button asChild size="lg" className="bg-[#8bc440] text-[#191919] hover:bg-[#8bc440]/90 font-semibold">
              <Link href="/configurator/van">
                Start Your Build <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </div>
        </section>

        {/* ── Why L3H3 ── */}
        <section className="py-14 border-b border-border">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <h2 className="text-2xl font-bold mb-3">Why L3H3 or L3H4?</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Mobile tyre fitting requires space — not just for equipment, but for the operator to work safely and efficiently at the roadside or at a customer's premises. Long wheelbase (L3) and high or extra-high roof (H3/H4) configurations provide the minimum interior volume and standing height our professional tyre conversion kits require.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  All eight van models we build on come in L3H3 specification as standard. Where L3H4 (extra-high roof) is available, we can discuss whether the additional height is worthwhile for your specific equipment configuration.
                </p>
              </div>
              <ul className="space-y-3">
                {benefits.map((b) => (
                  <li key={b} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#8bc440] shrink-0 mt-0.5" />
                    <span className="text-sm">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Van Grid ── */}
        <section className="py-16">
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="text-2xl font-bold mb-2">Supported Van Models</h2>
            <p className="text-muted-foreground mb-8">
              Click any model to see full specifications, conversion details, and FAQs.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {vanModels.map((van) => (
                <Link key={van.slug} href={`/van-conversions/${van.slug}`}>
                  <Card
                    className="h-full cursor-pointer hover-elevate"
                    data-testid={`card-van-${van.slug}`}
                  >
                    <CardContent className="pt-6 pb-5 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <Truck className="w-8 h-8 text-[#8bc440] shrink-0 mt-0.5" />
                        <Badge variant="outline" className="text-xs shrink-0">{van.roofSpec}</Badge>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">{van.make}</div>
                        <h3 className="font-bold text-base leading-tight">{van.model}</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Volume</span>
                        <span className="font-medium text-foreground">{van.loadVolumeCubicM} m³</span>
                        <span>Payload</span>
                        <span className="font-medium text-foreground">{van.payloadKg.toLocaleString()} kg</span>
                      </div>
                      <span className="text-xs text-[#8bc440] font-medium flex items-center gap-1 mt-auto">
                        View details <ArrowRight className="w-3 h-3" />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="bg-[#8bc440] py-12">
          <div className="container mx-auto px-4 max-w-5xl text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-[#191919] mb-3">
              Not sure which van is right for you?
            </h2>
            <p className="text-[#191919]/70 mb-6 max-w-xl mx-auto">
              Our team will help you choose the right base vehicle and equipment pack for your budget and business. Call us on 0800 000 0000 or use the configurator to get a quote online.
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

        {/* ── Location hub link ── */}
        <section className="py-10 border-t border-border">
          <div className="container mx-auto px-4 max-w-5xl text-center">
            <p className="text-muted-foreground text-sm">
              Looking for mobile tyre vans delivered to your area?{" "}
              <Link href="/mobile-tyre-vans" className="text-foreground underline underline-offset-2 hover:text-[#8bc440]">
                View UK delivery areas →
              </Link>
            </p>
          </div>
        </section>
      </div>

      <Footer />
    </>
  );
}
