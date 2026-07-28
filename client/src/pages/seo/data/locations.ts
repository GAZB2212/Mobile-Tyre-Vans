export interface LocationFaq {
  q: string;
  a: string;
}

export interface Location {
  slug: string;
  name: string;
  region: string;
  regionSlug: string;
  county: string;
  nearbyAreas: string[];
  intro: string;
  deliveryNote: string;
  faqs: LocationFaq[];
}

export const locations: Location[] = [
  // ── Northwest ───────────────────────────────────────────────────────────────
  {
    slug: "liverpool",
    name: "Liverpool",
    region: "Northwest England",
    regionSlug: "northwest",
    county: "Merseyside",
    nearbyAreas: ["Wirral", "Warrington", "St Helens", "Knowsley", "Sefton"],
    intro:
      "Liverpool is one of the UK's most active regions for mobile tyre fitting businesses, with a large population spread across multiple boroughs and a significant commercial vehicle presence driven by the Port of Liverpool and its associated logistics sector. A converted mobile tyre van operating in and around Liverpool can service everything from suburban residential customers to fleet operators in the industrial areas of Speke, Wavertree, and Aintree.",
    deliveryNote:
      "As we are based in the UK — just 15 minutes from Liverpool city centre — we can deliver your completed van conversion to Liverpool on the day of handover at no extra charge.",
    faqs: [
      {
        q: "How quickly can you deliver a mobile tyre van to Liverpool?",
        a: "Our workshop is located in the UK — approximately 15 minutes from Liverpool city centre. We can deliver your completed conversion directly to you in Liverpool on the handover date at no extra charge, or you are welcome to collect from our workshop.",
      },
      {
        q: "Is Liverpool a good area to start a mobile tyre fitting business?",
        a: "Yes. Liverpool and its surrounding boroughs have a combined population of over 860,000 and a strong commercial vehicle base associated with the Port of Liverpool and its logistics network. Demand for mobile tyre fitting is robust year-round, particularly in the commercial and fleet sectors.",
      },
      {
        q: "Does a mobile tyre van need to comply with any Liverpool city centre restrictions?",
        a: "Liverpool does not currently operate a Clean Air Zone (CAZ) or ULEZ, but all vans we supply are Euro 6 compliant as standard to future-proof your investment. Check with Liverpool City Council for any local parking or kerbside working restrictions in specific areas.",
      },
    ],
  },
  {
    slug: "wirral",
    name: "Wirral",
    region: "Northwest England",
    regionSlug: "northwest",
    county: "Merseyside",
    nearbyAreas: ["Liverpool", "Chester", "Ellesmere Port", "Birkenhead", "Heswall"],
    intro:
      "The Wirral's mix of commuter suburbs, retail parks, and light industrial estates creates a steady demand for mobile tyre services across both the residential and commercial sectors. The Cross Mersey corridor and the A41 connecting Birkenhead to Chester carry significant commercial traffic, making a locally based tyre van business well-placed to serve both local and regional demand.",
    deliveryNote:
      "Wirral is close to our workshop, so local delivery is always included at no extra charge. You are also welcome to collect your completed van conversion in person.",
    faqs: [
      {
        q: "Where is Mobile Tyre Vans' workshop located?",
        a: "Our workshop is at Unit 1, Example Business Park, Your Town, AA1 1AA. You are welcome to visit during business hours to discuss your conversion requirements or to collect a completed van.",
      },
      {
        q: "Can I come and inspect my van conversion before taking delivery?",
        a: "Yes — we encourage all customers to visit our workshop to inspect their completed van before final handover. We will walk you through the equipment installation, racking, and any branding applied. A pre-handover check is standard for all builds.",
      },
      {
        q: "Is the Wirral a viable area to operate a mobile tyre fitting business?",
        a: "Absolutely. The Wirral has a population of approximately 320,000 across areas including Birkenhead, Bebington, Heswall, and West Kirby. The peninsula also has a strong commercial corridor around the M53 motorway connecting to the national road network, giving you access to both residential and commercial accounts.",
      },
    ],
  },
  {
    slug: "manchester",
    name: "Manchester",
    region: "Northwest England",
    regionSlug: "northwest",
    county: "Greater Manchester",
    nearbyAreas: ["Salford", "Stockport", "Oldham", "Bury", "Trafford", "Wigan"],
    intro:
      "Manchester is the UK's largest city outside London and one of the busiest commercial centres in Europe. With a Greater Manchester conurbation of over 2.8 million people and a dense network of business parks, retail centres, and logistics hubs, the demand for mobile tyre fitting is exceptional. Manchester is also home to the UK's largest Clean Air Zone outside London, which means all vans in your fleet should be Euro 6 compliant — a standard we apply to every conversion we build.",
    deliveryNote:
      "We deliver completed van conversions to Manchester customers as part of our UK-wide delivery service. Typical delivery to the Manchester area takes 1–2 working days after sign-off.",
    faqs: [
      {
        q: "Does Manchester have a Clean Air Zone that affects mobile tyre vans?",
        a: "Yes. Greater Manchester operates a Clean Air Zone covering the city centre and surrounding boroughs. All vans we supply for conversion are Euro 6 compliant as standard, which means they are exempt from the daily CAZ charge. If you are considering a used vehicle for conversion, check its Euro status carefully before purchasing.",
      },
      {
        q: "Can a mobile tyre van business operate profitably in Manchester city centre?",
        a: "Yes — Manchester's dense urban population and large fleet operator base create excellent demand. City centre operation requires careful route planning due to traffic and parking constraints, but many of our customers in Greater Manchester combine city and suburban routes to maximise daily job volumes.",
      },
      {
        q: "How long does delivery of a completed conversion take to Manchester?",
        a: "We deliver to Manchester within 1–2 working days of sign-off. Alternatively, you are welcome to collect from our UK workshop — Manchester is approximately a 45-minute drive via the M56.",
      },
    ],
  },
  {
    slug: "salford",
    name: "Salford",
    region: "Northwest England",
    regionSlug: "northwest",
    county: "Greater Manchester",
    nearbyAreas: ["Manchester", "Eccles", "Worsley", "Swinton", "Pendleton"],
    intro:
      "Salford sits immediately west of Manchester city centre and forms part of the Greater Manchester conurbation. MediaCityUK, Salford Quays, and the M60/M602 motorway corridor create a high-density commercial environment with significant fleet vehicle traffic. A mobile tyre van operating from Salford has rapid access to Manchester, Trafford, and Eccles, giving excellent coverage of central Greater Manchester's commercial accounts.",
    deliveryNote:
      "We deliver to Salford as part of our Greater Manchester delivery run. Completed vans reach Salford within 1–2 working days of handover sign-off.",
    faqs: [
      {
        q: "Is Salford a good base for a mobile tyre van operation?",
        a: "Yes. Salford's position adjacent to Manchester city centre and the MediaCityUK development makes it a strong base for commercial and residential mobile tyre work. The M602 gives rapid access to the M60 ring road, from which you can reach most of Greater Manchester within 30 minutes.",
      },
      {
        q: "Does Salford fall within Manchester's Clean Air Zone?",
        a: "Parts of Salford may be subject to Greater Manchester's Clean Air Zone restrictions. All vans we supply are Euro 6 compliant and therefore exempt from CAZ charges. We recommend checking the current CAZ boundary map for the specific postcodes you intend to operate in.",
      },
      {
        q: "Can I pick up my converted van from your workshop rather than waiting for delivery?",
        a: "Yes. Our workshop in the North West is approximately 50 minutes from Salford via the M56. You are welcome to collect your completed van and we will give you a full handover briefing before you leave.",
      },
    ],
  },
  {
    slug: "bolton",
    name: "Bolton",
    region: "Northwest England",
    regionSlug: "northwest",
    county: "Greater Manchester",
    nearbyAreas: ["Wigan", "Bury", "Horwich", "Farnworth", "Chorley"],
    intro:
      "Bolton is a major town in the north of Greater Manchester with a strong industrial heritage and an active commercial vehicle base. The town sits at the junction of the M61 and A666, giving excellent motorway access to Manchester, Preston, and the wider Northwest. Bolton's mix of commercial estates, retail parks, and suburban residential areas creates a well-balanced demand profile for mobile tyre fitting across both passenger car and commercial vehicle accounts.",
    deliveryNote:
      "We deliver completed van conversions to Bolton as part of our Greater Manchester delivery area. Delivery typically takes 1–2 working days after handover sign-off.",
    faqs: [
      {
        q: "What type of customers does a Bolton-based mobile tyre van typically serve?",
        a: "Bolton has a strong commercial vehicle base with numerous logistics and distribution companies operating along the M61 corridor. You can expect a mix of fleet commercial accounts, retail park call-outs, and residential customer work. The Bolton town centre bypass gives good access across the borough.",
      },
      {
        q: "How far is Bolton from your UK workshop?",
        a: "Bolton is approximately 45–50 minutes from our workshop via the M56 and M60/M61. You are welcome to collect your conversion in person — we will guide you through all installed equipment before you drive away.",
      },
      {
        q: "Is it worth starting a mobile tyre business in a town like Bolton versus a city like Manchester?",
        a: "Both locations offer good opportunities. Towns like Bolton often have less competition from established mobile tyre operators than major city centres, while still offering enough population density to run a full day of jobs. Many operators find mixed coverage — serving Bolton and surrounding towns plus parts of Manchester — to be the most profitable model.",
      },
    ],
  },
  {
    slug: "wigan",
    name: "Wigan",
    region: "Northwest England",
    regionSlug: "northwest",
    county: "Greater Manchester",
    nearbyAreas: ["Bolton", "St Helens", "Leigh", "Warrington", "Skelmersdale"],
    intro:
      "Wigan sits at the crossroads of the M6, M58, and A49, making it an exceptionally well-connected base for mobile tyre operations covering a wide geographic area. The Wigan borough has a large industrial and distribution sector, particularly around the M6 corridor near Golborne and Leigh, and a substantial residential population across the town and its surrounding communities. Its central position in the Northwest makes it possible to serve customers in Manchester, Bolton, St Helens, and Warrington from a single Wigan base.",
    deliveryNote:
      "We deliver to Wigan as part of our Northwest delivery coverage. Completed vans arrive within 1–2 working days of sign-off.",
    faqs: [
      {
        q: "Why is Wigan a good location for a mobile tyre van business?",
        a: "Wigan's motorway connections (M6, M58) give a Wigan-based operator access to a very large catchment area in a short drive. The borough's industrial estates — particularly around the Pemberton and Westwood areas — provide commercial fleet accounts, while the residential areas offer steady retail tyre work.",
      },
      {
        q: "Can a mobile tyre van operating from Wigan serve the wider Northwest?",
        a: "Yes. Wigan's central Northwest position means you can realistically serve customers in Manchester (30 min), Bolton (20 min), St Helens (20 min), and Warrington (25 min) within a single working day. Many operators use a central Northwest town like Wigan as a hub for a wider regional operation.",
      },
      {
        q: "How quickly can you deliver a completed van to Wigan?",
        a: "We typically deliver to Wigan within 1–2 working days after sign-off. Alternatively, collect from our workshop — Wigan is approximately 40 minutes via the M58.",
      },
    ],
  },
  {
    slug: "preston",
    name: "Preston",
    region: "Northwest England",
    regionSlug: "northwest",
    county: "Lancashire",
    nearbyAreas: ["Blackpool", "Blackburn", "Burnley", "Lancaster", "Chorley"],
    intro:
      "Preston is the county town of Lancashire and the administrative and commercial hub of the county. Its position at the M6/M55 junction makes it the gateway to the Fylde Coast and an important commercial crossroads for the Northwest. The Preston area has a significant industrial base in the Walton Summit and Bamber Bridge industrial corridors, and the residential coverage extends across the Ribble Valley to serve a substantial rural and suburban population.",
    deliveryNote:
      "We deliver completed mobile tyre van conversions to Preston via our Lancashire delivery route. Delivery to Preston typically takes 1–2 working days after sign-off.",
    faqs: [
      {
        q: "Is Preston a good base for a mobile tyre business covering Lancashire?",
        a: "Yes. Preston's central position in Lancashire, combined with its M6/M55 motorway access, makes it an excellent base for covering the whole county. From Preston you can reach Blackpool, Blackburn, Burnley, and Lancaster within 30–45 minutes, covering a combined population of well over a million people.",
      },
      {
        q: "Are there any Clean Air Zone charges to be aware of in Preston?",
        a: "Preston does not currently operate a Clean Air Zone or ULEZ. However, all vans we supply are Euro 6 compliant as standard, which future-proofs your investment against any future air quality restrictions.",
      },
      {
        q: "What industries in Preston generate demand for mobile tyre fitting?",
        a: "The Walton Summit industrial estate, Bamber Bridge distribution centre, and the wider M6 motorway corridor all generate substantial commercial fleet traffic. Preston also has a large residential base with strong retail tyre demand, and the adjacent Fylde Coast (Blackpool, Lytham) provides additional coverage opportunity.",
      },
    ],
  },
  {
    slug: "blackpool",
    name: "Blackpool",
    region: "Northwest England",
    regionSlug: "northwest",
    county: "Lancashire",
    nearbyAreas: ["Preston", "Lytham St Annes", "Cleveleys", "Poulton-le-Fylde", "Fleetwood"],
    intro:
      "Blackpool is the UK's most visited seaside resort and supports a large year-round commercial vehicle base, including delivery fleets, taxis, coaches, and hire vehicles. The concentrated geography of the Fylde Coast means a mobile tyre van operating from Blackpool can cover the entire coastal strip from Fleetwood to Lytham St Annes within a tight geographic radius, while also serving the M55 corridor back towards Preston.",
    deliveryNote:
      "We deliver completed van conversions to Blackpool as part of our Lancashire delivery area. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Is a mobile tyre business viable in a coastal town like Blackpool?",
        a: "Yes. Blackpool's high concentration of taxis, mini-cabs, coaches, and hire vehicles creates reliable fleet-side demand year-round. The Blackpool tram network and municipal vehicle fleet also represent potential fleet accounts. Seasonal tourism increases overall vehicle numbers during summer months.",
      },
      {
        q: "Can a Blackpool-based mobile tyre van also cover Preston and the M55 corridor?",
        a: "Absolutely. The M55 connects Blackpool to Preston in approximately 20 minutes, giving you efficient access to both the Fylde Coast and the Preston commercial corridor from a single base. Many operators cover this combined area to maximise daily job volume.",
      },
      {
        q: "What vehicle types will a Blackpool mobile tyre operator most commonly service?",
        a: "In Blackpool you will encounter a mix of passenger cars, taxis, minibuses, coaches, and delivery vans. The holiday and hospitality sector generates steady light commercial work. Fleet accounts with taxi companies and coach operators can provide reliable recurring revenue.",
      },
    ],
  },
  {
    slug: "blackburn",
    name: "Blackburn",
    region: "Northwest England",
    regionSlug: "northwest",
    county: "Lancashire",
    nearbyAreas: ["Burnley", "Accrington", "Preston", "Darwen", "Bury"],
    intro:
      "Blackburn with Darwen is a large metropolitan borough in the heart of East Lancashire. The town has a strong manufacturing and logistics base along the M65 motorway corridor, and the East Lancashire Road network connects it efficiently to Manchester and the wider Northwest. The Blackburn area's commercial vehicle density and mixed industrial-residential character create good conditions for a mobile tyre fitting operation covering both fleet and retail accounts.",
    deliveryNote:
      "We deliver to Blackburn as part of our East Lancashire delivery area. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "What commercial sectors drive demand for mobile tyre fitting in Blackburn?",
        a: "Blackburn has a significant manufacturing base — particularly food processing, engineering, and distribution — along the Whitebirk Industrial Estate and Shadsworth Business Park on the M65 corridor. Fleet accounts from these sectors, combined with residential and taxi work, provide a well-rounded demand base.",
      },
      {
        q: "How does the M65 motorway affect a Blackburn-based mobile tyre operation?",
        a: "The M65 connects Blackburn directly to Preston (west) and Burnley, Nelson, and Colne (east), meaning a Blackburn-based operator can cover the entire East Lancashire corridor efficiently. The motorway also connects to the M6 north-south artery, extending potential coverage further.",
      },
      {
        q: "Is the Blackburn area well served by commercial vehicle dealers for servicing my tyre van?",
        a: "Yes. The Blackburn and East Lancashire area has a good distribution of commercial vehicle dealers and independent workshops. All major van brands (Ford, Mercedes, VW, Vauxhall) have authorised representation within the region.",
      },
    ],
  },
  {
    slug: "burnley",
    name: "Burnley",
    region: "Northwest England",
    regionSlug: "northwest",
    county: "Lancashire",
    nearbyAreas: ["Blackburn", "Nelson", "Colne", "Accrington", "Pendle"],
    intro:
      "Burnley is a market town in East Lancashire with a strong industrial heritage and a revitalised commercial sector centred on the M65 motorway. The town's Burnley Bridge Business Park and the wider Colne Valley corridor have attracted significant distribution and manufacturing investment in recent years. For mobile tyre operators, Burnley represents a solid base for serving the upper Calder Valley and the densely populated East Lancashire towns of Nelson and Colne.",
    deliveryNote:
      "We deliver to Burnley as part of our East Lancashire delivery area. Delivery typically takes 1–2 working days after sign-off.",
    faqs: [
      {
        q: "What business park areas around Burnley generate fleet tyre demand?",
        a: "Burnley Bridge Business Park is the largest logistics hub in the area, attracting major distribution tenants. The Heasandford Industrial Estate and Pioneer Business Park in Nelson also generate commercial fleet demand. Combined with the residential base across Burnley and Pendle, you have a good mix of account types.",
      },
      {
        q: "Can I cover Nelson and Colne from a Burnley base?",
        a: "Yes. Nelson and Colne are immediately east of Burnley along the M65/A56 corridor — both are within a 10-minute drive. Many operators cover Burnley, Nelson, and Colne together as a natural East Lancashire patch.",
      },
      {
        q: "Is Burnley affected by any Clean Air Zone restrictions?",
        a: "Burnley does not currently operate a Clean Air Zone. All vans we supply are Euro 6 compliant as standard, which ensures your investment is protected against any future air quality measures in the region.",
      },
    ],
  },
  {
    slug: "stockport",
    name: "Stockport",
    region: "Northwest England",
    regionSlug: "northwest",
    county: "Greater Manchester",
    nearbyAreas: ["Manchester", "Cheadle", "Hazel Grove", "Marple", "Bramhall"],
    intro:
      "Stockport is situated at the southern edge of Greater Manchester and forms part of the M60 motorway ring road network, giving it fast access to Manchester city centre, the airport, and the wider conurbation. The A6 corridor through Stockport is one of the busiest in the Northwest and generates significant commercial and residential vehicle traffic. The airport industrial areas and the Stockport town centre regeneration zone create a varied commercial account base for a mobile tyre operator.",
    deliveryNote:
      "We deliver to Stockport as part of our Greater Manchester delivery area. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Is Stockport part of Greater Manchester's Clean Air Zone?",
        a: "Stockport falls within the Greater Manchester administrative area and may be subject to Clean Air Zone requirements. All vans we supply are Euro 6 compliant, ensuring CAZ exemption. Check the GM CAZ boundary map for the specific postcodes in your intended operating area.",
      },
      {
        q: "Does Stockport's proximity to Manchester Airport create extra demand?",
        a: "Yes. Manchester Airport and its surrounding cargo, logistics, and hospitality complex generate significant commercial vehicle traffic on the M56 and M60 corridors near Stockport. Fleet accounts from airport-related businesses can be valuable for a Stockport-based operator.",
      },
      {
        q: "What is the drive time from your workshop to Stockport?",
        a: "Stockport is approximately 45–55 minutes from our workshop via the M56 and M60. You are welcome to collect your conversion from us — this is a popular option for customers in the southern Greater Manchester area.",
      },
    ],
  },
  {
    slug: "warrington",
    name: "Warrington",
    region: "Northwest England",
    regionSlug: "northwest",
    county: "Cheshire",
    nearbyAreas: ["Wigan", "St Helens", "Widnes", "Runcorn", "Northwich"],
    intro:
      "Warrington is one of the most important logistics hubs in the UK. Positioned at the junction of the M6, M56, and M62, it sits at the geographic centre of the Northwest road network, making it the natural home for distribution and warehousing operations. The Birchwood, Winwick, and Risley business parks house some of the UK's largest logistics and manufacturing operations. For a mobile tyre van operator, Warrington offers an exceptional commercial account base and unbeatable motorway access to serve customers across the entire Northwest.",
    deliveryNote:
      "We deliver to Warrington as part of our Northwest delivery area. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Why is Warrington such a strong location for commercial tyre fitting demand?",
        a: "Warrington is a major UK logistics hub. The M6/M56/M62 junction means almost every parcel and pallet moving between the North and South passes through or near Warrington. The town's business parks are home to major distribution centres with large HGV and LCV fleets — a ready-made commercial account base for a mobile tyre operator.",
      },
      {
        q: "Can a Warrington-based mobile tyre van also serve Cheshire, Merseyside, and Greater Manchester?",
        a: "Absolutely. Warrington's central position allows you to reach Liverpool (25 min), Manchester (30 min), Wigan (20 min), Chester (30 min), and Runcorn (15 min) with ease. Many of our most successful customers operate from Warrington precisely because of this geographic advantage.",
      },
      {
        q: "Does Warrington have a Clean Air Zone?",
        a: "Warrington does not currently operate a Clean Air Zone. However, if you intend to serve customers in nearby Manchester, Liverpool, or Chester (which has a CAZ), ensure your van is Euro 6 compliant — all vehicles we supply meet this standard.",
      },
    ],
  },
  {
    slug: "chester",
    name: "Chester",
    region: "Northwest England",
    regionSlug: "northwest",
    county: "Cheshire",
    nearbyAreas: ["Wrexham", "Ellesmere Port", "Warrington", "Neston", "Mold"],
    intro:
      "Chester is a historic cathedral city and the commercial centre of West Cheshire. The Chester CAZ covers the city centre, which means mobile tyre operators working within its boundary must be in Euro 6 compliant vehicles — a standard all our conversions meet. Chester's Deeside Industrial Park (just across the Welsh border) and the business parks along the A55/A483 corridor provide significant commercial fleet accounts, while Chester's affluent residential population and popular retail parks create a strong retail tyre demand.",
    deliveryNote:
      "Chester is 20 minutes from our workshop. We can deliver your completed conversion on the handover day at no extra charge, or you can collect from our workshop.",
    faqs: [
      {
        q: "Chester has a Clean Air Zone — is a mobile tyre van affected?",
        a: "Chester operates a Class C CAZ covering the city centre. Diesel vans that are non-Euro 6 are subject to a daily charge. All vans we supply are Euro 6 compliant, meaning they are fully exempt from the Chester CAZ charge. This is an important consideration when choosing your base vehicle.",
      },
      {
        q: "Can a Chester-based mobile tyre van serve North Wales as well?",
        a: "Yes. Chester sits on the Welsh border, and the A55 North Wales Expressway gives rapid access to Wrexham, Rhyl, and Llandudno. Many Chester-based operators find it profitable to combine West Cheshire and North Wales in their patch.",
      },
      {
        q: "How close is Chester to your UK workshop?",
        a: "Chester is approximately 20 minutes from our workshop via the M53 and A41. We can deliver your completed van on the day of handover at no extra charge, or you are welcome to collect from us in person.",
      },
    ],
  },
  {
    slug: "st-helens",
    name: "St Helens",
    region: "Northwest England",
    regionSlug: "northwest",
    county: "Merseyside",
    nearbyAreas: ["Warrington", "Wigan", "Liverpool", "Prescot", "Newton-le-Willows"],
    intro:
      "St Helens is a large industrial and commercial town at the heart of Merseyside. Known historically for glass manufacturing and chemical production, the town now has a diverse economic base with significant logistics and distribution activity along the M62 corridor. The Haydock Industrial Estate and Haydock Racecourse vicinity host major national distribution hubs, creating strong commercial tyre demand. The town's position between Liverpool, Wigan, and Warrington makes a St Helens-based operator well placed to serve a large geographic area.",
    deliveryNote:
      "We deliver to St Helens as part of our Merseyside delivery area. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "What distribution companies in St Helens create mobile tyre demand?",
        a: "The Haydock Industrial Estate, Omega Business Park, and the logistics clusters around the M62 Junction 23 area house national distribution operations from multiple large carriers. These generate significant demand for commercial vehicle tyre services, including emergency breakdown cover — a high-value service for mobile tyre operators.",
      },
      {
        q: "How is St Helens positioned for serving the wider Merseyside area?",
        a: "St Helens sits centrally between Liverpool (west), Wigan (north), and Warrington (east), with the M62 providing fast east-west access. A van based in St Helens can reach each of these areas within 20–25 minutes, making it a strong hub for regional Merseyside and Southwest Lancashire coverage.",
      },
      {
        q: "Is there a Clean Air Zone in St Helens?",
        a: "St Helens does not currently operate a Clean Air Zone. Neighbouring areas may have restrictions, so Euro 6 compliance — standard on all our conversions — is important for operators who intend to range widely.",
      },
    ],
  },
  {
    slug: "lancaster",
    name: "Lancaster",
    region: "Northwest England",
    regionSlug: "northwest",
    county: "Lancashire",
    nearbyAreas: ["Morecambe", "Preston", "Kendal", "Carnforth", "Heysham"],
    intro:
      "Lancaster is the historic county town of Lancashire and the main service centre for North Lancashire and the western edge of the Yorkshire Dales. The town's position on the M6 between Preston and the Lake District makes it the key commercial gateway to the Cumbrian coast and Morecambe Bay area. Lancaster University, Lancaster Royal Infirmary, and the Port of Heysham create an anchor commercial base, and the residential population across Lancaster, Morecambe, and the surrounding villages provides steady retail tyre demand.",
    deliveryNote:
      "We deliver to Lancaster as part of our Lancashire delivery area. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Can a Lancaster-based mobile tyre van also cover Cumbria and the Lake District?",
        a: "Yes. Lancaster sits at the M6 junction with the A6 north-south route, giving access to Kendal and the southern Lake District in approximately 25 minutes. Many Lancaster operators extend their patch into Cumbria, covering the Barrow-in-Furness and Kendal areas in the same working day.",
      },
      {
        q: "What commercial vehicle traffic exists around Lancaster?",
        a: "The Port of Heysham generates ferry-related commercial traffic on the A683 corridor. Lancaster University and Heysham industrial estate create fleet vehicle demand. The M6 itself carries substantial HGV traffic that regularly requires roadside tyre assistance — a good market for breakdown-specialist mobile tyre operators.",
      },
      {
        q: "Is Lancaster affected by Clean Air Zone restrictions?",
        a: "Lancaster does not operate a Clean Air Zone. All vans we supply are Euro 6 compliant as standard.",
      },
    ],
  },
  {
    slug: "oldham",
    name: "Oldham",
    region: "Northwest England",
    regionSlug: "northwest",
    county: "Greater Manchester",
    nearbyAreas: ["Manchester", "Rochdale", "Ashton-under-Lyne", "Saddleworth", "Failsworth"],
    intro:
      "Oldham is a large metropolitan borough in northeast Greater Manchester, with a strong manufacturing and retail commercial base along the A627M and M60 corridors. The borough borders Rochdale, Ashton-under-Lyne, and the western edge of the Peak District, giving a mobile tyre operator broad coverage options from urban industrial accounts to rural semi-commercial customers.",
    deliveryNote:
      "We deliver to Oldham as part of our Greater Manchester delivery area. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Does Oldham fall within Greater Manchester's Clean Air Zone?",
        a: "Oldham is part of the Greater Manchester administrative area. All vans we supply are Euro 6 compliant, ensuring CAZ exemption in any current or future Manchester Clean Air Zone restrictions.",
      },
      {
        q: "What routes does a mobile tyre van operator typically cover from Oldham?",
        a: "From Oldham, operators typically cover the M60 eastern arc (Ashton, Tameside), northeast Manchester, and Rochdale. The A627M provides fast access to the motorway network. Saddleworth and the Pennine edge communities also provide rural coverage opportunity.",
      },
      {
        q: "How long does delivery to Oldham take from your workshop?",
        a: "Oldham is approximately 50 minutes from our workshop via the M56 and M60. You can also collect from our workshop at a time that suits you.",
      },
    ],
  },
  {
    slug: "rochdale",
    name: "Rochdale",
    region: "Northwest England",
    regionSlug: "northwest",
    county: "Greater Manchester",
    nearbyAreas: ["Oldham", "Bury", "Halifax", "Heywood", "Milnrow"],
    intro:
      "Rochdale is a large town in the Pennine foothills north of Manchester, with an active industrial base along the M62 corridor and strong connections to Yorkshire via the A58 trans-Pennine route. The Kingsway Business Park near junction 20 of the M62 is one of the largest business parks in the North of England and generates substantial commercial fleet demand. Rochdale's position on the Lancashire-Yorkshire border makes it a useful hub for operators wanting to cover both sides of the Pennines.",
    deliveryNote:
      "We deliver to Rochdale as part of our Greater Manchester delivery area. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "What is Kingsway Business Park and why is it relevant for mobile tyre fitting?",
        a: "Kingsway Business Park, adjacent to M62 Junction 20, is one of the largest employment sites in the North of England, housing major logistics, retail, and manufacturing operations. The fleet vehicle density on site makes it a high-value area for mobile tyre operators to develop commercial accounts.",
      },
      {
        q: "Can a Rochdale-based operator efficiently cover both Lancashire and Yorkshire?",
        a: "Yes. The M62 connects Rochdale to Halifax and Bradford in the east, and Bury and Manchester to the west. The A58 over Blackstone Edge is a secondary trans-Pennine route used by operators wanting to avoid motorway diversions. Rochdale's position makes it genuinely cross-Pennine in its coverage reach.",
      },
      {
        q: "Does Rochdale fall within Greater Manchester's Clean Air Zone?",
        a: "Rochdale is within the Greater Manchester administrative boundary. All our conversions are Euro 6 compliant, protecting you from any CAZ charges within the GM zone.",
      },
    ],
  },
  // ── Yorkshire & Humber ──────────────────────────────────────────────────────
  {
    slug: "leeds",
    name: "Leeds",
    region: "Yorkshire & Humber",
    regionSlug: "yorkshire",
    county: "West Yorkshire",
    nearbyAreas: ["Bradford", "Wakefield", "Harrogate", "Huddersfield", "Castleford"],
    intro:
      "Leeds is the UK's third largest city and the financial and commercial capital of the North. With a population of nearly 800,000 and a vast commercial infrastructure spanning financial services, retail, manufacturing, and logistics, the demand for mobile tyre fitting is consistent and high-volume. Leeds operates a Clean Air Zone in the city centre, reinforcing the importance of Euro 6 compliance for any van working in and around the city.",
    deliveryNote:
      "We deliver to Leeds as part of our Yorkshire delivery area. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Does Leeds have a Clean Air Zone that affects commercial vans?",
        a: "Yes. Leeds City Council operates a Class B CAZ that applies to diesel vehicles that do not meet Euro 6 standards. All vans we supply are Euro 6 compliant and exempt from the Leeds CAZ daily charge. This is an important consideration for any mobile tyre operator working within the city boundary.",
      },
      {
        q: "Is Leeds a strong market for mobile tyre fitting?",
        a: "Yes. Leeds has a large commercial vehicle base across multiple sectors — financial services office fleets, retail distribution, manufacturing in the south Leeds industrial corridor, and a busy construction sector. Demand for both retail and fleet mobile tyre work is strong and consistent throughout the year.",
      },
      {
        q: "How long does delivery of a completed van conversion take to Leeds?",
        a: "We deliver to Leeds within 1–2 working days of sign-off. Leeds is approximately 90 minutes from our UK workshop via the M62.",
      },
    ],
  },
  {
    slug: "sheffield",
    name: "Sheffield",
    region: "Yorkshire & Humber",
    regionSlug: "yorkshire",
    county: "South Yorkshire",
    nearbyAreas: ["Rotherham", "Barnsley", "Doncaster", "Chesterfield", "Worksop"],
    intro:
      "Sheffield is the UK's fourth largest metropolitan area and the industrial powerhouse of South Yorkshire. The city has strong manufacturing and logistics credentials — particularly in advanced manufacturing and steel — and the Sheffield City Region (including Rotherham) operates a substantial commercial vehicle base. Sheffield is also home to a significant university population and large residential catchment area, creating a well-rounded demand profile for mobile tyre fitting.",
    deliveryNote:
      "We deliver to Sheffield as part of our Yorkshire delivery area. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Is Sheffield a good market for commercial vehicle tyre fitting?",
        a: "Yes. Sheffield's advanced manufacturing sector, distribution parks, and the M1 motorway corridor through Rotherham and the Dearne Valley create strong commercial fleet demand. The Sheffield-Rotherham conurbation has one of the highest concentrations of manufacturing employment in the UK.",
      },
      {
        q: "Does Sheffield have Clean Air Zone restrictions?",
        a: "Sheffield operates a CAZ covering the city centre. Older diesel vans may be charged. All our conversions are Euro 6 compliant and are exempt from Sheffield's CAZ charges.",
      },
      {
        q: "What areas can a Sheffield-based operator cover efficiently?",
        a: "From Sheffield you can cover Rotherham (10 min), Barnsley (20 min), Chesterfield (20 min), and Doncaster (25 min) with ease via the M1/A1(M) motorway network. This gives a Sheffield operator a very large South Yorkshire and North Derbyshire catchment.",
      },
    ],
  },
  {
    slug: "bradford",
    name: "Bradford",
    region: "Yorkshire & Humber",
    regionSlug: "yorkshire",
    county: "West Yorkshire",
    nearbyAreas: ["Leeds", "Huddersfield", "Halifax", "Keighley", "Shipley"],
    intro:
      "Bradford is one of the UK's most ethnically diverse cities and an important commercial centre in the West Yorkshire conurbation. The city has a substantial textile and manufacturing heritage, and today its commercial base spans retail, distribution, and professional services. Bradford's position on the M606 (connecting to the M62) gives rapid access to Leeds and the wider West Yorkshire motorway network, making it a viable base for a mobile tyre operation covering a large urban area.",
    deliveryNote:
      "We deliver to Bradford as part of our Yorkshire delivery area. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Is Bradford covered by West Yorkshire's Clean Air Zone?",
        a: "Yes. Bradford is part of the West Yorkshire CAZ, which covers Bradford city centre and parts of surrounding districts. All vans we supply are Euro 6 compliant and exempt from CAZ charges across the West Yorkshire zone.",
      },
      {
        q: "Can a Bradford-based operator serve Leeds and the wider West Yorkshire area?",
        a: "Yes. Bradford and Leeds are just 10–15 minutes apart via the M606/M62. Many operators cover both cities and surrounding towns from a single Bradford or Leeds base, servicing commercial accounts in both city centres and the motorway industrial corridors between them.",
      },
      {
        q: "What commercial sectors drive tyre demand in Bradford?",
        a: "Bradford has a large retail and distribution base — the Eureka Business Park and the Bradford IKEA retail corridor generate significant van fleet traffic. The city also has a substantial taxi and private hire sector, which provides consistent retail tyre call-out demand.",
      },
    ],
  },
  {
    slug: "hull",
    name: "Hull",
    region: "Yorkshire & Humber",
    regionSlug: "yorkshire",
    county: "East Riding of Yorkshire",
    nearbyAreas: ["Beverley", "Scunthorpe", "Goole", "Hessle", "Brough"],
    intro:
      "Hull (Kingston upon Hull) is a major port city at the mouth of the Humber estuary, with one of the UK's busiest ferry ports and a significant industrial base in chemicals, food processing, and offshore wind energy. The A63 and M62 connect Hull to the national motorway network, and the Humber Bridge links it to Lincolnshire. Hull's port-related commercial vehicle traffic and the wind energy supply chain create strong demand for both fleet and breakdown mobile tyre services.",
    deliveryNote:
      "We deliver to Hull as part of our Yorkshire delivery area. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Does Hull's port and offshore energy sector create mobile tyre demand?",
        a: "Yes. Hull's Humber Container Terminal, P&O Ferries terminal, and the Siemens Gamesa wind turbine manufacturing facility all operate large vehicle fleets. The Humber Industrial Belt between Hull and Scunthorpe has extensive chemical and processing plant traffic. These industrial accounts can be very valuable for a commercial-focused mobile tyre operator.",
      },
      {
        q: "Is there a Clean Air Zone in Hull?",
        a: "Hull does not currently operate a Clean Air Zone or ULEZ. All our van conversions are Euro 6 compliant as standard, future-proofing your vehicle for any future air quality measures.",
      },
      {
        q: "Can I collect my van from your UK workshop if I'm based in Hull?",
        a: "Yes. Hull is approximately 2 hours from our workshop via the M62. Many customers in East Yorkshire and Humber make the trip to collect in person, as it gives them a chance to receive a full handover briefing from our build team.",
      },
    ],
  },
  {
    slug: "york",
    name: "York",
    region: "Yorkshire & Humber",
    regionSlug: "yorkshire",
    county: "North Yorkshire",
    nearbyAreas: ["Leeds", "Harrogate", "Hull", "Selby", "Thirsk"],
    intro:
      "York is a historic city and a major tourist destination, but it also has a substantial commercial vehicle base across food and drink manufacturing, distribution, and professional services. The A64/A1(M) corridor connects York to Leeds, Harrogate, and the wider Yorkshire motorway network. As one of the most visited UK cities, York's taxi and private hire fleet is large, creating consistent call-out demand for mobile tyre fitting.",
    deliveryNote:
      "We deliver to York as part of our Yorkshire delivery area. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Is York a viable location for a mobile tyre fitting business?",
        a: "Yes. York's large taxi fleet, delivery vehicle base, and the manufacturing and distribution operations around the A64 and York Business Park provide solid demand. The city's high visitor footfall also means breakdown and retail tyre call-outs are common year-round.",
      },
      {
        q: "Does York have any traffic restrictions that affect a mobile tyre van?",
        a: "York's city centre has a number of parking and access restrictions, but mobile tyre operators typically attend customers' premises rather than working in restricted zones. York does not currently operate a CAZ or ULEZ. All our conversions are Euro 6 compliant.",
      },
      {
        q: "What areas can a York-based operator cover on a typical day?",
        a: "From York you can cover Selby (20 min), Harrogate (30 min), Malton (25 min), and Leeds (40 min via A64/A63) on a normal working day. The A1(M) north gives access to Thirsk, Northallerton, and Teesside for operators wanting extended coverage.",
      },
    ],
  },
  {
    slug: "doncaster",
    name: "Doncaster",
    region: "Yorkshire & Humber",
    regionSlug: "yorkshire",
    county: "South Yorkshire",
    nearbyAreas: ["Rotherham", "Sheffield", "Barnsley", "Worksop", "Scunthorpe"],
    intro:
      "Doncaster is one of the most important logistics hubs in the North of England. The A1(M) and M18 motorway junction near Doncaster handles a vast proportion of north-south UK freight, and the iPort Doncaster logistics park is one of the largest in Europe. Robin Hood Airport (DSA) and the Doncaster rail freight terminal add to the commercial vehicle density. For mobile tyre fitting, Doncaster offers an unparalleled concentration of HGV and LCV fleet accounts along the motorway corridors.",
    deliveryNote:
      "We deliver to Doncaster as part of our South Yorkshire delivery area. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Why is Doncaster such a strong location for commercial mobile tyre work?",
        a: "Doncaster is at the A1(M)/M18 motorway junction, which carries more freight than almost any other junction in the UK. The iPort Doncaster logistics park, Gateway East, and the rail freight terminal create the highest concentration of HGV fleet tyre demand outside the M25 area. A Doncaster-based mobile tyre operator with commercial focus can build a very strong fleet account base.",
      },
      {
        q: "Does Doncaster have a Clean Air Zone?",
        a: "Doncaster does not currently operate a Clean Air Zone. All our van conversions are Euro 6 compliant as standard.",
      },
      {
        q: "Can a Doncaster operator also cover the A1(M) corridor northwards to Wakefield and Leeds?",
        a: "Yes. The A1(M) north from Doncaster reaches Wakefield in 20 minutes and Leeds in 35 minutes. Many South Yorkshire operators combine Doncaster's logistics cluster with the M62 West Yorkshire commercial corridor to maximise daily revenue.",
      },
    ],
  },
  {
    slug: "huddersfield",
    name: "Huddersfield",
    region: "Yorkshire & Humber",
    regionSlug: "yorkshire",
    county: "West Yorkshire",
    nearbyAreas: ["Leeds", "Bradford", "Halifax", "Dewsbury", "Holmfirth"],
    intro:
      "Huddersfield is situated in the Colne Valley at the western edge of the West Yorkshire urban area. The town has strong manufacturing roots and benefits from excellent M62 motorway access connecting it to both Leeds/Bradford and Manchester. The Huddersfield New College, University of Huddersfield, and the town's strong textile and engineering heritage make it a varied commercial base. The M62 trans-Pennine corridor running through Huddersfield is one of the UK's busiest, creating excellent breakdown call-out opportunities.",
    deliveryNote:
      "We deliver to Huddersfield as part of our Yorkshire delivery area. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Is Huddersfield covered by West Yorkshire's Clean Air Zone?",
        a: "Huddersfield falls within the West Yorkshire CAZ area. All our conversions are Euro 6 compliant and exempt from West Yorkshire CAZ charges.",
      },
      {
        q: "What makes the M62 corridor important for a Huddersfield mobile tyre operator?",
        a: "The M62 between Manchester and Leeds passes directly through Huddersfield at some of the highest elevations of any UK motorway. HGVs and LCVs frequently experience tyre issues in this stretch, particularly in cold or wet conditions. A Huddersfield-based breakdown-focused mobile tyre operator is well-placed to attend M62 incidents quickly.",
      },
      {
        q: "Can a Huddersfield operator serve Halifax and Dewsbury as well?",
        a: "Yes. Halifax is 15 minutes north-west, Dewsbury 15 minutes east, and Bradford 20 minutes north — all easily covered from a Huddersfield base. Many West Yorkshire operators use a hub-and-spoke model from Huddersfield to cover the whole western Yorkshire conurbation.",
      },
    ],
  },
  {
    slug: "rotherham",
    name: "Rotherham",
    region: "Yorkshire & Humber",
    regionSlug: "yorkshire",
    county: "South Yorkshire",
    nearbyAreas: ["Sheffield", "Barnsley", "Doncaster", "Maltby", "Swinton"],
    intro:
      "Rotherham is the industrial twin of Sheffield, with a major steel and advanced manufacturing base and excellent M1/M18 motorway access. The Advanced Manufacturing Park at Waverley and the Manvers industrial corridor generate significant commercial fleet demand. Rotherham's position between Sheffield, Barnsley, and Doncaster makes it a strong hub for an operator wanting to cover the entire South Yorkshire metropolitan area.",
    deliveryNote:
      "We deliver to Rotherham as part of our South Yorkshire delivery area. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "What industrial areas in Rotherham create fleet tyre demand?",
        a: "The Advanced Manufacturing Park at Waverley (home to Boeing, Rolls-Royce, and other advanced manufacturers), the Manvers industrial area, and the Magna Business Park all house significant fleet operations. The M1 corridor north of Sheffield through Rotherham is also densely populated with distribution and logistics facilities.",
      },
      {
        q: "Is Rotherham covered by Sheffield's Clean Air Zone?",
        a: "Rotherham has its own separate borough boundary from Sheffield. All our conversions are Euro 6 compliant, ensuring CAZ exemption wherever you operate in the South Yorkshire area.",
      },
      {
        q: "Is delivery to Rotherham included in your UK-wide delivery service?",
        a: "Yes. We deliver to Rotherham as part of our UK-wide delivery offer. Contact us to confirm current delivery timescales for South Yorkshire.",
      },
    ],
  },
  {
    slug: "halifax",
    name: "Halifax",
    region: "Yorkshire & Humber",
    regionSlug: "yorkshire",
    county: "West Yorkshire",
    nearbyAreas: ["Bradford", "Huddersfield", "Rochdale", "Brighouse", "Elland"],
    intro:
      "Halifax is the administrative centre of Calderdale and an important industrial town in the West Yorkshire Pennines. The town sits at the head of the Calder Valley, with the M62 providing east-west access towards both Manchester and Leeds. Halifax's central position in the M62 corridor, its established manufacturing base at Copley Valley and Sowerby Bridge, and the dense residential population of Calderdale make it a solid base for a mobile tyre operation.",
    deliveryNote:
      "We deliver to Halifax as part of our Yorkshire delivery area. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Is Halifax in the West Yorkshire Clean Air Zone?",
        a: "Halifax falls within the Calderdale district, which is part of the West Yorkshire Combined Authority. All our van conversions are Euro 6 compliant and exempt from West Yorkshire CAZ charges.",
      },
      {
        q: "Can a Halifax-based operator cover Rochdale and East Lancashire as well as Yorkshire?",
        a: "Yes. The A58 trans-Pennine route connects Halifax to Rochdale in approximately 30 minutes, making cross-Pennine coverage viable from a Halifax base. You could cover Huddersfield, Bradford, Brighouse, and Sowerby Bridge in Yorkshire alongside Rochdale and Bury in Lancashire from a single Halifax operation.",
      },
      {
        q: "What commercial vehicle traffic exists in the Halifax Calder Valley corridor?",
        a: "The Calder Valley commercial corridor includes significant distribution, manufacturing, and construction activity along the A646 and M62 spur roads. Brighouse and Elland business parks, accessed from M62 Junction 25, have a high density of commercial vehicle traffic in the eastern Calderdale area.",
      },
    ],
  },
  // ── West Midlands ───────────────────────────────────────────────────────────
  {
    slug: "birmingham",
    name: "Birmingham",
    region: "West Midlands",
    regionSlug: "west-midlands",
    county: "West Midlands",
    nearbyAreas: ["Coventry", "Wolverhampton", "Dudley", "Solihull", "Sutton Coldfield"],
    intro:
      "Birmingham is the UK's second largest city and the commercial heart of the Midlands. With a population of over 1.1 million in the city alone — and 2.8 million in the wider West Midlands conurbation — Birmingham generates enormous demand for mobile tyre fitting across both commercial and residential accounts. Birmingham operates a Clean Air Zone in the city centre, and the scale of the city means a well-operated mobile tyre van business can easily build a full day of jobs without leaving a small geographic patch.",
    deliveryNote:
      "We deliver to Birmingham as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Does Birmingham's Clean Air Zone affect mobile tyre vans?",
        a: "Yes. Birmingham operates a Class D CAZ covering the city centre. Older diesel vans are subject to a daily charge. All vans we supply are Euro 6 compliant and fully exempt from the Birmingham CAZ. Operating in Birmingham without a compliant van would cost you £9 per day in CAZ charges — a significant annual cost.",
      },
      {
        q: "Is the Birmingham market highly competitive for mobile tyre fitting?",
        a: "Birmingham is a large enough city to support multiple mobile tyre operators. The key is differentiating your service — whether by speed, commercial fleet specialisation, extended hours, or premium tyres. The city's size means there is sufficient demand for well-run operators to build strong businesses.",
      },
      {
        q: "What areas around Birmingham can a mobile tyre van cover?",
        a: "From Birmingham, operators commonly cover Solihull, Sutton Coldfield, Walsall, Dudley, and Coventry. The M42, M6, and M5 motorways radiate outward from Birmingham, giving rapid access to all parts of the West Midlands conurbation.",
      },
    ],
  },
  {
    slug: "coventry",
    name: "Coventry",
    region: "West Midlands",
    regionSlug: "west-midlands",
    county: "West Midlands",
    nearbyAreas: ["Birmingham", "Leamington Spa", "Rugby", "Nuneaton", "Kenilworth"],
    intro:
      "Coventry is the UK's motor city — home to Jaguar Land Rover and a major hub of automotive manufacturing and logistics. The city's strong engineering and manufacturing base generates substantial commercial fleet tyre demand, and its position at the junction of the M6, M69, and M45 makes it one of the most connected cities in the UK road network. Coventry operates its own Clean Air Zone, reinforcing the need for Euro 6 compliant vehicles for any operator working in the city.",
    deliveryNote:
      "We deliver to Coventry as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Does Coventry's automotive sector create good mobile tyre demand?",
        a: "Yes. Jaguar Land Rover, which is headquartered in Coventry and Solihull, operates one of the UK's largest private vehicle fleets. The Coventry and Warwickshire automotive supply chain includes dozens of tier-1 and tier-2 manufacturers with large LCV fleets — excellent potential commercial accounts for a mobile tyre operator.",
      },
      {
        q: "Is there a Clean Air Zone in Coventry?",
        a: "Yes. Coventry operates a CAZ covering the city centre. All our van conversions are Euro 6 compliant and are exempt from Coventry's CAZ charges.",
      },
      {
        q: "How long does delivery of a converted van take to Coventry?",
        a: "We deliver to Coventry within 1–2 working days of sign-off. Coventry is approximately 2 hours from our UK workshop via the M6.",
      },
    ],
  },
  {
    slug: "wolverhampton",
    name: "Wolverhampton",
    region: "West Midlands",
    regionSlug: "west-midlands",
    county: "West Midlands",
    nearbyAreas: ["Birmingham", "Dudley", "Walsall", "Bridgnorth", "Telford"],
    intro:
      "Wolverhampton is the principal city of the Black Country and an important commercial and industrial centre in the West Midlands. The city has a strong manufacturing heritage and benefits from excellent motorway access via the M6, M54, and M5. The i54 Business Park near Wolverhampton Airport hosts major manufacturing tenants including Jaguar Land Rover and Moog, creating high-value commercial fleet accounts. Wolverhampton's central position in the western West Midlands makes it a strong base for covering the Black Country, South Staffordshire, and Shropshire.",
    deliveryNote:
      "We deliver to Wolverhampton as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "What is the i54 Business Park and why is it relevant for mobile tyre fitting?",
        a: "The i54 South Staffordshire Business Park, adjacent to the M54, is one of the Midlands' premier advanced manufacturing sites. Tenants include Jaguar Land Rover's engine manufacturing centre and Moog's Wolverhampton facility. These operations have large vehicle fleets and create recurring commercial tyre demand.",
      },
      {
        q: "Does Wolverhampton have Clean Air Zone restrictions?",
        a: "Wolverhampton does not currently operate its own CAZ, but is adjacent to Birmingham's zone. All our van conversions are Euro 6 compliant for city-wide operation across the West Midlands.",
      },
      {
        q: "Can a Wolverhampton operator cover Telford and Shrewsbury as well?",
        a: "Yes. The M54 connects Wolverhampton to Telford in 20 minutes and Shrewsbury in 40 minutes. Wolverhampton operators often extend their coverage into Shropshire, as there are fewer competing mobile tyre operators there than in the core West Midlands.",
      },
    ],
  },
  {
    slug: "dudley",
    name: "Dudley",
    region: "West Midlands",
    regionSlug: "west-midlands",
    county: "West Midlands",
    nearbyAreas: ["Birmingham", "Wolverhampton", "Stourbridge", "Halesowen", "Brierley Hill"],
    intro:
      "Dudley is the largest town in the Black Country and the commercial centre of the Metropolitan Borough of Dudley. The Merry Hill Shopping Centre and Brierley Hill retail and business district generate significant commercial vehicle traffic, and Dudley's central Black Country position gives easy access to Birmingham, Wolverhampton, and the M5 motorway. The town's industrial base in engineering, metalworking, and distribution creates a solid foundation for commercial fleet tyre accounts.",
    deliveryNote:
      "We deliver to Dudley as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "What commercial areas in Dudley generate mobile tyre demand?",
        a: "The Merry Hill/Brierley Hill retail and business complex, Pensnett Business Park, and the industrial estates around Coseley and Netherton are the main commercial generators in the Dudley area. Retail deliveries and trade vehicles servicing the Merry Hill complex create consistent call-out demand.",
      },
      {
        q: "Is the Dudley area covered by Birmingham's Clean Air Zone?",
        a: "Dudley is outside Birmingham's CAZ boundary but within the wider West Midlands. All our conversions are Euro 6 compliant for operation across the entire region.",
      },
      {
        q: "How does Dudley's position help a mobile tyre van operator?",
        a: "Dudley's central Black Country position means you can reach Birmingham, Wolverhampton, Walsall, and Stourbridge within 20 minutes, and the M5 south is within 15 minutes. This geographic advantage allows you to cover a very large territory from a single Dudley base.",
      },
    ],
  },
  {
    slug: "walsall",
    name: "Walsall",
    region: "West Midlands",
    regionSlug: "west-midlands",
    county: "West Midlands",
    nearbyAreas: ["Birmingham", "Wolverhampton", "Cannock", "Sutton Coldfield", "Aldridge"],
    intro:
      "Walsall is a large industrial town immediately north of Birmingham in the West Midlands conurbation. The town has a strong leather goods and manufacturing heritage and is home to several major distribution operations along the M6 Toll corridor. Walsall's position between Birmingham and Wolverhampton, with the M6 and M6 Toll providing fast north-south access, makes it a well-connected base for mobile tyre operations covering the northern West Midlands.",
    deliveryNote:
      "We deliver to Walsall as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "What is the M6 Toll corridor near Walsall and why is it relevant?",
        a: "The M6 Toll (T-Road) runs from junction 4 of the M6 near Birmingham to junction 12 near Cannock, passing the edge of Walsall. It carries significant commercial traffic that avoids the congested M6. Distribution parks along this corridor create strong commercial fleet tyre demand.",
      },
      {
        q: "Does Walsall fall within Birmingham's Clean Air Zone?",
        a: "Walsall is outside Birmingham's CAZ boundary. All our van conversions are Euro 6 compliant for operation across the entire West Midlands area.",
      },
      {
        q: "What makes Walsall a good location for a mobile tyre business?",
        a: "Walsall's position between Birmingham and Wolverhampton (15 minutes to each) means you have access to both cities' commercial demand from a single base. Cannock and the Staffordshire commercial corridor are also within easy reach, giving you a large effective territory.",
      },
    ],
  },
  {
    slug: "stoke-on-trent",
    name: "Stoke-on-Trent",
    region: "West Midlands",
    regionSlug: "west-midlands",
    county: "Staffordshire",
    nearbyAreas: ["Crewe", "Stafford", "Macclesfield", "Leek", "Newcastle-under-Lyme"],
    intro:
      "Stoke-on-Trent (the Potteries) is the largest city in Staffordshire and an important commercial and logistics hub in the centre of England. The city's position on the M6 corridor between Birmingham and Manchester makes it a natural midpoint for north-south freight distribution. Stoke's Amazon, Bet365, and various manufacturing operations create a large commercial vehicle base, and the city's relatively low cost of operation compared to Birmingham or Manchester makes it attractive for mobile tyre businesses.",
    deliveryNote:
      "We deliver to Stoke-on-Trent as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Is Stoke-on-Trent a good central UK base for a mobile tyre business?",
        a: "Stoke is genuinely close to the geographic centre of England, and its M6 motorway access means you can reach Manchester (45 min), Birmingham (45 min), Sheffield (40 min), and Derby (30 min) without difficulty. For operators wanting to cover a wide central UK territory, Stoke is an excellent base.",
      },
      {
        q: "Does Stoke-on-Trent have a Clean Air Zone?",
        a: "Stoke does not currently operate a CAZ or ULEZ. All our van conversions are Euro 6 compliant as standard.",
      },
      {
        q: "What major employers in Stoke create commercial fleet tyre demand?",
        a: "Bet365's headquarters, Amazon's Stoke fulfilment centre, and a range of pottery, ceramics, and manufacturing operations all operate commercial vehicle fleets. The M6 motorway through the Stoke area also generates HGV breakdown call-out demand.",
      },
    ],
  },
  {
    slug: "shrewsbury",
    name: "Shrewsbury",
    region: "West Midlands",
    regionSlug: "west-midlands",
    county: "Shropshire",
    nearbyAreas: ["Telford", "Wolverhampton", "Wrexham", "Oswestry", "Market Drayton"],
    intro:
      "Shrewsbury is the county town of Shropshire and the main commercial centre for a large rural county with limited urban density. Its unique position makes it a relatively uncrowded market for mobile tyre fitting — competition from established operators is lower than in major cities, yet the county's commercial vehicle base (agriculture, logistics, construction) creates steady demand. The A49/A5 road network radiates outward from Shrewsbury to serve the whole of Shropshire.",
    deliveryNote:
      "We deliver to Shrewsbury as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Is a Shropshire-based mobile tyre business less competitive than a city-based operation?",
        a: "Yes — the Shropshire market has fewer established mobile tyre operators than major cities, which can mean easier account acquisition and stronger customer loyalty. The trade-off is a lower population density, which requires more driving between jobs. Operators who manage their routes efficiently can build a strong, loyal client base in Shropshire.",
      },
      {
        q: "What commercial sectors in Shropshire generate tyre demand?",
        a: "Agriculture (tractors, trailers, and farm vehicles), construction (plant and commercial vehicles), and the Shrewsbury and Telford area NHS Trust all operate large vehicle fleets. Logistics along the A5 corridor between the Midlands and North Wales is also a significant demand driver.",
      },
      {
        q: "Does Shrewsbury have a Clean Air Zone?",
        a: "Shrewsbury does not operate a Clean Air Zone. All our van conversions are Euro 6 compliant as standard.",
      },
    ],
  },
  {
    slug: "telford",
    name: "Telford",
    region: "West Midlands",
    regionSlug: "west-midlands",
    county: "Shropshire",
    nearbyAreas: ["Shrewsbury", "Wolverhampton", "Bridgnorth", "Market Drayton", "Newport"],
    intro:
      "Telford is one of England's newer new towns, built in the 1960s around a planned industrial base that has evolved into a major advanced manufacturing centre. The Telford International Centre, Hortonwood, and Halesfield industrial estates host a wide range of manufacturing and distribution operations. Telford's M54 motorway connection to Wolverhampton and the M6 makes it easily accessible from the core West Midlands, and the town's planned road network means journey times between industrial areas are fast.",
    deliveryNote:
      "We deliver to Telford as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "What makes Telford a strong commercial market for mobile tyre fitting?",
        a: "Telford's planned industrial estates — Hortonwood, Halesfield, and Stafford Park — are among the most densely developed in the UK on a per-hectare basis. The town has a high concentration of advanced manufacturing operations, creating excellent fleet commercial account potential.",
      },
      {
        q: "Is there a Clean Air Zone in Telford?",
        a: "Telford does not operate a Clean Air Zone. All our conversions are Euro 6 compliant as standard.",
      },
      {
        q: "Can a Telford operator cover both Shropshire and the West Midlands?",
        a: "Yes. The M54 connects Telford to Wolverhampton in 20 minutes, giving access to the whole West Midlands conurbation. In the other direction, Shrewsbury is 15 minutes west. Telford operators often combine Shropshire rural coverage with West Midlands commercial accounts via the M54 corridor.",
      },
    ],
  },
  // ── East Midlands ───────────────────────────────────────────────────────────
  {
    slug: "nottingham",
    name: "Nottingham",
    region: "East Midlands",
    regionSlug: "east-midlands",
    county: "Nottinghamshire",
    nearbyAreas: ["Derby", "Leicester", "Mansfield", "Grantham", "Newark"],
    intro:
      "Nottingham is a major East Midlands city with a large commercial and retail base anchored by Boots, Experian, and a growing digital technology sector. The city operates a Clean Air Zone, and its extensive suburban area and surrounding county towns create a large effective market for mobile tyre fitting. The M1 motorway borders the eastern side of the city, making it easily accessible from Sheffield, Leicester, and beyond.",
    deliveryNote:
      "We deliver to Nottingham as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Is there a Clean Air Zone in Nottingham?",
        a: "Yes. Nottingham operates a CAZ covering the city centre. All our van conversions are Euro 6 compliant and exempt from the Nottingham CAZ daily charge.",
      },
      {
        q: "What is the tyre market like in Nottingham and Nottinghamshire?",
        a: "Nottingham city has a large commercial and residential tyre market. The surrounding county — including Mansfield, Newark, Grantham, and Retford — has lower competition and strong demand from agricultural, construction, and distribution sectors.",
      },
      {
        q: "How long does delivery to Nottingham take from your workshop?",
        a: "Nottingham is approximately 2 hours from our workshop via the M6 and M1. We deliver within 1–2 working days of sign-off.",
      },
    ],
  },
  {
    slug: "derby",
    name: "Derby",
    region: "East Midlands",
    regionSlug: "east-midlands",
    county: "Derbyshire",
    nearbyAreas: ["Nottingham", "Burton upon Trent", "Stoke-on-Trent", "Matlock", "Uttoxeter"],
    intro:
      "Derby is an engineering city with a world-class industrial base including Rolls-Royce aerospace and Toyota's UK car manufacturing plant. The city's strong manufacturing and logistics sector creates significant commercial fleet tyre demand. Derby's position at the junction of the A38, A52, and A6 places it at the centre of a large road network covering Derbyshire, South Staffordshire, and Nottinghamshire.",
    deliveryNote:
      "We deliver to Derby as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Does Rolls-Royce and Toyota's presence in Derby create tyre demand?",
        a: "Yes. Both Rolls-Royce and Toyota operate large internal vehicle fleets in Derby, in addition to their supply chain partners who operate LCV fleets throughout the city. Large OEM manufacturers are valuable commercial accounts for mobile tyre operators.",
      },
      {
        q: "Does Derby have a Clean Air Zone?",
        a: "Derby does not currently operate a CAZ. All our van conversions are Euro 6 compliant as standard.",
      },
      {
        q: "Can a Derby operator cover both Nottingham and Stoke-on-Trent?",
        a: "Yes. Nottingham is 20 minutes from Derby via the A52, and Stoke is approximately 35 minutes via the A50/A38. Derby's central position makes it a genuinely versatile base for East and West Midlands coverage.",
      },
    ],
  },
  {
    slug: "leicester",
    name: "Leicester",
    region: "East Midlands",
    regionSlug: "east-midlands",
    county: "Leicestershire",
    nearbyAreas: ["Coventry", "Nottingham", "Loughborough", "Hinckley", "Market Harborough"],
    intro:
      "Leicester is one of the UK's most ethnically diverse cities and an important commercial centre in the East Midlands. The city is home to a major clothing and textile wholesale sector, a large NHS trust, and a growing logistics base around the M1/M69 corridor. Leicester operates a Clean Air Zone in the city centre, and the city's large taxi and private hire sector creates consistent retail tyre call-out demand.",
    deliveryNote:
      "We deliver to Leicester as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Is there a Clean Air Zone in Leicester?",
        a: "Yes. Leicester operates a CAZ covering the city centre. All our van conversions are Euro 6 compliant and fully exempt from Leicester's CAZ charges.",
      },
      {
        q: "What commercial sectors in Leicester generate mobile tyre demand?",
        a: "Leicester's large clothing and textile wholesale district (centred on Narborough Road and St Margaret's Way) generates significant van and LCV fleet traffic. The East Midlands Gateway logistics park near junction 24 of the M1 is also a major distribution hub within easy reach.",
      },
      {
        q: "How does Leicester's central M1/M69 position benefit a mobile tyre operator?",
        a: "Leicester sits where the M1 and M69 intersect, giving fast access to Coventry (30 min west), Nottingham (30 min north), and Northampton (30 min south). A Leicester-based operator can cover a very large East Midlands territory efficiently.",
      },
    ],
  },
  {
    slug: "northampton",
    name: "Northampton",
    region: "East Midlands",
    regionSlug: "east-midlands",
    county: "Northamptonshire",
    nearbyAreas: ["Milton Keynes", "Leicester", "Coventry", "Wellingborough", "Daventry"],
    intro:
      "Northampton is often described as the UK's 'warehouse capital' due to its extraordinary concentration of logistics and distribution operations along the M1 corridor. Major retailers including Amazon, DHL, Hermes, and Royal Mail operate large fulfilment and distribution hubs in Northamptonshire, creating an exceptional commercial van fleet base. Mobile tyre fitting in Northampton is heavily oriented towards commercial fleet accounts.",
    deliveryNote:
      "We deliver to Northampton as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Why is Northampton called the UK's warehouse capital?",
        a: "Northampton and the wider Northamptonshire county has the highest concentration of large-scale distribution warehouses in the UK. The M1 Junction 15–16 area hosts Amazon, DHL, Tesco, Next, Hermes, and Royal Mail distribution centres. For a commercial-focused mobile tyre van, this is one of the strongest fleet account catchment areas in the country.",
      },
      {
        q: "Does Northampton have a Clean Air Zone?",
        a: "Northampton does not currently operate a CAZ or ULEZ. All our van conversions are Euro 6 compliant as standard.",
      },
      {
        q: "What is the geographic coverage advantage of being based in Northampton?",
        a: "Northampton's M1 position means you can reach Milton Keynes (20 min south), Leicester (40 min north), Coventry (35 min west), and Bedford (20 min east) quickly. For operators targeting the logistics and distribution sector, this central East Midlands position is hard to beat.",
      },
    ],
  },
  {
    slug: "peterborough",
    name: "Peterborough",
    region: "East Midlands",
    regionSlug: "east-midlands",
    county: "Cambridgeshire",
    nearbyAreas: ["Cambridge", "Leicester", "Northampton", "Stamford", "Huntingdon"],
    intro:
      "Peterborough is a fast-growing city at the crossroads of the A1(M) and A47, with a strong logistics, food processing, and distribution base. The city's Hampton, Queensgate, and Orton Southgate business parks generate significant commercial vehicle traffic, and Peterborough's geographic position between London, Leicester, and Norfolk makes it a useful hub for operators wanting east Midlands and East of England coverage.",
    deliveryNote:
      "We deliver to Peterborough as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "What industries in Peterborough create mobile tyre demand?",
        a: "Peterborough has a strong food manufacturing and distribution base — companies including Bakkavor, Princes, and various fresh produce distributors operate large refrigerated and standard van fleets. The Queensgate and Orton Southgate industrial areas also have significant engineering and construction vehicle demand.",
      },
      {
        q: "Does Peterborough have a Clean Air Zone?",
        a: "Peterborough does not currently operate a CAZ. All our van conversions are Euro 6 compliant.",
      },
      {
        q: "Can a Peterborough operator cover both the East Midlands and East Anglia?",
        a: "Yes. Peterborough's A47/A1(M) position allows you to reach Cambridge (45 min south-east), Leicester (50 min north-west), and Northampton (50 min west) on a single working day. This cross-regional coverage is a genuine advantage for operators wanting a large territory.",
      },
    ],
  },
  // ── East of England ─────────────────────────────────────────────────────────
  {
    slug: "norwich",
    name: "Norwich",
    region: "East of England",
    regionSlug: "east",
    county: "Norfolk",
    nearbyAreas: ["Ipswich", "Great Yarmouth", "Thetford", "Diss", "Lowestoft"],
    intro:
      "Norwich is the regional capital of East Anglia and the main commercial centre for Norfolk. The city has a strong financial services, public sector, and food processing base, and the surrounding county has extensive agricultural and construction activity generating substantial commercial vehicle demand. East Anglia's relative geographic isolation from the national motorway network means mobile tyre operators face less competition than in major city areas, while the agricultural sector provides a valuable niche in larger tyre sizes.",
    deliveryNote:
      "We deliver to Norwich as part of our nationwide delivery service. Delivery takes 2–3 working days from sign-off for East Anglian destinations.",
    faqs: [
      {
        q: "Is East Anglia a less competitive market for mobile tyre fitting?",
        a: "Generally, yes. East Anglia has fewer established mobile tyre operators than urban areas in the Midlands or Northwest. The agricultural, logistics, and construction sectors in Norfolk and Suffolk provide good commercial account opportunities for operators willing to cover the county's geographically spread demand.",
      },
      {
        q: "Does Norwich have a Clean Air Zone?",
        a: "Norwich does not currently operate a CAZ. All our van conversions are Euro 6 compliant as standard.",
      },
      {
        q: "Can a Norwich operator also cover Great Yarmouth and the Norfolk coast?",
        a: "Yes. Great Yarmouth is 30 minutes from Norwich via the A47. The Norfolk coast and Norfolk Broads area have a tourism and hospitality sector that generates seasonal vehicle demand. Many Norwich-based operators extend their patch across the county.",
      },
    ],
  },
  {
    slug: "ipswich",
    name: "Ipswich",
    region: "East of England",
    regionSlug: "east",
    county: "Suffolk",
    nearbyAreas: ["Norwich", "Colchester", "Bury St Edmunds", "Felixstowe", "Stowmarket"],
    intro:
      "Ipswich is the county town of Suffolk and an important commercial centre in East Anglia. The town's proximity to Felixstowe — the UK's busiest container port — creates significant logistics and HGV-related tyre demand along the A14 corridor. Ipswich's industrial base at the Ransomes Europark and the food processing operations in the wider Suffolk area provide strong commercial fleet account opportunities.",
    deliveryNote:
      "We deliver to Ipswich as part of our nationwide delivery service. Delivery takes 2–3 working days from sign-off for East Anglian destinations.",
    faqs: [
      {
        q: "Does the proximity to Felixstowe port create mobile tyre demand near Ipswich?",
        a: "Yes. The A14 between Ipswich and Felixstowe is one of the busiest freight routes in the UK, carrying container lorries to and from the port continuously. HGV-capable mobile tyre operators working the A14 corridor can build strong breakdown and emergency accounts in addition to LCV fleet work.",
      },
      {
        q: "Does Ipswich have a Clean Air Zone?",
        a: "Ipswich does not currently operate a CAZ. All our van conversions are Euro 6 compliant as standard.",
      },
      {
        q: "What is the A14 corridor and why does it matter for a tyre operator?",
        a: "The A14 runs from the M1 near Kettering through Cambridge to Felixstowe. It is the primary route for container port traffic in East Anglia and one of the UK's busiest freight roads. An Ipswich-based operator is well-placed to offer the A14 corridor as a service area.",
      },
    ],
  },
  {
    slug: "cambridge",
    name: "Cambridge",
    region: "East of England",
    regionSlug: "east",
    county: "Cambridgeshire",
    nearbyAreas: ["Peterborough", "Ipswich", "Luton", "Ely", "Newmarket"],
    intro:
      "Cambridge is one of the world's most renowned university cities and a major UK technology and life sciences hub. The Cambridge Biomedical Campus, Cambridge Science Park, and the arm64 technology corridor create a high-value commercial vehicle base of company car fleets, delivery vans, and specialist research vehicles. Cambridge's affluent residential population also generates strong retail tyre demand.",
    deliveryNote:
      "We deliver to Cambridge as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Does Cambridge's technology sector create mobile tyre demand?",
        a: "Yes. Cambridge's biomedical, pharmaceutical, and technology sectors operate large company car and LCV fleets. The Cambridge Biomedical Campus alone employs over 20,000 people, many of whom drive company vehicles. Prestigious employers in this area tend to value professional, reliable suppliers — an advantage for well-presented mobile tyre operators.",
      },
      {
        q: "Does Cambridge have traffic restrictions for vans?",
        a: "Cambridge city centre has pedestrianised areas and some lorry restrictions, but mobile tyre operators typically attend customers' premises rather than working in restricted zones. Cambridge does not currently operate a CAZ, though all our conversions are Euro 6 compliant.",
      },
      {
        q: "What are typical job types for a Cambridge-based mobile tyre operator?",
        a: "Cambridge operators can expect a mix of company car fleet work (technology and pharmaceutical sector), retail call-outs from the city's substantial residential population, and commercial work from the distribution and logistics operations around Ely, Newmarket, and the A14 corridor.",
      },
    ],
  },
  {
    slug: "luton",
    name: "Luton",
    region: "East of England",
    regionSlug: "east",
    county: "Bedfordshire",
    nearbyAreas: ["Milton Keynes", "Northampton", "St Albans", "Dunstable", "Harpenden"],
    intro:
      "Luton is a large industrial and commercial town in Bedfordshire, home to one of the UK's busiest regional airports and a major logistics cluster. Luton Airport Parkway and the surrounding business parks host significant cargo, ground handling, and logistics operations, generating substantial commercial fleet tyre demand. The M1 Junction 10/11 area south of Luton is also a major distribution corridor connecting to London and the Southeast.",
    deliveryNote:
      "We deliver to Luton as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Does Luton Airport create mobile tyre demand?",
        a: "Yes. Luton Airport's ground handling, cargo operations, and airline support companies operate large vehicle fleets including baggage tugs, towing vehicles, and staff transport buses. Adjacent hotel and logistics businesses also generate fleet demand. Airport-adjacent mobile tyre operators can develop valuable recurring commercial accounts.",
      },
      {
        q: "Does Luton have a Clean Air Zone?",
        a: "Luton does not currently operate a CAZ. All our van conversions are Euro 6 compliant as standard.",
      },
      {
        q: "Can a Luton-based operator cover Milton Keynes and Northampton?",
        a: "Yes. Milton Keynes is approximately 25 minutes from Luton via the M1. Northampton is 30 minutes further north. Luton operators can cover the entire M1 corridor between London and the East Midlands with efficient route planning.",
      },
    ],
  },
  {
    slug: "milton-keynes",
    name: "Milton Keynes",
    region: "East of England",
    regionSlug: "east",
    county: "Buckinghamshire",
    nearbyAreas: ["Northampton", "Luton", "Bedford", "Bletchley", "Newport Pagnell"],
    intro:
      "Milton Keynes is one of the UK's most purpose-built commercial cities, with an exceptional concentration of corporate headquarters, logistics operations, and distribution centres along the M1. Major employers including Amazon, Argos, DHL, and Red Bull are based in Milton Keynes, creating a high-density commercial fleet base. The city's planned grid road system also makes it one of the most navigationally straightforward places in the UK to operate a mobile service business.",
    deliveryNote:
      "We deliver to Milton Keynes as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Why does Milton Keynes have such a high concentration of fleet vehicles?",
        a: "Milton Keynes was planned as a new city with modern road infrastructure and large employment sites, which attracted national and international corporations seeking a central UK base. Consequently, it has an unusually high ratio of corporate fleet vehicles, delivery vans, and distribution trucks relative to its population.",
      },
      {
        q: "Does Milton Keynes have a Clean Air Zone?",
        a: "Milton Keynes does not currently operate a CAZ. All our van conversions are Euro 6 compliant.",
      },
      {
        q: "What is the advantage of Milton Keynes' grid road system for a mobile tyre operator?",
        a: "Milton Keynes is laid out on a regular grid of dual-carriageway H-roads (horizontal) and V-roads (vertical), making it one of the easiest UK cities to navigate. Journey times across the city are predictable, which improves daily job scheduling and minimises unproductive travel time.",
      },
    ],
  },
  // ── London & Southeast ───────────────────────────────────────────────────────
  {
    slug: "east-london",
    name: "East London",
    region: "London & Southeast",
    regionSlug: "london-southeast",
    county: "Greater London",
    nearbyAreas: ["London", "Stratford", "Barking", "Dagenham", "Romford", "Ilford"],
    intro:
      "East London encompasses the boroughs of Newham, Tower Hamlets, Hackney, Barking and Dagenham, Havering, Waltham Forest, and Redbridge — a vast area of over 1.5 million people undergoing significant development and regeneration. The former Olympic Park area at Stratford, the Crossrail Elizabeth line, and the continued growth of Canary Wharf and the tech cluster around Shoreditch create a high-density commercial vehicle environment. East London is also home to major logistics and distribution operations in Barking, Dagenham, and the A13 corridor. All vans must be ULEZ compliant to operate across Greater London — a standard all our conversions meet.",
    deliveryNote:
      "We deliver to East London as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Does my van need to be ULEZ compliant to operate in East London?",
        a: "Yes. Greater London's ULEZ covers all of East London and charges non-compliant diesel vans £12.50 per day. All our van conversions are Euro 6 compliant and fully exempt from the ULEZ charge.",
      },
      {
        q: "What commercial areas in East London generate mobile tyre demand?",
        a: "The A13 logistics corridor between Barking and Thurrock, the Stratford International Station area, Canary Wharf's commercial fleets, and the large residential populations of Newham and Waltham Forest all create substantial tyre demand. Dagenham's Ford engine plant is also in East London, creating fleet account potential.",
      },
      {
        q: "Can an East London operator also cover North and South Essex?",
        a: "Yes. The A12 and A13 out of East London give access to Romford, Chelmsford, and Brentwood in Essex within 30–45 minutes. Many East London operators extend their patch eastward along these corridors.",
      },
    ],
  },
  {
    slug: "south-london",
    name: "South London",
    region: "London & Southeast",
    regionSlug: "london-southeast",
    county: "Greater London",
    nearbyAreas: ["London", "Croydon", "Bromley", "Lewisham", "Wandsworth", "Sutton"],
    intro:
      "South London encompasses the boroughs south of the River Thames — including Croydon, Bromley, Lewisham, Southwark, Lambeth, Wandsworth, Merton, Kingston, and Sutton. The area has a population of approximately 3 million and includes one of the largest commercial business districts outside the City (Croydon) as well as extensive suburban residential areas. London Gatwick Airport, accessible via the M23, adds commercial logistics demand to the south of the area. All vans must be ULEZ compliant for Greater London operation.",
    deliveryNote:
      "We deliver to South London as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Is South London a good market for mobile tyre fitting?",
        a: "Yes. South London has a very large residential population combined with significant commercial activity in Croydon, Brixton, and the South Circular Road corridor. The area's extensive suburban network of residential streets generates consistent retail tyre call-out demand year-round.",
      },
      {
        q: "Does my van need to be ULEZ compliant for South London?",
        a: "Yes. The Greater London ULEZ covers all of South London. All our van conversions are Euro 6 compliant and exempt from the ULEZ daily charge.",
      },
      {
        q: "Can a South London operator reach Croydon and Gatwick efficiently?",
        a: "Yes. Croydon is the largest South London commercial centre, and the M23 from Croydon reaches Gatwick in approximately 20 minutes. Gatwick Airport and its logistics operations are a good commercial account addition for South London operators.",
      },
    ],
  },
  {
    slug: "north-london",
    name: "North London",
    region: "London & Southeast",
    regionSlug: "london-southeast",
    county: "Greater London",
    nearbyAreas: ["London", "Barnet", "Enfield", "Haringey", "Islington", "Camden"],
    intro:
      "North London encompasses the boroughs of Barnet, Enfield, Haringey, Islington, Camden, and Hackney — an area of approximately 1.8 million people ranging from the affluent suburbs of Barnet and Finchley to the densely commercial corridors of Islington and Camden. The A10/A406 North Circular Road creates a key logistics corridor, and the logistics parks around Waltham Cross and Edmonton generate substantial commercial fleet tyre demand. The affluent residential areas of North London — Highgate, Hampstead, East Barnet — create premium retail tyre demand.",
    deliveryNote:
      "We deliver to North London as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Does the North Circular Road create mobile tyre demand in North London?",
        a: "Yes. The A406 North Circular carries enormous commercial vehicle traffic between the M1, M11, A10, and A13 corridors. The Edmonton Green, Waltham Cross, and Enfield logistics cluster generates significant HGV and LCV fleet demand for a north London-based operator.",
      },
      {
        q: "Is North London ULEZ-covered?",
        a: "Yes. All of North London falls within the Greater London ULEZ. All our van conversions are Euro 6 compliant and exempt from ULEZ charges.",
      },
      {
        q: "What is the retail tyre market like in North London's affluent suburbs?",
        a: "The affluent North London suburbs — Barnet, Finchley, Highgate, Hampstead, Muswell Hill — have a high concentration of premium and executive vehicles. These customers often prefer mobile tyre fitting for convenience and are willing to pay a premium for rapid, professional service.",
      },
    ],
  },
  {
    slug: "west-london",
    name: "West London",
    region: "London & Southeast",
    regionSlug: "london-southeast",
    county: "Greater London",
    nearbyAreas: ["London", "Heathrow", "Ealing", "Hounslow", "Hillingdon", "Richmond"],
    intro:
      "West London encompasses the boroughs of Ealing, Hounslow, Hillingdon, Hammersmith and Fulham, and Richmond — an area whose defining commercial feature is Heathrow Airport, Europe's busiest hub. Heathrow's cargo, ground handling, and logistics operations generate an extraordinary density of commercial vehicle fleet traffic on the M4, M25, and A4 corridors. The Tech corridor along the M4 (Slough, Reading tech park) also sends commercial traffic through West London. All vans must be ULEZ compliant for operation across Greater London.",
    deliveryNote:
      "We deliver to West London as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Does Heathrow Airport create mobile tyre demand in West London?",
        a: "Yes — significantly. Heathrow's cargo, ground handling, catering, and logistics operations employ thousands of commercial vehicles. The network of logistics parks on the Bath Road (A4) and the M4 Corridor near Heathrow create one of the highest concentrations of commercial fleet vehicles in the UK.",
      },
      {
        q: "Is West London covered by the ULEZ?",
        a: "Yes. All of West London falls within the Greater London ULEZ. All our van conversions are Euro 6 compliant and fully exempt from the ULEZ daily charge.",
      },
      {
        q: "Can a West London operator cover the M4 corridor into Berkshire and Slough?",
        a: "Yes. The M4 from West London reaches Slough in 20 minutes, Maidenhead in 30 minutes, and Reading in 45 minutes. Many West London operators combine London fleet accounts with the Thames Valley commercial corridor along the M4.",
      },
    ],
  },
  {
    slug: "london",
    name: "London",
    region: "London & Southeast",
    regionSlug: "london-southeast",
    county: "Greater London",
    nearbyAreas: ["Reading", "Oxford", "Luton", "Brighton", "Watford"],
    intro:
      "London is the world's most important financial centre and the UK's largest city, with a population of approximately 9 million across Greater London. Demand for mobile tyre fitting in London is enormous, driven by the sheer number of vehicles, the city's 24/7 commercial activity, and the premium pricing achievable from London customers. All vans operating in London's ULEZ must be Euro 6 compliant — a standard all our conversions meet. Operating in London requires careful planning around Congestion Charges, parking restrictions, and road closures, but the revenue opportunity is unmatched.",
    deliveryNote:
      "We deliver to London as part of our nationwide delivery service. Delivery to Greater London typically takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Does my mobile tyre van need to be ULEZ compliant to work in London?",
        a: "Yes. Greater London's Ultra Low Emission Zone (ULEZ) covers the entire Greater London area and charges non-compliant diesel vans £12.50 per day. All vans we supply are Euro 6 compliant and fully exempt from the ULEZ charge. This is non-negotiable for any operator wanting to work anywhere in Greater London.",
      },
      {
        q: "Is there a Congestion Charge for commercial vans in London?",
        a: "Yes. The Congestion Charge applies to vehicles entering the Central London zone between 7am and 6pm Monday to Friday. The daily charge for vans is currently £15. ULEZ compliance does not exempt you from the Congestion Charge. Mobile tyre operators working primarily in the inner-city zone should factor this cost into their pricing model.",
      },
      {
        q: "Can a London-based mobile tyre operator work profitably?",
        a: "Yes — London typically supports the highest call-out rates and per-job revenue of any UK market. The premium pricing achievable in London more than offsets the ULEZ, Congestion Charge, and higher fuel costs. Many London-based operators specialise in a geographic patch (e.g., South London, East London) rather than trying to cover the whole city.",
      },
    ],
  },
  {
    slug: "reading",
    name: "Reading",
    region: "London & Southeast",
    regionSlug: "london-southeast",
    county: "Berkshire",
    nearbyAreas: ["Oxford", "Slough", "Newbury", "Basingstoke", "Windsor"],
    intro:
      "Reading is one of the most prosperous towns in the UK and a major technology and financial services hub in the Thames Valley. Major employers including Microsoft, Huawei, Oracle, and Vodafone are based in Reading, and the town's M4/A33 junction position gives excellent motorway access to London, Heathrow, and Bristol. Reading's high-earning workforce and corporate fleet base create premium tyre demand from both retail customers and fleet accounts.",
    deliveryNote:
      "We deliver to Reading as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Why is Reading a strong market for mobile tyre fitting?",
        a: "Reading's combination of affluent residential customers and a high concentration of corporate fleet vehicles (technology, financial services, and telecoms sectors) creates premium tyre demand. Technology company fleets often include high-performance vehicles requiring specialist tyres, which command higher margins than standard fitments.",
      },
      {
        q: "Does Reading have a Clean Air Zone?",
        a: "Reading does not currently operate a CAZ. All our van conversions are Euro 6 compliant as standard.",
      },
      {
        q: "Can a Reading operator cover the Thames Valley corridor — Oxford, Slough, and Newbury?",
        a: "Yes. Reading's M4 position gives fast access to Slough (20 min east), Newbury (25 min west), and Oxford (35 min north via the A34). Thames Valley operators based in Reading typically cover a wide geographic area along the M4 corridor.",
      },
    ],
  },
  {
    slug: "oxford",
    name: "Oxford",
    region: "London & Southeast",
    regionSlug: "london-southeast",
    county: "Oxfordshire",
    nearbyAreas: ["Reading", "Milton Keynes", "Swindon", "Banbury", "Witney"],
    intro:
      "Oxford is a world-renowned university city and the home of BMW's MINI plant — the UK's most productive car factory. The city's commercial base spans education, automotive manufacturing, technology, and tourism, creating a diverse and high-value tyre demand profile. Oxford is also the geographical hub of a wide Oxfordshire county with significant agricultural, construction, and logistics activity generating commercial tyre demand beyond the city itself.",
    deliveryNote:
      "We deliver to Oxford as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Does BMW's MINI plant create commercial fleet tyre demand near Oxford?",
        a: "Yes. The BMW MINI plant at Cowley operates one of the UK's largest just-in-time supply chains, with a constant flow of component delivery vans and logistics vehicles. The plant's supplier base around Oxfordshire and South Midlands creates a valuable commercial fleet account opportunity.",
      },
      {
        q: "Does Oxford have a Clean Air Zone?",
        a: "Oxford operates a Zero Emission Zone in the city centre (covering certain streets). While this is primarily targeted at zero-emission compliance for access, mobile tyre operators should be aware of restricted access in the central zone. All our conversions are Euro 6 compliant.",
      },
      {
        q: "Can an Oxford-based operator cover the Cotswolds and rural Oxfordshire?",
        a: "Yes. The Cotswolds and rural Oxfordshire have a substantial agricultural and construction commercial vehicle base with limited mobile tyre coverage compared to urban areas. Many Oxford operators extend their patch into rural Oxfordshire, Gloucestershire, and South Warwickshire.",
      },
    ],
  },
  {
    slug: "brighton",
    name: "Brighton",
    region: "London & Southeast",
    regionSlug: "london-southeast",
    county: "East Sussex",
    nearbyAreas: ["Worthing", "Eastbourne", "Crawley", "Hove", "Lewes"],
    intro:
      "Brighton and Hove is a vibrant coastal city on the Sussex coast and the largest urban centre in the Southeast outside Greater London. The city's creative, digital, and tourism economy generates a mix of commercial and residential tyre demand. Brighton's coastal road network (A27, A259) and its connections to London via the M23/A23 corridor give a Brighton-based operator strong coverage of the Sussex coast and the London commuter belt.",
    deliveryNote:
      "We deliver to Brighton as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Does Brighton have a Clean Air Zone?",
        a: "Brighton does not currently operate a Clean Air Zone. All our van conversions are Euro 6 compliant as standard.",
      },
      {
        q: "Can a Brighton operator cover the wider Sussex coast?",
        a: "Yes. The A27 coast road connects Brighton to Worthing (15 min west), Shoreham (10 min), Eastbourne (45 min east), and Chichester (45 min west). A Sussex coast patch gives a good linear coverage from Chichester to Eastbourne from a Brighton base.",
      },
      {
        q: "What industries in Brighton create commercial fleet tyre demand?",
        a: "Brighton has a large creative, media, and digital sector with numerous agency and technology companies running company car fleets. The hospitality and tourism sector generates delivery van demand. Gatwick Airport (30 min north) creates additional logistics and ground handling fleet potential.",
      },
    ],
  },
  {
    slug: "southampton",
    name: "Southampton",
    region: "London & Southeast",
    regionSlug: "london-southeast",
    county: "Hampshire",
    nearbyAreas: ["Portsmouth", "Bournemouth", "Winchester", "Fareham", "Eastleigh"],
    intro:
      "Southampton is the UK's busiest passenger port and a major container terminal, generating enormous commercial vehicle traffic on the M27 and M3 corridors. The port's logistics operations and the associated supply chain create exceptional HGV and LCV fleet demand. Southampton is also home to Ford Transit manufacturing heritage and has a large commercial vehicle service industry. For mobile tyre fitting, the port corridor and Southampton's business parks represent a strong commercial account base.",
    deliveryNote:
      "We deliver to Southampton as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Does Southampton Port create mobile tyre demand?",
        a: "Yes. Southampton's container terminal and cruise operations generate extensive HGV and logistics traffic on the M27/M271 corridor. Port logistics companies, dockside operators, and the supply chain for the automotive shipping industry all operate large commercial vehicle fleets.",
      },
      {
        q: "Does Southampton have a Clean Air Zone?",
        a: "Southampton does not currently operate a formal CAZ. All our van conversions are Euro 6 compliant as standard.",
      },
      {
        q: "Can a Southampton operator cover Portsmouth and the Isle of Wight?",
        a: "Yes. Portsmouth is 20 minutes from Southampton via the M27. The Isle of Wight is accessible via the Wightlink or Red Funnel ferry from Southampton or Portsmouth — some operators serve regular commercial accounts on the island via ferry, though this adds travel time.",
      },
    ],
  },
  {
    slug: "portsmouth",
    name: "Portsmouth",
    region: "London & Southeast",
    regionSlug: "london-southeast",
    county: "Hampshire",
    nearbyAreas: ["Southampton", "Chichester", "Fareham", "Gosport", "Havant"],
    intro:
      "Portsmouth is a major naval base and ferry port city on the Solent, with a substantial commercial vehicle presence driven by naval logistics, manufacturing, and ferry operations. The city's concentrated geography — Portsmouth is on a small island — means high vehicle density and consistent call-out demand. The M27/A27 coastal corridor connects Portsmouth to Southampton and Brighton, making a Portsmouth base well-placed for coastal Southeast coverage.",
    deliveryNote:
      "We deliver to Portsmouth as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "What industries in Portsmouth create commercial fleet tyre demand?",
        a: "The Royal Navy and BAE Systems shipbuilding operations, Portsmouth International Port's ferry and freight operations, and the retail and distribution centres around Port Solent and Gunwharf all generate commercial vehicle demand. The Tipner industrial corridor also has significant fleet traffic.",
      },
      {
        q: "Does Portsmouth have a Clean Air Zone?",
        a: "Portsmouth does not currently operate a CAZ. All our van conversions are Euro 6 compliant.",
      },
      {
        q: "Can a Portsmouth operator also cover Chichester and the West Sussex coast?",
        a: "Yes. Chichester is 20 minutes from Portsmouth via the A27. The West Sussex coast including Bognor Regis, Littlehampton, and Worthing can all be covered from a Portsmouth base, extending your patch westward from Brighton.",
      },
    ],
  },
  {
    slug: "bournemouth",
    name: "Bournemouth",
    region: "London & Southeast",
    regionSlug: "london-southeast",
    county: "Dorset",
    nearbyAreas: ["Poole", "Christchurch", "Salisbury", "Ringwood", "Blandford Forum"],
    intro:
      "Bournemouth and Poole form the largest urban conurbation on the South Coast, with a combined population of over 500,000. The area's financial services sector (JP Morgan, Barclays), tourism economy, and growing technology base create a varied demand profile for mobile tyre fitting. The A338 and A31 connect Bournemouth to Salisbury and the M27/Southampton corridor, extending coverage into central southern England.",
    deliveryNote:
      "We deliver to Bournemouth as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Is Bournemouth a good market for mobile tyre fitting?",
        a: "Yes. Bournemouth and Poole together have a large residential population and a significant financial services and tourism commercial base. The area's relative geographic isolation from competing mobile operators (compared to the London/M25 area) means demand-to-operator ratios are favourable.",
      },
      {
        q: "Does Bournemouth have a Clean Air Zone?",
        a: "Bournemouth does not currently operate a CAZ. All our van conversions are Euro 6 compliant as standard.",
      },
      {
        q: "Can a Bournemouth operator cover the Dorset and Hampshire coast?",
        a: "Yes. Poole is adjacent to Bournemouth, Christchurch is 10 minutes east, and Weymouth is 45 minutes west via the A35. The Dorset coast and New Forest area can all be covered from a Bournemouth base, giving a large rural and coastal patch with limited direct competition.",
      },
    ],
  },
  // ── Southwest ──────────────────────────────────────────────────────────────
  {
    slug: "bristol",
    name: "Bristol",
    region: "Southwest England",
    regionSlug: "southwest",
    county: "Bristol",
    nearbyAreas: ["Bath", "Swindon", "Gloucester", "Newport", "Weston-super-Mare"],
    intro:
      "Bristol is the Southwest's largest and most commercially diverse city, with a major port, aerospace and defence cluster, creative industries, and a rapidly growing technology sector. The M4/M5 junction position makes Bristol the gateway between London, Wales, and the Southwest. Bristol operates a Clean Air Zone in the city centre, making Euro 6 compliance mandatory for van operators working in the city. The Bristol-Bath corridor is one of the UK's strongest regional economies.",
    deliveryNote:
      "We deliver to Bristol as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Does Bristol have a Clean Air Zone?",
        a: "Yes. Bristol operates a CAZ covering the city centre. Diesel vans that do not meet Euro 6 standards are subject to a daily charge. All our van conversions are Euro 6 compliant and fully exempt from Bristol's CAZ charges.",
      },
      {
        q: "Can a Bristol operator cover Bath and Swindon as well?",
        a: "Yes. Bath is 15 minutes from Bristol via the A4. Swindon is 35 minutes east via the M4. Many Bristol operators combine the city with Bath's affluent residential base and Swindon's large commercial vehicle corridor for comprehensive Southwest coverage.",
      },
      {
        q: "What is the aerospace corridor near Bristol and why is it relevant for mobile tyre?",
        a: "The Bristol-Filton aerospace cluster (Airbus, Rolls-Royce, GKN) employs over 20,000 people and operates extensive vehicle fleets. The BAE Systems and Leonardo operations at Yeovil, 30 miles south, also generate fleet tyre demand in the wider Southwest region.",
      },
    ],
  },
  {
    slug: "exeter",
    name: "Exeter",
    region: "Southwest England",
    regionSlug: "southwest",
    county: "Devon",
    nearbyAreas: ["Plymouth", "Taunton", "Tiverton", "Exmouth", "Newton Abbot"],
    intro:
      "Exeter is the regional capital of Devon and the main commercial centre for the Southwest Peninsula. The city's M5 terminus position makes it the gateway to Devon and Cornwall, and the surrounding county has extensive agricultural, construction, and tourism commercial activity. Exeter Science Park, the RNHRD, and the city's large public sector employer base create a varied commercial fleet demand, while the Devon countryside generates agricultural tyre demand beyond standard van tyres.",
    deliveryNote:
      "We deliver to Exeter as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Is the Southwest Peninsula a competitive mobile tyre market?",
        a: "The Southwest Peninsula (Devon and Cornwall) is one of the least saturated markets in the UK for mobile tyre fitting. Lower population density is offset by high agricultural and construction demand and the absence of competing operators in many rural areas. Operators in this region often travel further per job but face less price competition.",
      },
      {
        q: "Does Exeter have a Clean Air Zone?",
        a: "Exeter does not currently operate a CAZ. All our van conversions are Euro 6 compliant as standard.",
      },
      {
        q: "Can an Exeter-based operator cover Plymouth and the A38 corridor?",
        a: "Yes. Plymouth is approximately 45 minutes from Exeter via the A38. Many Devon operators cover the Exeter-Plymouth corridor as their primary area, supplementing with Newton Abbot, Torbay, and the surrounding coastal communities.",
      },
    ],
  },
  {
    slug: "plymouth",
    name: "Plymouth",
    region: "Southwest England",
    regionSlug: "southwest",
    county: "Devon",
    nearbyAreas: ["Exeter", "Torquay", "Saltash", "Ivybridge", "Tavistock"],
    intro:
      "Plymouth is the largest city in Devon and one of the UK's most significant naval bases. The Royal Navy's Devonport Dockyard is the largest naval base in Western Europe, creating a large military and civilian vehicle fleet base. Plymouth's ferry connections to France, Spain, and the Isles of Scilly also generate commercial vehicle traffic. The city's geographic isolation at the end of the A38 means mobile tyre fitting competition is limited, while demand from the military, construction, and tourism sectors is consistent.",
    deliveryNote:
      "We deliver to Plymouth as part of our nationwide delivery service. Delivery takes 2–3 working days from sign-off.",
    faqs: [
      {
        q: "Does Plymouth's naval base create commercial tyre demand?",
        a: "Yes. Devonport Dockyard and the associated civilian and military vehicle fleets create substantial demand. The dock area's logistics, construction support, and maintenance operations all run commercial vehicle fleets. Civilian contractors and supply chain companies accessing the base also require mobile tyre services.",
      },
      {
        q: "Does Plymouth have a Clean Air Zone?",
        a: "Plymouth does not currently operate a CAZ. All our van conversions are Euro 6 compliant.",
      },
      {
        q: "Is Plymouth geographically isolated for delivery from your UK workshop?",
        a: "Plymouth is our most southwesterly regular delivery area at approximately 3.5 hours from Wirral via the M5 and A38. We deliver to Plymouth as part of our nationwide service. Given the distance, we recommend considering collection from our workshop or agreeing a delivery date well in advance.",
      },
    ],
  },
  {
    slug: "gloucester",
    name: "Gloucester",
    region: "Southwest England",
    regionSlug: "southwest",
    county: "Gloucestershire",
    nearbyAreas: ["Cheltenham", "Bristol", "Swindon", "Ross-on-Wye", "Stroud"],
    intro:
      "Gloucester is an historic cathedral city on the River Severn, positioned at the junction of the M5 and A417, making it the commercial gateway to the Cotswolds and the Forest of Dean. The city's trading estate at Waterwells and the distribution operations around the M5 Junction 12 area generate significant commercial fleet demand. Cheltenham, adjacent to Gloucester, adds a substantial financial services and GCHQ-related employer base to the catchment.",
    deliveryNote:
      "We deliver to Gloucester as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Can a Gloucester operator cover both Bristol and the Midlands?",
        a: "Yes. Bristol is 30 minutes south via the M5, and Cheltenham/Worcestershire is 25 minutes north. Gloucester's M5 position makes it a versatile base for operators wanting to cover the Southwest–Midlands corridor.",
      },
      {
        q: "Does Gloucester have a Clean Air Zone?",
        a: "Gloucester does not currently operate a CAZ. All our van conversions are Euro 6 compliant.",
      },
      {
        q: "What commercial vehicle demand exists in the Gloucester area?",
        a: "The Waterwells and Quedgeley business parks on the A38 corridor south of Gloucester have a range of distribution and manufacturing operations. The M5 motorway itself generates HGV breakdown call-out demand, and the agricultural Cotswolds and Vale of Gloucester create specialist agricultural tyre work.",
      },
    ],
  },
  {
    slug: "taunton",
    name: "Taunton",
    region: "Southwest England",
    regionSlug: "southwest",
    county: "Somerset",
    nearbyAreas: ["Bristol", "Exeter", "Bridgwater", "Yeovil", "Wellington"],
    intro:
      "Taunton is the county town of Somerset and the main commercial centre for the mid-Somerset region. Positioned on the M5 between Bristol and Exeter, Taunton sits at the crossroads of the Southwest's two largest cities. The town's strong agricultural, food processing, and public sector base — including Somerset County Council and Musgrove Park Hospital — creates consistent commercial fleet demand. The M5 corridor through Taunton generates HGV traffic, and the surrounding Somerset Levels have a specialised agricultural vehicle community with distinct tyre requirements.",
    deliveryNote:
      "We deliver to Taunton as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Is Taunton a viable base for a Southwest mobile tyre business?",
        a: "Yes. Taunton's M5 position between Bristol and Exeter gives you access to a large Southwest territory. From Taunton you can cover Bridgwater (15 min north), Yeovil (25 min east), Exeter (35 min south), and Minehead/Exmoor (30 min west) — a sizeable and largely rural Somerset patch with limited mobile tyre competition.",
      },
      {
        q: "Does the Somerset agricultural sector create specialist tyre demand?",
        a: "Yes. Somerset's dairy farming, cider orcharding, and arable sectors operate large fleets of tractors and agricultural machinery requiring specialist tyres. Agricultural and OTR (off-the-road) tyres command higher margins than standard van tyres, so operators who invest in the capability to service farm vehicles can build a valuable revenue stream alongside standard mobile tyre work.",
      },
      {
        q: "Does Taunton have a Clean Air Zone?",
        a: "Taunton does not currently operate a CAZ. All our van conversions are Euro 6 compliant as standard.",
      },
    ],
  },
  {
    slug: "swindon",
    name: "Swindon",
    region: "Southwest England",
    regionSlug: "southwest",
    county: "Wiltshire",
    nearbyAreas: ["Bristol", "Oxford", "Gloucester", "Chippenham", "Cirencester"],
    intro:
      "Swindon is a major commercial and engineering town in North Wiltshire, famous as the home of Honda's UK car plant (now expanded as an EV battery hub) and the former GWR railway works. The town's strong M4 corridor position makes it a key logistics and distribution hub between London, Bristol, and Wales. Swindon's large commercial estates and its position on the M4 generate substantial van fleet and HGV tyre demand.",
    deliveryNote:
      "We deliver to Swindon as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "What makes Swindon a strong commercial market for mobile tyre fitting?",
        a: "Swindon's M4 position makes it a natural distribution hub between London, Bristol, and South Wales. Major retailers including Amazon, WH Smith, and Nationwide Building Society have large operations in Swindon, creating significant commercial fleet demand.",
      },
      {
        q: "Does Swindon have a Clean Air Zone?",
        a: "Swindon does not currently operate a CAZ. All our van conversions are Euro 6 compliant.",
      },
      {
        q: "Can a Swindon operator cover the Cotswolds and rural Wiltshire?",
        a: "Yes. The Cotswolds are accessible from Swindon in 20–30 minutes. Rural Wiltshire — including Chippenham, Marlborough, and Devizes — has agricultural and construction vehicle demand with limited competing mobile tyre operators.",
      },
    ],
  },
  // ── Northeast ───────────────────────────────────────────────────────────────
  {
    slug: "newcastle",
    name: "Newcastle",
    region: "Northeast England",
    regionSlug: "northeast",
    county: "Tyne and Wear",
    nearbyAreas: ["Sunderland", "Gateshead", "Durham", "Hexham", "North Shields"],
    intro:
      "Newcastle upon Tyne is the commercial capital of Northeast England and the gateway to the Scottish border regions. The city's strong financial services, digital technology, and manufacturing base, combined with the Port of Tyne's import/export operations, creates a varied and substantial commercial fleet demand. Newcastle operates an Air Quality Management Area (AQMA) and is developing a Clean Air Zone, making Euro 6 compliance increasingly important for operators in the city.",
    deliveryNote:
      "We deliver to Newcastle as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Is Newcastle developing a Clean Air Zone?",
        a: "Newcastle and Gateshead are progressing plans for a Clean Air Zone. All our van conversions are Euro 6 compliant, ensuring you are not liable for any CAZ charges when the zone is introduced. We strongly recommend Euro 6 compliance for any van intending to operate in the Newcastle area.",
      },
      {
        q: "Can a Newcastle operator cover Northumberland and the Scottish border?",
        a: "Yes. The A1(M) north from Newcastle reaches Morpeth in 20 minutes and Berwick-upon-Tweed in 70 minutes. Northumberland has a large agricultural and construction commercial vehicle base with very few dedicated mobile tyre operators — a genuine opportunity for Newcastle operators wanting to expand their patch.",
      },
      {
        q: "How long does delivery to Newcastle take from your workshop?",
        a: "Newcastle is approximately 2.5 hours from our workshop via the M6 and A1(M). We deliver within 1–2 working days of sign-off.",
      },
    ],
  },
  {
    slug: "sunderland",
    name: "Sunderland",
    region: "Northeast England",
    regionSlug: "northeast",
    county: "Tyne and Wear",
    nearbyAreas: ["Newcastle", "Gateshead", "Durham", "Seaham", "Houghton le Spring"],
    intro:
      "Sunderland is a major city in the Northeast with a strong manufacturing and technology base anchored by Nissan's giant Sunderland factory — the UK's most productive car manufacturing facility. The Port of Sunderland and the city's growing technology corridor at the North East BIC add further commercial fleet demand. Sunderland's position on the A19 between Newcastle and Teesside makes it a well-connected base for Northeast mobile tyre operations.",
    deliveryNote:
      "We deliver to Sunderland as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Does Nissan's Sunderland plant create mobile tyre demand?",
        a: "Yes. Nissan's Sunderland plant is the UK's largest single automotive employer, operating extensive internal logistics fleets and supporting a large supply chain of component manufacturers in the surrounding area. Fleet accounts from Nissan's supply chain can be very valuable for a Sunderland-based mobile tyre operator.",
      },
      {
        q: "Does Sunderland have a Clean Air Zone?",
        a: "Sunderland does not currently operate a formal CAZ. All our van conversions are Euro 6 compliant as standard.",
      },
      {
        q: "What is the A19 corridor and why does it matter for tyre operators?",
        a: "The A19 runs north-south through Sunderland connecting Newcastle to Teesside. It carries significant HGV and LCV freight traffic and passes close to major employers including Nissan and various retail parks. A Sunderland-based operator has strong A19 corridor coverage opportunity.",
      },
    ],
  },
  {
    slug: "middlesbrough",
    name: "Middlesbrough",
    region: "Northeast England",
    regionSlug: "northeast",
    county: "North Yorkshire (Teesside)",
    nearbyAreas: ["Stockton-on-Tees", "Hartlepool", "Darlington", "Redcar", "Durham"],
    intro:
      "Middlesbrough is the commercial centre of Teesside, with one of the UK's most important chemical and process industries concentrated on the Tees estuary. The Teesside chemical industry operates enormous vehicle fleets including tankers, LCVs, and specialist vehicles that require professional mobile tyre support. Teesworks (the former SSI steelworks site) is now the UK's largest Freeport and is attracting significant offshore wind and green energy investment, creating major new fleet vehicle demand.",
    deliveryNote:
      "We deliver to Middlesbrough as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "What is Teesworks and why is it relevant for mobile tyre fitting?",
        a: "Teesworks is a 4,500-acre industrial development on the former SSI steelworks site — now a major Freeport and the UK's largest offshore wind manufacturing hub. Major investments from Orsted, SeAH Wind, and others are bringing thousands of new jobs and extensive new vehicle fleets to the site. A Middlesbrough-based mobile tyre operator is exceptionally well-placed to serve this growing fleet base.",
      },
      {
        q: "Does Middlesbrough have a Clean Air Zone?",
        a: "Middlesbrough does not currently operate a CAZ. All our van conversions are Euro 6 compliant.",
      },
      {
        q: "Can a Middlesbrough operator cover Darlington and the A1(M) corridor?",
        a: "Yes. Darlington is 15 minutes from Middlesbrough via the A66, and the A1(M) at Darlington gives north-south motorway access. The A1(M) north from Darlington reaches Durham in 20 minutes and Newcastle in 35 minutes.",
      },
    ],
  },
  {
    slug: "gateshead",
    name: "Gateshead",
    region: "Northeast England",
    regionSlug: "northeast",
    county: "Tyne and Wear",
    nearbyAreas: ["Newcastle", "Sunderland", "Durham", "Chester-le-Street", "Consett"],
    intro:
      "Gateshead sits directly south of Newcastle across the River Tyne and forms part of the Tyneside conurbation. The MetroCentre — Europe's largest indoor shopping and leisure complex — is located in Gateshead, generating enormous retail delivery and service vehicle traffic. The QEII Bridge corridor and the Gateshead Quays development area have attracted major hotel and entertainment infrastructure. Gateshead's A1(M) access makes it a well-connected base for the South Tyneside area.",
    deliveryNote:
      "We deliver to Gateshead as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Does the MetroCentre create significant mobile tyre demand in Gateshead?",
        a: "Yes. The MetroCentre's retail delivery operations, on-site staff vehicles, and visitor vehicles create substantial ongoing tyre demand. The surrounding Team Valley Trading Estate is also one of the largest business parks in the Northeast, generating consistent commercial fleet call-out work.",
      },
      {
        q: "Does Gateshead fall under Newcastle's proposed Clean Air Zone?",
        a: "Gateshead and Newcastle are jointly developing CAZ plans for the Tyne Bridge corridor. All our van conversions are Euro 6 compliant, ensuring full exemption from any current or future Tyneside CAZ charges.",
      },
      {
        q: "What is Team Valley Trading Estate and why is it relevant?",
        a: "Team Valley, between Gateshead and Birtley, is one of the largest trading estates in the Northeast. It houses hundreds of businesses across manufacturing, retail, and services — creating a concentrated and accessible commercial fleet account base for a Gateshead-based mobile tyre operator.",
      },
    ],
  },
  {
    slug: "durham",
    name: "Durham",
    region: "Northeast England",
    regionSlug: "northeast",
    county: "County Durham",
    nearbyAreas: ["Newcastle", "Sunderland", "Middlesbrough", "Bishop Auckland", "Consett"],
    intro:
      "Durham City is a UNESCO World Heritage Site and a major regional centre for education, healthcare, and public sector employment. The surrounding County Durham has a large rural commercial vehicle base in agriculture, construction, and logistics, with the A1(M) providing north-south motorway access. Durham's position between Newcastle, Sunderland, and Teesside makes it a useful mid-point base for operators wanting to cover the entire Northeast without committing to the higher costs of city-centre operation.",
    deliveryNote:
      "We deliver to Durham as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Is County Durham a good base for covering the wider Northeast?",
        a: "Yes. Durham's A1(M) position gives equidistant access to Newcastle (20 min north), Sunderland (20 min east), and Middlesbrough (30 min south). This central position in the Northeast allows an operator to serve the whole region efficiently from a single base, reducing deadhead travel between jobs.",
      },
      {
        q: "Does Durham have a Clean Air Zone?",
        a: "Durham City is developing a CAZ plan, though it has been subject to revisions. All our van conversions are Euro 6 compliant for full exemption from any current or future Durham CAZ requirements.",
      },
      {
        q: "What commercial activity in County Durham generates tyre demand?",
        a: "The Newton Aycliffe Business Park (one of the largest in the Northeast), Aykley Heads business district, and the County Durham rural sector (agriculture, quarrying, construction) all generate commercial fleet demand. County Durham has one of the UK's largest proportions of working agricultural land, creating a niche market for commercial and agricultural tyre fitting.",
      },
    ],
  },
  // ── Scotland ─────────────────────────────────────────────────────────────────
  {
    slug: "glasgow",
    name: "Glasgow",
    region: "Scotland",
    regionSlug: "scotland",
    county: "Glasgow City / Lanarkshire",
    nearbyAreas: ["Edinburgh", "Paisley", "Motherwell", "Dumbarton", "East Kilbride"],
    intro:
      "Glasgow is Scotland's largest city and the UK's sixth largest urban area, with a population of approximately 2.3 million in the Greater Glasgow and Clyde Valley conurbation. The city is a major commercial and industrial centre with strong logistics, manufacturing (including INEOS automotive), and retail bases. Glasgow operates a Low Emission Zone (LEZ) in the city centre, making Euro 6 compliance mandatory for vans operating within the LEZ boundary.",
    deliveryNote:
      "We deliver to Glasgow as part of our nationwide delivery service. Delivery to Scotland typically takes 2 working days from sign-off.",
    faqs: [
      {
        q: "Does Glasgow's Low Emission Zone affect mobile tyre vans?",
        a: "Yes. Glasgow operates a LEZ covering the city centre, which requires vans to meet Euro 6 (diesel) standards. Non-compliant vehicles are fined. All our van conversions are Euro 6 compliant and fully exempt from Glasgow's LEZ. If you intend to work within the city centre boundary, this compliance is essential.",
      },
      {
        q: "Is Glasgow a large enough market to support a mobile tyre van business?",
        a: "Absolutely. Glasgow's conurbation of 2.3 million people, combined with a large commercial vehicle base across manufacturing, retail, and logistics, creates excellent demand. Many of our Scottish customers operate in Glasgow and build successful businesses serving both the city and the wider Lanarkshire/Renfrewshire area.",
      },
      {
        q: "How long does delivery to Glasgow take from your UK workshop?",
        a: "Glasgow is approximately 2.5–3 hours from our workshop via the M74. We deliver to Glasgow within 2 working days of sign-off.",
      },
    ],
  },
  {
    slug: "edinburgh",
    name: "Edinburgh",
    region: "Scotland",
    regionSlug: "scotland",
    county: "City of Edinburgh",
    nearbyAreas: ["Glasgow", "Livingston", "Dunfermline", "Kirkcaldy", "Musselburgh"],
    intro:
      "Edinburgh is Scotland's capital and the UK's second most important financial centre after London. The city's financial services sector, major public sector employers, and thriving tourism industry create a large and relatively affluent commercial and retail tyre demand. Edinburgh operates a Low Emission Zone in the city centre, and the city's planned EV infrastructure expansion makes Euro 6 compliance a minimum requirement for any van working within the LEZ boundary.",
    deliveryNote:
      "We deliver to Edinburgh as part of our nationwide delivery service. Delivery to Scotland typically takes 2 working days from sign-off.",
    faqs: [
      {
        q: "Does Edinburgh's LEZ affect mobile tyre vans?",
        a: "Yes. Edinburgh's Low Emission Zone covers the city centre and applies to diesel vans that do not meet Euro 6 standards. All our van conversions are Euro 6 compliant and are exempt from Edinburgh's LEZ restrictions.",
      },
      {
        q: "What commercial sectors in Edinburgh generate tyre demand?",
        a: "Edinburgh's financial services sector (Standard Life Aberdeen, Baillie Gifford, Royal Bank of Scotland) operates extensive company car fleets. The city's large public sector (Scottish Government, NHS Lothian, City of Edinburgh Council) also runs substantial LCV fleets. Tourism-related fleet demand (taxis, coaches, hire vehicles) is year-round.",
      },
      {
        q: "Can an Edinburgh operator cover the Lothians and into Fife?",
        a: "Yes. The Forth Bridges connect Edinburgh to Fife in approximately 25 minutes, giving access to Dunfermline, Kirkcaldy, and the wider Fife peninsula. East Lothian and Midlothian are easily covered from Edinburgh as well.",
      },
    ],
  },
  {
    slug: "aberdeen",
    name: "Aberdeen",
    region: "Scotland",
    regionSlug: "scotland",
    county: "Aberdeenshire",
    nearbyAreas: ["Inverurie", "Stonehaven", "Peterhead", "Fraserburgh", "Banchory"],
    intro:
      "Aberdeen is Scotland's third largest city and the global capital of the offshore oil and gas industry. The city's energy sector creates one of the UK's highest concentrations of specialist and commercial vehicle fleets, including logistics, offshore support, and engineering vehicles. Aberdeen's Energy Transition Zone and the Harbour's expansion are also attracting renewable energy investment that will sustain commercial vehicle demand well into the future.",
    deliveryNote:
      "We deliver to Aberdeen as part of our nationwide delivery service. Delivery to Aberdeen typically takes 2–3 working days from sign-off.",
    faqs: [
      {
        q: "Does Aberdeen's oil and gas sector create mobile tyre demand?",
        a: "Yes. Aberdeen's offshore support industry operates enormous LCV and specialist vehicle fleets, including supply vessels, crew transport, and engineering support vehicles. Fleet accounts in the Aberdeen energy sector can be particularly valuable due to the 24-hour operational requirements of offshore work.",
      },
      {
        q: "Does Aberdeen have a Low Emission Zone?",
        a: "Aberdeen is implementing an LEZ for the city centre, aligned with Scotland's national LEZ framework. All our van conversions are Euro 6 compliant and fully exempt from Aberdeen's LEZ restrictions.",
      },
      {
        q: "Can an Aberdeen operator cover the North Scotland oil country — Peterhead, Fraserburgh?",
        a: "Yes. Peterhead is 40 minutes from Aberdeen via the A90, and Fraserburgh is 60 minutes north. The Buchan area north of Aberdeen has a large fishing and aquaculture commercial vehicle base in addition to oil-related traffic — a unique rural commercial niche for Aberdeen operators.",
      },
    ],
  },
  {
    slug: "dundee",
    name: "Dundee",
    region: "Scotland",
    regionSlug: "scotland",
    county: "Dundee City / Angus",
    nearbyAreas: ["Perth", "St Andrews", "Arbroath", "Forfar", "Kirkcaldy"],
    intro:
      "Dundee is Scotland's fourth largest city, with a rapidly growing digital technology and life sciences sector anchored by the University of Dundee and gaming studios including Rockstar North. The city has historically important jute, engineering, and manufacturing credentials, and today benefits from significant NHS Tayside, Michelin Scotland (tyre sector) operations. Dundee's position at the Tay estuary crossroads makes it the gateway to Angus, Perthshire, and North Fife.",
    deliveryNote:
      "We deliver to Dundee as part of our nationwide delivery service. Delivery to Scotland typically takes 2 working days from sign-off.",
    faqs: [
      {
        q: "Does Dundee have a Low Emission Zone?",
        a: "Yes. Dundee operates an LEZ as part of Scotland's national LEZ rollout. All our van conversions are Euro 6 compliant and exempt from LEZ charges.",
      },
      {
        q: "Can a Dundee operator cover Perthshire and Angus?",
        a: "Yes. Perth is 25 minutes from Dundee via the A90. Arbroath, Forfar, and Angus are within 30 minutes east and north. The rural areas of Perthshire and Angus have agricultural and construction commercial vehicle demand with very limited mobile tyre competition.",
      },
      {
        q: "What commercial sectors are active in Dundee for fleet vehicles?",
        a: "NHS Tayside operates one of Scotland's largest healthcare vehicle fleets. The V&A Dundee and tourism sector generate hospitality fleet demand. The technology and gaming sector runs company car fleets. The Port of Dundee creates logistics and shipping-related commercial vehicle demand.",
      },
    ],
  },
  {
    slug: "stirling",
    name: "Stirling",
    region: "Scotland",
    regionSlug: "scotland",
    county: "Stirlingshire",
    nearbyAreas: ["Glasgow", "Edinburgh", "Perth", "Falkirk", "Alloa"],
    intro:
      "Stirling occupies a strategically unique position at the heart of Scotland, equidistant between Glasgow, Edinburgh, and Perth. The M9/M80 interchange at Stirling is the most important road junction in Scotland for north-south and east-west movement, making it a natural crossroads for commercial vehicles. Stirling is home to the University of Stirling and significant public sector employment, and the Stirling Enterprise Park generates commercial fleet demand.",
    deliveryNote:
      "We deliver to Stirling as part of our nationwide delivery service. Delivery to Scotland typically takes 2 working days from sign-off.",
    faqs: [
      {
        q: "Why is Stirling considered the gateway to the Highlands?",
        a: "Stirling's castle sits at the crossing of the River Forth, and historically controlled movement between the Lowlands and Highlands. Today, the M9 north from Stirling gives access to Perth and Inverness, while the M80 connects south to Glasgow and the M8. All major routes into the Scottish Highlands pass through or near Stirling, making it a strategic base for operators wanting to cover central Scotland.",
      },
      {
        q: "Does Stirling have a Low Emission Zone?",
        a: "Stirling does not currently operate an LEZ. All our van conversions are Euro 6 compliant.",
      },
      {
        q: "Can a Stirling operator realistically cover Glasgow and Edinburgh from a single base?",
        a: "Yes. Glasgow is 35 minutes south-west and Edinburgh is 40 minutes south-east. Many Scottish operators based in Stirling or Falkirk use the central belt location to service both cities and the surrounding Forth Valley area from a single van.",
      },
    ],
  },
  {
    slug: "inverness",
    name: "Inverness",
    region: "Scotland",
    regionSlug: "scotland",
    county: "Highland",
    nearbyAreas: ["Elgin", "Aviemore", "Dingwall", "Nairn", "Fort Augustus"],
    intro:
      "Inverness is the capital of the Highlands and the fastest-growing city in Scotland. Its position as the economic hub of Highland Scotland gives it a unique catchment area: a large geographic territory with a growing population and limited mobile service competition. The Highlands' expanding renewable energy sector — particularly wind farm construction — creates significant demand for specialist construction and heavy commercial vehicle tyre services alongside the standard retail and fleet work.",
    deliveryNote:
      "We deliver to Inverness as part of our nationwide delivery service. Delivery to Inverness typically takes 2–3 working days from sign-off.",
    faqs: [
      {
        q: "Is Inverness a viable base for a mobile tyre business given its rural location?",
        a: "Yes — and the reduced competition is a genuine advantage. Inverness has a growing population (over 70,000 in the city), a large public sector, and a wide rural Highland catchment. The expanding wind energy sector across the Highlands creates significant specialist commercial and construction vehicle tyre work that is in short supply in the region.",
      },
      {
        q: "Does Inverness have a Low Emission Zone?",
        a: "Inverness does not currently have an LEZ in operation. All our van conversions are Euro 6 compliant as standard.",
      },
      {
        q: "What industries in Highland Scotland create commercial tyre demand?",
        a: "The renewable energy construction industry (wind farms across the Highland region require heavy plant and logistics vehicles with specialist tyres), forestry, fish farming logistics, Inverness Caledonian Thistle FC and Highland hospitality fleets, and NHS Highland all create fleet demand. The A9 trunk road carries substantial HGV traffic between Perth and Inverness — a breakdown coverage opportunity.",
      },
    ],
  },
  // ── Wales ───────────────────────────────────────────────────────────────────
  {
    slug: "cardiff",
    name: "Cardiff",
    region: "Wales",
    regionSlug: "wales",
    county: "Cardiff / Vale of Glamorgan",
    nearbyAreas: ["Newport", "Bridgend", "Barry", "Pontypridd", "Caerphilly"],
    intro:
      "Cardiff is the capital of Wales and the country's largest city, with a population of approximately 360,000 in the city and 1.4 million in the wider Cardiff Capital Region. The city's financial services, media, public sector, and retail sectors create significant commercial fleet demand. Cardiff Bay and the Central Business District are major employers, and the M4 corridor from Cardiff to Newport and Bristol is one of the busiest freight routes in Wales.",
    deliveryNote:
      "We deliver to Cardiff as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Does Cardiff have a Clean Air Zone?",
        a: "Cardiff has been developing CAZ plans as part of Welsh Government clean air initiatives. All our van conversions are Euro 6 compliant, ensuring full exemption from any current or future Cardiff CAZ charges.",
      },
      {
        q: "Can a Cardiff operator cover the M4 corridor to Newport and Bristol?",
        a: "Yes. Newport is 20 minutes east, and the Second Severn Crossing to Bristol is 35 minutes from Cardiff. Many Cardiff operators extend their patch along the M4 to cover South Wales and cross-border into South Gloucestershire, particularly for commercial fleet accounts.",
      },
      {
        q: "What commercial sectors in Cardiff create tyre demand?",
        a: "BBC Wales, ITV Wales, and the media cluster in Cardiff Bay generate company car and production vehicle fleet demand. The financial services sector (Legal & General, Admiral Insurance) runs large company car fleets. Cardiff's large retail sector — including St David's Dewi Sant — generates delivery van fleet demand.",
      },
    ],
  },
  {
    slug: "swansea",
    name: "Swansea",
    region: "Wales",
    regionSlug: "wales",
    county: "Swansea / West Glamorgan",
    nearbyAreas: ["Port Talbot", "Neath", "Llanelli", "Bridgend", "Ammanford"],
    intro:
      "Swansea is the second largest city in Wales and the commercial centre of West Wales. The city has a significant steel, petrochemical, and Amazon distribution presence along the M4 corridor, and the surrounding West Wales agricultural and tourism economy adds rural commercial vehicle demand. Swansea's relative remoteness from the major English mobile tyre operators makes the market less saturated than comparable English cities.",
    deliveryNote:
      "We deliver to Swansea as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Does Swansea have a Clean Air Zone?",
        a: "Swansea does not currently operate a CAZ. All our van conversions are Euro 6 compliant as standard.",
      },
      {
        q: "What commercial vehicle demand exists in the Swansea area?",
        a: "The Amazon fulfilment centre in Swansea, the Tata Steel/TATA chemicals operations at Port Talbot, the Valero oil refinery at Llandarcy, and the A48/M4 logistics corridor all generate significant commercial fleet demand. West Wales farming and tourism add seasonal commercial and agricultural tyre work.",
      },
      {
        q: "Can a Swansea operator cover the Gower Peninsula and rural West Wales?",
        a: "Yes. The Gower Peninsula, Carmarthenshire, and the wider West Wales rural area have limited mobile tyre coverage. Agricultural vehicle work (tractors, trailers, agricultural machinery) is a valuable niche for operators who invest in the right tyre sizes.",
      },
    ],
  },
  {
    slug: "newport",
    name: "Newport",
    region: "Wales",
    regionSlug: "wales",
    county: "Newport / Monmouthshire",
    nearbyAreas: ["Cardiff", "Bristol", "Cwmbran", "Chepstow", "Pontypool"],
    intro:
      "Newport is the most easterly large city in Wales, positioned on the M4 immediately before the Severn crossing into England. The city's logistics, manufacturing, and public sector base — including the passport and visa offices — creates commercial fleet demand, while its proximity to Bristol makes it a natural cross-border base for operators wanting to cover South Wales and the English Southwest simultaneously.",
    deliveryNote:
      "We deliver to Newport as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off.",
    faqs: [
      {
        q: "Is Newport a good cross-border base between Wales and England?",
        a: "Yes. Newport's M4 position — immediately west of the Severn bridges — means you can cover Cardiff (20 min west) and Bristol (25 min east) from a single Newport base. Operators who want to cover South Wales and South Gloucestershire simultaneously find Newport an efficient hub.",
      },
      {
        q: "Does Newport have a Clean Air Zone?",
        a: "Newport does not currently operate a CAZ. All our van conversions are Euro 6 compliant.",
      },
      {
        q: "What commercial sectors in Newport create fleet tyre demand?",
        a: "The Amazon, BT, and HMPO (passport office) operations in Newport all employ large workforces with company vehicle schemes. The Celtic Springs Business Park and the M4 commercial corridor between Newport and Magor/Llanwern are home to significant logistics and manufacturing operations.",
      },
    ],
  },
  {
    slug: "wrexham",
    name: "Wrexham",
    region: "Wales",
    regionSlug: "wales",
    county: "Wrexham / Flintshire",
    nearbyAreas: ["Chester", "Shrewsbury", "Deeside", "Llangollen", "Rhyl"],
    intro:
      "Wrexham is the largest town in North Wales and an important industrial centre on the Welsh–English border. The Wrexham Industrial Estate — one of Europe's largest industrial estates — hosts major manufacturing operations including Kellogg's, JCB, and numerous engineering and pharmaceutical companies. The A483/A55 North Wales Expressway gives Wrexham rapid access to Chester, Deeside, and the North Wales coast, making it a versatile base for operators covering both North Wales and the Northwest England border region.",
    deliveryNote:
      "We deliver to Wrexham as part of our nationwide delivery service. Delivery takes 1–2 working days from sign-off. Wrexham is approximately 40 minutes from our workshop.",
    faqs: [
      {
        q: "What makes the Wrexham Industrial Estate significant for mobile tyre fitting?",
        a: "The Wrexham Industrial Estate is one of Europe's largest, spanning over 1,500 acres with hundreds of tenants across food manufacturing, engineering, pharmaceuticals, and distribution. The estate generates a very high concentration of van and HGV fleet traffic from a compact geographic area — ideal for a commercial-focused mobile tyre operator.",
      },
      {
        q: "Can a Wrexham operator also cover the Deeside and Flintshire industrial corridor?",
        a: "Yes. The A483 north from Wrexham reaches Deeside (home to Toyota, AIRBUS, and major logistics parks) in approximately 20 minutes. The combined Wrexham–Deeside industrial corridor is one of the most commercially active in Wales, providing an outstanding commercial fleet account base.",
      },
      {
        q: "How close is Wrexham to your UK workshop?",
        a: "Wrexham is approximately 40 minutes from our the North West workshop via the A41 and A483. This makes it one of our closest delivery destinations, and local delivery can often be arranged on the handover day at no extra charge.",
      },
    ],
  },
];

export function getLocationBySlug(slug: string): Location | undefined {
  return locations.find((l) => l.slug === slug);
}

export const locationsByRegion: Record<string, Location[]> = locations.reduce(
  (acc, loc) => {
    if (!acc[loc.region]) acc[loc.region] = [];
    acc[loc.region].push(loc);
    return acc;
  },
  {} as Record<string, Location[]>
);
