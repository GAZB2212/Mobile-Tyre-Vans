import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO, { createServiceStructuredData } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  MapPin,
  Package,
  Globe,
  Truck,
  CheckCircle,
  ArrowRight,
  PoundSterling,
  Users,
  Zap,
  ShieldCheck,
} from "lucide-react";
import { Link } from "wouter";
import heroImage from "@assets/Screenshot_2026-03-10_at_15.36.03_1773157556561.webp";

const stats = [
  {
    value: "£1,200",
    label: "Daily turnover",
    sub: "Top London operators",
    icon: PoundSterling,
  },
  {
    value: "40%",
    label: "Sector growth",
    sub: "Year-on-year demand",
    icon: TrendingUp,
  },
  {
    value: "24hrs",
    label: "Time to market",
    sub: "From deposit to trading",
    icon: Zap,
  },
  {
    value: "100%",
    label: "In-house support",
    sub: "Everything under one roof",
    icon: ShieldCheck,
  },
];

const included = [
  {
    icon: Truck,
    title: "The Van",
    description:
      "Your fully converted mobile tyre van, fitted out to the highest standard with racking, compressor, and all the equipment you need to run a professional operation from day one.",
  },
  {
    icon: Package,
    title: "Tyre Supply",
    description:
      "We connect you with our established tyre supplier network so you get trade pricing from the start. No searching for suppliers, no upfront stock headaches — just order what you need, when you need it.",
  },
  {
    icon: Globe,
    title: "Your Website",
    description:
      "A professional, SEO-optimised website built for your brand and area. Customers find you, book online, and you show up looking like an established business from day one.",
  },
];

const reasons = [
  {
    title: "Customers no longer visit tyre shops",
    description:
      "The shift is already happening. Consumers expect services to come to them — groceries, doctors, mechanics. Tyres are no different. Mobile tyre fitting is growing faster than the traditional retail market and shows no sign of slowing.",
  },
  {
    title: "High ticket, repeat business",
    description:
      "A single job can be worth £100–£400. Customers need new tyres every 2–3 years, meaning every customer you serve today is a repeat booking for years to come. Word-of-mouth and online reviews build a compounding customer base.",
  },
  {
    title: "Low overheads, high margins",
    description:
      "No shop premises, no rates, no large staff. Just you, your van, and your tools. Your biggest costs are your van, tyres, and fuel — all directly tied to revenue. The economics are compelling.",
  },
  {
    title: "London operators are leading the way",
    description:
      "Our clients in London are already seeing daily turnovers of up to £1,200. Urban density, high vehicle ownership, and time-poor consumers make cities ideal markets. But the opportunity exists everywhere — we have operators thriving in towns and rural areas too.",
  },
];

export default function BusinessOpportunity() {
  return (
    <>
      <SEO
        title="The Mobile Tyre Business Opportunity | Mobile Tyre Vans"
        description="Discover why the mobile tyre fitting sector is one of the UK's fastest growing small business opportunities. Clients earning up to £1,200 per day. Business in a box — van, tech, supplier and website included."
        canonical="/business-opportunity"
        keywords="mobile tyre business opportunity, start a mobile tyre business, mobile tyre franchise, tyre fitting business UK, mobile tyre van business, tyre business startup"
        structuredData={[
          createServiceStructuredData({
            name: "Mobile Tyre Business Opportunity",
            description: "Complete mobile tyre business package including van conversion, tyre supplier network, professional website, and ongoing support. Clients earning up to £1,200 per day.",
            url: "/business-opportunity",
          }),
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "How much can I earn with a mobile tyre business?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Our clients in London are already seeing daily turnovers of up to £1,200. Urban density, high vehicle ownership, and time-poor consumers make cities ideal markets. But the opportunity exists everywhere — we have operators thriving in towns and rural areas too."
                }
              },
              {
                "@type": "Question",
                "name": "What is included in the mobile tyre business package?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Our business-in-a-box includes your fully converted mobile tyre van fitted out to the highest standard, connection to our established tyre supplier network for trade pricing, and a professional SEO-optimised website built for your brand and area."
                }
              },
              {
                "@type": "Question",
                "name": "Who is the mobile tyre business opportunity for?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "The opportunity suits ex-tradespeople looking for better margins, entrepreneurs seeking a proven business model with low startup costs, and existing fleet operators wanting to add a mobile tyre service bolt-on for additional revenue."
                }
              },
              {
                "@type": "Question",
                "name": "Why is now the right time to start a mobile tyre business?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Consumer behaviour has fundamentally shifted — customers expect services to come to them. Mobile tyre fitting is growing faster than the traditional retail market. Low overheads, high margins, and repeat business make the economics compelling."
                }
              }
            ]
          }
        ]}
      />
      <Header />

      {/* Hero */}
      <section className="relative py-24 md:py-36 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/30" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <Badge className="mb-6 bg-accent/20 text-accent border-accent/30 text-sm">
              Business Opportunity
            </Badge>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white mb-6 leading-tight">
              The UK's Fastest Growing Mobile Business
            </h1>
            <p className="text-xl text-white/70 mb-10 leading-relaxed max-w-2xl">
              Mobile tyre fitting is no longer a niche — it's a booming sector
              driven by changing consumer habits. Our clients are building
              thriving businesses, and we give you everything you need to do the
              same.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/configurator/van">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-[#8bc440e6] text-[#191919] border-green-600 font-semibold"
                  data-testid="button-configure-van-opportunity"
                >
                  Configure Your Van
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto bg-white/10 backdrop-blur-sm text-white border-white/30 font-semibold"
                  data-testid="button-contact-opportunity"
                >
                  Talk to Us First
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-accent border-y border-accent/20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="text-center"
                  data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Icon className="w-6 h-6 mx-auto mb-3 text-[#191919]/70" />
                  <div className="text-3xl sm:text-4xl font-extrabold text-[#191919] mb-1">
                    {stat.value}
                  </div>
                  <div className="font-semibold text-[#191919] text-sm">
                    {stat.label}
                  </div>
                  <div className="text-[#191919]/60 text-xs mt-0.5">
                    {stat.sub}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why now */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-5">
              Why Now Is the Right Time
            </h2>
            <p className="text-muted-foreground text-lg">
              Consumer behaviour has fundamentally shifted. The businesses that
              recognise this shift early are the ones building something lasting.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {reasons.map((reason, i) => (
              <Card
                key={i}
                className="border-border"
                data-testid={`card-reason-${i}`}
              >
                <CardContent className="p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle className="w-4 h-4 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-2">{reason.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {reason.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Business in a box */}
      <section className="py-20 md:py-28 bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <Badge className="mb-4 bg-accent/10 text-accent border-accent/20">
              Everything Included
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-5">
              A Complete Business in a Box
            </h2>
            <p className="text-muted-foreground text-lg">
              We don't just build vans. We give you everything you need to start
              trading immediately — all handled in-house, all from one team.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {included.map((item, i) => {
              const Icon = item.icon;
              return (
                <Card
                  key={i}
                  className="border-border"
                  data-testid={`card-included-${i}`}
                >
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-md bg-accent/10 flex items-center justify-center mb-5">
                      <Icon className="w-6 h-6 text-accent" />
                    </div>
                    <h3 className="font-bold text-lg mb-3">{item.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonial / Social proof */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <Badge className="mb-4 bg-accent/10 text-accent border-accent/20">
                  Real Results
                </Badge>
                <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                  Our Clients Are Already Winning
                </h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Mobile tyre operators who launched with a Mobile Tyre Vans
                  conversion are seeing daily turnovers of{" "}
                  <strong className="text-foreground">up to £1,200</strong> in
                  busy urban markets like London. That's not a ceiling — that's
                  what operators are achieving in their first year.
                </p>
                <p className="text-muted-foreground mb-8 leading-relaxed">
                  The sector is expanding fast. Demand is outpacing supply in
                  most parts of the UK, which means operators entering now are
                  capturing territory before it becomes saturated. The time to
                  move is before everyone else does.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/configurator/van">
                    <Button
                      size="lg"
                      className="w-full sm:w-auto bg-[#8bc440e6] text-[#191919] border-green-600 font-semibold"
                      data-testid="button-start-configurator"
                    >
                      Start Configuring
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  {
                    metric: "£1,200",
                    desc: "Daily turnover achieved by London operators",
                  },
                  {
                    metric: "Same day",
                    desc: "Customers can book, pay and receive service",
                  },
                  {
                    metric: "No premises",
                    desc: "Zero shop costs — your van is your business",
                  },
                  {
                    metric: "Nationwide",
                    desc: "Demand exists in every town and city in the UK",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-5 p-5 rounded-md border border-border bg-card"
                    data-testid={`proof-item-${i}`}
                  >
                    <div className="text-2xl font-extrabold text-accent flex-shrink-0 min-w-[90px]">
                      {item.metric}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {item.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who is this for */}
      <section className="py-20 md:py-28 bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-5">
              Who Is This For?
            </h2>
            <p className="text-muted-foreground text-lg">
              You don't need to be a tyre expert. You need ambition, a work
              ethic, and the right setup behind you.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                icon: Users,
                title: "Ex-tradespeople",
                desc: "Already used to working with your hands and running your own schedule. Mobile tyres is a natural next step with better margins.",
              },
              {
                icon: MapPin,
                title: "Entrepreneurs",
                desc: "Looking for a proven business model with low startup costs compared to a traditional tyre shop. The economics stack up fast.",
              },
              {
                icon: TrendingUp,
                title: "Existing fleet operators",
                desc: "Already running vehicles? Adding a mobile tyre service bolt-on can generate significant additional revenue from your existing customer base.",
              },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <Card key={i} data-testid={`card-who-${i}`}>
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-6 h-6 text-accent" />
                    </div>
                    <h3 className="font-bold mb-2">{item.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {item.desc}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Cross-links */}
      <section className="py-12 bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Card className="border-border">
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg mb-2">Training Included</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Every van purchase includes complete REACT motorway certification and professional tyre fitting training.
                  </p>
                  <Link href="/training">
                    <Button variant="outline" className="!border-2 !border-accent text-accent" data-testid="link-training-from-opportunity">
                      View Training Programme
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg mb-2">Build Your Van Online</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Use our configurator to spec your perfect mobile tyre van and get an instant quote.
                  </p>
                  <Link href="/configurator/van">
                    <Button variant="outline" className="!border-2 !border-accent text-accent" data-testid="link-configurator-from-opportunity">
                      Open Configurator
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-5">
              Ready to Build Your Business?
            </h2>
            <p className="text-muted-foreground text-lg mb-10">
              Use our configurator to spec your van, or get in touch and we'll
              walk you through everything — no pressure, no obligation.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/configurator/van">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-[#8bc440e6] text-[#191919] border-green-600 font-semibold"
                  data-testid="button-final-cta"
                >
                  Configure Your Van
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto font-semibold"
                  data-testid="button-contact-cta"
                >
                  Speak to Our Team
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
