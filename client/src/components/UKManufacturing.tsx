import ukFlagImage from "@assets/UNION-FLAG-MAIN-scaled_90a802df-2c99-4be4-b22f-d3f679f647a7.jpg_1759236038143.webp";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export default function UKManufacturing() {
  const ref = useScrollReveal();

  return (
    <section ref={ref} className="scroll-reveal relative py-16 sm:py-24 md:py-32 lg:py-40 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${ukFlagImage})` }}
      />
      <div className="absolute inset-0 bg-black/40" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white drop-shadow-lg" data-testid="text-uk-manufacturing">
            Manufactured in the UK!
          </h2>
        </div>
      </div>
    </section>
  );
}
