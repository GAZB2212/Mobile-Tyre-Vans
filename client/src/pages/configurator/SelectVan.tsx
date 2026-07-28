import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useConfigurator } from "@/lib/ConfiguratorContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ConfiguratorStepper from "@/components/ConfiguratorStepper";
import { ConfiguratorSummary } from "@/components/ConfiguratorSummary";
import { ConfiguratorTutorial } from "@/components/ConfiguratorTutorial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, ArrowDown, Car, Fuel, Gauge, Settings, Info, SlidersHorizontal, X, Truck } from "lucide-react";
import type { Van } from "@shared/schema";

export default function SelectVan() {
  const [, setLocation] = useLocation();
  const { state, setVan, setVanReg } = useConfigurator();
  const [modalVan, setModalVan] = useState<Van | null>(null);
  const [filterMake, setFilterMake] = useState<string>("all");
  const [filterModel, setFilterModel] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterFuel, setFilterFuel] = useState<string>("all");

  // Own van form state
  const [ownVanReg, setOwnVanReg] = useState<string>("");

  const { data: allVans = [], isLoading } = useQuery<Van[]>({
    queryKey: ['/api/vans'],
  });
  
  // Extract unique filter options
  const filterOptions = useMemo(() => {
    const makes = Array.from(new Set(allVans.map(v => v.make))).sort();
    const models = Array.from(new Set(allVans.map(v => v.model))).sort();
    const years = Array.from(new Set(allVans.map(v => v.year))).sort((a, b) => b - a);
    const fuels = Array.from(new Set(allVans.map(v => v.specs.fuel).filter(Boolean))).sort();
    
    return { makes, models, years, fuels };
  }, [allVans]);
  
  // Apply filters
  const vans = useMemo(() => {
    return allVans.filter(van => {
      if (filterMake !== "all" && van.make !== filterMake) return false;
      if (filterModel !== "all" && van.model !== filterModel) return false;
      if (filterYear !== "all" && van.year.toString() !== filterYear) return false;
      if (filterFuel !== "all" && van.specs.fuel !== filterFuel) return false;
      return true;
    });
  }, [allVans, filterMake, filterModel, filterYear, filterFuel]);
  
  const clearFilters = () => {
    setFilterMake("all");
    setFilterModel("all");
    setFilterYear("all");
    setFilterFuel("all");
  };
  
  const hasActiveFilters = filterMake !== "all" || filterModel !== "all" || filterYear !== "all" || filterFuel !== "all";

  const handleSelectVan = (vanId: string) => {
    setVan(vanId);
    setLocation('/configurator/service-type');
  };

  const handleOwnVan = () => {
    setVan(null);
    setVanReg(ownVanReg.trim().toUpperCase() || null);
    setLocation('/configurator/service-type');
  };

  const openModal = (van: Van, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setModalVan(van);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
    }).format(price / 100);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <ConfiguratorStepper currentPath="/configurator/van" />

          <div className="mb-8">
            <div className="flex items-start justify-between gap-4 mb-2">
              <h1 className="text-3xl md:text-4xl font-bold" data-testid="text-page-title">
                Select Your Van
              </h1>
            </div>
            <p className="text-muted-foreground mb-5">
              Browse our ready-to-convert stock below and select the van you'd like built around — or if you already have your own van, scroll down to enter your details.
            </p>

            {/* Two-path signpost */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-3 rounded-md border bg-card p-4">
                <Truck className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Browse our stock</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Choose from our range of quality vans — all ready to be converted.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="flex items-start gap-3 rounded-md border bg-card p-4 text-left hover-elevate"
                onClick={() => document.getElementById('own-van-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                data-testid="button-scroll-to-own-van"
              >
                <Car className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">I already have a van</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Enter your reg at the bottom of this page.
                  </p>
                </div>
                <ArrowDown className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0 ml-auto" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
            <div className="xl:col-span-2">
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6" data-testid="skeleton-vans">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex flex-col rounded-md border bg-card overflow-hidden">
                      <Skeleton className="w-full h-36 rounded-none" />
                      <div className="p-4 space-y-2 flex-1">
                        <Skeleton className="h-4 w-16 rounded" />
                        <Skeleton className="h-5 w-3/4 rounded" />
                        <Skeleton className="h-5 w-1/2 rounded" />
                        <Skeleton className="h-3 w-full rounded mt-2" />
                        <Skeleton className="h-3 w-full rounded" />
                        <Skeleton className="h-3 w-2/3 rounded" />
                      </div>
                      <div className="p-4 pt-0 space-y-2">
                        <Skeleton className="h-8 w-full rounded" />
                        <Skeleton className="h-8 w-full rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* Filters */}
                  <Card className="mb-6" data-testid="filter-container">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <SlidersHorizontal className="w-5 h-5 text-accent" />
                          <CardTitle className="text-lg">Filter Vans</CardTitle>
                        </div>
                        {hasActiveFilters && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearFilters}
                            data-testid="button-clear-filters"
                          >
                            <X className="w-4 h-4 mr-1" />
                            Clear Filters
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Make</label>
                          <Select value={filterMake} onValueChange={setFilterMake}>
                            <SelectTrigger data-testid="select-filter-make">
                              <SelectValue placeholder="All Makes" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Makes</SelectItem>
                              {filterOptions.makes.map((make) => (
                                <SelectItem key={make} value={make}>
                                  {make}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Model</label>
                          <Select value={filterModel} onValueChange={setFilterModel}>
                            <SelectTrigger data-testid="select-filter-model">
                              <SelectValue placeholder="All Models" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Models</SelectItem>
                              {filterOptions.models.map((model) => (
                                <SelectItem key={model} value={model}>
                                  {model}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Year</label>
                          <Select value={filterYear} onValueChange={setFilterYear}>
                            <SelectTrigger data-testid="select-filter-year">
                              <SelectValue placeholder="All Years" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Years</SelectItem>
                              {filterOptions.years.map((year) => (
                                <SelectItem key={year} value={year.toString()}>
                                  {year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Fuel Type</label>
                          <Select value={filterFuel} onValueChange={setFilterFuel}>
                            <SelectTrigger data-testid="select-filter-fuel">
                              <SelectValue placeholder="All Fuel Types" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Fuel Types</SelectItem>
                              {filterOptions.fuels.map((fuel) => (
                                <SelectItem key={fuel} value={fuel}>
                                  {fuel}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="mt-4 text-sm text-muted-foreground">
                        Showing {vans.length} of {allVans.length} vans
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6" data-testid="grid-vans">
                    {vans.length === 0 ? (
                      <div className="col-span-full text-center py-12">
                        <p className="text-muted-foreground text-lg">
                          No vans match your filters. Try adjusting your selection.
                        </p>
                      </div>
                    ) : (
                      vans.map((van) => {
                      const firstImage = van.heroImage || van.images?.[0];
                      const isSelected = state.vanId === van.id;
                      
                      return (
                        <Card 
                          key={van.id} 
                          className={`hover-elevate cursor-pointer overflow-visible flex flex-col group ${isSelected ? 'ring-2 ring-accent shadow-[0_0_12px_2px_hsl(var(--accent)/0.35)]' : ''}`}
                          onClick={() => setLocation(`/stock/${van.slug}`)}
                          data-testid={`card-van-${van.id}`}
                        >
                          {/* Van Image */}
                          {firstImage && (
                            <div className="relative w-full h-36 overflow-hidden rounded-t-md">
                              <img 
                                src={firstImage} 
                                alt={`${van.make} ${van.model}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                data-testid={`img-van-${van.id}`}
                              />
                              {/* Spec hover overlay */}
                              <div className="absolute bottom-0 left-0 right-0 invisible group-hover:visible bg-black/70 backdrop-blur-sm px-2 py-1.5 flex gap-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 text-white text-[10px] font-medium bg-white/15 rounded px-1.5 py-0.5">
                                  <Gauge className="w-3 h-3" />
                                  {van.mileage.toLocaleString()}mi
                                </span>
                                <span className="inline-flex items-center gap-1 text-white text-[10px] font-medium bg-white/15 rounded px-1.5 py-0.5">
                                  <Fuel className="w-3 h-3" />
                                  {van.specs.fuel}
                                </span>
                                <span className="inline-flex items-center gap-1 text-white text-[10px] font-medium bg-white/15 rounded px-1.5 py-0.5">
                                  {van.year}
                                </span>
                              </div>
                            </div>
                          )}

                          <CardHeader className="space-y-0 pb-3 pt-3">
                            <div className="flex items-center justify-between gap-1.5 mb-1">
                              <Badge variant="secondary" className="text-xs" data-testid={`badge-van-year-${van.id}`}>
                                {van.year}
                              </Badge>
                              {van.reg && (
                                <Badge variant="outline" className="text-xs font-mono font-semibold uppercase tracking-wide" data-testid={`badge-van-reg-${van.id}`}>
                                  {van.reg}
                                </Badge>
                              )}
                            </div>
                            <CardTitle className="text-base leading-tight mb-1" data-testid={`text-van-title-${van.id}`}>
                              {van.make} {van.model}
                            </CardTitle>
                            <p className="text-xl font-bold text-accent" data-testid={`text-van-price-${van.id}`}>
                              {formatPrice(van.price)}
                            </p>
                          </CardHeader>
                          
                          <CardContent className="pt-0 pb-3 flex-1 flex flex-col">
                            <div className="space-y-1.5 mb-3 flex-1">
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Gauge className="w-3.5 h-3.5" />
                                <span data-testid={`text-van-mileage-${van.id}`}>
                                  {van.mileage.toLocaleString()} miles
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Settings className="w-3.5 h-3.5" />
                                <span data-testid={`text-van-transmission-${van.id}`}>
                                  {van.specs.transmission}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Fuel className="w-3.5 h-3.5" />
                                <span data-testid={`text-van-fuel-${van.id}`}>
                                  {van.specs.fuel}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Car className="w-3.5 h-3.5" />
                                <span data-testid={`text-van-size-${van.id}`}>
                                  {van.specs.size}
                                </span>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="space-y-2">
                              {(van.heroImage || (van.images && van.images.length > 0) || van.description) && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="w-full"
                                  onClick={(e) => openModal(van, e)}
                                  data-testid={`button-more-info-${van.id}`}
                                >
                                  <Info className="w-3.5 h-3.5 mr-1.5" />
                                  More Info
                                </Button>
                              )}
                              
                              <Button 
                                size="sm"
                                className={`w-full ${state.vanId === van.id ? 'bg-accent text-accent-foreground' : '!border-2 !border-accent text-accent hover:bg-accent/10'}`}
                                variant={state.vanId === van.id ? "default" : "outline"}
                                onClick={(e) => { e.stopPropagation(); handleSelectVan(van.id); }}
                                data-testid={`button-select-van-${van.id}`}
                              >
                                {state.vanId === van.id ? 'Selected' : 'Select Van'}
                                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    }))}
                  </div>

                  {/* Own van section */}
                  <div id="own-van-section" className="mt-8">
                    <Card className="border-dashed">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <Car className="w-5 h-5 text-muted-foreground" />
                          <CardTitle className="text-lg">Already have your own van?</CardTitle>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Already have your own vehicle? Enter your registration below and we'll build a package around it.
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="mb-4 max-w-sm">
                          <div className="space-y-1.5">
                            <Label htmlFor="own-van-reg">Registration Plate (optional)</Label>
                            <Input
                              id="own-van-reg"
                              placeholder="e.g. AB12 CDE"
                              value={ownVanReg}
                              onChange={(e) => setOwnVanReg(e.target.value.toUpperCase())}
                              data-testid="input-own-van-reg"
                            />
                          </div>
                        </div>
                        <Button
                          size="lg"
                          className="w-full sm:w-auto bg-accent text-accent-foreground"
                          onClick={handleOwnVan}
                          data-testid="button-continue-own-van"
                        >
                          Continue with My Own Van
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </div>

            <div className="xl:col-span-1">
              <ConfiguratorSummary />
            </div>
          </div>
        </div>
      </div>

      <Footer />
      
      <ConfiguratorTutorial page="van" />

      {/* Van Details Modal */}
      <Dialog open={!!modalVan} onOpenChange={(open) => !open && setModalVan(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {modalVan && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl" data-testid={`modal-van-title-${modalVan.id}`}>
                  {modalVan.make} {modalVan.model}
                </DialogTitle>
                <DialogDescription data-testid={`modal-van-subtitle-${modalVan.id}`}>
                  {modalVan.year} • {formatPrice(modalVan.price)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Image Carousel */}
                {(() => {
                  // Combine heroImage and images array
                  const allImages = [];
                  if (modalVan.heroImage) allImages.push(modalVan.heroImage);
                  if (modalVan.images && modalVan.images.length > 0) {
                    allImages.push(...modalVan.images.filter(img => img !== modalVan.heroImage));
                  }
                  
                  return allImages.length > 0 ? (
                    <div className="space-y-3">
                      <h2 className="font-semibold text-lg">Images ({allImages.length})</h2>
                      <Carousel className="w-full" data-testid={`modal-carousel-${modalVan.id}`}>
                        <CarouselContent>
                          {allImages.map((img, idx) => (
                            <CarouselItem key={idx}>
                              <div className="relative aspect-video overflow-hidden rounded-md border bg-muted">
                                <img 
                                  src={img} 
                                  alt={`${modalVan.make} ${modalVan.model} - Image ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                  data-testid={`modal-carousel-img-${modalVan.id}-${idx}`}
                                  onError={(e) => {
                                    console.error(`Failed to load image: ${img}`);
                                    e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImage unavailable%3C/text%3E%3C/svg%3E';
                                  }}
                                />
                              </div>
                            </CarouselItem>
                          ))}
                        </CarouselContent>
                        {allImages.length > 1 && (
                          <>
                            <CarouselPrevious className="left-2" data-testid={`modal-carousel-prev-${modalVan.id}`} />
                            <CarouselNext className="right-2" data-testid={`modal-carousel-next-${modalVan.id}`} />
                          </>
                        )}
                      </Carousel>
                    </div>
                  ) : null;
                })()}

                {/* Full Specifications */}
                <div className="space-y-3">
                  <h2 className="font-semibold text-lg">Specifications</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Gauge className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Mileage:</span>
                        <span className="font-medium" data-testid={`modal-mileage-${modalVan.id}`}>
                          {modalVan.mileage.toLocaleString()} miles
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Settings className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Transmission:</span>
                        <span className="font-medium" data-testid={`modal-transmission-${modalVan.id}`}>
                          {modalVan.specs.transmission}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Fuel className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Fuel:</span>
                        <span className="font-medium" data-testid={`modal-fuel-${modalVan.id}`}>
                          {modalVan.specs.fuel}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Car className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Size:</span>
                        <span className="font-medium" data-testid={`modal-size-${modalVan.id}`}>
                          {modalVan.specs.size}
                        </span>
                      </div>
                      {modalVan.specs.engine && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Engine:</span>
                          <span className="font-medium" data-testid={`modal-engine-${modalVan.id}`}>
                            {modalVan.specs.engine}
                          </span>
                        </div>
                      )}
                      {modalVan.specs.doors && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Doors:</span>
                          <span className="font-medium" data-testid={`modal-doors-${modalVan.id}`}>
                            {modalVan.specs.doors}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                {modalVan.description && (
                  <div className="space-y-3">
                    <h2 className="font-semibold text-lg">Description</h2>
                    <p 
                      className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed"
                      data-testid={`modal-description-${modalVan.id}`}
                    >
                      {modalVan.description}
                    </p>
                  </div>
                )}

                {/* Action Button */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button 
                    className="flex-1"
                    onClick={() => {
                      handleSelectVan(modalVan.id);
                      setModalVan(null);
                    }}
                    data-testid={`modal-button-select-${modalVan.id}`}
                  >
                    Select This Van
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button 
                    variant="outline"
                    className="!border-2 !border-accent text-accent hover:bg-accent/10"
                    onClick={() => setModalVan(null)}
                    data-testid={`modal-button-close-${modalVan.id}`}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
