import { useState } from 'react';
import EquipmentGrid from '../EquipmentGrid';

export default function EquipmentGridExample() {
  const [selectedKit, setSelectedKit] = useState<string | null>('professional');

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Choose Your Equipment Kit</h2>
      <EquipmentGrid 
        selectedKit={selectedKit} 
        onKitSelect={setSelectedKit}
      />
    </div>
  );
}