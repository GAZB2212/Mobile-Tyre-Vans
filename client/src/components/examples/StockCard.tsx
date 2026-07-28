import StockCard from '../StockCard';
import stockImage from "@assets/generated_images/Mobile_tyre_van_conversion_372a2d42.webp";

export default function StockCardExample() {
  // todo: remove mock functionality
  const mockVan = {
    id: "van-001",
    title: "Mobile Tyre Van - Ready to Go",
    make: "Ford",
    model: "Transit Custom",
    year: 2022,
    mileage: 15000,
    price: 4500000, // £45,000 in pence
    vatIncluded: false,
    imageUrl: stockImage,
    specs: {
      transmission: "Manual",
      size: "LWB",
      fuel: "Diesel"
    }
  };

  return (
    <div className="max-w-sm">
      <StockCard {...mockVan} />
    </div>
  );
}