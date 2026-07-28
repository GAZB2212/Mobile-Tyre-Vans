import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Package } from "lucide-react";
import equipmentImage from "@assets/generated_images/Tire_changing_equipment_kit_1bd060cf.webp";

interface EquipmentKit {
  id: string;
  name: string;
  description: string;
  price: number;
  powerKw: number;
  includes: string[];
  imageUrl: string;
  popular?: boolean;
}

interface EquipmentGridProps {
  selectedKit: string | null;
  onKitSelect: (kitId: string) => void;
}

export default function EquipmentGrid({ selectedKit, onKitSelect }: EquipmentGridProps) {
  // todo: remove mock functionality
  const kits: EquipmentKit[] = [
    {
      id: "starter",
      name: "Starter Kit",
      description: "Perfect for small operations and getting started",
      price: 1250000, // £12,500 in pence
      powerKw: 3.5,
      includes: ["Tyre Changer", "Wheel Balancer", "Air Compressor"],
      imageUrl: equipmentImage
    },
    {
      id: "professional",
      name: "Professional Kit",
      description: "Complete setup for professional mobile services",
      price: 1850000, // £18,500 in pence
      powerKw: 5.2,
      includes: ["Advanced Tyre Changer", "Digital Wheel Balancer", "High-Capacity Compressor", "Valve Tools"],
      imageUrl: equipmentImage,
      popular: true
    },
    {
      id: "premium",
      name: "Premium Kit",
      description: "Top-tier equipment for high-volume operations",
      price: 2450000, // £24,500 in pence
      powerKw: 7.8,
      includes: ["Premium Tyre Changer", "Laser Wheel Balancer", "Dual-Stage Compressor", "Complete Tool Set", "TPMS Tools"],
      imageUrl: equipmentImage
    }
  ];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price / 100);
  };

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {kits.map((kit) => (
        <Card 
          key={kit.id} 
          className={`hover-elevate cursor-pointer transition-all ${
            selectedKit === kit.id ? 'ring-2 ring-chart-2 border-chart-2' : ''
          } ${kit.popular ? 'relative' : ''}`}
          onClick={() => onKitSelect(kit.id)}
          data-testid={`card-kit-${kit.id}`}
        >
          {kit.popular && (
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <Badge className="bg-chart-3 text-black font-semibold">Most Popular</Badge>
            </div>
          )}
          
          <CardHeader className="pb-3">
            <div className="aspect-video overflow-hidden rounded-md mb-3">
              <img 
                src={kit.imageUrl} 
                alt={kit.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <CardTitle className="flex items-center justify-between">
              <span>{kit.name}</span>
              {selectedKit === kit.id && (
                <div className="w-6 h-6 bg-chart-2 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </CardTitle>
          </CardHeader>
          
          <CardContent>
            <p className="text-muted-foreground mb-4">{kit.description}</p>
            
            <div className="flex items-center justify-between mb-4">
              <div className="text-2xl font-bold text-chart-2">
                {formatPrice(kit.price)}
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <Zap className="w-4 h-4 mr-1" />
                {kit.powerKw}kW
              </div>
            </div>
            
            <div className="space-y-2 mb-4">
              <div className="flex items-center text-sm font-medium">
                <Package className="w-4 h-4 mr-2" />
                Includes:
              </div>
              <ul className="space-y-1">
                {kit.includes.map((item, index) => (
                  <li key={index} className="flex items-center text-sm text-muted-foreground">
                    <Check className="w-3 h-3 mr-2 text-chart-3" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            
            <Button 
              className={`w-full ${
                selectedKit === kit.id 
                  ? 'bg-chart-2 hover:bg-chart-2/90' 
                  : 'bg-chart-3 hover:bg-chart-3/90 text-black'
              }`}
              data-testid={`button-select-${kit.id}`}
            >
              {selectedKit === kit.id ? 'Selected' : 'Select Kit'}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}