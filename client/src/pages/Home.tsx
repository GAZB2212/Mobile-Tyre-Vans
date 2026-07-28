import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, MapPin, Truck, ShieldCheck, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import UKManufacturing from "@/components/UKManufacturing";
import ProcessSteps from "@/components/ProcessSteps";
import EarningsPotential from "@/components/EarningsPotential";
import TrainingSection from "@/components/TrainingSection";
import TrustStrip from "@/components/TrustStrip";
import FeaturedStock from "@/components/FeaturedStock";
import GalleryPreview from "@/components/GalleryPreview";
import VanDesigns from "@/components/VanDesigns";
import Testimonials from "@/components/Testimonials";
import YouTubeSection from "@/components/YouTubeSection";
import CTASection from "@/components/CTASection";
import FAQ from "@/components/FAQ";
import HomeEnquiryForm from "@/components/HomeEnquiryForm";
import Footer from "@/components/Footer";
import SEO, { buildOrganizationStructuredData, homeFaqStructuredData } from "@/components/SEO";

const KEY_CITIES = [
  "Liverpool", "Manchester", "Birmingham", "London", "Leeds",
  "Glasgow", "Sheffield", "Bristol", "Newcastle", "Cardiff",
  "Nottingham", "Leicester", "Edinburgh", "Coventry", "Bradford",
];

function DeliveryAreasSection() {
  return (
    <section className="py-14 bg-muted/30 border-y border-border">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-delivery-heading">
            Nationwide Delivery — Anywhere in the UK
          </h2>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base max-w-2xl mx-auto">
            We deliver every completed conversion using professional, fully insured drivers — anywhere in the UK. Delivery is not included in the build price; the cost is calculated based on your location once we have your postcode.
          </p>
          <div className="flex flex-wrap justify-center gap-6 mt-5">
            <div className="inline-flex items-center gap-2 text-sm text-foreground">
              <Truck className="w-4 h-4 text-accent shrink-0" />
              Professional insured drivers
            </div>
            <div className="inline-flex items-center gap-2 text-sm text-foreground">
              <Calculator className="w-4 h-4 text-accent shrink-0" />
              Quoted by postcode
            </div>
            <div className="inline-flex items-center gap-2 text-sm text-foreground">
              <ShieldCheck className="w-4 h-4 text-accent shrink-0" />
              Fully insured door-to-door
            </div>
          </div>
          <div className="mt-5">
            <Link href="/contact">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline" data-testid="link-get-delivery-quote">
                Get a delivery quote <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-medium text-center">Popular areas we deliver to — and everywhere in between</p>
        <div className="flex flex-wrap justify-center gap-2">
          {KEY_CITIES.map((city) => (
            <Link
              key={city}
              href={`/mobile-tyre-vans/${city.toLowerCase()}`}
              data-testid={`link-city-${city.toLowerCase()}`}
            >
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-background border border-border text-sm text-foreground hover-elevate transition-colors">
                <MapPin className="w-3 h-3 text-accent shrink-0" />
                {city}
              </span>
            </Link>
          ))}
          <span className="inline-flex items-center px-3 py-1.5 rounded-md bg-accent/10 border border-accent/20 text-sm text-accent font-medium">
            + everywhere else
          </span>
        </div>
      </div>
    </section>
  );
}

function PreFooterCTA() {
  return (
    <section className="py-16 bg-accent" data-testid="section-prefooter-cta">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-accent-foreground mb-3" data-testid="text-prefooter-headline">
          Ready to get started?
        </h2>
        <p className="text-accent-foreground/80 text-base sm:text-lg mb-8 max-w-xl mx-auto">
          Build your fully-equipped mobile tyre van today and start earning from day one.
        </p>
        <Button
          size="lg"
          className="bg-accent-foreground text-accent font-bold hover:bg-accent-foreground/90"
          asChild
          data-testid="button-prefooter-configure"
        >
          <Link href="/configurator/van">Configure Your Van</Link>
        </Button>
      </div>
    </section>
  );
}

export default function Home() {
  const { data: ratingSummary } = useQuery<{ count: number; averageRating: number }>({
    queryKey: ["/api/testimonials/rating-summary"],
  });

  const orgSchema = buildOrganizationStructuredData(ratingSummary);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Mobile Tyre Van Conversions UK | Mobile Tyre Vans"
        description="UK specialists in custom mobile tyre van conversions. Fully equipped builds, nationwide delivery, finance available. Based in the UK. Call 0800 000 0000."
        canonical="/"
        keywords="mobile tyre van, tyre van conversion, mobile tyre fitting van, mobile tyre van for sale, mobile tyre business, van conversion UK"
        structuredData={[orgSchema, homeFaqStructuredData]}
      />
      <Header />
      <div>
        <Hero />
        <TrustStrip />
        <UKManufacturing />
        <ProcessSteps />
        <EarningsPotential />
        <TrainingSection />
        <FeaturedStock />
        <GalleryPreview />
        <VanDesigns />
        <DeliveryAreasSection />
        <Testimonials />
        <YouTubeSection />
        <FAQ />
        <HomeEnquiryForm />
        <CTASection />
        <PreFooterCTA />
      </div>
      <Footer />
    </div>
  );
}
