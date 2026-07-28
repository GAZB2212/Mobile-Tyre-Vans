import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Phone } from "lucide-react";
import vanImage from "@assets/IMG_1103_1759503549443.webp";

export default function CTASection() {
  return (
    <section className="py-20 bg-black relative overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${vanImage})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/70 to-black/60" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 text-white" data-testid="text-cta-title">
            Ready to Start Your Mobile Tyre Business?
          </h2>
          <p className="text-base sm:text-lg md:text-xl mb-8 sm:mb-10 text-white/90 max-w-2xl mx-auto">
            Get a custom quote in minutes. Our team will help you choose the perfect setup for your business needs.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-primary text-white hover:bg-primary/90 font-semibold"
              data-testid="button-get-quote"
            >
              Get Your Quote
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-2 border-white text-white hover:bg-white/10 backdrop-blur-sm font-semibold"
              data-testid="button-call-now"
            >
              <Phone className="w-5 h-5 mr-2" />
              Call Now: 0800 000 0000
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
