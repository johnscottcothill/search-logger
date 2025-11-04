<!-- Search Area -->
<p class="subheading">Search for inspiration now...</p>
<input type="text" id="search-box" autocomplete="off">
<ul id="suggestions"></ul>

<style>
  /* Import Google Font (if not already imported) */
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap');

  /* Subheading Styling */
  .subheading {
    font-family: 'Montserrat', sans-serif;
    font-size: 1.5em;
    color: #fff;
    text-align: center;
    margin: 20px 0 10px 0;
    position: relative;
    z-index: 2;
    opacity: 0;
    animation: fadeInUp 1.5s ease-out forwards;
    animation-delay: 0.5s;
    text-shadow: 1px 1px 6px rgba(0, 0, 0, 0.7);
  }

  /* Fade-in and slide-up animation */
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .result-label {
    font-weight: bold;
    margin-right: 5px;
  }
</style>

<script>
  // =========================
  // Search logging config + CID
  // =========================
  const WRITE_KEY = 'QXJrENxfFS';
  const LOG_URL   = 'https://search-logger-b3c0926779e3.herokuapp.com/v1/log-search';

  const CID_KEY = 'ledspace_cid';
  function generateCid() {
    try {
      if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
      // Fallback UUID-ish
      const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
      return `${Date.now()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}`;
    } catch { return String(Date.now()) + Math.random().toString(16).slice(2); }
  }
  function getCid() {
    try {
      let cid = localStorage.getItem(CID_KEY);
      if (!cid) {
        cid = generateCid();
        localStorage.setItem(CID_KEY, cid);
      }
      return cid;
    } catch {
      // If localStorage blocked, return ephemeral per-page cid
      if (!window.__ephemeral_cid) window.__ephemeral_cid = generateCid();
      return window.__ephemeral_cid;
    }
  }

  function logSearchEvent(evt) {
    const payload = {
      writeKey: WRITE_KEY, // include in body (sendBeacon can't set headers)
      cid: getCid(),       // persistent client id
      query: evt.query || '',
      selected_text: evt.selected_text || '',
      label: evt.label || '',
      dest_url: evt.dest_url || '',
      method: evt.method || '', // "click" | "enter"
      rank: typeof evt.rank === 'number' ? evt.rank : null, // 1-based
      matched_synonyms: Array.isArray(evt.matched_synonyms) ? evt.matched_synonyms : [],
      source_path: location.pathname,
      referrer: document.referrer || '',
      score: typeof evt.score === 'number' ? evt.score : null
    };

    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'text/plain;charset=UTF-8' });
        navigator.sendBeacon(LOG_URL, blob);
      } else {
        fetch(LOG_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Write-Key': WRITE_KEY },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(() => {});
      }
    } catch (_) { /* no-op */ }
  }

  function extractLabelFromName(name) {
    if (!name) return '';
    if (name.startsWith('[')) {
      const end = name.indexOf(']');
      if (end !== -1) return name.substring(1, end);
    }
    return '';
  }

  // Mapping for label names to inline styles
  const labelStyles = {
    'Product': 'background-color: darkblue; color: white; padding: 2px 6px; border-radius: 3px;',
    'Inspiration': 'background-color: purple; color: white; padding: 2px 6px; border-radius: 3px;',
    'Help': 'background-color: red; color: white; padding: 2px 6px; border-radius: 3px;',
    'Guide': 'background-color: green; color: white; padding: 2px 6px; border-radius: 3px;',
    'Info': 'background-color: lightblue; color: black; padding: 2px 6px; border-radius: 3px;',
    'Project': 'background-color: gold; color: black; padding: 2px 6px; border-radius: 3px;',
    'Service': 'background-color: yellow; color: black; padding: 2px 6px; border-radius: 3px;'
  };

  // Define keywords (in lowercase) that should prevent the "Other" option from being added
  const excludeOtherKeywords = ['office', 'club', 'fitness', 'gym', 'nightclub', 'night club', 'residential', 'adventure', 'entertainment', 'retail', 'hospitality', 'hotel'];

  // Redirect Options Data – add a label prefix (e.g., "[Product]") as needed in the name.
  const options = [
    {
      name: '[Product] LED Strip Lighting',
      synonyms: ['LED Strip', 'Lighting', 'Lights', 'Linear Lighting'],
      url: '/collections/led-strip-lights'
    },
    {
      name: '[Product] Seamless Dot Free Lighting',
      synonyms: ['COB', 'Dot Free', 'Seamless', 'lighting', 'LED Strip Lighting', 'NS-LINE'],
      url: '/collections/seamless'
    },
    {
      name: '[Product] VIVOE Neon Style Lighting',
      synonyms: ['Lighting Pack', 'LED Strip', 'Neon LED Strip', 'Flex LED Strip', 'Vibe Full Colour', 'LED Strip Lighting'],
      url: '/collections/vivoe'
    },
    {
      name: '[Product] Basics No Thrills Lighting',
      synonyms: ['TradeStrip', 'SMD LED Strip', 'LED Strip Lighting'],
      url: '/collections/basics'
    },
    {
      name: '[Product] Slat Wall Standard Lightbars',
      synonyms: ['Slatwall Lighting', 'Wall Mounted Lighting', 'LED Strip Lighting'],
      url: '/collections/slatwall-lighting-kits'
    },
    {
      name: '[Product] BLAQ Aura Slat Wall Lighting',
      synonyms: ['Slatwall Lighting', 'Wall Mounted Lighting', 'Slat Wall Panel Lighting', 'LED Strip Lighting'],
      url: '/products/blaq-aura'
    },
    {
      name: '[Product] SPLASH12 IP67 Lighting',
      synonyms: ['Outdoor Lighting', 'Wet Area Lighting', 'Garden Lighting', 'LED Strip Lighting'],
      url: '/collections/splash12'
    },
    {
      name: '[Inspiration] Kitchen Lighting',
      synonyms: ['Kickboard Lighting', 'Under-Cabinet Lighting', 'Cupboard Lighting', 'Plinth Lighting'],
      url: '/collections/kitchen'
    },
    {
      name: '[Inspiration] Bathroom Lighting',
      synonyms: ['Shower Lighting', 'Bath Lighting', 'Shower Niche', 'Bathroom Niche', 'Washroom Lighting', 'Wet Room Lighting'],
      url: '/collections/bathroom'
    },
    {
      name: '[Service] Bathroom Niche Kit Builder',
      synonyms: ['Shower Lighting', 'Bath Lighting', 'Shower Niche', 'Bathroom Niche', 'Washroom Lighting', 'Wet Room Lighting'],
      url: '/pages/bathroom-niche-lighting'
    },
    {
      name: '[Inspiration] Bedroom Lighting',
      synonyms: ['Under Bed Lighting', 'Wardrobe Lighting', 'Cupboard Lighting'],
      url: '/collections/bedroom'
    },
    {
      name: '[Inspiration] Dining and Living Room Lighting',
      synonyms: ['Dining Lighting', 'Lounge Lighting'],
      url: '/collections/lounge-dining-room'
    },
    {
      name: '[Inspiration] Garden Lighting',
      synonyms: ['Garden Lighting', 'Fence Lighting', 'Pergola Lighting', 'IP67 Lighting', 'Outdoor Seating Area Lighting', 'Pathway Lighting', 'Orangery Lighting', 'Conservatory Lighting', 'SPLASH LED Strip'],
      url: '/collections/outdoor'
    },
    {
      name: '[Inspiration] Roof Lantern Lighting',
      synonyms: ['Sky Light Lighting', 'Ceiling Lighting'],
      url: '/collections/roof-lanterns-skylights'
    },
    {
      name: '[Inspiration] Media Wall Lighting',
      synonyms: ['TV backlighting', 'Shelf Lighting', 'Lounge Lighting', 'Living Room Lighting'],
      url: '/collections/media-wall'
    },
    {
      name: '[Inspiration] Home Cinema Lighting',
      synonyms: ['Movie Lighting', 'Big Screen Lighting', 'Ceiling and Coving Lighting'],
      url: '/collections/home-cinema'
    },
    {
      name: '[Product] Warm White Lighting',
      synonyms: ['Warm White', '2500K', '3000K', 'Golden Lighting', 'LED Strip Lighting'],
      url: '/collections/warm-white-led-strip-lights'
    },
    {
      name: '[Product] Natural White Lighting',
      synonyms: ['Natural White', 'LED Strip Lighting'],
      url: '/collections/natural-white-led-strip-lights'
    },
    {
      name: '[Product] Cool White Lighting',
      synonyms: ['Day Light', 'Cool White', 'LED Strip Lighting'],
      url: '/collections/cool-white-led-strip-lights'
    },
    {
      name: '[Product] RGB+W Colour Changing Lighting',
      synonyms: ['Colour', 'Color', 'Red Green Blue White', 'RGBW', 'LED Strip Lights'],
      url: '/collections/rgbw-led-strip'
    },
    {
      name: '[Product] Pixel Digitially Addressable Lighting',
      synonyms: ['SPI', 'DMX', 'C-Box', 'Artnet', 'Full Service', 'Consultation', 'Project', 'LED Strip Lights'],
      url: '/collections/pixelstrip'
    },
    {
      name: '[Product] LED Profile',
      synonyms: ['Aluminium Profile', 'Channel', 'Trunking', 'Mounting', 'ALU'],
      url: '/collections/led-profile'
    },
    {
      name: '[Product] Plaster-In LED Profile',
      synonyms: ['Muck in', 'Dry Wall', 'Aluminium Profile', 'Channel', 'Trunking', 'Mounting'],
      url: '/collections/led-profile?gf_614019=INSTALL_Plaster-In'
    },
    {
      name: '[Product] Recessed LED Profile',
      synonyms: ['Recess', 'Aluminium Profile', 'Channel', 'Trunking', 'Mounting'],
      url: '/collections/led-profile?gf_614019=INSTALL_Recess'
    },
    {
      name: '[Product] Surface Mount LED Profile',
      synonyms: ['Surface', 'Aluminium Profile', 'Channel', 'Trunking', 'Mounting'],
      url: '/collections/led-profile?gf_614019=INSTALL_Surface+Mount'
    },
    {
      name: '[Product] Corner LED Profile',
      synonyms: ['Corner', '90 Degree', '45 Degree', 'Aluminium Profile', 'Channel', 'Trunking', 'Mounting'],
      url: '/collections/led-profile?gf_614019=INSTALL_Corner'
    },
    {
      name: '[Product] Suspendable LED Profile',
      synonyms: ['Suspend', 'Hang', 'Luminaire', 'Aluminium Profile', 'Channel', 'Trunking', 'Mounting'],
      url: '/collections/led-profile?gf_614019=INSTALL_Suspend'
    },
    {
      name: '[Product] LED Profile Accessories',
      synonyms: ['Mounting Clips', 'End Caps', 'Brackets', 'Suspension Kit', 'Aluminium Profile', 'Channel', 'Trunking', 'Mounting'],
      url: '/collections/accessories-for-led-profiles'
    },
    {
      name: '[Product] 24V LED Strip',
      synonyms: ['24 volt', 'voltage', 'LED Strip Lights'],
      url: '/collections/24v-led-strip-lights'
    },
    {
      name: '[Product] 12V LED Strip',
      synonyms: ['12 volt', 'voltage', 'LED Strip Lights', 'Campervan Lighting', 'Caravan Lighting', 'Boat Lighting', 'Marine Lighting'],
      url: '/collections/12v-led-strip-lights'
    },
    {
      name: '[Product] Smart Controls',
      synonyms: ['Switches', 'Remote Controls', 'Presence', 'Sensors', 'Alexa', 'Google Home', 'Tuya', 'Dimmable'],
      url: '/pages/smart-lighting'
    },
    {
      name: '[Product] Power Supplies',
      synonyms: ['PSUs', 'Transformers', 'Mains Dimmable', 'Dali', 'Waterproof', '75w', '15w', '100w', 'IP67', '200w', 'watts', 'wattage', 'Meanwell', 'Triac'],
      url: '/collections/power-supplies'
    },
    {
      name: '[Product] Cables and Connectors',
      synonyms: ['5 Core Cable', 'RGBW cable', 'Adjustable White cable', 'Mains Plug', 'Wago', 'Terminal Blocks', 'PSU Enclousure', 'Leads'],
      url: '/collections/cables-connectors'
    },
    {
      name: '[Product] Adjustable White LED Strip',
      synonyms: ['CCT White', 'Warm White', 'Natural White', 'Cool White', 'Tunable'],
      url: '/collections/cct-tunable-white-led-strip'
    },
    {
      name: '[Help] Customer Services',
      synonyms: ['Contact', 'Issue'],
      url: '/pages/help'
    },
    {
      name: '[Guide] LED Strip Lighting How-To Video Guides',
      synonyms: ['Using Connectors', 'Connecting Smart Controller', 'Remote Control Setup', 'Pairing Devices'],
      url: '/pages/how'
    },
    {
      name: '[Guide] How To: Install Slat Wall Panels with Built-in LED Lighting',
      synonyms: ['slat walls', 'WoodVeneerHub', 'Charles and Ivy', 'WoodUpp'],
      url: '/blogs/help-advice/how-to-install-slat-wall-panels-with-built-in-led-lighting'
    },
    {
      name: '[Guide] Understanding: Kelvin Temperatures',
      synonyms: ['Kelvin', 'Colours', 'Temperatures'],
      url: '/blogs/help-advice/understaning-kelvin-temperatures'
    },
    {
      name: '[Guide] Installing: LED Strip Lights On Shelving, Kickboards, Cabinets & Plinths',
      synonyms: ['How To', 'Guide', 'Kickboards', 'Plinths', 'Shelving', 'Cabinets'],
      url: '/blogs/help-advice/installing-led-strip-lights-on-shelving-kickboards-cabinets-plinths'
    },
    {
      name: '[Guide] How To: Join LED Profiles',
      synonyms: ['Guide', 'How', 'Profile'],
      url: '/blogs/help-advice/how-to-join-led-profiles'
    },
    {
      name: '[Guide] Installing: LED Strip Lighting Underneath Kitchen Cabinets',
      synonyms: ['how to', 'guide'],
      url: '/blogs/help-advice/installing-led-strip-lighting-underneath-kitchen-cabinets'
    },
    {
      name: '[Guide] How To: Cutting LED Profiles For Corners',
      synonyms: ['How to', 'Cutting Profile', 'Installing LED Strip'],
      url: '/blogs/help-advice/cutting-led-profiles-for-corners'
    },
    {
      name: '[Guide] Understanding: The Benefits of Adjustable White LED Strip Lights',
      synonyms: ['CCT', 'Tunable'],
      url: '/blogs/help-advice/benefits-of-tunable-cct-adjustable-white-led-strip-lights'
    },
    {
      name: '[Guide] Understanding: RGB vs RGBW LED Strip',
      synonyms: ['RGBW', 'RGB', 'Colour Changing'],
      url: '/blogs/help-advice/rgb-vs-rgbw'
    },
    {
      name: '[Guide] Understanding: Power Supplies For LED Strip',
      synonyms: ['how to', 'guide', 'voltage', 'wattage'],
      url: '/blogs/help-advice/choosing-a-power-supply'
    },
    {
      name: '[Guide] Seamless Installation Guides',
      synonyms: ['COB', 'Guide', 'Troubleshooting'],
      url: '/pages/pack-help'
    },
    {
      name: '[Info] Comparison Table',
      synonyms: ['Specifications'],
      url: '/pages/specifications'
    },
    {
      name: '[Help] Order Tracking',
      synonyms: ['Tracking', 'Delivery'],
      url: '/pages/status-lookup'
    },
    {
      name: '[Info] Delivery Information',
      synonyms: ['Delivery', 'UK', 'Order'],
      url: '/pages/delivery'
    },
    {
      name: '[Info] Warranty Information',
      synonyms: ['warranty'],
      url: '/pages/5-year-warranty'
    },
    {
      name: '[Info] Returns',
      synonyms: ['Returning Items', 'Refunds'],
      url: '/pages/returns'
    },
    {
      name: '[Info] Buy Now Pay Later',
      synonyms: ['Klarna', 'BNPL', 'Credit'],
      url: '/pages/klarna'
    },
    {
      name: '[Info] Affiliates and Influencers',
      synonyms: ['Partnership'],
      url: '/pages/partner'
    },
    {
      name: '[Info] Discounts and Offers',
      synonyms: ['Discounting', 'Clearance', 'Offers', 'Money Off'],
      url: '/pages/discounts-offers'
    },
    {
      name: '[Info] Ratings and Reviews',
      synonyms: ['Customer Reviews', 'Customer Ratings'],
      url: '/pages/reviews'
    },
    {
      name: '[Info] Refunds',
      synonyms: ['Refund Policy', 'Returns'],
      url: '/policies/refund-policy'
    },
    {
      name: '[Product] Stairs',
      synonyms: ['Stairway', 'Steps'],
      url: '/products/seamless-warm-white-stair-kit-13-steps'
    },
    {
      name: '[Product] Cabinet Lighting',
      synonyms: ['LED Profile Options for Cabinet Lighting'],
      url: '/collections/led-profile?gf_614074=IDEALFOR_Cabinets'
    },
    {
      name: '[Product] Ceiling Lighting',
      synonyms: ['LED Profile Options for Cabinet Lighting'],
      url: '/collections/led-profile?gf_614074=IDEALFOR_Ceilings'
    },
    {
      name: '[Product] Lighting for Coving',
      synonyms: ['Coving Lighting', 'Architrave'],
      url: '/collections/led-profile?gf_614074=IDEALFOR_Coving'
    },
    {
      name: '[Product] Cupboard Lighting',
      synonyms: ['LED Profile Options for Coving'],
      url: '/collections/led-profile?gf_614074=IDEALFOR_Cupboards'
    },
    {
      name: '[Product] LED Profile for Flooring',
      synonyms: ['Flooring LED Strip Installation'],
      url: '/collections/led-profile?gf_614074=IDEALFOR_Floors'
    },
    {
      name: '[Product] LED Profile for TV Media Walls',
      synonyms: ['Media Wall Profile'],
      url: '/collections/led-profile?gf_614074=IDEALFOR_Media+Walls'
    },
    {
      name: '[Product] LED Profile for Shelving',
      synonyms: ['Shelving', 'LED Profile'],
      url: '/collections/led-profile?gf_614074=IDEALFOR_Shelves'
    },
    {
      name: '[Product] Wall Lighting',
      synonyms: ['LED Profile for Walls'],
      url: '/collections/led-profile?gf_614074=IDEALFOR_Walls'
    },
    {
      name: '[Product] Wardrobe Lighting',
      synonyms: ['LED Profile for Wardrobes'],
      url: '/collections/led-profile?gf_614074=IDEALFOR_Wardrobes'
    },
    {
      name: '[Service] LED Profile Cutting',
      synonyms: ['Service', 'Cut Profile'],
      url: '/products/cut-aluminium-profile-to-length'
    },
    {
      name: '[Service] Cut LED Strip to Length',
      synonyms: ['Service', 'Cut LED Strip'],
      url: '/products/cut-led-strip-to-specified-length'
    },
    {
      name: '[Service] Get a Quote',
      synonyms: ['Quote', 'Project Advice', 'Help'],
      url: '/pages/quote'
    },
    {
      name: '[Service] Online Kit Builder',
      synonyms: ['Custom Pack Creator'],
      url: '/pages/led-strip-kit-builders'
    },
    {
      name: '[Product] Seamless DIY LED Strip Packs',
      synonyms: ['Seamless Kit', 'Pre-Packed'],
      url: '/collections/seamless-easy-packs'
    },
    {
      name: '[Product] Clearance',
      synonyms: ['Warehouse Clearance'],
      url: '/collections/november-clearance'
    },
    {
      name: '[Project] Case Studies',
      synonyms: ['LEDSpace Projects', 'Consultancy', 'Design Services'],
      url: '/pages/lighting-case-studies'
    },
    {
      name: '[Project] Fitness Studio and Gym Lighting',
      synonyms: ['Case Study', 'Fitness', 'Cycling', 'Exercise', 'Swimming Pool', 'Health', 'Business', 'Rise Fitness Studios', 'Cadence Indoor Cycling Studio', 'Consultancy', 'Design Services'],
      url: '/pages/case-study-rise-fitness-studios'
    },
    {
      name: '[Project] Leisure and Entertainment Lighting',
      synonyms: ['Leisure Centre', 'Cinema', 'Business', 'Corporate', 'Adventure Park', 'Consultancy', 'Design Services'],
      url: '/pages/case-study-ninja-warrior-uk-adventure-parks'
    },
    {
      name: '[Project] Residential Lighting',
      synonyms: ['Entire Home Lighting Projects', 'Estate Agents', 'Consultancy', 'Design Services'],
      url: '/pages/residential-projects'
    },
    {
      name: '[Project] Hospitality Lighting',
      synonyms: ['Hotels', 'Bar,', 'Restaurant', 'Drive-Thru', 'Pubs', 'Eateries', 'Consultancy', 'Design Services'],
      url: '/pages/case-study-popcorn-bar-restaurant'
    },
    {
      name: '[Project] Event and Exhibition Lighting',
      synonyms: ['Exhibiting', 'Trade Shows', 'Consultancy', 'Design Services'],
      url: '/pages/case-study-spiro-events-exhibitions'
    },
    {
      name: '[Project] Retail Lighting',
      synonyms: ['Retail Display', 'Supermarket', 'Consultancy', 'Design Services'],
      url: '/pages/case-study-infinity-mirror-oxford-street'
    },
    {
      name: '[Project] Lighting Consultancy, Design and Implementation',
      synonyms: [
        'Hotelier','Construction','Dental Practice','Doctors','GP Practice','General Practitioners',
        'Transportation','Tradesmen','Agriculture','Farming','Reception','Nursing Home','Shopping Centre',
        'Walkway','Driveway','Landscape','Games room','Showroom','Changing Room','Golf course','Putting venue',
        'Bowling alley','Escape room','Public square','Railway station','Coffee shop','Dessert shop','Stage',
        'Holiday Park','Forestry','Fishing','Nightclub','Office','Club','Mining','Metallurgy','Manufacturing',
        'Textiles','Apparel','Food Processing','Beverage Production','Pharmaceuticals','Biotechnology',
        'Healthcare','Medical Devices','Clinical Research','Hospitality','Tourism','Catering','Leisure',
        'Entertainment','Media','Publishing','Broadcasting','Telecommunications','Information Technology',
        'Software Development','Hardware Manufacturing','Electronics','Automotive','Aerospace','Railways',
        'Maritime','Aviation','Logistics','Supply Chain','Retail','Wholesale','E-commerce','Financial Services',
        'Banking','Insurance','Investment','Asset Management','Real Estate','Property Development','Legal Services',
        'Consulting','Engineering','Civil Engineering','Mechanical Engineering','Electrical Engineering',
        'Chemical Engineering','Construction Materials','Urban Planning','Architecture','Interior Design',
        'Landscaping','Environmental Services','Recycling','Waste Management','Utilities','Energy','Oil and Gas',
        'Renewable Energy','Solar Energy','Wind Energy','Hydroelectricity','Geothermal Energy','Nuclear Energy',
        'Water Supply','Agricultural Machinery','Food Retailing','Supermarkets','Department Stores','Consumer Goods',
        'Home Furnishings','Furniture','Personal Care','Cosmetics','Beauty','Sports','Fitness','Recreation','Arts',
        'Culture','Performing Arts','Fine Arts','Museums','Exhibitions','Education','Primary Education',
        'Secondary Education','Higher Education','Vocational Training','Research and Development','Scientific Research',
        'Information and Communications Technology','Data Services','Cloud Computing','Cybersecurity','Big Data',
        'Artificial Intelligence','Machine Learning','Robotics','Automation','Nanotechnology','Space Technology',
        'Satellite Communications','Telecom Equipment','Data Centres','Digital Marketing','Advertising',
        'Public Relations','Market Research','Event Management','Security Services','Private Security','Cyber Security',
        'Cleaning Services','Maintenance Services','Facility Management','Recruitment','Human Resources','Business Services',
        'Logistics Technology','E-learning','Education Technology','Childcare','Senior Care','Social Care','Non-profit',
        'Charities','Government Services','Public Administration','Defence','Military','Space Exploration',
        'Freight Forwarding','Courier Services','Delivery Services','Property Management','Construction and Infrastructure',
        'Heavy Engineering','Precision Engineering','Advanced Manufacturing','Packaging','Printing','Advertising and Media',
        'Food and Beverage','Dairy Production','Meat Production','Breweries','Distilleries','Soft Drinks',
        'Agricultural Biotechnology','Organic Farming','Sustainable Agriculture','Aquaculture','Horticulture',
        'Forestry and Timber','Paper Manufacturing','Plastics','Rubber','Metal Fabrication','Tool Manufacturing',
        'Machinery','Industrial Equipment','Logistics and Supply Chain','Freight and Cargo','Maritime Shipping',
        'Rail Freight','Road Transport','Air Cargo','Vehicle Leasing','Car Rental','Travel and Tourism',
        'Hospitality Management','Hotel Chains','Resorts','Motels','Bed and Breakfast','Guesthouses','Event Catering',
        'Food Service','Restaurant Chains','Fast Food','Casual Dining','Fine Dining','Bars and Pubs'
      ],
      url: '/pages/lighting-case-studies'
    },
    {
      name: 'xxxxx',
      synonyms: ['xxxx', 'xxxx', 'xxxxx', 'xxxx'],
      url: '/'
    }
    // ... add additional options as needed
  ];

  const searchBox = document.getElementById('search-box');
  const suggestionsList = document.getElementById('suggestions');

  // Precompute IDF for TF-IDF matching
  const allDocs = options.map(o => [o.name.toLowerCase(), ...o.synonyms.map(s => s.toLowerCase())]);
  const totalDocs = allDocs.length;
  const termDocCount = {};
  allDocs.forEach(doc => {
    const uniqueTerms = new Set(doc);
    for (let t of uniqueTerms) {
      termDocCount[t] = (termDocCount[t] || 0) + 1;
    }
  });

  function idf(term) {
    const df = termDocCount[term] || 0;
    return Math.log((totalDocs + 1) / (df + 1)) + 1;
  }

  function calculateScore(option, query) {
    query = query.toLowerCase();
    let score = 0;
    const matchedSynonyms = [];

    // Check name for exact or partial match
    const nameTerm = option.name.toLowerCase();
    if (nameTerm === query) {
      score += 10 * idf(query);
    } else if (nameTerm.includes(query)) {
      score += 5 * idf(query);
    }

    // Check synonyms for matches
    option.synonyms.forEach((syn, i) => {
      const synTerm = syn.toLowerCase();
      const positionFactor = 1 / (i + 1);
      if (synTerm === query) {
        score += 8 * idf(query) * positionFactor;
        matchedSynonyms.push(syn);
      } else if (synTerm.includes(query)) {
        score += 3 * idf(query) * positionFactor;
        matchedSynonyms.push(syn);
      }
    });

    return { score, matchedSynonyms };
  }

  // Logging + redirect wrapper
  function selectOptionWithLogging(item, rank, method, rawQuery) {
    const option = item.option;
    const dest = option.url ? option.url : ('/search?q=' + encodeURIComponent(rawQuery || option.name));
    const label = extractLabelFromName(option.name) || (option.name.includes('[Search]') ? 'Search' : '');

    logSearchEvent({
      query: (rawQuery || searchBox.value.trim()),
      selected_text: option.name, // keep original, including label prefix
      label,
      dest_url: dest,
      method, // "click" or "enter"
      rank: typeof rank === 'number' ? rank + 1 : null, // 1-based
      matched_synonyms: item.matchedSynonyms || [],
      score: item.score
    });

    // Redirect after queuing beacon
    setTimeout(() => { window.location.href = dest; }, 0);
  }

  // Update suggestions as the user types
  searchBox.addEventListener('input', function() {
    const rawQuery = this.value.trim();
    const query = rawQuery.toLowerCase();
    suggestionsList.innerHTML = '';

    // Only show suggestions if 2 or more characters have been typed
    if (query.length < 2) {
      return;
    }

    const scoredOptions = options.map(option => {
      const { score, matchedSynonyms } = calculateScore(option, query);
      return { option, score, matchedSynonyms };
    }).filter(item => item.score > 0);

    scoredOptions.sort((a, b) => b.score - a.score);

    // Show only the top 5 matches
    const limitedOptions = scoredOptions.slice(0, 5);

    limitedOptions.forEach((item, idx) => {
      let displayName = item.option.name;
      let labelHtml = '';
      // Check if the name starts with a label (e.g. "[Product]")
      if (displayName.startsWith('[')) {
        const endIndex = displayName.indexOf(']');
        if (endIndex !== -1) {
          const labelText = displayName.substring(1, endIndex); // Extract label text without brackets
          if (labelStyles[labelText]) {
            labelHtml = `<span class="result-label" style="${labelStyles[labelText]}">(${labelText})</span>`;
          } else {
            labelHtml = `<span class="result-label">(${labelText})</span>`;
          }
          // Remove the label prefix from the displayed name
          displayName = displayName.substring(endIndex + 1).trim();
        }
      }

      let synonymLabel = '';
      if (item.matchedSynonyms.length > 0) {
        const matchedList = item.matchedSynonyms.join(', ');
        synonymLabel = `<span class="synonym-label">(matched: ${matchedList})</span>`;
      }
      const li = document.createElement('li');
      li.innerHTML = `${labelHtml}${displayName} ${synonymLabel} <span class="select-hint">(select)</span>`;
      li.addEventListener('click', () => selectOptionWithLogging(item, idx, 'click', rawQuery));
      suggestionsList.appendChild(li);
    });

    // Append the "Other" option only if the query is not in the exclusion list.
    if (!excludeOtherKeywords.includes(query)) {
      const otherLi = document.createElement('li');
      otherLi.innerHTML = `<span class="result-label" style="${labelStyles['Product']}">(Search)</span> Other <span class="synonym-label">(matched: ${rawQuery})</span> <span class="select-hint">(select)</span>`;
      otherLi.addEventListener('click', () => {
        const dest = '/search?q=' + encodeURIComponent(rawQuery);
        logSearchEvent({
          query: rawQuery,
          selected_text: 'Other (Search)',
          label: 'Search',
          dest_url: dest,
          method: 'click',
          rank: limitedOptions.length + 1,
          matched_synonyms: [rawQuery],
          score: null
        });
        setTimeout(() => { window.location.href = dest; }, 0);
      });
      suggestionsList.appendChild(otherLi);
    }
  });

  // Allow redirection with the Enter key
  searchBox.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      const rawQuery = this.value.trim();
      const query = rawQuery.toLowerCase();
      if (query.length < 2) {
        return;
      }
      const scoredOptions = options.map(option => {
        const { score, matchedSynonyms } = calculateScore(option, query);
        return { option, score, matchedSynonyms };
      }).filter(item => item.score > 0);

      scoredOptions.sort((a, b) => b.score - a.score);

      if (scoredOptions.length > 0) {
        // top suggestion
        selectOptionWithLogging(scoredOptions[0], 0, 'enter', rawQuery);
      } else {
        // If no match, redirect to Shopify's standard search
        const dest = '/search?q=' + encodeURIComponent(rawQuery);
        logSearchEvent({
          query: rawQuery,
          selected_text: 'No match (fallback search)',
          label: 'Search',
          dest_url: dest,
          method: 'enter',
          rank: null,
          matched_synonyms: [],
          score: null
        });
        setTimeout(() => { window.location.href = dest; }, 0);
      }
    }
  });

  // Typewriter Effect
  const typewriterTexts = [
    'What do you want to light up, today?',
    'Kitchen?',
    'Gym?',
    'Bathroom?',
    'Media Wall?',
    'Hotel?',
    'Living Room?',
    'Garden?'
  ];
  let typewriterIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  let currentText = '';
  let typewriterDelay = 20;
  let typewriterActive = true;

  function typewriter() {
    if (!typewriterActive) return;
    const fullText = typewriterTexts[typewriterIndex % typewriterTexts.length];
    if (isDeleting) {
      currentText = fullText.substring(0, charIndex--);
    } else {
      currentText = fullText.substring(0, charIndex++);
    }
    searchBox.setAttribute('placeholder', currentText);
    let timeout = typewriterDelay;
    if (!isDeleting && charIndex === fullText.length + 1) {
      timeout = 500;
      isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      typewriterIndex++;
      timeout = 50;
    }
    setTimeout(typewriter, timeout);
  }
  typewriter();

  searchBox.addEventListener('focus', () => { typewriterActive = false; });
  searchBox.addEventListener('blur', () => {
    typewriterActive = true;
    typewriter();
  });

  // Clear the search box and suggestions if the user returns via the back button
  window.addEventListener('pageshow', function(e) {
    searchBox.value = "";
    suggestionsList.innerHTML = "";
  });
</script>
