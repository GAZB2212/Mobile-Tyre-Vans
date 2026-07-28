import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SEO, { createTrainingStructuredData } from "@/components/SEO";
import Header from "@/components/Header";
import { 
  GraduationCap, 
  ShieldCheck, 
  Award, 
  Clock, 
  CheckCircle2,
  Bell,
  FileText,
  Users,
  Wrench,
  CarFront,
  ArrowRight
} from "lucide-react";
import { Link } from "wouter";

export default function Training() {
  const reactModules = [
    {
      title: "Highway Code Compliance",
      description: "Understanding legal requirements for motorway operations and roadside recovery",
      duration: "2 hours",
    },
    {
      title: "Vehicle Positioning",
      description: "Safe positioning techniques for maximum protection on live carriageways",
      duration: "3 hours",
    },
    {
      title: "Risk Assessment",
      description: "Dynamic risk assessment skills for varying road and weather conditions",
      duration: "2 hours",
    },
    {
      title: "Emergency Procedures",
      description: "Response protocols for incidents and emergency situations",
      duration: "2 hours",
    },
    {
      title: "Equipment Safety",
      description: "Safe use of recovery equipment and personal protective gear",
      duration: "1.5 hours",
    },
    {
      title: "Practical Assessment",
      description: "Real-world scenarios and hands-on evaluation",
      duration: "3 hours",
    },
  ];

  const tyreFittingModules = [
    {
      title: "Tyre Technology & Construction",
      description: "Understanding tyre types, ratings, and construction methods",
      duration: "2 hours",
    },
    {
      title: "Mobile Fitting Techniques",
      description: "Professional tyre fitting and removal in roadside environments",
      duration: "4 hours",
    },
    {
      title: "Wheel Balancing",
      description: "Precision balancing techniques for all vehicle types",
      duration: "2 hours",
    },
    {
      title: "Puncture Repair",
      description: "Professional puncture assessment and repair procedures",
      duration: "1.5 hours",
    },
    {
      title: "TPMS Systems",
      description: "Tyre pressure monitoring system diagnostics and programming",
      duration: "2 hours",
    },
    {
      title: "Customer Service",
      description: "Professional service delivery and customer communication",
      duration: "1.5 hours",
    },
  ];

  const trainingBenefits = [
    "Full legal compliance for motorway and roadside operations",
    "Professional certification recognized across the industry",
    "Comprehensive tyre fitting and repair expertise",
    "Enhanced safety for you and your customers",
    "Insurance requirements fully satisfied",
    "Ongoing support and refresher training available",
  ];

  const requirements = [
    "Valid UK driving license",
    "No medical conditions affecting roadside work",
    "Basic understanding of vehicle operations",
    "Commitment to full training attendance",
  ];

  return (
    <div className="min-h-screen">
      <Header />
      <SEO 
        title="Mobile Tyre Fitting Training | REACT Certification | Coming Soon"
        description="Professional REACT motorway certification and tyre fitting training is coming soon from Mobile Tyre Vans. Register your interest today. Based in the UK, serving the UK."
        canonical="/training"
        keywords="mobile tyre fitting training, REACT motorway certification, tyre fitting course UK, mobile tyre technician training, tyre fitting qualification"
        structuredData={[
          ...createTrainingStructuredData(),
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "What is REACT certification?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "REACT stands for Recovery Equipment And Carriageway Training. It is the industry-standard legal certification required to operate on UK motorways and high-speed roads, covering vehicle positioning, risk assessment, and emergency procedures."
                }
              },
              {
                "@type": "Question",
                "name": "Is REACT certification required by law?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Yes. REACT certification is a legal requirement for anyone performing mobile tyre fitting or roadside recovery work on UK motorways. Insurance providers also typically require REACT certification."
                }
              },
              {
                "@type": "Question",
                "name": "How long does the training programme take?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "The REACT motorway certification programme takes approximately 13.5 hours to complete. The professional tyre fitting training takes approximately 13 hours. Both programmes can be combined."
                }
              },
              {
                "@type": "Question",
                "name": "When will training be available?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Mobile Tyre Vans is developing an in-house training programme for REACT certification and professional tyre fitting. It is not yet available, but you can register your interest by contacting us on 0800 000 0000."
                }
              },
              {
                "@type": "Question",
                "name": "What are the requirements to attend?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Attendees need a valid UK driving licence, no medical conditions affecting roadside work, a basic understanding of vehicle operations, and commitment to full training attendance."
                }
              }
            ]
          }
        ]}
      />

      {/* Coming Soon Hero */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-background py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center max-w-3xl mx-auto">
            <Badge variant="outline" className="mb-4" data-testid="badge-coming-soon">
              <Bell className="w-4 h-4 mr-2" />
              Coming Soon
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-6" data-testid="text-page-title">
              Training Programme
            </h1>
            <p className="text-xl text-muted-foreground mb-4" data-testid="text-page-subtitle">
              We are working hard to bring you a comprehensive in-house training programme covering REACT motorway certification and professional tyre fitting.
            </p>
            <p className="text-base text-muted-foreground mb-8">
              Training is not yet available. In the meantime, please contact us to discuss your requirements and we can point you in the right direction.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/contact">
                <Button size="lg" className="border-green-600 font-semibold bg-accent/90 text-accent-foreground" data-testid="button-contact-us">
                  <GraduationCap className="w-5 h-5 mr-2" />
                  Contact Us About Training
                </Button>
              </Link>
              <Link href="/configurator/van">
                <Button variant="outline" size="lg" className="!border-2 !border-accent text-accent hover:bg-accent/10" data-testid="button-start-configurator">
                  Start Your Van Build
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Notice Banner */}
      <section className="py-6 px-4 border-y bg-muted/40">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-start gap-4 p-4 rounded-md bg-background border">
            <Bell className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">Training coming soon</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                We are developing a full training programme for REACT motorway certification and professional tyre fitting. The information below gives you a preview of what will be covered. Call us on <a href="tel:08000000000" className="text-accent font-medium hover:underline">0800 000 0000</a> to find out more or register your interest.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Training Overview - Preview of what's coming */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-muted-foreground" data-testid="text-preview-label">
              What the programme will cover
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <Card className="border-primary/20 opacity-75" data-testid="card-react-overview">
              <CardHeader>
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                  <ShieldCheck className="w-6 h-6 text-accent" />
                </div>
                <CardTitle className="text-2xl">REACT Training</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Recovery Equipment And Carriageway Training (REACT) is the industry-standard qualification and legal requirement for operating on UK motorways and high-speed roads.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Legal requirement for motorway operations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Essential for insurance coverage</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Industry-recognized certification</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-accent/20 opacity-75" data-testid="card-tyre-overview">
              <CardHeader>
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                  <Wrench className="w-6 h-6 text-accent" />
                </div>
                <CardTitle className="text-2xl">Tyre Fitting Training</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Professional tyre fitting training covering all aspects of mobile tyre services, from basic fitting to advanced TPMS diagnostics and customer service excellence.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Comprehensive fitting techniques</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Advanced TPMS programming</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Professional service standards</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* REACT Training Modules Preview */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-3xl font-bold mb-2" data-testid="text-react-modules-title">
              REACT Training Modules
            </h2>
            <Badge variant="outline" className="mb-4">Coming Soon</Badge>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-react-modules-description">
              Essential certification for safe and legal motorway operations
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-70">
            {reactModules.map((module, index) => (
              <Card key={index} data-testid={`card-react-module-${index}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                      <span className="font-bold text-accent">{index + 1}</span>
                    </div>
                    <Badge variant="secondary" data-testid={`badge-react-duration-${index}`}>
                      <Clock className="w-3 h-3 mr-1" />
                      {module.duration}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-semibold mb-2" data-testid={`text-react-module-title-${index}`}>
                    {module.title}
                  </h3>
                  <p className="text-muted-foreground" data-testid={`text-react-module-description-${index}`}>
                    {module.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Tyre Fitting Training Modules Preview */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-4">
              <Wrench className="w-8 h-8 text-accent" />
            </div>
            <h2 className="text-3xl font-bold mb-2" data-testid="text-tyre-modules-title">
              Tyre Fitting Training Modules
            </h2>
            <Badge variant="outline" className="mb-4">Coming Soon</Badge>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-tyre-modules-description">
              Professional mobile tyre fitting and service expertise
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-70">
            {tyreFittingModules.map((module, index) => (
              <Card key={index} data-testid={`card-tyre-module-${index}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                      <span className="font-bold text-accent">{index + 1}</span>
                    </div>
                    <Badge variant="secondary" data-testid={`badge-tyre-duration-${index}`}>
                      <Clock className="w-3 h-3 mr-1" />
                      {module.duration}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-semibold mb-2" data-testid={`text-tyre-module-title-${index}`}>
                    {module.title}
                  </h3>
                  <p className="text-muted-foreground" data-testid={`text-tyre-module-description-${index}`}>
                    {module.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits & Requirements Preview */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-7xl">
          <div className="grid md:grid-cols-2 gap-8 opacity-70">
            <Card data-testid="card-benefits">
              <CardHeader>
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                  <Award className="w-6 h-6 text-accent" />
                </div>
                <CardTitle>Training Benefits</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {trainingBenefits.map((benefit, index) => (
                    <li key={index} className="flex items-start gap-3" data-testid={`item-benefit-${index}`}>
                      <CheckCircle2 className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card data-testid="card-requirements">
              <CardHeader>
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-accent" />
                </div>
                <CardTitle>Entry Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {requirements.map((requirement, index) => (
                    <li key={index} className="flex items-start gap-3" data-testid={`item-requirement-${index}`}>
                      <CheckCircle2 className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                      <span>{requirement}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Cross-links */}
      <section className="py-12 px-4 bg-muted/30 border-y">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Explore More</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-2">The Business Opportunity</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Discover why mobile tyre fitting is one of the UK's fastest growing small business opportunities.
                </p>
                <Link href="/business-opportunity" aria-label="Explore the mobile tyre van business opportunity">
                  <Button variant="outline" className="!border-2 !border-accent text-accent" data-testid="link-opportunity-from-training">
                    Explore the Opportunity
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-2">Browse Our Van Stock</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  View our selection of ready-to-go mobile tyre vans, all professionally converted and fully equipped.
                </p>
                <Link href="/stock">
                  <Button variant="outline" className="!border-2 !border-accent text-accent" data-testid="link-stock-from-training">
                    View Stock
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold mb-4" data-testid="text-cta-title">
            Interested in Training?
          </h2>
          <p className="text-lg text-muted-foreground mb-8" data-testid="text-cta-description">
            Training is coming soon. Get in touch and we will let you know as soon as it is available.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/contact">
              <Button size="lg" className="bg-accent/90 text-accent-foreground border-green-600 font-semibold" data-testid="button-contact-training">
                <Bell className="w-5 h-5 mr-2" />
                Register Your Interest
              </Button>
            </Link>
            <Link href="/configurator/van">
              <Button variant="outline" size="lg" className="!border-2 !border-accent text-accent hover:bg-accent/10" data-testid="button-configure-van">
                Configure Your Van
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
