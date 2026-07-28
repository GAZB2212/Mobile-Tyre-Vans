import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ImageGallery } from "@/components/ImageGallery";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import type { Upgrade } from "@shared/schema";
import { getImageUrl } from "@/lib/utils";

interface UpgradeDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  upgrade: Upgrade;
  variants?: Upgrade[];
}

export function UpgradeDetailsModal({ 
  open, 
  onOpenChange, 
  upgrade,
  variants = []
}: UpgradeDetailsModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const formatPrice = (price: number, upgradeName?: string) => {
    const lowerName = upgradeName?.toLowerCase() || '';
    if (lowerName.includes('garage branding') || lowerName.includes('carplay')) {
      return 'POA';
    }
    
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
    }).format(price / 100);
  };

  const hasVariants = variants.length > 0;
  const allImages = upgrade.images || [];
  const currentImage = allImages[currentImageIndex];

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
  };

  const previousImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">{upgrade.name}</DialogTitle>
          </DialogHeader>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Column - Images */}
            <div className="space-y-4">
              {allImages.length > 0 ? (
                <div className="space-y-3">
                  {/* Main Image */}
                  <div 
                    className="relative aspect-square bg-muted rounded-lg overflow-hidden cursor-pointer group"
                    onClick={() => setGalleryOpen(true)}
                    data-testid="img-upgrade-detail-main"
                  >
                    <img
                      src={getImageUrl(currentImage)}
                      alt={upgrade.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-sm font-medium">
                        Click to enlarge
                      </span>
                    </div>
                  </div>

                  {/* Image Navigation */}
                  {allImages.length > 1 && (
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={previousImage}
                        data-testid="button-image-previous"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {currentImageIndex + 1} / {allImages.length}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={nextImage}
                        data-testid="button-image-next"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground">No images available</p>
                </div>
              )}

              {/* Video Section - only show if showVideo is enabled */}
              {upgrade.showVideo && (
                upgrade.videoUrl ? (
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                    {/* Check if it's a YouTube/Vimeo embed URL or uploaded video */}
                    {upgrade.videoUrl.includes('youtube.com') || upgrade.videoUrl.includes('vimeo.com') ? (
                      <iframe
                        src={upgrade.videoUrl}
                        className="w-full h-full"
                        allowFullScreen
                        title={`${upgrade.name} video`}
                      />
                    ) : (
                      <video
                        src={getImageUrl(upgrade.videoUrl)}
                        controls
                        preload="metadata"
                        className="w-full h-full"
                        data-testid="video-upgrade-detail"
                      >
                        <source src={getImageUrl(upgrade.videoUrl)} type="video/mp4" />
                        <source src={getImageUrl(upgrade.videoUrl)} type="video/webm" />
                        <source src={getImageUrl(upgrade.videoUrl)} type="video/ogg" />
                        Your browser does not support the video tag.
                      </video>
                    )}
                  </div>
                ) : (
                  <div className="aspect-video bg-muted/50 rounded-lg flex flex-col items-center justify-center border-2 border-dashed">
                    <Play className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Video coming soon</p>
                  </div>
                )
              )}
            </div>

            {/* Right Column - Details */}
            <div className="space-y-6">
              {/* Price */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Price</h3>
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {hasVariants ? (
                    <>From {formatPrice(Math.min(...variants.map(v => v.price)))}</>
                  ) : (
                    formatPrice(upgrade.price, upgrade.name)
                  )}
                </Badge>
              </div>

              {/* Description */}
              {upgrade.description && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
                  <p className="text-sm leading-relaxed">{upgrade.description}</p>
                </div>
              )}

              {/* Detailed Information */}
              {upgrade.detailedInfo && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Detailed Information</h3>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{upgrade.detailedInfo}</p>
                </div>
              )}

              {/* Variants */}
              {hasVariants && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    Available Options ({variants.length})
                  </h3>
                  <div className="space-y-2">
                    {variants.map((variant) => (
                      <div
                        key={variant.id}
                        className="p-3 rounded-lg border bg-card"
                        data-testid={`variant-option-${variant.id}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium">
                            {variant.variantName || variant.name}
                          </h4>
                          <Badge variant="secondary">
                            {formatPrice(variant.price, variant.name)}
                          </Badge>
                        </div>
                        {variant.description && (
                          <p className="text-sm text-muted-foreground">
                            {variant.description}
                          </p>
                        )}
                        {variant.images && variant.images.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {variant.images.slice(0, 3).map((img, idx) => (
                              <div
                                key={idx}
                                className="w-16 h-16 rounded overflow-hidden bg-muted"
                              >
                                <img
                                  src={getImageUrl(img)}
                                  alt={`${variant.variantName || variant.name} ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                            ))}
                            {variant.images.length > 3 && (
                              <div className="w-16 h-16 rounded bg-muted flex items-center justify-center">
                                <span className="text-xs text-muted-foreground">
                                  +{variant.images.length - 3}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Info */}
              {upgrade.allowQuantity && (
                <div>
                  <Badge variant="outline" className="text-xs">
                    Quantity Available
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full-screen Image Gallery */}
      <ImageGallery
        images={allImages}
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        title={upgrade.name}
      />
    </>
  );
}
