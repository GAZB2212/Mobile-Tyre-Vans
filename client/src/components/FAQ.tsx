import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export default function FAQ() {
  const ref = useScrollReveal();

  const faqs = [
    {
      question: "How long does a van conversion take?",
      answer: "Build times can vary depending on how busy we are. Generally, you're looking at around 6–9 weeks from order confirmation. We'll give you a more accurate timeline based on your specific requirements and our current workload at the time of booking."
    },
    {
      question: "Do you offer finance options?",
      answer: "Yes, we offer various finance packages including hire purchase, lease purchase, and business loans. Our team can help you find the most suitable option for your business needs."
    },
    {
      question: "What warranty do you provide?",
      answer: "All our conversions come with a 12-month warranty covering workmanship and equipment. Some of our equipment also benefits from a 10-year manufacturer's warranty. Speak to one of the team to find out more about what's covered with your specific build."
    },
    {
      question: "Can I use my existing van?",
      answer: "Yes, you can! The main requirement is that your van must be a high top model, so you can comfortably stand up in the rear living area. Ideally, it should also be a long or medium wheelbase van to give you enough space for the conversion. We'll confirm your van's suitability during consultation."
    },
    {
      question: "Do you provide training?",
      answer: "Yes, we include basic equipment training with every conversion. We also offer extended training programs to help you maximize your business potential. Our comprehensive training package is currently being put together and will be available soon."
    },
    {
      question: "What ongoing support do you offer?",
      answer: "We provide ongoing technical support, maintenance services, and can supply spare parts. Our team is always available to help ensure your business runs smoothly."
    }
  ];

  return (
    <section ref={ref} className="scroll-reveal py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white" data-testid="text-faq-title">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-muted-foreground">
              Common questions about our mobile tyre van conversions
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border border-accent/20 rounded-2xl px-6 hover-elevate"
                data-testid={`faq-item-${index}`}
              >
                <AccordionTrigger className="text-left font-semibold py-6 hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-6">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
