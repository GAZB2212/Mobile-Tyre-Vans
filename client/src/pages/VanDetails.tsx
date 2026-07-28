import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Car, Fuel, Gauge, Settings, Calendar, CheckCircle, Phone, Mail, Wrench } from "lucide-react";
import { useConfigurator } from "@/lib/ConfiguratorContext";
import SEO, { createVehicleStructuredData, createBreadcrumbStructuredData } from "@/components/SEO";
import type { VanWithSaleStatus } from "@shared/schema";

export default function VanDetails() {
  const [, params] = useRoute("/stock/:slug");
  const slug = params?.slug;
  const [, setLocation] = useLocation();
  const { setVan } = useConfigurator();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { data: van, isLoading, error } = useQuery<VanWithSaleStatus>({
    queryKey: ['/api/vans/slug', slug],
    queryFn: async () => {
      const response = await fetch(`/api/vans/slug/${slug}`);
      if (!response.ok) {
        throw new Error('Van not found');
      }
      return response.json();
    },
    enabled: !!slug,
  });

  const handleConfigureVan = () => {
    setShowConfirmDialog(true);
  };

  const confirmSelectVan = () => {
    if (van) {
      setVan(van.id);
      setLocation('/configurator/service-type');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading van details...</p>
        </div>
      </div>
    );
  }

  if (error || !van) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="py-12 text-center">
            <Car className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Van Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The van you're looking for doesn't exist or has been sold.
            </p>
            <Button asChild variant="default" className="bg-accent border-accent text-accent-foreground">
              <Link href="/stock">Browse All Vans</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const breadcrumbs = createBreadcrumbStructuredData([
    { name: 'Home', url: '/' },
    { name: 'Stock', url: '/stock' },
    { name: van.title, url: `/stock/${van.slug}` }
  ]);

  const vehicleData = createVehicleStructuredData({
    make: van.make,
    model: van.model,
    year: van.year,
    price: van.price,
    mileage: van.mileage,
    slug: van.slug,
    heroImage: van.heroImage,
    images: van.images,
    specs: van.specs,
    description: van.description || undefined,
  });

  const vanTitle = `${van.year} ${van.make} ${van.model}`;
  const vanDescription = `For sale: ${vanTitle}. A fully equipped mobile tyre van conversion${van.mileage ? ` with ${van.mileage.toLocaleString()} miles` : ''}. ${van.specs?.transmission || ''}, ${van.specs?.fuel || ''}. Finance available. Enquire now!`;

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title={`${vanTitle} - Mobile Tyre Van`}
        description={vanDescription}
        canonical={`/stock/${van.slug}`}
        ogType="product"
        ogImage={van.heroImage || van.images[0]}
        structuredData={[breadcrumbs, vehicleData]}
      />
      {/* Header */}
      <section className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link href="/stock" data-testid="link-back-to-stock">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Stock
            </Link>
          </Button>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Images and Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Main Image */}
              <div className="aspect-video bg-muted rounded-md overflow-hidden">
                {(() => {
                  const allImages = van.heroImage ? [van.heroImage, ...van.images] : van.images;
                  const currentImage = allImages[selectedImageIndex];
                  
                  return currentImage ? (
                    <img
                      src={currentImage}
                      alt={`${van.title} - Image ${selectedImageIndex + 1}`}
                      className="w-full h-full object-cover"
                      data-testid="img-van-main"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Car className="w-32 h-32 text-muted-foreground/30" />
                    </div>
                  );
                })()}
              </div>

              {/* Image Gallery Thumbnails */}
              {(() => {
                const allImages = van.heroImage ? [van.heroImage, ...van.images] : van.images;
                if (allImages.length > 1) {
                  return (
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
                      {allImages.map((image, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedImageIndex(index)}
                          className={`aspect-video bg-muted rounded-md overflow-hidden hover-elevate transition-all ${
                            selectedImageIndex === index ? 'ring-2 ring-accent' : ''
                          }`}
                          data-testid={`button-thumbnail-${index}`}
                        >
                          <img
                            src={image}
                            alt={`${van.title} thumbnail ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  );
                }
                return null;
              })()}

              {/* Van Title and Key Info */}
              <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    {van.effectiveSaleStatus !== "available" && (
                      <Badge
                        className={
                          van.effectiveSaleStatus === "sold"
                            ? "bg-red-600 text-white border-0 mb-2"
                            : "bg-amber-500 text-black border-0 mb-2"
                        }
                        data-testid="badge-sale-status"
                      >
                        {van.effectiveSaleStatus === "sold" ? "Sold" : "Deposit Taken"}
                      </Badge>
                    )}
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2 break-words" data-testid="text-van-title">
                      {van.year} {van.make} {van.model}
                    </h1>
                    <p className="text-base sm:text-lg text-muted-foreground">{van.title}</p>
                    {van.effectiveSaleStatus === "sold" && (
                      <p className="mt-2 text-base font-medium text-accent" data-testid="text-more-coming">
                        More coming into stock — ask for details.
                      </p>
                    )}
                  </div>
                  <Badge className="bg-accent text-accent-foreground text-sm">
                    {van.specs.size}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-card rounded-md border">
                  <div className="flex items-center gap-3">
                    <Gauge className="w-5 h-5 text-accent flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Mileage</p>
                      <p className="text-sm sm:text-base font-semibold truncate" data-testid="text-van-mileage">{van.mileage.toLocaleString()} miles</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-accent flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Transmission</p>
                      <p className="text-sm sm:text-base font-semibold truncate">{van.specs.transmission}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Fuel className="w-5 h-5 text-accent flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Fuel Type</p>
                      <p className="text-sm sm:text-base font-semibold truncate">{van.specs.fuel}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-accent flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Year</p>
                      <p className="text-sm sm:text-base font-semibold">{van.year}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Specifications */}
              <Card>
                <CardHeader>
                  <CardTitle>Vehicle Specifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Make</span>
                      <span className="font-medium">{van.make}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Model</span>
                      <span className="font-medium">{van.model}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Year</span>
                      <span className="font-medium">{van.year}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Mileage</span>
                      <span className="font-medium">{van.mileage.toLocaleString()} miles</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Transmission</span>
                      <span className="font-medium">{van.specs.transmission}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Fuel Type</span>
                      <span className="font-medium">{van.specs.fuel}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Size</span>
                      <span className="font-medium">{van.specs.size}</span>
                    </div>
                    {van.specs.doors && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Doors</span>
                        <span className="font-medium">{van.specs.doors}</span>
                      </div>
                    )}
                    {van.specs.engine && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">Engine</span>
                        <span className="font-medium">{van.specs.engine}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Features */}
              <Card>
                <CardHeader>
                  <CardTitle>Standard Features</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-accent" />
                      <span>Professional conversion</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-accent" />
                      <span>MOT tested</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-accent" />
                      <span>Service history</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-accent" />
                      <span>Ready for immediate use</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-accent" />
                      <span>UK-built quality</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-accent" />
                      <span>Warranty included</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Price and Contact */}
            <div className="lg:col-span-1">
              <div className="lg:sticky lg:top-4 space-y-4">
                {/* Price Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm text-muted-foreground">Price</CardTitle>
                    <div className="mt-2">
                      <p className="text-4xl font-bold text-accent" data-testid="text-van-price">
                        £{(van.price / 100).toLocaleString()}
                      </p>
                      {!van.vatIncluded && (
                        <p className="text-sm text-muted-foreground mt-1">+ VAT</p>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      size="lg"
                      className="w-full bg-accent border-accent text-accent-foreground"
                      onClick={handleConfigureVan}
                      data-testid="button-configure-van"
                    >
                      <Wrench className="w-4 h-4 mr-2" />
                      Configure This Van
                    </Button>
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="w-full !border-2 !border-accent text-accent hover:bg-accent/10"
                      data-testid="button-enquire"
                    >
                      <Link href="/contact">
                        Enquire Now
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                {/* Contact Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Need Help?</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-card/50 rounded-md border">
                      <Phone className="w-5 h-5 text-accent" />
                      <div>
                        <p className="text-sm text-muted-foreground">Call us</p>
                        <p className="font-medium">0800 000 0000</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-card/50 rounded-md border">
                      <Mail className="w-5 h-5 text-accent" />
                      <div>
                        <p className="text-sm text-muted-foreground">Email us</p>
                        <p className="font-medium">info@mobiletyrevans.co.uk</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Finance Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Finance Available</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      Flexible finance options available from our FCA-authorized partners.
                    </p>
                    <Button
                      asChild
                      variant="outline"
                      className="w-full !border-2 !border-accent text-accent hover:bg-accent/10"
                      data-testid="button-finance"
                    >
                      <Link href="/finance">
                        View Finance Options
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Related Vans */}
      <section className="py-12 bg-card border-t">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-4">
              Interested in a Custom Build?
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground mb-6">
              Our configurator lets you design your perfect mobile tyre van with your choice of equipment and upgrades.
            </p>
            <Button size="lg" asChild className="bg-accent border-accent text-accent-foreground" data-testid="button-start-configurator">
              <Link href="/configurator/van">
                Start Configurator
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Van Selection Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Van Selection</AlertDialogTitle>
            <AlertDialogDescription>
              {van && (
                <>
                  Do you want to select this <strong>{van.year} {van.make} {van.model}</strong> and proceed to the next step?
                  <br /><br />
                  You'll be able to choose your equipment kit and upgrades next.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-select-van">
              No, Go Back
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSelectVan}
              data-testid="button-confirm-select-van"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              Yes, Select This Van
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
