import { ShieldCheck, Truck, Hammer } from "lucide-react";

const features = [
  {
    icon: ShieldCheck,
    number: "01",
    title: "FCA Authorised",
    description: "Regulated finance provider offering flexible funding solutions for your mobile tyre business"
  },
  {
    icon: Truck,
    number: "02",
    title: "Nationwide Delivery",
    description: "Complete UK-wide service coverage with professional delivery and handover support"
  },
  {
    icon: Hammer,
    number: "03",
    title: "UK-Built",
    description: "Manufactured in Britain with premium British craftsmanship and quality materials"
  }
];

export default function TrustStrip() {
  return (
    <section className="py-14 bg-background">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto divide-y md:divide-y-0 md:divide-x divide-border/40">
          {features.map((feature, index) => (
            <div
              key={index}
              className="text-center space-y-3 py-8 md:py-4 px-6 md:px-10"
              data-testid={`feature-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className="flex justify-center mb-3">
                <feature.icon className="w-14 h-14 text-accent" strokeWidth={1.25} />
              </div>
              <h3 className="text-lg md:text-xl font-extrabold text-foreground tracking-wide">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed px-2">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
