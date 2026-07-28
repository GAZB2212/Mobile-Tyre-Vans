import { useLocation } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ConfiguratorStepper from "@/components/ConfiguratorStepper";
import { ConfiguratorSummary } from "@/components/ConfiguratorSummary";
import { ConfiguratorTutorial } from "@/components/ConfiguratorTutorial";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ArrowLeft, GraduationCap, Bell } from "lucide-react";

export default function SelectTraining() {
  const [, setLocation] = useLocation();

  const handleContinue = () => {
    setLocation('/configurator/finance');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <Button 
              variant="ghost" 
              onClick={() => setLocation('/configurator/upgrades')}
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Upgrades
            </Button>
            
            <ConfiguratorStepper currentPath="/configurator/training" />

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 mt-4" data-testid="text-page-title">
              Training
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mb-4">
              Professional training programmes for mobile tyre technicians
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
            <div className="xl:col-span-2">
              {/* Coming Soon Notice */}
              <Card className="mb-6" data-testid="card-training-coming-soon">
                <CardContent className="py-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-4">
                    <GraduationCap className="w-8 h-8 text-accent" />
                  </div>
                  <Badge variant="outline" className="mb-4" data-testid="badge-coming-soon">
                    <Bell className="w-3 h-3 mr-1" />
                    Coming Soon
                  </Badge>
                  <h2 className="text-xl font-bold mb-3">Training Not Yet Available</h2>
                  <p className="text-muted-foreground max-w-md mx-auto mb-4">
                    We are working to bring you a comprehensive training programme covering REACT motorway certification and professional tyre fitting. Training is not currently offered — please continue to the next step.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Interested in training? Call us on{" "}
                    <a href="tel:08000000000" className="text-accent font-medium hover:underline">
                      0800 000 0000
                    </a>{" "}
                    or visit our{" "}
                    <a href="/training" className="text-accent font-medium hover:underline">
                      training page
                    </a>{" "}
                    to find out more.
                  </p>
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row gap-4 mt-6">
                <Button 
                  onClick={handleContinue}
                  size="lg"
                  className="flex-1 bg-accent text-accent-foreground"
                  data-testid="button-continue"
                >
                  Continue to Finance
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
            
            <div className="xl:col-span-1">
              <div className="sticky top-6">
                <ConfiguratorSummary />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
      <ConfiguratorTutorial page="training" />
    </div>
  );
}
