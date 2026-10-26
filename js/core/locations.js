// Ghana's 16 regions, each with common towns / neighbourhoods used as suggestions in the "Area / town" box.
// Sellers can still type any area that isn't listed, so this list never blocks anyone. Add places any time.
export const REGIONS = {
  "Greater Accra": ["Accra Metropolitan", "Adenta", "Airport Residential", "Ashaley Botwe", "Achimota", "Abeka", "Abelemkpe", "Amasaman", "Bortianor", "Cantonments", "Dansoman", "Dome", "Dzorwulu", "East Legon", "Haatso", "Kanda", "Kasoa Road", "Kokomlemle", "Kwabenya", "Labadi", "Lapaz", "Legon", "Madina", "Nima", "Nungua", "Ofankor", "Osu", "Pokuase", "Ridge", "Spintex", "Tema", "Tesano", "Teshie", "Weija", "Ga East", "Ga West"],
  "Ashanti": ["Kumasi Metropolitan", "Adum", "Ahodwo", "Asokwa", "Bantama", "Ejisu", "Kejetia", "Kwadaso", "Obuasi", "Suame", "Tafo", "Nhyiaeso", "Santasi", "Atonsu", "Mampong", "Konongo"],
  "Western": ["Takoradi", "Sekondi", "Tarkwa", "Axim", "Effia-Kwesimintsim", "Prestea", "Shama"],
  "Western North": ["Sefwi Wiawso", "Bibiani", "Enchi", "Juaboso"],
  "Central": ["Cape Coast", "Kasoa", "Winneba", "Mankessim", "Elmina", "Swedru", "Assin Fosu", "Dunkwa-on-Offin"],
  "Eastern": ["Koforidua", "Nkawkaw", "Nsawam", "Suhum", "Aburi", "Akim Oda", "Somanya", "Akosombo", "Kade"],
  "Volta": ["Ho", "Hohoe", "Aflao", "Keta", "Sogakope", "Kpando", "Anloga"],
  "Oti": ["Dambai", "Nkwanta", "Kete Krachi", "Jasikan"],
  "Northern": ["Tamale", "Yendi", "Savelugu", "Bimbilla"],
  "Savannah": ["Damongo", "Bole", "Salaga"],
  "North East": ["Nalerigu", "Walewale", "Gambaga"],
  "Upper East": ["Bolgatanga", "Bawku", "Navrongo", "Zebilla"],
  "Upper West": ["Wa", "Tumu", "Lawra", "Jirapa"],
  "Bono": ["Sunyani", "Berekum", "Dormaa Ahenkro", "Wenchi"],
  "Bono East": ["Techiman", "Kintampo", "Atebubu", "Nkoranza"],
  "Ahafo": ["Goaso", "Bechem", "Kenyasi", "Hwidiem"]
};

export const REGION_NAMES = Object.keys(REGIONS);

/** "Greater Accra" + "Ashaley Botwe"  ->  "Greater Accra, Ashaley Botwe" (this is what cards and ad pages show) */
export const joinLocation = (region, area) => [region, area].filter(Boolean).join(", ");
