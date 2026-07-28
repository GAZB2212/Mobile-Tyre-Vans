import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { getImageUrl } from "@/lib/utils";

interface ImageGalleryProps {
  images: string[];
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageGallery({ images, title, open, onOpenChange }: ImageGalleryProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Image gallery for {title}
          </DialogDescription>
        </DialogHeader>
        
        <div className="relative p-6 pt-4">
          <Carousel className="w-full">
            <CarouselContent>
              {images.map((image, index) => (
                <CarouselItem key={index}>
                  <div className="flex items-center justify-center bg-muted rounded-lg overflow-hidden aspect-video">
                    <img
                      src={getImageUrl(image)}
                      alt={`${title} - Image ${index + 1}`}
                      className="w-full h-full object-contain"
                      data-testid={`img-gallery-${index}`}
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {images.length > 1 && (
              <>
                <CarouselPrevious className="left-2" data-testid="button-gallery-prev" />
                <CarouselNext className="right-2" data-testid="button-gallery-next" />
              </>
            )}
          </Carousel>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ImageThumbnailProps {
  images: string[];
  alt: string;
  onOpenGallery: () => void;
  testId?: string;
}

export function ImageThumbnail({ images, alt, onOpenGallery, testId }: ImageThumbnailProps) {
  if (!images || images.length === 0) return null;

  return (
    <div 
      className="relative flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border cursor-pointer group"
      onClick={(e) => {
        e.stopPropagation();
        onOpenGallery();
      }}
      data-testid={testId}
    >
      <img
        src={getImageUrl(images[0])}
        alt={alt}
        className="w-full h-full object-cover"
        data-testid={`${testId}-img`}
      />
      
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <div className="text-white text-xs font-medium">
          {images.length > 1 ? `+${images.length - 1} more` : 'View'}
        </div>
      </div>
    </div>
  );
}
