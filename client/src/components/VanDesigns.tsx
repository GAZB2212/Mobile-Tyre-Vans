import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import vanImage1 from "@assets/IMG_8800_1759504961672.webp";
import vanImage2 from "@assets/IMG_1129_1759504961672.webp";
import vanImage3 from "@assets/IMG_7127_1759504961672.webp";

const DESIGNS = [
  {
    title: "Professional Branding & Interior Layout",
    description: "Custom vinyl wrap designs with optimised equipment storage",
    imageSrc: vanImage1,
  },
  {
    title: "Premium Equipment Setup",
    description: "State-of-the-art tyre fitting equipment and professional workspace",
    imageSrc: vanImage2,
  },
  {
    title: "Complete Van Conversion",
    description: "Finished mobile tyre van with full branding and equipment installation",
    imageSrc: vanImage3,
  },
];

export default function VanDesigns() {
  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-accent/10 text-accent border-accent/20">
            Inspiration
          </Badge>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4" data-testid="text-designs-title">Van Gallery</h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
            Browse our collection of design concepts, build processes, and finished conversions to inspire your perfect mobile tyre van
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {DESIGNS.map((design, index) => (
            <Card
              key={index}
              className="hover-elevate overflow-hidden cursor-pointer"
              data-testid={`card-design-${index}`}
            >
              <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 relative overflow-hidden group">
                <img
                  src={design.imageSrc}
                  alt={design.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-base sm:text-lg mb-2" data-testid={`text-design-title-${index}`}>
                  {design.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                  {design.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center flex flex-wrap items-center justify-center gap-4">
          <Link href="/gallery">
            <Button size="lg" variant="default" className="bg-accent hover:bg-accent/90 text-accent-foreground" data-testid="button-view-gallery">
              Explore Full Gallery
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Link href="/van-conversions">
            <Button size="lg" variant="outline" data-testid="button-view-conversions">
              View Van Conversion Models
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
