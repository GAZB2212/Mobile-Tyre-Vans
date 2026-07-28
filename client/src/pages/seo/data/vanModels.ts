export interface VanModelFaq {
  q: string;
  a: string;
}

export interface VanModel {
  slug: string;
  displayName: string;
  make: string;
  model: string;
  roofSpec: "L3H3" | "L3H3/H4";
  tagline: string;
  overview: string;
  loadVolumeCubicM: number;
  payloadKg: number;
  cargoLengthMm: number;
  floorWidthMm: number;
  internalHeightMm: number;
  euroSix: boolean;
  platform: string;
  whyItWorks: string[];
  popularKits: string[];
  faqs: VanModelFaq[];
}

export const vanModels: VanModel[] = [
  {
    slug: "ford-transit",
    displayName: "Ford Transit L3H3",
    make: "Ford",
    model: "Transit",
    roofSpec: "L3H3",
    tagline: "Britain's best-selling van — the natural choice for mobile tyre fitting",
    overview:
      "The Ford Transit L3H3 is the UK's most popular large panel van and for good reason. Its long wheelbase and high roof give you 11.8 m³ of useable cargo space — enough to house a full tyre changer, wheel balancer, compressor, and a generous stock of tyres. Parts, servicing, and bodywork repairs are the easiest in the industry, and residual values remain strong. A huge proportion of our completed mobile tyre van builds use the Transit as their base, which means our racking, equipment mounting, and cable layouts are optimised specifically for its interior.",
    loadVolumeCubicM: 11.8,
    payloadKg: 1389,
    cargoLengthMm: 3621,
    floorWidthMm: 1795,
    internalHeightMm: 1882,
    euroSix: true,
    platform: "Ford Transit (sixth generation)",
    whyItWorks: [
      "11.8 m³ load space comfortably fits tyre changer, balancer, compressor, and stock",
      "1,389 kg payload handles the weight of professional tyre equipment with ease",
      "Lowest cost of ownership and widest dealer network of any UK van",
      "Strong residual values protect your asset",
      "Ford's Transit Custom shares many parts — useful if you also run a smaller fleet van",
      "Our racking system is purpose-built for the Transit's 1,795 mm floor width",
    ],
    popularKits: [
      "Standard Mobile Tyre Kit (T1000 tyre changer + Mini Spin balancer)",
      "Pro Mobile Tyre Kit (T2000 Pro tyre changer + Pro balancer)",
    ],
    faqs: [
      {
        q: "Which Ford Transit variant do you use for mobile tyre van conversions?",
        a: "We build exclusively on the Ford Transit L3H3 (long wheelbase, high roof). This gives the 11.8 m³ cargo space needed to fit professional tyre equipment plus a working tyre stock. We do not convert the Transit Custom or SWB variants as they lack sufficient internal height for a standing work environment.",
      },
      {
        q: "Is the Ford Transit L3H3 Euro 6 compliant?",
        a: "Yes. All current Ford Transit vans are Euro 6 (or Euro 6d) compliant, meaning they are eligible to enter Clean Air Zones (CAZs) and Ultra Low Emission Zones (ULEZs) without a daily charge. This is essential for mobile tyre fitters working in or around major UK cities.",
      },
      {
        q: "Can I supply my own Ford Transit for conversion?",
        a: "Absolutely. We accept customer-supplied vehicles for conversion. We recommend the Transit be no older than a 2018 plate and have full service history. Before committing to a conversion, bring it to our UK workshop so our team can inspect it and confirm it is suitable.",
      },
      {
        q: "How long does it take to convert a Ford Transit into a mobile tyre van?",
        a: "A standard Transit conversion takes 5–8 working days depending on the kit specification and any additional upgrades (branding, CCTV, lighting, etc.). We will confirm a build slot and completion date when you place your order.",
      },
    ],
  },
  {
    slug: "mercedes-sprinter",
    displayName: "Mercedes-Benz Sprinter L3H3",
    make: "Mercedes-Benz",
    model: "Sprinter",
    roofSpec: "L3H3",
    tagline: "Premium build quality and the largest dealer-supported van in the UK",
    overview:
      "The Mercedes-Benz Sprinter L3H3 is the premium choice for operators who want a van that commands respect on the road and holds its value exceptionally well. With 12.0 m³ of cargo space and a payload of up to 1,400 kg, the Sprinter is the most spacious van in its class before you reach the extra-high roof variants. The interior is wider and taller than a Ford Transit, making the working environment more comfortable when you are fitting tyres roadside or at a customer's premises. Mercedes vans carry strong used values, making the Sprinter an excellent long-term asset.",
    loadVolumeCubicM: 12.0,
    payloadKg: 1400,
    cargoLengthMm: 3665,
    floorWidthMm: 1820,
    internalHeightMm: 1900,
    euroSix: true,
    platform: "Mercedes-Benz VS30 platform",
    whyItWorks: [
      "12.0 m³ load space — one of the largest in the L3H3 class",
      "1,820 mm interior width gives more useable bench and racking space",
      "Strong residual values and premium resale appeal",
      "Excellent cab comfort for high-mileage mobile tyre operators",
      "Large Mercedes dealer network for servicing anywhere in the UK",
      "High roof entry without ducking — ideal when loading heavy tyres",
    ],
    popularKits: [
      "Standard Mobile Tyre Kit (T1000 tyre changer + Mini Spin balancer)",
      "Pro Mobile Tyre Kit (T2000 Pro tyre changer + Pro balancer)",
    ],
    faqs: [
      {
        q: "Is the Mercedes Sprinter L3H3 suitable for a mobile tyre fitting business?",
        a: "Yes — the Sprinter L3H3 is one of the most popular choices for professional mobile tyre operators. Its 12.0 m³ cargo area and 1,820 mm floor width give you more useable working space than most alternatives, which matters when you are fitting tyres on-site rather than in a workshop.",
      },
      {
        q: "Does the Mercedes Sprinter L3H3 pass London's ULEZ charge?",
        a: "Current Mercedes Sprinter vans (post-2019 plate) are Euro 6 compliant and are exempt from the ULEZ daily charge. Older pre-Euro 6 Sprinters will incur a charge. All new vehicles we supply are Euro 6 as standard.",
      },
      {
        q: "How does the Sprinter compare to the Ford Transit for a mobile tyre conversion?",
        a: "The Sprinter offers marginally more cargo volume (12.0 m³ vs 11.8 m³) and a wider floor, which some operators prefer for racking layouts. The Transit wins on cost of ownership and parts availability. Both make excellent tyre vans — the Sprinter is the premium choice for operators who want a higher-quality cab environment.",
      },
      {
        q: "Can I get finance on a Mercedes Sprinter mobile tyre van conversion?",
        a: "Yes. We offer hire purchase finance on both the van and the conversion as a single package. Use our online finance calculator to see indicative monthly payments, then speak to our sales team to discuss a tailored plan.",
      },
    ],
  },
  {
    slug: "volkswagen-crafter",
    displayName: "Volkswagen Crafter L3H3",
    make: "Volkswagen",
    model: "Crafter",
    roofSpec: "L3H3",
    tagline: "German engineering with outstanding build quality and handling",
    overview:
      "The Volkswagen Crafter L3H3 is engineered independently by VW — unlike its predecessors, the current Crafter is built entirely in-house rather than sharing a platform with the Mercedes Sprinter. The result is a van with VW's characteristic precision build quality, a class-leading driving experience, and an interior that our conversion teams find particularly well-suited to professional equipment fitting. Its 11.3 m³ cargo volume and 1,380 kg payload are very competitive, and the Crafter's reputation for reliability makes it a strong long-term asset for a mobile tyre business.",
    loadVolumeCubicM: 11.3,
    payloadKg: 1380,
    cargoLengthMm: 3640,
    floorWidthMm: 1780,
    internalHeightMm: 1865,
    euroSix: true,
    platform: "Volkswagen MAN TGE platform",
    whyItWorks: [
      "11.3 m³ cargo space is ample for full tyre kit plus working stock",
      "Built on VW's proprietary platform — not a rebadged Sprinter",
      "VW reliability record gives excellent long-term ownership costs",
      "Optional rear-wheel drive available for operators in challenging terrain",
      "Clean, well-lit interior makes equipment management easy",
      "Strong VW commercial van dealer network UK-wide",
    ],
    popularKits: [
      "Standard Mobile Tyre Kit (T1000 tyre changer + Mini Spin balancer)",
      "Pro Mobile Tyre Kit (T2000 Pro tyre changer + Pro balancer)",
    ],
    faqs: [
      {
        q: "Is the VW Crafter L3H3 a rebadged Mercedes Sprinter?",
        a: "No. From 2017 onwards the Volkswagen Crafter is built on VW's own MAN TGE platform and is entirely separate from the Mercedes Sprinter. Earlier generations (pre-2017) were built on a shared platform, but the current model is a wholly independent vehicle engineered and manufactured by Volkswagen.",
      },
      {
        q: "Does the Volkswagen Crafter comply with UK Clean Air Zone requirements?",
        a: "Yes. All current VW Crafter vans are Euro 6 compliant, so they are not subject to Clean Air Zone or ULEZ daily charges. This is important for mobile tyre operators who need to work across different UK cities.",
      },
      {
        q: "How much tyre stock can I carry in a converted Crafter L3H3?",
        a: "With our standard racking configuration for the VW Crafter L3H3, you can carry a typical working stock of 20–30 passenger tyres plus your full tyre changing and balancing equipment. The exact capacity depends on tyre size profile and racking specification.",
      },
      {
        q: "Is rear-wheel drive or front-wheel drive better for a mobile tyre van?",
        a: "The majority of mobile tyre operators choose front-wheel drive as it is more fuel-efficient and performs well on normal road surfaces. Rear-wheel drive can be useful for operators working on uneven surfaces or in rural areas. We can discuss which drivetrain suits your planned operation when you contact us.",
      },
    ],
  },
  {
    slug: "nissan-interstar",
    displayName: "Nissan Interstar L3H3",
    make: "Nissan",
    model: "Interstar",
    roofSpec: "L3H3",
    tagline: "Renault Master-based workhorse with Nissan's commercial backing",
    overview:
      "The Nissan Interstar L3H3 is built on the Renault Master platform — one of the most proven large van platforms in Europe — giving operators excellent parts availability and a long track record of reliability in commercial use. The Interstar is the largest of the Renault-Nissan alliance van family in this class, offering 12.6 m³ of cargo volume, a 1,400 kg payload, and the tall, wide interior that mobile tyre fitting requires. For operators who want the platform reliability of the Renault Master with the backing of Nissan's commercial network, the Interstar is a compelling choice.",
    loadVolumeCubicM: 12.6,
    payloadKg: 1400,
    cargoLengthMm: 3705,
    floorWidthMm: 1835,
    internalHeightMm: 1920,
    euroSix: true,
    platform: "Renault-Nissan X62 platform (shared with Renault Master and Vauxhall Movano)",
    whyItWorks: [
      "12.6 m³ load space — among the largest in the L3H3 category",
      "1,835 mm floor width gives generous racking room on both sides",
      "Shares platform with Renault Master and Vauxhall Movano — very wide parts network",
      "1,400 kg payload comfortably handles equipment and tyre stock",
      "Strong residual values in the used van market",
      "Low total cost of ownership for high-mileage mobile operators",
    ],
    popularKits: [
      "Standard Mobile Tyre Kit (T1000 tyre changer + Mini Spin balancer)",
      "Pro Mobile Tyre Kit (T2000 Pro tyre changer + Pro balancer)",
    ],
    faqs: [
      {
        q: "Is the Nissan Interstar the same as the Renault Master?",
        a: "The Nissan Interstar and Renault Master share the same X62 platform and many mechanical components. The main differences are in badging, cab trim level, and the dealer/service network behind them. The Vauxhall Movano also uses the same platform. All three are excellent choices for a mobile tyre van conversion.",
      },
      {
        q: "What is the maximum payload of the Nissan Interstar L3H3?",
        a: "The Nissan Interstar L3H3 has a maximum payload of approximately 1,400 kg depending on specification. Mobile tyre equipment (tyre changer, balancer, compressor, and racking) typically weighs 400–600 kg, leaving substantial capacity for a working tyre stock.",
      },
      {
        q: "Does the Interstar fit in a standard commercial vehicle workshop for servicing?",
        a: "Yes. The Nissan Interstar L3H3 fits in a standard double-height commercial workshop. Its overall height is approximately 2.5 m with roof rack clearance — just check that your garage or workshop has sufficient clearance before servicing.",
      },
      {
        q: "Can the Nissan Interstar be serviced anywhere in the UK?",
        a: "Yes. Given the Interstar shares its platform with the Renault Master and Vauxhall Movano, parts are available through an extremely wide dealer and independent network across the UK. This is a significant benefit for mobile operators who cover large geographic areas.",
      },
    ],
  },
  {
    slug: "iveco-daily",
    displayName: "Iveco Daily L3H3",
    make: "Iveco",
    model: "Daily",
    roofSpec: "L3H3",
    tagline: "The heavy-duty specialist — maximum payload for serious equipment loads",
    overview:
      "The Iveco Daily L3H3 occupies a unique position in the large van market: it is built to truck standards rather than car-derived van standards, giving it a higher gross vehicle weight, a more robust chassis, and — crucially — a higher payload capacity than most competitors. For mobile tyre operators who carry a full professional kit plus a large stock of tyres, the Daily's 1,500+ kg payload is a genuine advantage. With 12.5 m³ of cargo space and an exceptionally strong floor, the Daily is the choice for operators who prioritise capacity and durability over running cost.",
    loadVolumeCubicM: 12.5,
    payloadKg: 1500,
    cargoLengthMm: 3680,
    floorWidthMm: 1870,
    internalHeightMm: 1945,
    euroSix: true,
    platform: "Iveco Daily sixth generation (ladder frame chassis)",
    whyItWorks: [
      "Highest payload capacity in this class — up to 1,500 kg",
      "Ladder frame chassis offers greater structural rigidity for heavy racking",
      "12.5 m³ load space with class-leading 1,870 mm floor width",
      "Built to truck standards — exceptional longevity in hard commercial use",
      "Available with larger engine options for operators covering high mileage",
      "Outstanding for carrying heavy equipment loads — full kit plus large tyre stock",
    ],
    popularKits: [
      "Pro Mobile Tyre Kit (T2000 Pro tyre changer + Pro balancer)",
      "Standard Mobile Tyre Kit (T1000 tyre changer + Mini Spin balancer)",
    ],
    faqs: [
      {
        q: "Why is the Iveco Daily the highest-payload van in this category?",
        a: "Unlike car-derived vans like the Transit or Sprinter, the Iveco Daily is built on a traditional ladder-frame chassis similar to a light truck. This gives it a higher gross vehicle weight rating and payload capacity. For mobile tyre operators carrying both professional equipment and a large working tyre stock, this extra capacity is genuinely useful.",
      },
      {
        q: "Is the Iveco Daily harder to drive than a Ford Transit or Mercedes Sprinter?",
        a: "The Daily has a slightly more commercial driving feel due to its truck-derived chassis, but modern versions are comfortable and well-equipped. Operators who already have HGV or larger vehicle experience typically adapt quickly. For those used to car-derived vans, there is a short adjustment period.",
      },
      {
        q: "Does the Iveco Daily require a special driving licence?",
        a: "No. The Iveco Daily in L3H3 specification falls within the 3.5-tonne gross vehicle weight limit and can be driven on a standard UK category B car licence. A category C1 licence is only required for Iveco Daily variants over 3.5 tonnes GVW.",
      },
      {
        q: "Is the Iveco Daily Euro 6 compliant for UK Clean Air Zones?",
        a: "Yes. All current Iveco Daily vans sold in the UK are Euro 6 compliant, meaning they are exempt from Clean Air Zone and ULEZ daily charges. The Daily was actually one of the earlier vans to achieve Euro 6 compliance in this class.",
      },
    ],
  },
  {
    slug: "citroen-relay",
    displayName: "Citroën Relay L3H3",
    make: "Citroën",
    model: "Relay",
    roofSpec: "L3H3",
    tagline: "The French workhorse — cost-effective and widely supported across the UK",
    overview:
      "The Citroën Relay L3H3 is one of the most cost-effective ways to enter mobile tyre fitting. Built on the PSA Group platform shared with the Peugeot Boxer and Fiat Ducato, the Relay benefits from one of the most widely supported parts networks in Europe. Running costs are lower than premium alternatives, and the 11.5 m³ cargo space is more than adequate for a full tyre fitting kit. For new entrants to mobile tyre fitting who want to keep startup costs manageable without sacrificing capability, the Relay is a strong choice.",
    loadVolumeCubicM: 11.5,
    payloadKg: 1400,
    cargoLengthMm: 3705,
    floorWidthMm: 1765,
    internalHeightMm: 1865,
    euroSix: true,
    platform: "PSA Group X290 platform (shared with Peugeot Boxer and Fiat Ducato)",
    whyItWorks: [
      "11.5 m³ cargo space — adequate for full tyre kit and working stock",
      "Lower purchase price than German-brand equivalents",
      "PSA platform shared with Boxer and Ducato — excellent parts availability",
      "Excellent fuel economy helps keep running costs competitive",
      "Strong Citroën commercial dealer network across the UK",
      "Popular choice for owner-operators looking to keep startup costs manageable",
    ],
    popularKits: [
      "Standard Mobile Tyre Kit (T1000 tyre changer + Mini Spin balancer)",
      "Pro Mobile Tyre Kit (T2000 Pro tyre changer + Pro balancer)",
    ],
    faqs: [
      {
        q: "Is the Citroën Relay the same as the Peugeot Boxer?",
        a: "Yes — the Citroën Relay and Peugeot Boxer are mechanically identical, sharing the PSA Group X290 platform. The differences are cosmetic (badging, grille trim) and in the dealer network. Parts are fully interchangeable, which makes both excellent choices for mobile operators who want wide servicing options.",
      },
      {
        q: "How does the Citroën Relay compare on cost to the Ford Transit?",
        a: "The Citroën Relay typically costs less to purchase new or used than a comparable Ford Transit. Running and servicing costs are also competitive. For operators on a tighter startup budget, the Relay can deliver genuine savings without compromising on the workspace needed for professional mobile tyre fitting.",
      },
      {
        q: "Is the Citroën Relay L3H3 suitable for a full equipment pack?",
        a: "Yes. The Relay L3H3 has 11.5 m³ of cargo space and a 1,400 kg payload, which comfortably accommodates a professional tyre changer, wheel balancer, compressor, racking, and a working stock of tyres. We have converted many Relays to our standard tyre van specification.",
      },
      {
        q: "Does the Citroën Relay pass ULEZ and Clean Air Zone charges?",
        a: "All current Citroën Relay models are Euro 6 compliant and are therefore exempt from ULEZ and Clean Air Zone daily charges. Pre-Euro 6 Relays (generally pre-2018 plates) may incur charges in some zones.",
      },
    ],
  },
  {
    slug: "peugeot-boxer",
    displayName: "Peugeot Boxer L3H3",
    make: "Peugeot",
    model: "Boxer",
    roofSpec: "L3H3",
    tagline: "Proven French reliability — the PSA workhorse for value-focused operators",
    overview:
      "The Peugeot Boxer L3H3 shares its DNA with the Citroën Relay and Fiat Ducato, making it one of the most proven large van platforms in Europe. The Boxer has a long track record in UK commercial use, and its 11.5 m³ cargo volume and 1,400 kg payload are well-matched to the demands of mobile tyre fitting. As a Peugeot, it sits in the same value-for-money bracket as the Relay, with the added benefit of Peugeot's strong UK commercial dealer presence. Our conversion team regularly fits Boxers to the same specification as the Relay — equipment fitting and racking layouts are optimised for the shared PSA interior dimensions.",
    loadVolumeCubicM: 11.5,
    payloadKg: 1400,
    cargoLengthMm: 3705,
    floorWidthMm: 1765,
    internalHeightMm: 1865,
    euroSix: true,
    platform: "PSA Group X290 platform (shared with Citroën Relay and Fiat Ducato)",
    whyItWorks: [
      "11.5 m³ cargo space with 1,400 kg payload — ideal for full tyre kit",
      "PSA platform reliability backed by decades of commercial van production",
      "Lower capital outlay than German-brand alternatives",
      "Parts interchangeable with Citroën Relay and Fiat Ducato",
      "Peugeot's UK dealer network provides nationwide servicing coverage",
      "Competitive fuel economy for high-mileage mobile tyre operators",
    ],
    popularKits: [
      "Standard Mobile Tyre Kit (T1000 tyre changer + Mini Spin balancer)",
      "Pro Mobile Tyre Kit (T2000 Pro tyre changer + Pro balancer)",
    ],
    faqs: [
      {
        q: "Is the Peugeot Boxer the same van as the Citroën Relay?",
        a: "Yes. The Peugeot Boxer and Citroën Relay are mechanically identical — both are built on the PSA Group X290 platform. The Fiat Ducato also shares this platform. The main differences are cosmetic. Parts are interchangeable, which is a practical benefit when operating in areas where one marque's dealer is more convenient than another.",
      },
      {
        q: "What makes the Peugeot Boxer a good base van for mobile tyre fitting?",
        a: "The Boxer L3H3 provides all the key requirements: sufficient cargo space (11.5 m³), adequate payload (1,400 kg), Euro 6 compliance for UK city access, and a comfortable working height inside the van. Its lower purchase price compared to German alternatives makes it a popular choice for new market entrants.",
      },
      {
        q: "Can I use a Peugeot Boxer for my own business and have it converted by you?",
        a: "Yes. We accept customer-supplied Peugeot Boxers for conversion. We recommend the van is L3H3 specification, no older than a 2018 plate, and has a full service history. Contact us to discuss a customer-vehicle conversion and we will arrange a vehicle inspection.",
      },
      {
        q: "How fuel-efficient is the Peugeot Boxer L3H3 when fully loaded?",
        a: "Real-world fuel economy for a fully loaded Peugeot Boxer L3H3 running on typical mobile tyre routes typically falls between 28 and 34 mpg depending on engine specification, load weight, and driving pattern. Lighter equipment loads and motorway-heavy routes tend to return better figures.",
      },
    ],
  },
  {
    slug: "vauxhall-movano",
    displayName: "Vauxhall Movano L3H3",
    make: "Vauxhall",
    model: "Movano",
    roofSpec: "L3H3",
    tagline: "The British-backed van on a world-class platform — great value, outstanding capacity",
    overview:
      "The Vauxhall Movano L3H3 is built on the same Renault Master/Nissan Interstar X62 platform, giving it one of the most spacious interiors in the large van category at 12.6 m³ and an outstanding 1,400 kg payload. Vauxhall's UK heritage and extensive dealer network mean that the Movano is one of the easiest large vans to service and maintain anywhere in Britain. For mobile tyre operators who want the Renault Master's proven platform credentials combined with local Vauxhall dealer support, the Movano is a compelling option.",
    loadVolumeCubicM: 12.6,
    payloadKg: 1400,
    cargoLengthMm: 3705,
    floorWidthMm: 1835,
    internalHeightMm: 1920,
    euroSix: true,
    platform: "Renault-Nissan X62 platform (shared with Renault Master and Nissan Interstar)",
    whyItWorks: [
      "12.6 m³ load space — among the largest available in the L3H3 class",
      "1,835 mm floor width gives more racking and work space than most rivals",
      "Shares platform with Renault Master and Nissan Interstar — very wide parts supply chain",
      "Strong Vauxhall dealer presence for easy UK-wide servicing",
      "Lower purchase price than equivalent German vans",
      "1,400 kg payload easily handles professional tyre equipment and stock",
    ],
    popularKits: [
      "Standard Mobile Tyre Kit (T1000 tyre changer + Mini Spin balancer)",
      "Pro Mobile Tyre Kit (T2000 Pro tyre changer + Pro balancer)",
    ],
    faqs: [
      {
        q: "Is the Vauxhall Movano the same as the Renault Master?",
        a: "Mechanically, yes. The Vauxhall Movano and Renault Master are built on the same X62 platform and share most mechanical components. The Nissan Interstar also uses this platform. The key differences are in cab trim, branding, and the dealer network that services them. Parts are largely interchangeable across all three.",
      },
      {
        q: "Why is the Vauxhall Movano L3H3 so popular for large commercial conversions?",
        a: "The Movano's combination of a wide, tall interior (12.6 m³ and 1,835 mm floor width), high payload, and lower purchase price than German rivals makes it attractive for operators who need maximum capacity. Its British-brand heritage also means Vauxhall dealers are well-distributed across all UK regions.",
      },
      {
        q: "Is the Vauxhall Movano compliant with UK Clean Air Zone requirements?",
        a: "All current Vauxhall Movano vans are Euro 6 compliant and are exempt from Clean Air Zone and London ULEZ daily charges. This is important for any mobile tyre operator planning to work across different UK cities.",
      },
      {
        q: "What is the difference between the Vauxhall Movano L3H3 and L3H4?",
        a: "The L3H3 designation means long wheelbase (L3) with high roof (H3). The L3H4 — where available on certain variants — offers an extra-high roof for even greater internal height. For most mobile tyre applications the L3H3 provides all the working height needed. We can advise which specification is best for your intended use.",
      },
    ],
  },
];

export function getVanBySlug(slug: string): VanModel | undefined {
  return vanModels.find((v) => v.slug === slug);
}
