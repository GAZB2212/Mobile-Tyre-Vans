import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useConfigurator } from "@/lib/ConfiguratorContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ConfiguratorStepper from "@/components/ConfiguratorStepper";
import { ConfiguratorSummary } from "@/components/ConfiguratorSummary";
import { ConfiguratorTutorial } from "@/components/ConfiguratorTutorial";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, ArrowLeft, Zap, Package, Info, CheckCircle, AlertCircle, AlertTriangle } from "lucide-react";
import type { Kit, Van } from "@shared/schema";

export default function SelectKit() {
  const [, setLocation] = useLocation();
  const { state, setKit } = useConfigurator();
  const [modalKit, setModalKit] = useState<Kit | null>(null);
  const [warnKit, setWarnKit] = useState<Kit | null>(null);

  const { data: allKits = [], isLoading } = useQuery<Kit[]>({
    queryKey: ['/api/kits'],
  });

  const { data: van } = useQuery<Van>({
    queryKey: ['/api/vans', state.vanId],
    queryFn: async () => {
      const res = await fetch(`/api/vans/${state.vanId}`);
      if (!res.ok) throw new Error('Failed to fetch van');
      return res.json();
    },
    enabled: !!state.vanId,
  });

  const isEuro6Van = useMemo(() => {
    if (!van?.euroStatus) return null; // null = unknown
    const s = van.euroStatus.toLowerCase();
    if (s.includes('euro 6') || s.includes('euro6')) return true;
    return false; // known non-euro-6
  }, [van]);

  // Always show all kits in their fixed sortOrder (1, 2, 3, 4)
  const kits = useMemo(() => {
    const sorted = [...allKits].sort((a, b) => a.sortOrder - b.sortOrder);
    // If no service type selected, show all kits
    if (!state.serviceType) return sorted;
    // Filter: show kit if its serviceType array includes the customer's chosen type
    return sorted.filter(kit => {
      const kitTypes: string[] = Array.isArray(kit.serviceType)
        ? kit.serviceType
        : ["car", "commercial", "hybrid"]; // fallback for legacy data
      if (kitTypes.length === 0 || kitTypes.length === 3) return true; // effectively "all"
      // Hybrid customers see car-compatible packs (they need a base car pack + commercial upgrades)
      if (state.serviceType === "hybrid") {
        return kitTypes.includes("hybrid") || kitTypes.includes("car");
      }
      return kitTypes.includes(state.serviceType!);
    });
  }, [allKits, state.serviceType]);

  // Determine if selecting this kit should trigger a warning
  const kitNeedsWarning = (kit: Kit): boolean => {
    if (isEuro6Van === null) return false; // unknown euro status — no warning
    if (isEuro6Van && !kit.euroSixCompatible) return true;  // euro 6 van, non-euro 6 kit
    if (!isEuro6Van && kit.euroSixCompatible) return true;  // non-euro 6 van, euro 6 kit
    return false;
  };

  const confirmSelectKit = (kitId: string) => {
    setKit(kitId);
    setLocation('/configurator/upgrades');
  };

  const handleSelectKit = (kit: Kit) => {
    if (kitNeedsWarning(kit)) {
      setWarnKit(kit);
      return;
    }
    confirmSelectKit(kit.id);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
    }).format(price / 100);
  };

  const openModal = (kit: Kit, e: React.MouseEvent) => {
    e.stopPropagation();
    setModalKit(kit);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <Button 
              variant="ghost" 
              onClick={() => setLocation('/configurator/service-type')}
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Service Type
            </Button>
            
            <ConfiguratorStepper currentPath="/configurator/kit" />

            <h1 className="text-3xl md:text-4xl font-bold mb-2 mt-4" data-testid="text-page-title">
              Choose Your Equipment Kit
            </h1>
            <p className="text-muted-foreground mb-4">
              Select the perfect equipment package for your mobile tyre business
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
            <div className="xl:col-span-2">
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="skeleton-kits">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex flex-col rounded-md border bg-card overflow-hidden">
                      <div className="p-6 space-y-3">
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-5 w-16 rounded" />
                          <Skeleton className="h-7 w-20 rounded" />
                        </div>
                        <Skeleton className="h-6 w-2/3 rounded" />
                        <Skeleton className="h-4 w-full rounded" />
                        <Skeleton className="h-4 w-3/4 rounded" />
                      </div>
                      <div className="p-6 pt-0 space-y-2">
                        <Skeleton className="h-3 w-full rounded" />
                        <Skeleton className="h-3 w-full rounded" />
                        <Skeleton className="h-3 w-2/3 rounded" />
                        <Skeleton className="h-9 w-full rounded mt-4" />
                        <Skeleton className="h-9 w-full rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* Euro status notice banner */}
                  {isEuro6Van !== null && van && (
                    <div className="mb-6 p-4 rounded-md flex items-start gap-3 bg-accent/10 border border-accent/20">
                      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-accent" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {isEuro6Van ? 'Your van has a Euro 6 engine' : 'Your van has a non-Euro 6 engine'}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {isEuro6Van
                            ? `Your ${van.make} ${van.model} has a Euro 6 engine. Packs marked Euro 6 are fully compatible. Selecting a non-Euro 6 pack will show a compatibility notice.`
                            : `Your ${van.make} ${van.model} has a non-Euro 6 engine. Packs not marked Euro 6 are fully compatible. Selecting a Euro 6 pack will show a compatibility notice.`
                          }
                        </p>
                      </div>
                    </div>
                  )}

                  {kits.length === 0 && (
                    <div className="py-12 text-center rounded-md border border-dashed" data-testid="empty-kits">
                      <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                      <p className="font-medium mb-1">No kits available</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        No equipment kits are currently available for your selected service type.
                      </p>
                      <Button variant="outline" size="sm" onClick={() => setLocation('/configurator/service-type')}>
                        Change Service Type
                      </Button>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="grid-kits">
                    {kits.map((kit) => {
                      const isIncompatible = kitNeedsWarning(kit);
                      return (
                        <Card 
                          key={kit.id} 
                          className={`hover-elevate cursor-pointer ${state.kitId === kit.id ? 'ring-2 ring-accent' : ''} ${isIncompatible ? 'opacity-75' : ''}`}
                          onClick={() => handleSelectKit(kit)}
                          data-testid={`card-kit-${kit.id}`}
                        >
                          <CardHeader>
                            <div className="flex items-start justify-between mb-2 gap-1 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="secondary" className="flex items-center gap-1" data-testid={`badge-kit-power-${kit.id}`}>
                                  <Zap className="w-3 h-3" />
                                  {kit.powerKw}kW
                                </Badge>
                                {kit.euroSixCompatible && (
                                  <Badge className="bg-accent/20 text-accent border-accent/30" data-testid={`badge-euro6-${kit.id}`}>
                                    Euro 6
                                  </Badge>
                                )}
                                {isIncompatible && (
                                  <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30" data-testid={`badge-incompatible-${kit.id}`}>
                                    Non Euro 6
                                  </Badge>
                                )}
                              </div>
                              <p className="text-2xl font-bold text-accent" data-testid={`text-kit-price-${kit.id}`}>
                                {formatPrice(kit.price)}
                              </p>
                            </div>
                            <CardTitle className="text-xl" data-testid={`text-kit-name-${kit.id}`}>
                              {kit.name}
                            </CardTitle>
                            <CardDescription data-testid={`text-kit-description-${kit.id}`}>
                              {kit.description}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 mb-4">
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <Package className="w-4 h-4 text-accent" />
                                <span>Includes:</span>
                              </div>
                              <ul className="space-y-1 ml-6">
                                {kit.includes.map((item, idx) => (
                                  <li key={idx} className="text-sm text-muted-foreground list-disc" data-testid={`text-kit-includes-${kit.id}-${idx}`}>
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            
                            <Button
                              type="button"
                              variant="ghost"
                              className="w-full mb-2"
                              onClick={(e) => openModal(kit, e)}
                              data-testid={`button-more-info-${kit.id}`}
                            >
                              <Info className="w-4 h-4 mr-2" />
                              More Info
                            </Button>
                            
                            <Button 
                              className={`w-full ${state.kitId === kit.id ? 'bg-accent text-accent-foreground' : '!border-2 !border-accent text-accent hover:bg-accent/10'}`}
                              variant={state.kitId === kit.id ? "default" : "outline"}
                              data-testid={`button-select-kit-${kit.id}`}
                            >
                              {state.kitId === kit.id ? 'Selected' : 'Select Kit'}
                              <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
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
      
      <ConfiguratorTutorial page="kit" />

      {/* Compatibility Warning Dialog */}
      <Dialog open={!!warnKit} onOpenChange={(open) => !open && setWarnKit(null)}>
        <DialogContent className="max-w-md" data-testid="dialog-euro6-warning">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <DialogTitle className="text-xl" data-testid="text-euro6-warning-title">
                Compatibility Notice
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground pt-1 leading-relaxed" data-testid="text-euro6-warning-description">
              {isEuro6Van
                ? <>Your selected vehicle has a <strong className="text-foreground">Euro 6 engine</strong>. The <strong className="text-foreground">{warnKit?.name}</strong> pack is not designed for Euro 6 vehicles and may not be compatible. We recommend selecting a Euro 6 compatible pack.</>
                : <>Your selected vehicle has a <strong className="text-foreground">non-Euro 6 engine</strong>. The <strong className="text-foreground">{warnKit?.name}</strong> pack is designed for Euro 6 vehicles and may not be compatible. We recommend selecting a non-Euro 6 pack.</>
              }
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 pt-2">
            <Button
              className="w-full bg-accent text-accent-foreground"
              onClick={() => setWarnKit(null)}
              data-testid="button-euro6-go-back"
            >
              Choose a Different Pack
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => {
                if (warnKit) confirmSelectKit(warnKit.id);
                setWarnKit(null);
              }}
              data-testid="button-euro6-proceed-anyway"
            >
              I know what I'm doing — proceed anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Kit Details Modal */}
      <Dialog open={!!modalKit} onOpenChange={(open) => !open && setModalKit(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {modalKit && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl" data-testid={`modal-kit-title-${modalKit.id}`}>
                  {modalKit.name}
                </DialogTitle>
                <DialogDescription data-testid={`modal-kit-subtitle-${modalKit.id}`}>
                  {modalKit.powerKw}kW • {formatPrice(modalKit.price)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Image Carousel */}
                {modalKit.images && modalKit.images.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg">Images ({modalKit.images.length})</h3>
                    <Carousel className="w-full" data-testid={`modal-carousel-${modalKit.id}`}>
                      <CarouselContent>
                        {modalKit.images.map((img, idx) => (
                          <CarouselItem key={idx}>
                            <div className="relative aspect-video overflow-hidden rounded-md border bg-muted">
                              <img 
                                src={img} 
                                alt={`${modalKit.name} - Image ${idx + 1}`}
                                className="w-full h-full object-cover"
                                data-testid={`modal-carousel-img-${modalKit.id}-${idx}`}
                                onError={(e) => {
                                  console.error(`Failed to load image: ${img}`);
                                  e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImage unavailable%3C/text%3E%3C/svg%3E';
                                }}
                              />
                            </div>
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                      {modalKit.images.length > 1 && (
                        <>
                          <CarouselPrevious className="left-2" data-testid={`modal-carousel-prev-${modalKit.id}`} />
                          <CarouselNext className="right-2" data-testid={`modal-carousel-next-${modalKit.id}`} />
                        </>
                      )}
                    </Carousel>
                  </div>
                )}

                {/* Description */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Description</h3>
                  <p className="text-muted-foreground" data-testid={`modal-kit-description-${modalKit.id}`}>
                    {modalKit.description}
                  </p>
                </div>

                {/* Full Includes List */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Package className="w-5 h-5 text-accent" />
                    Complete Equipment List
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    {modalKit.includes.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                        <span data-testid={`modal-kit-includes-${modalKit.id}-${idx}`}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Key Specifications */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">Key Specifications</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Zap className="w-4 h-4 text-accent" />
                        <span className="text-muted-foreground">Power Output:</span>
                        <span className="font-medium" data-testid={`modal-kit-power-${modalKit.id}`}>
                          {modalKit.powerKw}kW
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="pt-4 border-t">
                  <Button
                    className="w-full bg-accent text-accent-foreground"
                    onClick={() => {
                      handleSelectKit(modalKit);
                      setModalKit(null);
                    }}
                    data-testid={`modal-button-select-kit-${modalKit.id}`}
                  >
                    {state.kitId === modalKit.id ? 'Selected - Continue' : 'Select This Kit'}
                    <ArrowRight className="w-4 h-4 ml-2" />
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
