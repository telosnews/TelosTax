/**
 * NAICS (North American Industry Classification System) codes for Schedule C Line B.
 *
 * This is a curated subset of ~300 NAICS codes most commonly used by sole proprietors,
 * independent contractors, and small businesses filing Schedule C. It is NOT the full
 * NAICS directory (which has 1,000+ entries), but covers the vast majority of real-world
 * sole-proprietor filings.
 *
 * Each entry includes an `isSSTB` flag indicating whether the code falls within a
 * Specified Service Trade or Business (SSTB) category for purposes of the IRC §199A
 * Qualified Business Income deduction. SSTB classifications per IRC §199A(d)(2) and
 * Treas. Reg. §1.199A-5:
 *   - Health care
 *   - Law
 *   - Accounting
 *   - Actuarial science
 *   - Performing arts
 *   - Consulting
 *   - Athletics
 *   - Financial services / brokerage
 *   - Any trade or business where the principal asset is the reputation or skill of employees/owners
 *
 * Note: "Consulting" SSTB status under §199A is narrower than NAICS consulting codes.
 * Engineering, architecture, and similar technical services are NOT SSTB even if advisory.
 * We mark codes as SSTB only when they clearly fall within the regulatory definition.
 *
 * @authority
 *   IRC: Section 199A(d)(2) — SSTB definition
 *   Treas. Reg: §1.199A-5 — SSTB safe harbors and categories
 *   IRS: Schedule C Instructions — Principal Business or Professional Activity Codes
 */

export interface NAICSEntry {
  code: string;       // 6-digit NAICS code
  description: string; // Human-readable description
  isSSTB: boolean;    // Whether this is an SSTB for QBI purposes
}

export const NAICS_CODES: NAICSEntry[] = [
  // ─────────────────────────────────────────────────────────────────
  // AGRICULTURE, FORESTRY, FISHING & HUNTING (11xxxx)
  // ─────────────────────────────────────────────────────────────────
  { code: '111100', description: 'Oilseed & Grain Farming', isSSTB: false },
  { code: '111200', description: 'Vegetable & Melon Farming', isSSTB: false },
  { code: '111300', description: 'Fruit & Tree Nut Farming', isSSTB: false },
  { code: '111400', description: 'Greenhouse, Nursery & Floriculture', isSSTB: false },
  { code: '111900', description: 'Other Crop Farming', isSSTB: false },
  { code: '112100', description: 'Cattle Ranching & Farming', isSSTB: false },
  { code: '112200', description: 'Hog & Pig Farming', isSSTB: false },
  { code: '112300', description: 'Poultry & Egg Production', isSSTB: false },
  { code: '112400', description: 'Sheep & Goat Farming', isSSTB: false },
  { code: '112500', description: 'Aquaculture', isSSTB: false },
  { code: '112900', description: 'Other Animal Production', isSSTB: false },
  { code: '113110', description: 'Timber Tract Operations', isSSTB: false },
  { code: '113210', description: 'Forest Nurseries & Gathering Forest Products', isSSTB: false },
  { code: '113310', description: 'Logging', isSSTB: false },
  { code: '114110', description: 'Fishing', isSSTB: false },
  { code: '114210', description: 'Hunting & Trapping', isSSTB: false },
  { code: '115110', description: 'Crop Support Activities', isSSTB: false },
  { code: '115210', description: 'Animal Production Support Activities', isSSTB: false },

  // ─────────────────────────────────────────────────────────────────
  // MINING, OIL & GAS (21xxxx)
  // ─────────────────────────────────────────────────────────────────
  { code: '211120', description: 'Crude Petroleum Extraction', isSSTB: false },
  { code: '211130', description: 'Natural Gas Extraction', isSSTB: false },
  { code: '212310', description: 'Stone Mining & Quarrying', isSSTB: false },
  { code: '212390', description: 'Other Nonmetallic Mineral Mining', isSSTB: false },
  { code: '213111', description: 'Drilling Oil & Gas Wells', isSSTB: false },
  { code: '213112', description: 'Oil & Gas Support Activities', isSSTB: false },

  // ─────────────────────────────────────────────────────────────────
  // CONSTRUCTION (23xxxx)
  // ─────────────────────────────────────────────────────────────────
  { code: '236115', description: 'New Single-Family Housing Construction', isSSTB: false },
  { code: '236116', description: 'New Multifamily Housing Construction', isSSTB: false },
  { code: '236118', description: 'Residential Remodelers', isSSTB: false },
  { code: '236210', description: 'Industrial Building Construction', isSSTB: false },
  { code: '236220', description: 'Commercial Building Construction', isSSTB: false },
  { code: '237110', description: 'Water & Sewer Line Construction', isSSTB: false },
  { code: '237310', description: 'Highway, Street & Bridge Construction', isSSTB: false },
  { code: '238110', description: 'Poured Concrete Foundation & Structure', isSSTB: false },
  { code: '238120', description: 'Structural Steel & Precast Concrete', isSSTB: false },
  { code: '238130', description: 'Framing Contractors', isSSTB: false },
  { code: '238140', description: 'Masonry Contractors', isSSTB: false },
  { code: '238150', description: 'Glass & Glazing Contractors', isSSTB: false },
  { code: '238160', description: 'Roofing Contractors', isSSTB: false },
  { code: '238170', description: 'Siding Contractors', isSSTB: false },
  { code: '238190', description: 'Other Foundation & Exterior Contractors', isSSTB: false },
  { code: '238210', description: 'Electrical Contractors', isSSTB: false },
  { code: '238220', description: 'Plumbing, Heating & Air-Conditioning', isSSTB: false },
  { code: '238290', description: 'Other Building Equipment Contractors', isSSTB: false },
  { code: '238310', description: 'Drywall & Insulation Contractors', isSSTB: false },
  { code: '238320', description: 'Painting & Wall Covering Contractors', isSSTB: false },
  { code: '238330', description: 'Flooring Contractors', isSSTB: false },
  { code: '238340', description: 'Tile & Terrazzo Contractors', isSSTB: false },
  { code: '238350', description: 'Finish Carpentry Contractors', isSSTB: false },
  { code: '238390', description: 'Other Building Finishing Contractors', isSSTB: false },
  { code: '238910', description: 'Site Preparation Contractors', isSSTB: false },
  { code: '238990', description: 'All Other Specialty Trade Contractors', isSSTB: false },

  // ─────────────────────────────────────────────────────────────────
  // MANUFACTURING (31-33xxxx)
  // ─────────────────────────────────────────────────────────────────
  { code: '311810', description: 'Bread & Bakery Product Manufacturing', isSSTB: false },
  { code: '311990', description: 'All Other Food Manufacturing', isSSTB: false },
  { code: '312120', description: 'Breweries', isSSTB: false },
  { code: '312130', description: 'Wineries', isSSTB: false },
  { code: '312140', description: 'Distilleries', isSSTB: false },
  { code: '315990', description: 'Apparel Accessories Manufacturing', isSSTB: false },
  { code: '321999', description: 'All Other Miscellaneous Wood Product Mfg', isSSTB: false },
  { code: '323111', description: 'Commercial Printing (except Screen)', isSSTB: false },
  { code: '325611', description: 'Soap & Other Detergent Manufacturing', isSSTB: false },
  { code: '326199', description: 'All Other Plastics Product Manufacturing', isSSTB: false },
  { code: '332710', description: 'Machine Shops', isSSTB: false },
  { code: '333249', description: 'Other Industrial Machinery Manufacturing', isSSTB: false },
  { code: '333999', description: 'All Other Misc. General Purpose Machinery', isSSTB: false },
  { code: '334111', description: 'Electronic Computer Manufacturing', isSSTB: false },
  { code: '334614', description: 'Software & Media Reproducing', isSSTB: false },
  { code: '335999', description: 'All Other Misc. Electrical Equipment Mfg', isSSTB: false },
  { code: '337110', description: 'Wood Kitchen Cabinet & Countertop Mfg', isSSTB: false },
  { code: '339910', description: 'Jewelry & Silverware Manufacturing', isSSTB: false },
  { code: '339990', description: 'All Other Miscellaneous Manufacturing', isSSTB: false },

  // ─────────────────────────────────────────────────────────────────
  // WHOLESALE TRADE (42xxxx)
  // ─────────────────────────────────────────────────────────────────
  { code: '423990', description: 'Other Misc. Durable Goods Wholesalers', isSSTB: false },
  { code: '424990', description: 'Other Misc. Nondurable Goods Wholesalers', isSSTB: false },
  { code: '425120', description: 'Wholesale Trade Agents & Brokers', isSSTB: false },

  // ─────────────────────────────────────────────────────────────────
  // RETAIL TRADE (44-45xxxx)
  // ─────────────────────────────────────────────────────────────────
  { code: '441110', description: 'New Car Dealers', isSSTB: false },
  { code: '441120', description: 'Used Car Dealers', isSSTB: false },
  { code: '441210', description: 'Recreational Vehicle Dealers', isSSTB: false },
  { code: '442110', description: 'Furniture Stores', isSSTB: false },
  { code: '442210', description: 'Floor Covering Stores', isSSTB: false },
  { code: '443142', description: 'Electronics Stores', isSSTB: false },
  { code: '444110', description: 'Home Centers', isSSTB: false },
  { code: '444120', description: 'Paint & Wallpaper Stores', isSSTB: false },
  { code: '444130', description: 'Hardware Stores', isSSTB: false },
  { code: '444190', description: 'Other Building Material Dealers', isSSTB: false },
  { code: '445110', description: 'Supermarkets & Grocery Stores', isSSTB: false },
  { code: '445210', description: 'Meat Markets', isSSTB: false },
  { code: '445230', description: 'Fruit & Vegetable Markets', isSSTB: false },
  { code: '445291', description: 'Baked Goods Stores', isSSTB: false },
  { code: '445292', description: 'Confectionery & Nut Stores', isSSTB: false },
  { code: '445299', description: 'All Other Specialty Food Stores', isSSTB: false },
  { code: '446110', description: 'Pharmacies & Drug Stores', isSSTB: false },
  { code: '447110', description: 'Gasoline Stations with Convenience Stores', isSSTB: false },
  { code: '448110', description: 'Men\'s Clothing Stores', isSSTB: false },
  { code: '448120', description: 'Women\'s Clothing Stores', isSSTB: false },
  { code: '448140', description: 'Family Clothing Stores', isSSTB: false },
  { code: '448150', description: 'Clothing Accessories Stores', isSSTB: false },
  { code: '448310', description: 'Jewelry Stores', isSSTB: false },
  { code: '449110', description: 'Furniture & Home Furnishings Retailers', isSSTB: false },
  { code: '451110', description: 'Sporting Goods Stores', isSSTB: false },
  { code: '451120', description: 'Hobby, Toy & Game Stores', isSSTB: false },
  { code: '451130', description: 'Sewing, Needlework & Piece Goods Stores', isSSTB: false },
  { code: '451140', description: 'Musical Instrument & Supplies Stores', isSSTB: false },
  { code: '451211', description: 'Book Stores', isSSTB: false },
  { code: '452210', description: 'Department Stores', isSSTB: false },
  { code: '452319', description: 'All Other General Merchandise Stores', isSSTB: false },
  { code: '453110', description: 'Florists', isSSTB: false },
  { code: '453210', description: 'Office Supplies & Stationery Stores', isSSTB: false },
  { code: '453220', description: 'Gift, Novelty & Souvenir Stores', isSSTB: false },
  { code: '453310', description: 'Used Merchandise Stores', isSSTB: false },
  { code: '453910', description: 'Pet & Pet Supplies Stores', isSSTB: false },
  { code: '453920', description: 'Art Dealers', isSSTB: false },
  { code: '453991', description: 'Tobacco Stores', isSSTB: false },
  { code: '453998', description: 'All Other Misc. Store Retailers', isSSTB: false },
  { code: '454110', description: 'Electronic Shopping & Mail-Order', isSSTB: false },
  { code: '454210', description: 'Vending Machine Operators', isSSTB: false },
  { code: '454310', description: 'Fuel Dealers', isSSTB: false },
  { code: '454390', description: 'Other Direct Selling Establishments', isSSTB: false },

  // ─────────────────────────────────────────────────────────────────
  // TRANSPORTATION & WAREHOUSING (48-49xxxx)
  // ─────────────────────────────────────────────────────────────────
  { code: '484110', description: 'General Freight Trucking, Local', isSSTB: false },
  { code: '484120', description: 'General Freight Trucking, Long-Distance', isSSTB: false },
  { code: '484220', description: 'Specialized Freight Trucking, Local', isSSTB: false },
  { code: '485110', description: 'Urban Transit Systems', isSSTB: false },
  { code: '485310', description: 'Taxi & Ridesharing Services', isSSTB: false },
  { code: '485320', description: 'Limousine Service', isSSTB: false },
  { code: '485990', description: 'Other Transit & Ground Passenger', isSSTB: false },
  { code: '487110', description: 'Scenic & Sightseeing Transportation, Land', isSSTB: false },
  { code: '488410', description: 'Motor Vehicle Towing', isSSTB: false },
  { code: '488490', description: 'Other Support Activities for Road Transport', isSSTB: false },
  { code: '491110', description: 'Postal Service', isSSTB: false },
  { code: '492110', description: 'Couriers & Express Delivery Services', isSSTB: false },
  { code: '492210', description: 'Local Messengers & Delivery', isSSTB: false },
  { code: '493110', description: 'General Warehousing & Storage', isSSTB: false },

  // ─────────────────────────────────────────────────────────────────
  // INFORMATION (51xxxx)
  // ─────────────────────────────────────────────────────────────────
  { code: '511110', description: 'Newspaper Publishers', isSSTB: false },
  { code: '511120', description: 'Periodical Publishers', isSSTB: false },
  { code: '511130', description: 'Book Publishers', isSSTB: false },
  { code: '511199', description: 'All Other Publishers', isSSTB: false },
  { code: '511210', description: 'Software Publishers', isSSTB: false },
  { code: '512110', description: 'Motion Picture & Video Production', isSSTB: false },
  { code: '512191', description: 'Teleproduction & Postproduction Services', isSSTB: false },
  { code: '512240', description: 'Sound Recording Studios', isSSTB: false },
  { code: '512290', description: 'Other Sound Recording Industries', isSSTB: false },
  { code: '515210', description: 'Cable & Other Subscription Programming', isSSTB: false },
  { code: '517311', description: 'Wired Telecommunications Carriers', isSSTB: false },
  { code: '517312', description: 'Wireless Telecommunications Carriers', isSSTB: false },
  { code: '518210', description: 'Data Processing, Hosting & Related Services', isSSTB: false },
  { code: '519130', description: 'Internet Publishing & Broadcasting', isSSTB: false },
  { code: '519190', description: 'All Other Information Services', isSSTB: false },

  // ─────────────────────────────────────────────────────────────────
  // FINANCE & INSURANCE (52xxxx) — MANY ARE SSTB
  // ─────────────────────────────────────────────────────────────────
  { code: '522310', description: 'Mortgage & Nonmortgage Loan Brokers', isSSTB: true },
  { code: '523110', description: 'Investment Banking & Securities Dealing', isSSTB: true },
  { code: '523120', description: 'Securities Brokerage', isSSTB: true },
  { code: '523130', description: 'Commodity Contracts Dealing', isSSTB: true },
  { code: '523140', description: 'Commodity Contracts Brokerage', isSSTB: true },
  { code: '523910', description: 'Miscellaneous Intermediation', isSSTB: true },
  { code: '523920', description: 'Portfolio Management', isSSTB: true },
  { code: '523930', description: 'Investment Advice', isSSTB: true },
  { code: '523991', description: 'Trust, Fiduciary & Custody Activities', isSSTB: true },
  { code: '523999', description: 'Misc. Financial Investment Activities', isSSTB: true },
  { code: '524210', description: 'Insurance Agencies & Brokerages', isSSTB: true },
  { code: '524291', description: 'Claims Adjusting', isSSTB: true },
  { code: '524292', description: 'Third Party Administration of Insurance', isSSTB: true },
  { code: '524298', description: 'Other Insurance Related Activities', isSSTB: true },

  // ─────────────────────────────────────────────────────────────────
  // REAL ESTATE (53xxxx)
  // ─────────────────────────────────────────────────────────────────
  { code: '531110', description: 'Lessors of Residential Buildings', isSSTB: false },
  { code: '531120', description: 'Lessors of Nonresidential Buildings', isSSTB: false },
  { code: '531130', description: 'Lessors of Miniwarehouses & Self-Storage', isSSTB: false },
  { code: '531190', description: 'Lessors of Other Real Estate Property', isSSTB: false },
  { code: '531210', description: 'Offices of Real Estate Agents & Brokers', isSSTB: false },
  { code: '531311', description: 'Residential Property Managers', isSSTB: false },
  { code: '531312', description: 'Nonresidential Property Managers', isSSTB: false },
  { code: '531320', description: 'Real Estate Appraisers', isSSTB: false },
  { code: '531390', description: 'Other Activities Related to Real Estate', isSSTB: false },
  { code: '532111', description: 'Passenger Car Rental', isSSTB: false },
  { code: '532281', description: 'Formal Wear & Costume Rental', isSSTB: false },
  { code: '532289', description: 'All Other Consumer Goods Rental', isSSTB: false },
  { code: '532310', description: 'General Rental Centers', isSSTB: false },
  { code: '532411', description: 'Commercial Air, Rail & Water Equip. Rental', isSSTB: false },
  { code: '532412', description: 'Construction & Mining Machinery Rental', isSSTB: false },
  { code: '532490', description: 'Other Commercial Equipment Rental & Leasing', isSSTB: false },

  // ─────────────────────────────────────────────────────────────────
  // PROFESSIONAL, SCIENTIFIC & TECHNICAL SERVICES (54xxxx)
  // This section has the most nuanced SSTB classifications
  // ─────────────────────────────────────────────────────────────────
  { code: '541110', description: 'Offices of Lawyers', isSSTB: true },
  { code: '541120', description: 'Offices of Notaries', isSSTB: false },
  { code: '541191', description: 'Title Abstract & Settlement Offices', isSSTB: false },
  { code: '541199', description: 'All Other Legal Services', isSSTB: true },
  { code: '541211', description: 'Offices of Certified Public Accountants', isSSTB: true },
  { code: '541213', description: 'Tax Preparation Services', isSSTB: true },
  { code: '541214', description: 'Payroll Services', isSSTB: true },
  { code: '541219', description: 'Other Accounting Services', isSSTB: true },
  { code: '541310', description: 'Architectural Services', isSSTB: false },
  { code: '541320', description: 'Landscape Architectural Services', isSSTB: false },
  { code: '541330', description: 'Engineering Services', isSSTB: false },
  { code: '541340', description: 'Drafting Services', isSSTB: false },
  { code: '541350', description: 'Building Inspection Services', isSSTB: false },
  { code: '541360', description: 'Geophysical Surveying & Mapping Services', isSSTB: false },
  { code: '541370', description: 'Surveying & Mapping (except Geophysical)', isSSTB: false },
  { code: '541380', description: 'Testing Laboratories & Services', isSSTB: false },
  { code: '541410', description: 'Interior Design Services', isSSTB: false },
  { code: '541420', description: 'Industrial Design Services', isSSTB: false },
  { code: '541430', description: 'Graphic Design Services', isSSTB: false },
  { code: '541490', description: 'Other Specialized Design Services', isSSTB: false },
  { code: '541511', description: 'Custom Computer Programming Services', isSSTB: false },
  { code: '541512', description: 'Computer Systems Design Services', isSSTB: false },
  { code: '541513', description: 'Computer Facilities Management Services', isSSTB: false },
  { code: '541519', description: 'Other Computer Related Services', isSSTB: false },
  { code: '541611', description: 'Administrative Management Consulting', isSSTB: true },
  { code: '541612', description: 'Human Resources Consulting', isSSTB: true },
  { code: '541613', description: 'Marketing Consulting Services', isSSTB: true },
  { code: '541614', description: 'Process & Logistics Consulting', isSSTB: true },
  { code: '541618', description: 'Other Management Consulting Services', isSSTB: true },
  { code: '541620', description: 'Environmental Consulting Services', isSSTB: false },
  { code: '541690', description: 'Other Scientific & Technical Consulting', isSSTB: false },
  { code: '541711', description: 'Research & Development in Biotechnology', isSSTB: false },
  { code: '541712', description: 'R&D in Physical, Engineering & Life Sciences', isSSTB: false },
  { code: '541720', description: 'R&D in Social Sciences & Humanities', isSSTB: false },
  { code: '541810', description: 'Advertising Agencies', isSSTB: false },
  { code: '541820', description: 'Public Relations Agencies', isSSTB: false },
  { code: '541830', description: 'Media Buying Agencies', isSSTB: false },
  { code: '541840', description: 'Media Representatives', isSSTB: false },
  { code: '541850', description: 'Outdoor Advertising', isSSTB: false },
  { code: '541860', description: 'Direct Mail Advertising', isSSTB: false },
  { code: '541890', description: 'Other Services Related to Advertising', isSSTB: false },
  { code: '541910', description: 'Marketing Research & Public Opinion Polling', isSSTB: false },
  { code: '541921', description: 'Photography Studios, Portrait', isSSTB: false },
  { code: '541922', description: 'Commercial Photography', isSSTB: false },
  { code: '541930', description: 'Translation & Interpretation Services', isSSTB: false },
  { code: '541940', description: 'Veterinary Services', isSSTB: false },
  { code: '541990', description: 'All Other Professional & Technical Services', isSSTB: false },

  // ─────────────────────────────────────────────────────────────────
  // MANAGEMENT OF COMPANIES (55xxxx)
  // ─────────────────────────────────────────────────────────────────
  { code: '551111', description: 'Offices of Bank Holding Companies', isSSTB: false },
  { code: '551112', description: 'Offices of Other Holding Companies', isSSTB: false },

  // ─────────────────────────────────────────────────────────────────
  // ADMINISTRATIVE & SUPPORT SERVICES (56xxxx)
  // ─────────────────────────────────────────────────────────────────
  { code: '561110', description: 'Office Administrative Services', isSSTB: false },
  { code: '561210', description: 'Facilities Support Services', isSSTB: false },
  { code: '561311', description: 'Employment Placement Agencies', isSSTB: false },
  { code: '561312', description: 'Executive Search Services', isSSTB: false },
  { code: '561320', description: 'Temporary Help Services', isSSTB: false },
  { code: '561410', description: 'Document Preparation Services', isSSTB: false },
  { code: '561421', description: 'Telephone Answering Services', isSSTB: false },
  { code: '561431', description: 'Private Mail Centers', isSSTB: false },
  { code: '561439', description: 'Other Business Service Centers', isSSTB: false },
  { code: '561440', description: 'Collection Agencies', isSSTB: false },
  { code: '561450', description: 'Credit Bureaus', isSSTB: false },
  { code: '561491', description: 'Repossession Services', isSSTB: false },
  { code: '561499', description: 'All Other Business Support Services', isSSTB: false },
  { code: '561510', description: 'Travel Agencies', isSSTB: false },
  { code: '561520', description: 'Tour Operators', isSSTB: false },
  { code: '561591', description: 'Convention & Visitors Bureaus', isSSTB: false },
  { code: '561599', description: 'All Other Travel Arrangement Services', isSSTB: false },
  { code: '561612', description: 'Security Guards & Patrol Services', isSSTB: false },
  { code: '561621', description: 'Security Systems (except Locksmiths)', isSSTB: false },
  { code: '561622', description: 'Locksmiths', isSSTB: false },
  { code: '561710', description: 'Exterminating & Pest Control Services', isSSTB: false },
  { code: '561720', description: 'Janitorial Services', isSSTB: false },
  { code: '561730', description: 'Landscaping Services', isSSTB: false },
  { code: '561740', description: 'Carpet & Upholstery Cleaning Services', isSSTB: false },
  { code: '561790', description: 'Other Services to Buildings & Dwellings', isSSTB: false },
  { code: '561910', description: 'Packaging & Labeling Services', isSSTB: false },
  { code: '561990', description: 'All Other Support Services', isSSTB: false },
  { code: '562111', description: 'Solid Waste Collection', isSSTB: false },
  { code: '562119', description: 'Other Waste Collection', isSSTB: false },
  { code: '562910', description: 'Remediation Services', isSSTB: false },
  { code: '562991', description: 'Septic Tank & Related Services', isSSTB: false },
  { code: '562998', description: 'All Other Miscellaneous Waste Services', isSSTB: false },

  // ─────────────────────────────────────────────────────────────────
  // EDUCATIONAL SERVICES (61xxxx)
  // ─────────────────────────────────────────────────────────────────
  { code: '611110', description: 'Elementary & Secondary Schools', isSSTB: false },
  { code: '611210', description: 'Junior Colleges', isSSTB: false },
  { code: '611310', description: 'Colleges, Universities & Professional Schools', isSSTB: false },
  { code: '611430', description: 'Professional & Management Development Training', isSSTB: false },
  { code: '611511', description: 'Cosmetology & Barber Schools', isSSTB: false },
  { code: '611519', description: 'Other Technical & Trade Schools', isSSTB: false },
  { code: '611610', description: 'Fine Arts Schools', isSSTB: false },
  { code: '611620', description: 'Sports & Recreation Instruction', isSSTB: false },
  { code: '611630', description: 'Language Schools', isSSTB: false },
  { code: '611691', description: 'Exam Preparation & Tutoring', isSSTB: false },
  { code: '611699', description: 'All Other Miscellaneous Schools & Instruction', isSSTB: false },
  { code: '611710', description: 'Educational Support Services', isSSTB: false },

  // ─────────────────────────────────────────────────────────────────
  // HEALTH CARE & SOCIAL ASSISTANCE (62xxxx) — MOST ARE SSTB
  // ─────────────────────────────────────────────────────────────────
  { code: '621111', description: 'Offices of Physicians (except Mental Health)', isSSTB: true },
  { code: '621112', description: 'Offices of Physicians, Mental Health', isSSTB: true },
  { code: '621210', description: 'Offices of Dentists', isSSTB: true },
  { code: '621310', description: 'Offices of Chiropractors', isSSTB: true },
  { code: '621320', description: 'Offices of Optometrists', isSSTB: true },
  { code: '621330', description: 'Offices of Mental Health Practitioners', isSSTB: true },
  { code: '621340', description: 'Offices of Physical & Occupational Therapists', isSSTB: true },
  { code: '621391', description: 'Offices of Podiatrists', isSSTB: true },
  { code: '621399', description: 'Offices of All Other Misc. Health Practitioners', isSSTB: true },
  { code: '621410', description: 'Family Planning Centers', isSSTB: true },
  { code: '621420', description: 'Outpatient Mental Health Centers', isSSTB: true },
  { code: '621491', description: 'HMO Medical Centers', isSSTB: true },
  { code: '621492', description: 'Kidney Dialysis Centers', isSSTB: true },
  { code: '621498', description: 'All Other Outpatient Care Centers', isSSTB: true },
  { code: '621510', description: 'Medical & Diagnostic Laboratories', isSSTB: true },
  { code: '621610', description: 'Home Health Care Services', isSSTB: true },
  { code: '621910', description: 'Ambulance Services', isSSTB: true },
  { code: '621999', description: 'All Other Misc. Ambulatory Health Care', isSSTB: true },
  { code: '623110', description: 'Nursing Care Facilities', isSSTB: false },
  { code: '623210', description: 'Residential Intellectual Disability Facilities', isSSTB: false },
  { code: '623220', description: 'Residential Mental Health Facilities', isSSTB: false },
  { code: '623312', description: 'Assisted Living Facilities for the Elderly', isSSTB: false },
  { code: '624110', description: 'Child & Youth Services', isSSTB: false },
  { code: '624120', description: 'Services for the Elderly & Disabled', isSSTB: false },
  { code: '624190', description: 'Other Individual & Family Services', isSSTB: false },
  { code: '624210', description: 'Community Food Services', isSSTB: false },
  { code: '624310', description: 'Vocational Rehabilitation Services', isSSTB: false },
  { code: '624410', description: 'Child Day Care Services', isSSTB: false },

  // ─────────────────────────────────────────────────────────────────
  // ARTS, ENTERTAINMENT & RECREATION (71xxxx) — PERFORMING ARTS & ATHLETICS ARE SSTB
  // ─────────────────────────────────────────────────────────────────
  { code: '711110', description: 'Theater Companies & Dinner Theaters', isSSTB: true },
  { code: '711120', description: 'Dance Companies', isSSTB: true },
  { code: '711130', description: 'Musical Groups & Artists', isSSTB: true },
  { code: '711190', description: 'Other Performing Arts Companies', isSSTB: true },
  { code: '711211', description: 'Sports Teams & Clubs', isSSTB: true },
  { code: '711212', description: 'Racetracks', isSSTB: true },
  { code: '711219', description: 'Other Spectator Sports', isSSTB: true },
  { code: '711310', description: 'Promoters with Facilities', isSSTB: false },
  { code: '711320', description: 'Promoters without Facilities', isSSTB: false },
  { code: '711410', description: 'Agents & Managers for Artists & Athletes', isSSTB: true },
  { code: '711510', description: 'Independent Artists, Writers & Performers', isSSTB: true },
  { code: '713110', description: 'Amusement & Theme Parks', isSSTB: false },
  { code: '713120', description: 'Amusement Arcades', isSSTB: false },
  { code: '713910', description: 'Golf Courses & Country Clubs', isSSTB: false },
  { code: '713920', description: 'Skiing Facilities', isSSTB: false },
  { code: '713930', description: 'Marinas', isSSTB: false },
  { code: '713940', description: 'Fitness & Recreational Sports Centers', isSSTB: false },
  { code: '713950', description: 'Bowling Centers', isSSTB: false },
  { code: '713990', description: 'All Other Amusement & Recreation', isSSTB: false },

  // ─────────────────────────────────────────────────────────────────
  // ACCOMMODATION & FOOD SERVICES (72xxxx)
  // ─────────────────────────────────────────────────────────────────
  { code: '721110', description: 'Hotels (except Casino Hotels) & Motels', isSSTB: false },
  { code: '721191', description: 'Bed-and-Breakfast Inns', isSSTB: false },
  { code: '721199', description: 'All Other Traveler Accommodation', isSSTB: false },
  { code: '721211', description: 'RV Parks & Campgrounds', isSSTB: false },
  { code: '721310', description: 'Rooming & Boarding Houses', isSSTB: false },
  { code: '722310', description: 'Food Service Contractors', isSSTB: false },
  { code: '722320', description: 'Caterers', isSSTB: false },
  { code: '722330', description: 'Mobile Food Services', isSSTB: false },
  { code: '722410', description: 'Drinking Places (Alcoholic Beverages)', isSSTB: false },
  { code: '722511', description: 'Full-Service Restaurants', isSSTB: false },
  { code: '722513', description: 'Limited-Service Restaurants', isSSTB: false },
  { code: '722514', description: 'Cafeterias & Buffets', isSSTB: false },
  { code: '722515', description: 'Snack & Nonalcoholic Beverage Bars', isSSTB: false },

  // ─────────────────────────────────────────────────────────────────
  // OTHER SERVICES (81xxxx)
  // ─────────────────────────────────────────────────────────────────
  { code: '811111', description: 'General Automotive Repair', isSSTB: false },
  { code: '811112', description: 'Automotive Exhaust System Repair', isSSTB: false },
  { code: '811113', description: 'Automotive Transmission Repair', isSSTB: false },
  { code: '811118', description: 'Other Automotive Mechanical & Electrical Repair', isSSTB: false },
  { code: '811121', description: 'Automotive Body, Paint & Interior Repair', isSSTB: false },
  { code: '811122', description: 'Automotive Glass Replacement Shops', isSSTB: false },
  { code: '811191', description: 'Automotive Oil Change & Lubrication Shops', isSSTB: false },
  { code: '811192', description: 'Car Washes', isSSTB: false },
  { code: '811198', description: 'All Other Automotive Repair & Maintenance', isSSTB: false },
  { code: '811210', description: 'Electronic & Precision Equipment Repair', isSSTB: false },
  { code: '811310', description: 'Commercial Machinery Repair & Maintenance', isSSTB: false },
  { code: '811411', description: 'Home & Garden Equipment Repair', isSSTB: false },
  { code: '811412', description: 'Appliance Repair & Maintenance', isSSTB: false },
  { code: '811420', description: 'Reupholstery & Furniture Repair', isSSTB: false },
  { code: '811430', description: 'Footwear & Leather Goods Repair', isSSTB: false },
  { code: '811490', description: 'Other Personal & Household Goods Repair', isSSTB: false },
  { code: '812111', description: 'Barber Shops', isSSTB: false },
  { code: '812112', description: 'Beauty Salons', isSSTB: false },
  { code: '812113', description: 'Nail Salons', isSSTB: false },
  { code: '812191', description: 'Diet & Weight Reducing Centers', isSSTB: false },
  { code: '812199', description: 'Other Personal Care Services', isSSTB: false },
  { code: '812210', description: 'Funeral Homes & Funeral Services', isSSTB: false },
  { code: '812220', description: 'Cemeteries & Crematories', isSSTB: false },
  { code: '812310', description: 'Coin-Operated Laundries & Drycleaners', isSSTB: false },
  { code: '812320', description: 'Drycleaning & Laundry Services', isSSTB: false },
  { code: '812331', description: 'Linen Supply', isSSTB: false },
  { code: '812332', description: 'Industrial Laundering', isSSTB: false },
  { code: '812910', description: 'Pet Care (except Veterinary) Services', isSSTB: false },
  { code: '812921', description: 'Photofinishing Laboratories', isSSTB: false },
  { code: '812922', description: 'One-Hour Photofinishing', isSSTB: false },
  { code: '812930', description: 'Parking Lots & Garages', isSSTB: false },
  { code: '812990', description: 'All Other Personal Services', isSSTB: false },
  { code: '813110', description: 'Religious Organizations', isSSTB: false },
  { code: '813319', description: 'Other Social Advocacy Organizations', isSSTB: false },
  { code: '813410', description: 'Civic & Social Organizations', isSSTB: false },
  { code: '813910', description: 'Business Associations', isSSTB: false },
  { code: '813920', description: 'Professional Organizations', isSSTB: false },
  { code: '813930', description: 'Labor Unions & Similar Organizations', isSSTB: false },
  { code: '813990', description: 'Other Similar Organizations', isSSTB: false },

  // ─────────────────────────────────────────────────────────────────
  // UNCLASSIFIED / CATCH-ALL
  // ─────────────────────────────────────────────────────────────────
  { code: '999999', description: 'Unclassified Establishments', isSSTB: false },
];

/**
 * Lookup a NAICS entry by its 6-digit code.
 * Returns undefined if the code is not in the curated list.
 */
export function findNAICSByCode(code: string): NAICSEntry | undefined {
  return NAICS_CODES.find((entry) => entry.code === code);
}

/**
 * Search NAICS codes by description (case-insensitive substring match).
 * Returns all entries whose description contains the search term.
 */
export function searchNAICS(query: string): NAICSEntry[] {
  if (!query || query.trim().length < 2) return [];
  const lower = query.toLowerCase().trim();
  return NAICS_CODES.filter(
    (entry) =>
      entry.description.toLowerCase().includes(lower) ||
      entry.code.includes(lower),
  );
}
