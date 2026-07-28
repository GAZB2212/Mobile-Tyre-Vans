import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, PoundSterling, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export default function EarningsPotential() {
  const [, setLocation] = useLocation();
  const ref = useScrollReveal();

  const benefits = [
    {
      icon: PoundSterling,
      title: "Up to £1,200 Per Day",
      description: "Our busiest customers report daily turnover of up to £1,200 during peak periods",
    },
    {
      icon: Clock,
      title: "Start Earning Immediately",
      description: "Van arrives fully equipped and ready to operate - start taking jobs from day one",
    },
    {
      icon: TrendingUp,
      title: "Growing Demand",
      description: "Mobile tyre services are in high demand with customers valuing convenience",
    },
  ];

  const revenueBreakdown = [
    { service: "Standard Tyre Fitting", earnings: "£60-£120 per job" },
    { service: "Emergency Callout", earnings: "£150-£250 per job" },
    { service: "Fleet Services", earnings: "£500-£1,500 per day" },
    { service: "Premium Tyre Supply & Fit", earnings: "£200-£400 per job" },
  ];

  return (
    <section ref={ref} className="scroll-reveal py-16 md:py-24 bg-gradient-to-br from-accent/5 via-background to-background">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-accent/10 text-accent border-accent/20">
              Business Opportunity
            </Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4" data-testid="text-earnings-title">
              Start Your Profitable Mobile Tyre Business
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              We sell complete, fully-equipped mobile tyre vans ready to generate revenue from day one. Start earning immediately with a turnkey business solution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {benefits.map((benefit, index) => (
              <Card key={index} className="hover-elevate" data-testid={`card-benefit-${index}`}>
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                    <benefit.icon className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mb-12">
            <CardContent className="p-6 md:p-8">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-accent" />
                Typical Service Pricing
              </h3>
              <div className="space-y-4">
                {revenueBreakdown.map((item, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center pb-4 border-b last:border-0"
                    data-testid={`item-revenue-${index}`}
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                      <span className="font-medium">{item.service}</span>
                    </div>
                    <Badge variant="secondary" className="text-base font-semibold">
                      {item.earnings}
                    </Badge>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 bg-accent/5 rounded-lg border border-accent/20">
                <p className="text-sm text-muted-foreground text-center">
                  <span className="font-semibold text-foreground">Real Results:</span> Our busiest customers report daily turnover of up to £1,200 during peak periods with multiple jobs and fleet services
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="bg-gradient-to-br from-accent/10 to-accent/5 rounded-2xl p-8 md:p-12 text-center border border-accent/20">
            <h3 className="text-2xl md:text-3xl font-bold mb-4">
              Ready to Start Your Mobile Tyre Business?
            </h3>
            <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
              Browse our ready-to-go vans or build your custom setup with our configurator. Every van comes fully equipped to start earning immediately.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-accent text-accent-foreground"
                onClick={() => setLocation('/stock')}
                data-testid="button-view-stock"
              >
                View Available Vans
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="!border-2 !border-accent text-accent hover:bg-accent/10"
                onClick={() => setLocation('/configurator/van')}
                data-testid="button-build-van"
              >
                Build Your Van
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
