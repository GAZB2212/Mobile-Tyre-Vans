import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import type { GalleryItem } from "@shared/schema";
import { GalleryVideoCard } from "@/components/GalleryVideoCard";

export default function Gallery() {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const { data: items = [], isLoading } = useQuery<GalleryItem[]>({
    queryKey: ['/api/gallery-items'],
  });

  const categories = Array.from(new Set(items.map(item => item.category))).sort();

  const filteredItems = activeCategory === "all"
    ? items
    : items.filter(item => item.category === activeCategory);

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Mobile Tyre Van Gallery | Conversion Portfolio & Build Photos"
        description="Explore our portfolio of completed mobile tyre van conversions. See real build photos, custom branding, and professional equipment installations from Mobile Tyre Vans."
        canonical="/gallery"
        keywords="mobile tyre van gallery, tyre van conversion photos, van conversion portfolio, mobile tyre van branding, custom van conversion UK"
        structuredData={[{
          "@context": "https://schema.org",
          "@type": "ImageGallery",
          "name": "Mobile Tyre Vans — Van Conversion Gallery",
          "description": "Portfolio of completed mobile tyre van conversions, custom vehicle branding, and professional equipment installation work by Mobile Tyre Vans.",
          "url": "https://www.mobiletyrevans.co.uk/gallery",
          "author": {
            "@type": "Organization",
            "name": "Mobile Tyre Vans"
          }
        }]}
      />
      <Header />

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-card to-background border-b py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-4 bg-accent/10 text-accent border-accent/20">
              Portfolio
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4" data-testid="text-gallery-title">
              Van Build Gallery
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground">
              Explore our collection of completed van conversions, design concepts, and build process videos. 
              Get inspired for your own mobile tyre van project.
            </p>
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      {!isLoading && categories.length > 1 && (
        <section className="border-b bg-card/50 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex flex-wrap gap-2 items-center">
              <Button
                variant={activeCategory === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCategory("all")}
                className={activeCategory === "all" ? "bg-accent border-accent text-accent-foreground" : ""}
                data-testid="filter-all"
              >
                All
                <Badge className="ml-2 bg-background/20 text-current border-0 text-xs">
                  {items.length}
                </Badge>
              </Button>
              {categories.map(category => {
                const count = items.filter(i => i.category === category).length;
                const isActive = activeCategory === category;
                return (
                  <Button
                    key={category}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveCategory(category)}
                    className={isActive ? "bg-accent border-accent text-accent-foreground" : ""}
                    data-testid={`filter-${category.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {category}
                    <Badge className="ml-2 bg-background/20 text-current border-0 text-xs">
                      {count}
                    </Badge>
                  </Button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">Loading gallery...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">No gallery items yet. Check back soon!</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">No items in this category.</p>
        </div>
      ) : (
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="columns-1 sm:columns-2 lg:columns-4 gap-6">
                {filteredItems.map((item, itemIndex) => (
                  <Card
                    key={item.id}
                    className="overflow-hidden cursor-pointer break-inside-avoid mb-6"
                    data-testid={`card-gallery-${itemIndex}`}
                  >
                    <div className="bg-gradient-to-br from-muted to-muted/50 relative overflow-hidden group min-h-[180px] flex items-stretch">
                      {item.type === 'video' ? (
                        <div className="w-full">
                          <GalleryVideoCard
                            fileUrl={item.fileUrl}
                            title={item.title}
                            storedThumbnailUrl={item.thumbnailUrl}
                          />
                        </div>
                      ) : (
                        <img
                          src={item.fileUrl}
                          alt={item.title}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `
                                <div class="flex flex-col items-center justify-center gap-3 py-12 w-full">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground/50"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                                  <span class="text-xs text-muted-foreground">Failed to load</span>
                                </div>
                              `;
                            }
                          }}
                        />
                      )}
                      {/* Category badge shown when viewing "All" */}
                      {activeCategory === "all" && (
                        <div className="absolute top-2 left-2">
                          <Badge className="bg-black/60 text-white border-0 text-xs backdrop-blur-sm">
                            {item.category}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-sm line-clamp-2" data-testid={`text-gallery-item-${itemIndex}`}>
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-br from-accent/5 to-accent/10 border-t">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready to Build Your Own?</h2>
            <p className="text-muted-foreground mb-8">
              Start configuring your perfect mobile tyre van today and join our portfolio of successful conversions
            </p>
            <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground" asChild data-testid="button-configure">
              <Link href="/configurator/van">
                Configure Your Van
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
