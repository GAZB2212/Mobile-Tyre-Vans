import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO, { createServiceStructuredData } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Car, Package, Sparkles, CreditCard, Check, Wrench, Palette, Users } from "lucide-react";
import { Link } from "wouter";

const steps = [
  {
    number: "01",
    icon: Car,
    title: "Choose Your Van",
    description: "Select from our comprehensive stock of quality base vehicles to suit all budgets. From compact city vans to large panel vans, we have options for every business need. Alternatively, supply your own vehicle for conversion.",
    features: [
      "Extensive stock for all budgets",
      "Or supply your own vehicle",
      "Quality checked vehicles",
      "Full vehicle history provided"
    ]
  },
  {
    number: "02",
    icon: Package,
    title: "Select Your Kit",
    description: "Choose from our professionally curated tyre equipment packages. Each kit includes everything you need to start your mobile tyre fitting business, from entry-level setups to premium professional packages.",
    features: [
      "Complete equipment packages",
      "Entry to premium options",
      "Industry-leading brands",
      "Professional grade quality"
    ]
  },
  {
    number: "03",
    icon: Sparkles,
    title: "Add Your Upgrades",
    description: "Customize your van with optional extras including professional branding, advanced equipment, security systems, and more. Our in-house graphic design team will create stunning livery to make your business stand out.",
    features: [
      "In-house graphic design team",
      "Professional van branding",
      "Security & safety upgrades",
      "Premium equipment options"
    ]
  },
  {
    number: "04",
    icon: CreditCard,
    title: "Choose Your Finance",
    description: "Flexible funding solutions to suit your business needs. As an FCA authorised provider, we offer competitive hire purchase and leasing options to help spread the cost of your investment.",
    features: [
      "FCA regulated finance",
      "Hire purchase available",
      "Flexible leasing options",
      "Competitive rates"
    ]
  }
];

const qualityPoints = [
  {
    icon: Wrench,
    title: "Fully Built In-House",
    description: "Every van is converted by our dedicated build team in our own facility, ensuring consistent quality and attention to detail."
  },
  {
    icon: Palette,
    title: "Expert Design Team",
    description: "Our in-house graphic designers create professional, eye-catching branding that makes your business stand out on the road."
  },
  {
    icon: Users,
    title: "Quality Workmanship",
    description: "British craftsmanship you can trust. We take pride in delivering mobile tyre vans built to the highest standards."
  }
];

const howToStructuredData = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Get Your Mobile Tyre Van Conversion",
  "description": "Build your custom mobile tyre van in 4 simple steps with Mobile Tyre Vans. Choose your van, select your kit, add upgrades, and arrange finance.",
  "totalTime": "PT30D",
  "step": steps.map((step, i) => ({
    "@type": "HowToStep",
    "position": i + 1,
    "name": step.title,
    "text": step.description,
    "url": `https://www.mobiletyrevans.co.uk/how-it-works#step-${step.number}`,
  }))
};

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="How It Works | Mobile Tyre Van Build Process Explained"
        description="See how we build your mobile tyre van in 4 simple steps: choose your van, select your equipment kit, add custom upgrades, arrange finance. UK-built, in-house team, nationwide delivery."
        canonical="/how-it-works"
        keywords="how mobile tyre van works, tyre van build process, custom van conversion steps, mobile tyre van build UK"
        structuredData={[
          howToStructuredData,
          createServiceStructuredData({
            name: "Mobile Tyre Van Build Process",
            description: "Our 4-step mobile tyre van build process: choose your van, select your equipment kit, add custom upgrades, and arrange finance. UK-built by our in-house team with nationwide delivery.",
            url: "/how-it-works",
          })
        ]}
      />
      <Header />
      
      <div>
        {/* Hero Section */}
        <section className="relative py-20 sm:py-32 overflow-hidden">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-6 text-foreground" data-testid="text-how-it-works-title">
                How We Build Your Perfect Mobile Tyre Van
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground mb-8 leading-relaxed">
                From selecting your ideal vehicle to hitting the road with a fully equipped mobile tyre fitting business, we guide you through every step of the journey.
              </p>
            </div>
          </div>
        </section>

        {/* Process Steps */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto space-y-20">
              {steps.map((step, index) => (
                <div 
                  key={index}
                  className={`flex flex-col ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-12 items-center`}
                  data-testid={`section-step-${index + 1}`}
                >
                  {/* Icon & Number */}
                  <div className="flex-shrink-0 relative">
                    <div className="w-32 h-32 bg-accent rounded-2xl flex items-center justify-center relative">
                      <step.icon className="w-16 h-16 text-accent-foreground" strokeWidth={1.5} />
                      <div className="absolute -top-4 -right-4 w-16 h-16 bg-foreground text-background rounded-full flex items-center justify-center text-2xl font-bold">
                        {step.number}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 text-center lg:text-left">
                    <h3 className="text-3xl font-bold mb-4 text-foreground" data-testid={`text-step-${index + 1}-title`}>
                      {step.title}
                    </h3>
                    <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                      {step.description}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {step.features.map((feature, i) => (
                        <div key={i} className="flex items-center gap-2 justify-center lg:justify-start">
                          <Check className="w-5 h-5 text-accent flex-shrink-0" />
                          <span className="text-sm text-foreground">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Quality Points */}
        <section className="py-20 bg-background">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 text-foreground" data-testid="text-quality-title">
                Why Choose Mobile Tyre Vans
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Quality, expertise, and attention to detail in every build
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {qualityPoints.map((point, index) => (
                <div 
                  key={index}
                  className="text-center space-y-4 p-6 rounded-2xl hover-elevate"
                  data-testid={`card-quality-${index}`}
                >
                  <div className="flex justify-center">
                    <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center">
                      <point.icon className="w-8 h-8 text-accent" strokeWidth={1.5} />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-foreground">
                    {point.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {point.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Large CTA Section */}
        <section className="py-24 bg-accent relative overflow-hidden">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-6 text-accent-foreground" data-testid="text-cta-title">
                Ready to Build Your Van?
              </h2>
              <p className="text-lg sm:text-xl text-accent-foreground/90 mb-10 leading-relaxed">
                Start configuring your perfect mobile tyre van today. Choose your vehicle, select your equipment, and get a personalized quote in minutes.
              </p>
              <Link href="/configurator/van">
                <Button 
                  size="lg" 
                  variant="secondary"
                  className="text-lg px-12 py-6 h-auto font-bold"
                  data-testid="button-start-building"
                >
                  Start Building Your Van
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}
