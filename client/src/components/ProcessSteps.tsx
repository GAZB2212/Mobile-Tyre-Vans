import { Button } from "@/components/ui/button";
import { Car, Package, Sparkles, CreditCard } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const services = [
  {
    icon: Car,
    title: "Choose Your Van",
    description: "Select from our range of quality base vehicles perfectly suited for mobile tyre fitting operations"
  },
  {
    icon: Package,
    title: "Choose Your Kit",
    description: "Pick the ideal tyre equipment package including changers, balancers, and compressors"
  },
  {
    icon: Sparkles,
    title: "Choose Your Upgrades",
    description: "Add optional extras like branding, lighting, security systems, and premium equipment"
  },
  {
    icon: CreditCard,
    title: "Choose Your Finance",
    description: "Flexible finance options including hire purchase and leasing to spread the cost"
  }
];

export default function ProcessSteps() {
  const ref = useScrollReveal();

  return (
    <section ref={ref} className="scroll-reveal py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 sm:mb-6 text-foreground" data-testid="text-process-title">
            Build Your Van
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-12 max-w-7xl mx-auto">
          {services.map((service, index) => (
            <div key={index} className="text-center space-y-4 sm:space-y-6" data-testid={`card-service-${index}`}>
              <div className="flex justify-center">
                <service.icon className="w-16 h-16 text-accent" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-foreground">
                {service.title}
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                {service.description}
              </p>
              <Link href="/how-it-works" aria-label={`How it works — ${service.title.toLowerCase()}`}>
                <Button variant="link" className="text-foreground hover:text-accent p-0 h-auto" data-testid={`button-learn-more-${index}`}>
                  How It Works <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
