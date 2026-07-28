import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Car, Fuel, Gauge, Settings, Calendar, ArrowRight, Search, Wrench, Flame, Zap, Tag, Clock } from "lucide-react";
import { useConfigurator } from "@/lib/ConfiguratorContext";
import SEO from "@/components/SEO";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import type { VanWithSaleStatus } from "@shared/schema";

const URGENCY_STYLES: Record<string, { className: string; icon: typeof Flame }> = {
  "Only 1 Left":    { className: "bg-red-600 text-white border-0",       icon: Flame },
  "Selling Fast":   { className: "bg-orange-500 text-white border-0",    icon: Flame },
  "Hot Deal":       { className: "bg-orange-500 text-white border-0",    icon: Flame },
  "Just In":        { className: "bg-accent text-accent-foreground border-0", icon: Zap },
  "Nearly New":     { className: "bg-accent text-accent-foreground border-0", icon: Zap },
  "Reduced":        { className: "bg-blue-600 text-white border-0",      icon: Tag },
  "Price Drop":     { className: "bg-blue-600 text-white border-0",      icon: Tag },
  "Reserved":       { className: "bg-muted text-muted-foreground border-0", icon: Clock },
};

export default function Stock() {
  const [makeFilter, setMakeFilter] = useState<string>("all");
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [transmissionFilter, setTransmissionFilter] = useState<string>("all");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [, setLocation] = useLocation();
  const { setVan } = useConfigurator();

  const { data: vans = [], isLoading } = useQuery<VanWithSaleStatus[]>({
    queryKey: ['/api/vans'],
  });

  const handleConfigureVan = (vanId: string) => {
    setVan(vanId);
    setLocation('/configurator/service-type');
  };

  const uniqueMakes = Array.from(new Set(vans.map(van => van.make))).sort();
  const uniqueModels = Array.from(new Set(vans.map(van => van.model))).sort();
  const uniqueYears = Array.from(new Set(vans.map(van => van.year))).sort((a, b) => b - a);

  const filteredVans = vans.filter(van => {
    if (makeFilter && makeFilter !== "all" && van.make !== makeFilter) return false;
    if (modelFilter && modelFilter !== "all" && van.model !== modelFilter) return false;
    if (yearFilter && yearFilter !== "all" && van.year.toString() !== yearFilter) return false;
    if (transmissionFilter && transmissionFilter !== "all" && van.specs.transmission !== transmissionFilter) return false;
    if (maxPrice && van.price > parseInt(maxPrice) * 100) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading our van stock...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <SEO 
        title="Mobile Tyre Vans For Sale | Buy Ready-to-Go Conversions UK"
        description="Browse our stock of mobile tyre vans for sale. Professionally converted, fully equipped, and available with nationwide UK delivery. View prices, specs, and finance options. Call 0800 000 0000."
        canonical="/stock"
        keywords="mobile tyre van for sale, buy mobile tyre van, tyre van for sale UK, mobile tyre fitting van, used mobile tyre van, tyre van conversion for sale"
      />
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-card to-background border-b">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4" data-testid="text-stock-title">
              Ready-to-Go Mobile Tyre Vans
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground">Browse our selection of vans. All vans are ready to be equipped  for your business.</p>
          </div>
        </div>
      </section>
      {/* Filters */}
      <section className="border-b bg-card/50">
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Make</label>
              <Select value={makeFilter} onValueChange={setMakeFilter}>
                <SelectTrigger data-testid="select-make-filter">
                  <SelectValue placeholder="All Makes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Makes</SelectItem>
                  {uniqueMakes.map(make => (
                    <SelectItem key={make} value={make}>{make}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Model</label>
              <Select value={modelFilter} onValueChange={setModelFilter}>
                <SelectTrigger data-testid="select-model-filter">
                  <SelectValue placeholder="All Models" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Models</SelectItem>
                  {uniqueModels.map(model => (
                    <SelectItem key={model} value={model}>{model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Year</label>
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger data-testid="select-year-filter">
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {uniqueYears.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Transmission</label>
              <Select value={transmissionFilter} onValueChange={setTransmissionFilter}>
                <SelectTrigger data-testid="select-transmission-filter">
                  <SelectValue placeholder="All Transmissions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Transmissions</SelectItem>
                  <SelectItem value="Manual">Manual</SelectItem>
                  <SelectItem value="Automatic">Automatic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Max Price (£)</label>
              <Input
                type="number"
                placeholder="Any price"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                data-testid="input-max-price-filter"
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                className="w-full !border-2 !border-accent text-accent hover:bg-accent/10"
                onClick={() => {
                  setMakeFilter("all");
                  setModelFilter("all");
                  setYearFilter("all");
                  setTransmissionFilter("all");
                  setMaxPrice("");
                }}
                data-testid="button-clear-filters"
              >
                <Search className="w-4 h-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm text-muted-foreground" data-testid="text-results-count">
              Showing {filteredVans.length} of {vans.length} vans
            </p>
          </div>
        </div>
      </section>
      {/* Van Grid */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          {filteredVans.length === 0 ? (
            <Card className="max-w-md mx-auto">
              <CardContent className="py-12 text-center">
                <Car className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No vans found</h3>
                <p className="text-muted-foreground mb-6">
                  Try adjusting your filters to see more results
                </p>
                <Button
                  variant="outline"
                  className="!border-2 !border-accent text-accent hover:bg-accent/10"
                  onClick={() => {
                    setMakeFilter("all");
                    setModelFilter("all");
                    setYearFilter("all");
                    setTransmissionFilter("all");
                    setMaxPrice("");
                  }}
                  data-testid="button-reset-filters"
                >
                  Reset Filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVans.map((van) => {
                const urgencyStyle = van.urgencyBadge ? URGENCY_STYLES[van.urgencyBadge] : null;
                const UrgencyIcon = urgencyStyle?.icon;
                return (
                  <Card key={van.id} className="overflow-hidden" data-testid={`card-van-${van.id}`}>
                    {/* Van Image */}
                    <div className="aspect-video bg-muted relative">
                      {van.heroImage ? (
                        <img
                          src={van.heroImage}
                          alt={van.title}
                          className="w-full h-full object-cover"
                          data-testid={`img-van-${van.id}`}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Car className="w-20 h-20 text-muted-foreground/30" />
                        </div>
                      )}
                      {/* Size badge */}
                      <div className="absolute top-3 right-3">
                        <Badge className="bg-accent text-accent-foreground">
                          {van.specs.size}
                        </Badge>
                      </div>
                      {/* Urgency badge */}
                      {van.urgencyBadge && urgencyStyle && UrgencyIcon && van.effectiveSaleStatus === "available" && (
                        <div className="absolute top-3 left-3">
                          <Badge className={`${urgencyStyle.className} flex items-center gap-1`} data-testid={`badge-urgency-${van.id}`}>
                            <UrgencyIcon className="w-3 h-3" />
                            {van.urgencyBadge}
                          </Badge>
                        </div>
                      )}
                      {/* Sale status badge */}
                      {van.effectiveSaleStatus !== "available" && (
                        <div className="absolute top-3 left-3">
                          <Badge
                            className={
                              van.effectiveSaleStatus === "sold"
                                ? "bg-red-600 text-white border-0"
                                : "bg-amber-500 text-black border-0"
                            }
                            data-testid={`badge-sale-status-${van.id}`}
                          >
                            {van.effectiveSaleStatus === "sold" ? "Sold" : "Deposit Taken"}
                          </Badge>
                        </div>
                      )}
                    </div>

                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-xl" data-testid={`text-van-title-${van.id}`}>
                          {van.year} {van.make} {van.model}
                        </CardTitle>
                      </div>
                      <p className="text-2xl font-bold text-accent" data-testid={`text-van-price-${van.id}`}>
                        £{(van.price / 100).toLocaleString()}
                        {!van.vatIncluded && <span className="text-sm font-normal text-muted-foreground ml-1">+ VAT</span>}
                      </p>
                    </CardHeader>

                    <CardContent>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2">
                          <Gauge className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{van.mileage.toLocaleString()} miles</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Settings className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{van.specs.transmission}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Fuel className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{van.specs.fuel}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{van.year}</span>
                        </div>
                      </div>
                      {van.effectiveSaleStatus === "sold" && (
                        <p
                          className="mt-3 text-sm font-medium text-accent"
                          data-testid={`text-more-coming-${van.id}`}
                        >
                          More coming into stock — ask for details.
                        </p>
                      )}
                    </CardContent>

                    <CardFooter className="pt-0 flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 !border-2 !border-accent text-accent hover:bg-accent/10"
                        onClick={() => handleConfigureVan(van.id)}
                        data-testid={`button-configure-${van.id}`}
                      >
                        <Wrench className="w-4 h-4 mr-2" />
                        Configure
                      </Button>
                      <Button
                        asChild
                        className="flex-1 bg-accent border-accent text-accent-foreground"
                        data-testid={`button-view-van-${van.id}`}
                      >
                        <Link href={`/stock/${van.slug}`}>
                          View Details
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>
      {/* Cross-links */}
      <section className="py-12 border-t">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg mb-2">Finance Available</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Spread the cost with our flexible finance options. Use our calculator to see monthly payments.
                  </p>
                  <Button variant="outline" className="!border-2 !border-accent text-accent" asChild data-testid="link-finance-from-stock">
                    <Link href="/finance">
                      View Finance Options
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg mb-2">Build Your Own Spec</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Use our online configurator to customise your van with your choice of equipment and upgrades.
                  </p>
                  <Button variant="outline" className="!border-2 !border-accent text-accent" asChild data-testid="link-configurator-from-stock">
                    <Link href="/configurator/van">
                      Open Configurator
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-card border-t">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
              Can't Find What You're Looking For?
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground mb-8">
              We can build a custom mobile tyre van to your exact specifications. Start with our configurator or get in touch with our team.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="default" asChild className="bg-accent border-accent text-accent-foreground" data-testid="button-configure-custom">
                <Link href="/configurator/van">
                  Configure Your Van
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="!border-2 !border-accent text-accent hover:bg-accent/10" asChild data-testid="button-contact-sales">
                <Link href="/contact">
                  Contact Sales
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
