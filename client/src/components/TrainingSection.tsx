import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GraduationCap, ShieldCheck, Award, Wrench } from "lucide-react";
import { Link } from "wouter";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export default function TrainingSection() {
  const ref = useScrollReveal();

  const trainingFeatures = [
    {
      icon: ShieldCheck,
      title: "REACT Certified",
      description: "Legal requirement for motorway operations and roadside recovery",
    },
    {
      icon: Wrench,
      title: "Tyre Fitting Training",
      description: "Professional mobile tyre fitting and TPMS expertise",
    },
    {
      icon: Award,
      title: "Expert Instructors",
      description: "Industry-experienced trainers with real-world knowledge",
    },
  ];

  return (
    <section ref={ref} className="scroll-reveal py-16 px-4 bg-muted/30">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4" data-testid="badge-training">
            <GraduationCap className="w-4 h-4 mr-2" />
            Optional Professional Training
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4" data-testid="text-training-title">
            Complete Training Programme Available Soon
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-training-description">
            Add comprehensive REACT motorway certification and professional tyre fitting training to your order - everything you need to start earning from day one
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {trainingFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="hover-elevate" data-testid={`card-training-feature-${index}`}>
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-white dark:bg-white rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2" data-testid={`text-feature-title-${index}`}>
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground" data-testid={`text-feature-description-${index}`}>
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center">
          <Link href="/training" data-testid="link-training-details">
            <Button size="lg" variant="outline" className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950" data-testid="button-learn-training">
              Learn More About Training
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
