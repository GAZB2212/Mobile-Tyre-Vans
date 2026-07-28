import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import StockCard from "./StockCard";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import type { Van } from "@shared/schema";
import stockImage from "@assets/generated_images/Mobile_tyre_van_conversion_372a2d42.webp";

export default function FeaturedStock() {

  const { data: allVans = [], isLoading } = useQuery<Van[]>({
    queryKey: ['/api/vans'],
  });

  const featuredVans = allVans
    .filter(van => van.published !== false)
    .slice(0, 3)
    .map(van => ({
      id: van.id,
      slug: van.slug,
      title: van.title,
      make: van.make,
      model: van.model,
      year: van.year,
      mileage: van.mileage,
      price: van.price,
      vatIncluded: van.vatIncluded,
      imageUrl: van.heroImage || (van.images && van.images.length > 0 ? van.images[0] : stockImage),
      specs: van.specs
    }));

  if (isLoading) {
    return (
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        </div>
      </section>
    );
  }

  if (featuredVans.length === 0) {
    return null;
  }

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white" data-testid="text-featured-title">
              Featured Stock
            </h2>
            <p className="text-lg text-muted-foreground">
              Quality base vehicles available for conversion from our current stock
            </p>
          </div>
          <Button variant="outline" size="lg" className="hidden md:flex border-accent text-accent hover:bg-accent hover:text-white" asChild data-testid="button-view-all-stock">
            <Link href="/stock">
              View All Stock
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {featuredVans.map((van) => (
            <StockCard key={van.id} {...van} />
          ))}
        </div>

        <div className="text-center md:hidden">
          <Button variant="outline" size="lg" className="border-accent text-accent hover:bg-accent hover:text-white" asChild data-testid="mobile-button-view-all-stock">
            <Link href="/stock">
              View All Stock
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
