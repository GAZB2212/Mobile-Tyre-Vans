import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Settings, Calendar, Gauge, Fuel } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useConfigurator } from "@/lib/ConfiguratorContext";

interface StockCardProps {
  id: string;
  slug: string;
  title: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  price: number;
  vatIncluded: boolean;
  imageUrl: string;
  specs: {
    transmission: string;
    size: string;
    fuel: string;
  };
}

export default function StockCard({ 
  id, 
  slug,
  title, 
  make, 
  model, 
  year, 
  mileage, 
  price, 
  vatIncluded, 
  imageUrl, 
  specs 
}: StockCardProps) {
  const [, setLocation] = useLocation();
  const { setVan } = useConfigurator();
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price / 100);
  };

  return (
    <Card className="hover-elevate cursor-pointer group overflow-hidden" data-testid={`card-stock-${id}`}>
      <div className="aspect-video overflow-hidden">
        <img 
          src={imageUrl} 
          alt={title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          data-testid={`img-stock-${id}`}
        />
      </div>
      
      <CardContent className="p-4">
        <div className="mb-3">
          <h3 className="font-semibold text-lg mb-1" data-testid={`text-stock-title-${id}`}>
            {make} {model}
          </h3>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
        
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="flex items-center text-sm text-muted-foreground">
            <Calendar className="w-4 h-4 mr-1" />
            {year}
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <Gauge className="w-4 h-4 mr-1" />
            {mileage.toLocaleString()}mi
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <Fuel className="w-4 h-4 mr-1" />
            {specs.fuel}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="secondary" className="text-xs">
            {specs.transmission}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {specs.size}
          </Badge>
        </div>
        
        <div className="mb-4">
          <div className="text-2xl font-bold text-chart-2" data-testid={`text-price-${id}`}>
            {formatPrice(price)}
          </div>
          <div className="text-sm text-muted-foreground">
            {vatIncluded ? "Inc. VAT" : "Ex. VAT"}
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="p-4 pt-0 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 !border-2 !border-accent text-accent hover:bg-accent/10" asChild data-testid={`button-view-${id}`}>
          <Link href={`/stock/${slug}`}>
            <Eye className="w-4 h-4 mr-2" />
            View
          </Link>
        </Button>
        <Button 
          size="sm" 
          className="flex-1 bg-chart-3 hover:bg-chart-3/90 text-black" 
          data-testid={`button-configure-${id}`}
          onClick={() => {
            setVan(id);
            setLocation('/configurator/service-type');
          }}
        >
          <Settings className="w-4 h-4 mr-2" />
          Configure
        </Button>
      </CardFooter>
    </Card>
  );
}