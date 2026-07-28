import type { SkuComponent } from '@shared/schema';

export type KitSeedEntry = {
  id: string;
  name: string;
  description: string;
  includes: string[];
  powerKw: string;
  price: number;
  published: boolean;
  sku: string;
  skuComponents?: SkuComponent[];
};

export const kitCatalog: KitSeedEntry[] = [
  {
    id: "pack-1-non-euro6-t1000",
    name: "Pack 1 - Non Euro 6 with T1000 Pro & Mini Spin",
    description: "Complete mobile tyre fitting setup with T1000 Pro tyre changer and Mini Spin wheel balancer for Non Euro 6 vehicles",
    includes: ["T1000 Pro Tyre Changer", "Mini Spin Wheel Balancer", "Air Compressor", "Basic Tool Set"],
    powerKw: "3.5",
    price: 574500,
    published: true,
    sku: "MTV-KIT-001",
    skuComponents: [
      { sku: "MTV-EQP-T1000", description: "T1000 Pro Tyre Changer", quantity: 1 },
      { sku: "MTV-EQP-MSPIN", description: "Mini Spin Wheel Balancer", quantity: 1 },
      { sku: "MTV-AIR-COMP-STD", description: "Standard Air Compressor", quantity: 1 },
      { sku: "MTV-EQP-TOOLS-STD", description: "Basic Tool Set", quantity: 1 },
    ],
  },
  {
    id: "pack-2-euro6-t1000",
    name: "Pack 2 - Euro 6 with T1000 Pro & Mini Spin",
    description: "Complete mobile tyre fitting setup with T1000 Pro tyre changer and Mini Spin wheel balancer for Euro 6 vehicles",
    includes: ["T1000 Pro Tyre Changer", "Mini Spin Wheel Balancer", "Euro 6 Compatible Air System", "Basic Tool Set"],
    powerKw: "3.5",
    price: 594500,
    published: true,
    sku: "MTV-KIT-002",
    skuComponents: [
      { sku: "MTV-EQP-T1000", description: "T1000 Pro Tyre Changer", quantity: 1 },
      { sku: "MTV-EQP-MSPIN", description: "Mini Spin Wheel Balancer", quantity: 1 },
      { sku: "MTV-AIR-COMP-E6", description: "Euro 6 Compatible Air System", quantity: 1 },
      { sku: "MTV-EQP-TOOLS-STD", description: "Basic Tool Set", quantity: 1 },
    ],
  },
  {
    id: "pack-3-non-euro6-t2000",
    name: "Pack 3 - Non Euro 6 with T2000 Pro & Mini Spin",
    description: "Advanced mobile tyre fitting setup with T2000 Pro tyre changer and Mini Spin wheel balancer for Non Euro 6 vehicles",
    includes: ["T2000 Pro Tyre Changer", "Mini Spin Wheel Balancer", "High-Capacity Air Compressor", "Professional Tool Set"],
    powerKw: "5.0",
    price: 644500,
    published: true,
    sku: "MTV-KIT-003",
    skuComponents: [
      { sku: "MTV-EQP-T2000", description: "T2000 Pro Tyre Changer", quantity: 1 },
      { sku: "MTV-EQP-MSPIN", description: "Mini Spin Wheel Balancer", quantity: 1 },
      { sku: "MTV-AIR-COMP-HC", description: "High-Capacity Air Compressor", quantity: 1 },
      { sku: "MTV-EQP-TOOLS-PRO", description: "Professional Tool Set", quantity: 1 },
    ],
  },
  {
    id: "pack-4-euro6-t2000",
    name: "Pack 4 - Euro 6 with T2000 Pro & Mini Spin",
    description: "Premium mobile tyre fitting setup with T2000 Pro tyre changer and Mini Spin wheel balancer for Euro 6 vehicles",
    includes: ["T2000 Pro Tyre Changer", "Mini Spin Wheel Balancer", "Euro 6 Compatible High-Capacity Air System", "Professional Tool Set"],
    powerKw: "5.0",
    price: 664500,
    published: true,
    sku: "MTV-KIT-004",
    skuComponents: [
      { sku: "MTV-EQP-T2000", description: "T2000 Pro Tyre Changer", quantity: 1 },
      { sku: "MTV-EQP-MSPIN", description: "Mini Spin Wheel Balancer", quantity: 1 },
      { sku: "MTV-AIR-COMP-HCE6", description: "Euro 6 Compatible High-Capacity Air System", quantity: 1 },
      { sku: "MTV-EQP-TOOLS-PRO", description: "Professional Tool Set", quantity: 1 },
    ],
  },
];
