import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import { CheckCircle, Phone, Mail, MessageSquare, User } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const enquirySchema = z.object({
  name: z.string().min(2, "Please enter your full name"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(7, "Please enter a valid phone number"),
  message: z.string().min(10, "Please tell us a bit about what you're looking for"),
});

type EnquiryData = z.infer<typeof enquirySchema>;

export default function HomeEnquiryForm() {
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();
  const ref = useScrollReveal();

  const form = useForm<EnquiryData>({
    resolver: zodResolver(enquirySchema),
    defaultValues: { name: "", email: "", phone: "", message: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: EnquiryData) =>
      apiRequest("POST", "/api/leads", {
        ...data,
        source: "homepage_enquiry",
      }),
    onSuccess: () => {
      setSubmitted(true);
      trackEvent("homepage_enquiry_submitted");
    },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "Please try again or call us on 0800 000 0000.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EnquiryData) => mutation.mutate(data);

  return (
    <section ref={ref} className="scroll-reveal py-16 md:py-24 bg-background border-t">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

            <div>
              <Badge className="mb-4 bg-accent/10 text-accent border-accent/20">
                Get in Touch
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Not Ready for the Configurator?
              </h2>
              <p className="text-muted-foreground text-lg mb-8">
                No problem. Drop us a message and one of our team will get back to you to discuss your requirements and answer any questions.
              </p>

              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Call Us Direct</p>
                    <a href="tel:08000000000" className="text-muted-foreground hover:text-foreground transition-colors">
                      0800 000 0000
                    </a>
                    <p className="text-xs text-muted-foreground mt-0.5">Mon–Fri, 9am–5:30pm</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Email Us</p>
                    <a href="mailto:info@mobiletyrevans.co.uk" className="text-muted-foreground hover:text-foreground transition-colors">
                      info@mobiletyrevans.co.uk
                    </a>
                    <p className="text-xs text-muted-foreground mt-0.5">We reply within 24 hours</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Use the Form</p>
                    <p className="text-muted-foreground text-sm">Tell us what you need and we'll reach out</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              {submitted ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <CheckCircle className="w-14 h-14 text-accent mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">Message Received!</h3>
                    <p className="text-muted-foreground mb-6">
                      Thanks for getting in touch. A member of our team will contact you shortly.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => { setSubmitted(false); form.reset(); }}
                      data-testid="button-send-another"
                    >
                      Send Another Message
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-6">
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                  <Input
                                    placeholder="John Smith"
                                    className="pl-9"
                                    data-testid="input-enquiry-name"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email Address</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                      placeholder="john@example.com"
                                      type="email"
                                      className="pl-9"
                                      data-testid="input-enquiry-email"
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Phone Number</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                      placeholder="07700 900000"
                                      type="tel"
                                      className="pl-9"
                                      data-testid="input-enquiry-phone"
                                      {...field}
                                    />
                                  </div>
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
                              <FormLabel>Your Message</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Tell us what you're looking for — van size, equipment, budget, timescales, or any questions you have..."
                                  className="min-h-[120px]"
                                  data-testid="input-enquiry-message"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button
                          type="submit"
                          className="w-full bg-accent text-accent-foreground"
                          disabled={mutation.isPending}
                          data-testid="button-submit-enquiry"
                        >
                          {mutation.isPending ? "Sending..." : "Send Enquiry"}
                        </Button>

                        <p className="text-xs text-muted-foreground text-center">
                          We'll never share your details with third parties.
                        </p>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              )}
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
