import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MessageCircle, X, Send, CheckCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const chatSchema = z.object({
  name: z.string().min(2, "Please enter your name"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().optional(),
  message: z.string().min(10, "Please tell us a bit more — at least 10 characters"),
});

type ChatFormValues = z.infer<typeof chatSchema>;

export default function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const form = useForm<ChatFormValues>({
    resolver: zodResolver(chatSchema),
    defaultValues: { name: "", email: "", phone: "", message: "" },
  });

  const mutation = useMutation({
    mutationFn: async (data: ChatFormValues) => {
      return apiRequest("POST", "/api/leads", {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        message: data.message,
        source: "live_chat",
      });
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Something went wrong",
        description: "We couldn't send your message. Please call us on 0800 000 0000.",
      });
    },
  });

  const handleOpen = () => {
    setOpen(true);
    setSubmitted(false);
    form.reset();
  };

  const handleClose = () => {
    setOpen(false);
    setSubmitted(false);
    form.reset();
  };

  return (
    <div className="hidden md:block fixed bottom-5 right-5 z-[9999]">
      {/* Chat panel — absolutely positioned above the button, never occupies page space */}
      <div
        className={`absolute bottom-16 right-0 transition-all duration-300 origin-bottom-right ${
          open
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
        aria-hidden={!open}
      >
        <div className="w-80 rounded-md border border-border bg-background shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-accent px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-accent-foreground">Live Chat</p>
                <p className="text-xs text-accent-foreground/70">Mobile Tyre Vans</p>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleClose}
              className="text-accent-foreground hover:bg-white/20"
              data-testid="button-chat-close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {submitted ? (
            /* Thank-you state */
            <div className="p-6 flex flex-col items-center text-center gap-3">
              <CheckCircle className="w-10 h-10 text-accent" />
              <p className="font-semibold text-foreground">Message received!</p>
              <p className="text-sm text-muted-foreground">
                Thanks for getting in touch. We'll get back to you as soon as possible — usually within a few hours during business hours.
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="w-3 h-3" /> Or call us: 0800 000 0000
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClose}
                className="mt-1"
                data-testid="button-chat-done"
              >
                Close
              </Button>
            </div>
          ) : (
            /* Form state */
            <div className="p-4">
              <p className="text-sm text-muted-foreground mb-4">
                Send us a message and we'll get back to you as soon as we can.
              </p>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
                  className="space-y-3"
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Name *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Your name"
                            data-testid="input-chat-name"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Email *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder="your@email.com"
                            data-testid="input-chat-email"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Phone (optional)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="tel"
                            placeholder="07700 000000"
                            data-testid="input-chat-phone"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Message *</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="How can we help?"
                            className="resize-none text-sm"
                            rows={3}
                            data-testid="input-chat-message"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full bg-accent/90 text-accent-foreground hover:bg-accent"
                    disabled={mutation.isPending}
                    data-testid="button-chat-send"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {mutation.isPending ? "Sending..." : "Send Message"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Or call us: <a href="tel:08000000000" className="underline">0800 000 0000</a>
                  </p>
                </form>
              </Form>
            </div>
          )}
        </div>
      </div>

      {/* Trigger button */}
      <button
        onClick={open ? handleClose : handleOpen}
        className="w-14 h-14 rounded-full bg-accent text-accent-foreground shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 focus:outline-none"
        aria-label="Open live chat"
        data-testid="button-chat-bubble"
      >
        {open ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </button>
    </div>
  );
}
