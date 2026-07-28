import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO, { aboutPageStructuredData } from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Award, Users, Wrench, ArrowRight, MapPin, Phone, Mail } from "lucide-react";
import { Link } from "wouter";
import logoImg from "@assets/mtv-logo.svg";

export default function About() {
  const values = [
    {
      icon: CheckCircle,
      title: "Quality Craftsmanship",
      description: "Every van is built to the highest standards with attention to detail and professional finishing",
    },
    {
      icon: Award,
      title: "Industry Expertise",
      description: "Years of experience in mobile tyre van conversions and automotive engineering",
    },
    {
      icon: Users,
      title: "Customer Focus",
      description: "Dedicated to understanding your needs and delivering solutions that help your business thrive",
    },
    {
      icon: Wrench,
      title: "Full Support",
      description: "Comprehensive aftercare and ongoing support to keep your mobile business running smoothly",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="About Mobile Tyre Vans | Founded 2020 | UK Tyre Van Conversion Specialists"
        description="Mobile Tyre Vans is the UK's specialist in mobile tyre van conversions. Our experienced team builds fully-equipped, REACT-compliant tyre vans with nationwide delivery and FCA-authorised finance."
        canonical="/about"
        keywords="about mobile tyre vans, tyre van conversion specialists UK, van conversion company UK, MTV, founded 2020, mobile tyre business"
        structuredData={[aboutPageStructuredData]}
      />
      <Header />

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-card to-background border-b py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-4 bg-accent/10 text-accent border-accent/20">
              Our Story
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4" data-testid="text-about-title">
              Building Mobile Tyre Businesses
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground">
              We're passionate about helping entrepreneurs start and grow their mobile tyre fitting businesses 
              with professional van conversions designed for success.
            </p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-6">Our Mission</h2>
                <p className="text-muted-foreground mb-4">
                  We believe in empowering mobile business owners with the tools they need to succeed. 
                  Our mission is to design and build the finest mobile tyre vans in the UK, combining 
                  functionality, durability, and professional appearance.
                </p>
                <p className="text-muted-foreground">
                  Every van we convert is built with the understanding that it's not just a vehicle—it's 
                  a mobile workshop, a business card, and the foundation of an entrepreneur's livelihood.
                </p>
              </div>
              <div className="aspect-video rounded-lg overflow-hidden bg-black flex items-center justify-center">
                <img
                  src={logoImg}
                  alt="Mobile Tyre Vans logo"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* E-E-A-T: Expertise, Founding & Credentials */}
      <section className="py-16 md:py-24 bg-card/50 border-y">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-4">Our Background</h2>
                <p className="text-muted-foreground mb-4">
                  Mobile Tyre Vans was founded in 2020 in the North West, to serve a clear gap in the UK market: mobile tyre fitting entrepreneurs who needed professionally built, business-ready vans without the guesswork. Since launching, we have built and delivered conversions to customers across England, Scotland, and Wales.
                </p>
                <p className="text-muted-foreground mb-4">
                  Our workshop team has a combined background spanning automotive engineering, vehicle customisation, and mobile tyre business operations — giving us a unique understanding of both the build requirements and the day-to-day demands of running a mobile tyre service.
                </p>
                <p className="text-muted-foreground">
                  Every conversion leaves our facility after a full pre-delivery inspection, ensuring the van is roadworthy, legally compliant, and ready to earn from day one.
                </p>
              </div>
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-3">Our Team</h3>
                  <div className="space-y-3 mb-6">
                    {[
                      { role: "Van Conversion Lead", detail: "10+ years automotive fabrication and commercial vehicle fit-out" },
                      { role: "Tyre Equipment Specialist", detail: "Former mobile tyre technician with in-depth product knowledge" },
                      { role: "Finance & Sales", detail: "FCA-authorised credit broker, dedicated customer support" },
                    ].map((member) => (
                      <div key={member.role} className="text-sm">
                        <span className="font-medium">{member.role}</span>
                        <span className="text-muted-foreground"> — {member.detail}</span>
                      </div>
                    ))}
                  </div>
                  <h3 className="font-semibold text-lg mb-3">Expertise & Credentials</h3>
                  <ul className="space-y-2">
                    {[
                      "Specialist mobile tyre van conversion workshop",
                      "Experienced in L3H3 Sprinter, Transit & Crafter builds",
                      "REACT-aware builds designed for motorway compliance",
                      "Finance-approved supplier — HP and lease available",
                      "UK-wide delivery on all completed conversions",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <Card data-testid="card-address">
                  <CardContent className="p-5 space-y-3">
                    <h3 className="font-semibold">Visit Our Workshop</h3>
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <address className="not-italic">
                        Unit 1, Example Business Park,<br />Your Town, AA1 1AA
                      </address>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4 text-accent shrink-0" />
                      <a href="tel:08000000000" className="hover:text-foreground transition-colors">0800 000 0000</a>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="w-4 h-4 text-accent shrink-0" />
                      <a href="mailto:sales@mobiletyrevans.co.uk" className="hover:text-foreground transition-colors">sales@mobiletyrevans.co.uk</a>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      Mon–Fri: 9:00 am – 5:30 pm
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-16 md:py-24 bg-card">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">What Drives Us</h2>
              <p className="text-muted-foreground">
                Our core values guide every van we build and every customer relationship we nurture
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {values.map((value, index) => (
                <Card key={index} className="hover-elevate" data-testid={`card-value-${index}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                        <value.icon className="w-6 h-6 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-2">{value.title}</h3>
                        <p className="text-sm text-muted-foreground">{value.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">Our Build Process</h2>
            <div className="space-y-8">
              {[
                { step: "01", title: "Consultation", description: "We discuss your business needs and recommend the perfect setup" },
                { step: "02", title: "Design", description: "Create a custom layout optimized for your workflow and equipment" },
                { step: "03", title: "Conversion", description: "Professional installation of racking, equipment, and electrical systems" },
                { step: "04", title: "Branding", description: "Apply professional vehicle wrapping and signage to match your brand" },
                { step: "05", title: "Handover", description: "Full walkthrough and training on your new mobile workshop" },
              ].map((step, index) => (
                <div key={index} className="flex gap-6" data-testid={`step-${index}`}>
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold">
                      {step.step}
                    </div>
                    {index < 4 && <div className="w-0.5 flex-1 bg-border mt-2" />}
                  </div>
                  <div className="pb-8">
                    <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Cross-links */}
      <section className="py-12 border-t">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg mb-2">Get in Touch</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Have questions? Call us on 0800 000 0000 or send us a message.
                  </p>
                  <Button variant="outline" className="!border-2 !border-accent text-accent" asChild data-testid="link-contact-from-about">
                    <Link href="/contact">
                      Contact Us
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg mb-2">How We Build Your Van</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    See our step-by-step process from choosing your van to hitting the road.
                  </p>
                  <Button variant="outline" className="!border-2 !border-accent text-accent" asChild data-testid="link-how-it-works-from-about">
                    <Link href="/how-it-works">
                      See How It Works
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-br from-accent/5 to-accent/10 border-t">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Start Your Journey</h2>
            <p className="text-muted-foreground mb-8">
              Ready to build your mobile tyre business with a professional van conversion?
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground" asChild data-testid="button-configure">
                <Link href="/configurator/van">
                  Configure Your Van
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="!border-2 !border-accent text-accent hover:bg-accent/10" asChild data-testid="button-contact">
                <Link href="/contact">Contact Us</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
