import { useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { useMutation } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO, { contactPageStructuredData } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Phone, Mail, MapPin, Clock, Send } from "lucide-react";

const contactFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 characters"),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

export default function Contact() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      subject: "",
      message: "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      return apiRequest('POST', '/api/leads', data);
    },
    onSuccess: () => {
      setSubmitted(true);
      trackEvent("contact_form_submitted");
      toast({
        title: "Message Sent!",
        description: "We'll get back to you as soon as possible.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ContactFormData) => {
    submitMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Contact Us | 0800 000 0000 | UK"
        description="Contact Mobile Tyre Vans for a quote on your mobile tyre van conversion. Call us on 0800 000 0000 or visit our workshop at Unit 1, Example Business Park, Your Town, AA1 1AA."
        canonical="/contact"
        keywords="contact mobile tyre vans, mobile tyre vans phone number, mobile tyre van quote, UK van conversion contact"
        structuredData={[contactPageStructuredData]}
      />
      <Header />

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-card to-background border-b py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-4 bg-accent/10 text-accent border-accent/20">
              Get in Touch
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4" data-testid="text-contact-title">
              Contact Us
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground">
              Have questions about our mobile tyre van conversions? We're here to help you get started.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Information & Form */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Contact Info */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Phone className="w-5 h-5 text-accent" />
                      Phone
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <a href="tel:08000000000" className="text-lg font-semibold hover:text-accent transition-colors">
                      0800 000 0000
                    </a>
                    <p className="text-sm text-muted-foreground mt-1">Mon-Fri 9am-5:30pm</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="w-5 h-5 text-accent" />
                      Email
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <a href="mailto:sales@mobiletyrevans.co.uk" className="text-lg font-semibold hover:text-accent transition-colors break-all">
                      sales@mobiletyrevans.co.uk
                    </a>
                    <p className="text-sm text-muted-foreground mt-1">We reply within 24 hours</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-accent" />
                      Location
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold">Unit 1, Example Business Park</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      the North West<br />
                      AA1 1AA
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-accent" />
                      Hours
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Monday - Friday</span>
                        <span className="font-semibold">9:00 - 17:30</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Saturday</span>
                        <span className="font-semibold">Closed</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sunday</span>
                        <span className="font-semibold">Closed</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Contact Form */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Send Us a Message</CardTitle>
                    <CardDescription>
                      Fill out the form below and we'll get back to you as soon as possible
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {submitted ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                          <Send className="w-8 h-8 text-accent" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Message Sent Successfully!</h3>
                        <p className="text-muted-foreground mb-6">
                          Thank you for contacting us. We'll respond to your inquiry within 24 hours.
                        </p>
                        <Button onClick={() => setSubmitted(false)} variant="outline" className="!border-2 !border-accent text-accent hover:bg-accent/10">
                          Send Another Message
                        </Button>
                      </div>
                    ) : (
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Name</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Your name" {...field} data-testid="input-name" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Email</FormLabel>
                                  <FormControl>
                                    <Input type="email" placeholder="your.email@example.com" {...field} data-testid="input-email" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="phone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Phone</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Your phone number" {...field} data-testid="input-phone" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="subject"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Subject</FormLabel>
                                  <FormControl>
                                    <Input placeholder="What's this about?" {...field} data-testid="input-subject" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name="message"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Message</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Tell us about your project or ask any questions..." 
                                    className="min-h-32"
                                    {...field} 
                                    data-testid="input-message"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <Button 
                            type="submit" 
                            size="lg" 
                            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                            disabled={submitMutation.isPending}
                            data-testid="button-submit"
                          >
                            {submitMutation.isPending ? "Sending..." : "Send Message"}
                            <Send className="w-4 h-4 ml-2" />
                          </Button>
                        </form>
                      </Form>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Google Maps Embed */}
      <section className="py-0 border-t">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
              <MapPin className="w-5 h-5 text-accent" />
              <h2 className="text-xl font-semibold">Find Us</h2>
            </div>
            <p className="text-muted-foreground mb-4 text-sm">
              Unit 1, Example Business Park, Your Town, AA1 1AA
            </p>
            <div className="rounded-md overflow-hidden border" style={{ height: 400 }}>
              <iframe
                title="Mobile Tyre Vans — Location"
                src="https://maps.google.com/maps?q=United+Kingdom&output=embed&hl=en&z=5"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                data-testid="embed-google-maps"
              />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
