import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star } from "lucide-react";
import type { Testimonial } from "@shared/schema";
import { createReviewStructuredData } from "@/components/SEO";

export default function Testimonials() {

  const { data: testimonials = [] } = useQuery<Testimonial[]>({
    queryKey: ["/api/testimonials"],
  });

  if (testimonials.length === 0) return null;

  const reviewSchemas = createReviewStructuredData(
    testimonials.map(t => ({
      id: t.id,
      name: t.name,
      content: t.content,
      rating: t.rating,
      company: t.company,
      location: t.location,
    }))
  );

  return (
    <section className="py-20 bg-background">
      {reviewSchemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white" data-testid="text-testimonials-title">
            What Our Customers Say
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Join hundreds of successful mobile tyre businesses across the UK
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial) => {
            const initials = testimonial.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);
            return (
              <Card key={testimonial.id} className="hover-elevate bg-card" data-testid={`card-testimonial-${testimonial.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-center mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-accent text-accent" />
                    ))}
                  </div>

                  <blockquote className="text-muted-foreground mb-6 italic">
                    "{testimonial.content}"
                  </blockquote>

                  <div className="flex items-center">
                    <Avatar className="w-10 h-10 mr-3">
                      <AvatarFallback className="bg-accent text-primary font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold text-sm" data-testid={`text-customer-name-${testimonial.id}`}>
                        {testimonial.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {testimonial.company}{testimonial.location ? `, ${testimonial.location}` : ""}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
