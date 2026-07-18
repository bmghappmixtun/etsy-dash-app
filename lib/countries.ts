/**
 * ISO 3166-1 alpha-2 country codes → human name + flag emoji.
 * Kept minimal for performance; covers the most common Etsy destinations.
 */

export interface CountryInfo {
  code: string;
  name: string;
  flag: string;
}

const COUNTRIES: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  FR: "France",
  DE: "Germany",
  IT: "Italy",
  ES: "Spain",
  NL: "Netherlands",
  BE: "Belgium",
  CH: "Switzerland",
  AT: "Austria",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  IE: "Ireland",
  PT: "Portugal",
  PL: "Poland",
  CZ: "Czechia",
  GR: "Greece",
  HU: "Hungary",
  RO: "Romania",
  JP: "Japan",
  KR: "South Korea",
  CN: "China",
  HK: "Hong Kong",
  TW: "Taiwan",
  SG: "Singapore",
  MY: "Malaysia",
  TH: "Thailand",
  PH: "Philippines",
  ID: "Indonesia",
  VN: "Vietnam",
  IN: "India",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  IL: "Israel",
  TR: "Turkey",
  EG: "Egypt",
  ZA: "South Africa",
  MX: "Mexico",
  BR: "Brazil",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colombia",
  PE: "Peru",
  NZ: "New Zealand",
  RU: "Russia",
  UA: "Ukraine",
};

const FALLBACK: CountryInfo = { code: "??", name: "Unknown", flag: "🏳️" };

export function getCountryInfo(code: string | null | undefined): CountryInfo {
  if (!code) return FALLBACK;
  const upper = code.toUpperCase();
  const name = COUNTRIES[upper] ?? code;
  // Regional indicator symbols: 🇦 + 🇧 for AB
  const codePoints = upper
    .split("")
    .map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65));
  const flag = String.fromCodePoint(...codePoints);
  return { code: upper, name, flag };
}

export function listCountries(): CountryInfo[] {
  return Object.keys(COUNTRIES)
    .map((code) => getCountryInfo(code))
    .sort((a, b) => a.name.localeCompare(b.name));
}
