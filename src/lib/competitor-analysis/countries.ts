/**
 * ISO 3166-1 alpha-2 codes supported by Meta Ads Library (ad_reached_countries / country URL param).
 * @see https://www.facebook.com/ads/library/api/
 */
export const META_AD_LIBRARY_COUNTRY_CODES = [
  'AD', 'AE', 'AG', 'AI', 'AL', 'AM', 'AN', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
  'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN',
  'CO', 'CR', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE', 'EG',
  'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF', 'GG',
  'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM', 'HN',
  'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP',
  'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR',
  'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN',
  'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA', 'NC', 'NE', 'NF',
  'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL',
  'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW', 'SA', 'SB', 'SC',
  'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SZ',
  'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ',
  'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU', 'WF', 'WS', 'XK',
  'YE', 'YT', 'ZA', 'ZM', 'ZW',
] as const;

export type MetaAdLibraryCountryCode = (typeof META_AD_LIBRARY_COUNTRY_CODES)[number];

export type CountryOption = {
  name: string;
  shortcut: string;
};

const regionDisplay = new Intl.DisplayNames(['en'], { type: 'region' });

/** Human-readable country names, sorted A→Z. */
export const META_AD_LIBRARY_COUNTRIES: CountryOption[] = META_AD_LIBRARY_COUNTRY_CODES.map(
  (shortcut) => ({
    shortcut,
    name: regionDisplay.of(shortcut) ?? shortcut,
  })
).sort((a, b) => a.name.localeCompare(b.name));

export function filterCountryOptions(query: string): CountryOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return META_AD_LIBRARY_COUNTRIES;
  return META_AD_LIBRARY_COUNTRIES.filter(
    (item) =>
      item.name.toLowerCase().includes(q) || item.shortcut.toLowerCase().includes(q)
  );
}

export function resolveCountryFromInput(query: string): CountryOption | null {
  const q = query.trim();
  if (!q) return null;
  const lower = q.toLowerCase();
  const exact = META_AD_LIBRARY_COUNTRIES.find(
    (item) => item.shortcut.toLowerCase() === lower || item.name.toLowerCase() === lower
  );
  if (exact) return exact;
  const matches = filterCountryOptions(q);
  return matches[0] ?? null;
}
