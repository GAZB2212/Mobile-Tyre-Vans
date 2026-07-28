import { useState } from 'react';
import PriceSummary from '../PriceSummary';

export default function PriceSummaryExample() {
  const [showVAT, setShowVAT] = useState(true);
  
  const handleRequestQuote = () => {
    console.log('Request quote triggered');
  };

  return (
    <div className="max-w-sm">
      <PriceSummary 
        basePrice={4500000} // £45,000
        kitPrice={1850000}  // £18,500
        upgradesPrice={750000} // £7,500
        showVAT={showVAT}
        onVATToggle={setShowVAT}
        onRequestQuote={handleRequestQuote}
      />
    </div>
  );
}