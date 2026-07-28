import { useLocation } from "wouter";
import { useConfigurator } from "@/lib/ConfiguratorContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ConfiguratorStepper from "@/components/ConfiguratorStepper";
import { ConfiguratorSummary } from "@/components/ConfiguratorSummary";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Car, Truck, Shuffle } from "lucide-react";
import type { KitServiceType } from "@shared/schema";

const SERVICE_OPTIONS: {
  value: KitServiceType;
  label: string;
  description: string;
  detail: string;
  Icon: React.ComponentType<{ className?: string }>;
  nextPath: string;
}[] = [
  {
    value: "car",
    label: "Car & Van Tyres",
    description: "Passenger cars, vans & SUVs",
    detail:
      "Your conversion will be set up for fitting standard car and light-van tyres. Choose from our range of equipment packs in the next step.",
    Icon: Car,
    nextPath: "/configurator/kit",
  },
  {
    value: "commercial",
    label: "Commercial Only",
    description: "HGVs, lorries & heavy commercial fleet",
    detail:
      "For heavy goods vehicles and large commercial fleets only. No equipment pack required — select your commercial extras and equipment in the next step.",
    Icon: Truck,
    nextPath: "/configurator/upgrades",
  },
  {
    value: "hybrid",
    label: "Car & Commercial",
    description: "Mixed fleet — car tyres and commercial",
    detail:
      "Your van will handle both standard car/van tyres and commercial vehicles. You'll choose an equipment pack first, then select your commercial extras on top.",
    Icon: Shuffle,
    nextPath: "/configurator/kit",
  },
];

export default function SelectServiceType() {
  const [, setLocation] = useLocation();
  const { state, setServiceType } = useConfigurator();

  const handleSelect = (value: KitServiceType, nextPath: string) => {
    setServiceType(value);
    setLocation(nextPath);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => setLocation("/configurator/van")}
            className="mb-4 gap-2"
            data-testid="button-back-to-van"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Van Selection
          </Button>
          <ConfiguratorStepper currentPath="/configurator/service-type" />

          <h1
            className="text-3xl md:text-4xl font-bold mb-2 mt-4"
            data-testid="text-page-title"
          >
            What Will You Be Fitting?
          </h1>
          <p className="text-muted-foreground mb-4">
            Tell us what type of vehicles your mobile tyre service will cover
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
          <div className="xl:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6" data-testid="grid-service-types">
              {SERVICE_OPTIONS.map(({ value, label, description, detail, Icon, nextPath }) => {
                const isSelected = state.serviceType === value;
                return (
                  <Card
                    key={value}
                    className={`cursor-pointer hover-elevate transition-all ${
                      isSelected ? "ring-2 ring-accent" : ""
                    }`}
                    onClick={() => handleSelect(value, nextPath)}
                    data-testid={`card-service-type-${value}`}
                  >
                    <CardContent className="p-6 flex flex-col gap-4 h-full">
                      <div
                        className={`w-12 h-12 rounded-md flex items-center justify-center ${
                          isSelected
                            ? "bg-accent text-accent-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="w-6 h-6" />
                      </div>

                      <div className="flex-1">
                        <h2 className="text-lg font-semibold mb-1">{label}</h2>
                        <p className="text-sm font-medium text-muted-foreground mb-3">
                          {description}
                        </p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {detail}
                        </p>
                      </div>

                      <Button
                        className={`w-full mt-2 ${
                          isSelected
                            ? "bg-accent text-accent-foreground"
                            : "!border-2 !border-accent text-accent hover:bg-accent/10"
                        }`}
                        variant={isSelected ? "default" : "outline"}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(value, nextPath);
                        }}
                        data-testid={`button-select-service-type-${value}`}
                      >
                        {isSelected ? (
                          <>
                            Selected — Continue
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </>
                        ) : (
                          "Select"
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="xl:col-span-1">
            <ConfiguratorSummary />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
