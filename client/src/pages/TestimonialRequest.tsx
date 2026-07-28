import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Star, CheckCircle, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import SEO from "@/components/SEO";

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-1" data-testid="star-rating-picker">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          className="focus:outline-none"
          data-testid={`button-star-${i}`}
        >
          <Star
            className={`w-8 h-8 transition-colors ${
              i <= (hovered || value) ? "fill-accent text-accent" : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function TestimonialRequest() {
  const [, params] = useRoute("/testimonial/:token");
  const token = params?.token ?? "";

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(5);
  const [submitted, setSubmitted] = useState(false);

  const { data: tokenData, isLoading, isError } = useQuery<{ customerName: string; valid: boolean }>({
    queryKey: [`/api/testimonial-request/${token}`],
    enabled: !!token,
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/testimonial-request/${token}`, {
        name,
        company,
        location: location || null,
        content,
        rating,
      });
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (isError || !tokenData?.valid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SEO
          title="Invalid Link"
          description="This testimonial link is invalid or has already been used."
          noindex
        />
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold">Link not found</h2>
            <p className="text-muted-foreground">
              This testimonial link is invalid or has already been used. Please contact us if you think this is an error.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SEO
          title="Thank You"
          description="Your testimonial has been submitted."
          noindex
        />
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-accent mx-auto" />
            <h2 className="text-xl font-semibold">Thank you!</h2>
            <p className="text-muted-foreground">
              Your testimonial has been submitted and will be reviewed by our team before going live on the site.
            </p>
            <p className="text-sm text-muted-foreground">
              We really appreciate you taking the time — it makes a big difference.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <SEO
        title="Share Your Experience"
        description="Leave a testimonial for Mobile Tyre Vans."
        noindex
      />
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <img src="/favicon.png" alt="Mobile Tyre Vans" className="w-12 h-12 mx-auto" />
          <h1 className="text-2xl font-bold">Share your experience</h1>
          <p className="text-muted-foreground">
            Hi{tokenData.customerName ? ` ${tokenData.customerName}` : ""}! We'd love to hear how your van conversion went.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Leave a testimonial</CardTitle>
            <CardDescription>Your review helps others make confident decisions.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Your name <span className="text-destructive">*</span></Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. James Smith"
                    required
                    data-testid="input-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Business name <span className="text-destructive">*</span></Label>
                  <Input
                    id="company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Smith Tyres Ltd"
                    required
                    data-testid="input-company"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location (optional)</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Manchester"
                  data-testid="input-location"
                />
              </div>

              <div className="space-y-2">
                <Label>Star rating <span className="text-destructive">*</span></Label>
                <StarPicker value={rating} onChange={setRating} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Your review <span className="text-destructive">*</span></Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Tell us about your experience — the van, the build quality, the service..."
                  rows={5}
                  required
                  data-testid="input-content"
                />
              </div>

              {submitMutation.isError && (
                <p className="text-sm text-destructive" data-testid="text-submit-error">
                  Something went wrong. Please try again or contact us directly.
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={submitMutation.isPending || !name || !company || !content}
                data-testid="button-submit"
              >
                {submitMutation.isPending ? "Submitting..." : "Submit testimonial"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
