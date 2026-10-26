import { PlatformSettings } from '../types';

export const OHADA_COUNTRIES = [
  { code: 'CI', name: "Côte d'Ivoire", currency: 'FCFA (XOF)', defaultVat: 18, flag: '🇨🇮', phonePrefix: '+225', city: 'Abidjan', timezones: ['Africa/Abidjan'] },
  { code: 'SN', name: 'Sénégal', currency: 'FCFA (XOF)', defaultVat: 18, flag: '🇸🇳', phonePrefix: '+221', city: 'Dakar', timezones: ['Africa/Dakar'] },
  { code: 'CM', name: 'Cameroun', currency: 'FCFA (XAF)', defaultVat: 19.25, flag: '🇨🇲', phonePrefix: '+237', city: 'Douala', timezones: ['Africa/Douala'] },
  { code: 'BJ', name: 'Bénin', currency: 'FCFA (XOF)', defaultVat: 18, flag: '🇧🇯', phonePrefix: '+229', city: 'Cotonou', timezones: ['Africa/Porto-Novo'] },
  { code: 'TG', name: 'Togo', currency: 'FCFA (XOF)', defaultVat: 18, flag: '🇹🇬', phonePrefix: '+228', city: 'Lomé', timezones: ['Africa/Lome'] },
  { code: 'BF', name: 'Burkina Faso', currency: 'FCFA (XOF)', defaultVat: 18, flag: '🇧🇫', phonePrefix: '+226', city: 'Ouagadougou', timezones: ['Africa/Ouagadougou'] },
  { code: 'ML', name: 'Mali', currency: 'FCFA (XOF)', defaultVat: 18, flag: '🇲🇱', phonePrefix: '+223', city: 'Bamako', timezones: ['Africa/Bamako'] },
  { code: 'GA', name: 'Gabon', currency: 'FCFA (XAF)', defaultVat: 18, flag: '🇬🇦', phonePrefix: '+241', city: 'Libreville', timezones: ['Africa/Libreville'] },
  { code: 'CG', name: 'Congo', currency: 'FCFA (XAF)', defaultVat: 18, flag: '🇨🇬', phonePrefix: '+242', city: 'Brazzaville', timezones: ['Africa/Brazzaville'] },
  { code: 'NE', name: 'Niger', currency: 'FCFA (XOF)', defaultVat: 18, flag: '🇳🇪', phonePrefix: '+227', city: 'Niamey', timezones: ['Africa/Niamey'] },
  { code: 'GN', name: 'Guinée', currency: 'GNF', defaultVat: 18, flag: '🇬🇳', phonePrefix: '+224', city: 'Conakry', timezones: ['Africa/Conakry'] },
  { code: 'CD', name: 'RD Congo', currency: 'CDF / USD', defaultVat: 16, flag: '🇨🇩', phonePrefix: '+243', city: 'Kinshasa', timezones: ['Africa/Kinshasa', 'Africa/Lubumbashi'] }
];

export type OhadaCountry = typeof OHADA_COUNTRIES[number];

/** Pays de l'utilisateur deviné sans réseau ni permission : fuseau horaire, puis région de la langue (fr-SN…). */
export function detectUserCountry(): OhadaCountry {
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {}
  const byTz = OHADA_COUNTRIES.find(c => c.timezones.includes(tz));
  if (byTz) return byTz;
  const regions = (navigator.languages ?? [navigator.language]).map(l => l.split('-')[1]?.toUpperCase());
  return OHADA_COUNTRIES.find(c => regions.includes(c.code)) ?? OHADA_COUNTRIES[0];
}

/** Valeur de devise stockée sur le dossier pour un pays. */
export const dossierCurrency = (c?: OhadaCountry) => c?.currency.includes('FCFA') ? 'FCFA' : c?.currency || 'FCFA';

export const ACTIVITY_SECTORS = [
  'Commerce de gros & demi-gros',
  'Commerce de détail & alimentation générale',
  'Quincaillerie & matériaux de construction',
  'Artisanat, confection & textile',
  'Prestations de services & conseil',
  'Transport, logistique & livraison',
  'BTP, travaux & rénovation',
  'Restauration, maquis & hôtellerie',
  'Santé, pharmacie & cosmétiques',
  'Agro-alimentaire & maraîchage',
  'Numérique, télécoms & multimédia'
];

export const FISCAL_REGIMES: Array<'Réel Simplifié' | 'Réel Normal' | 'Synthétique / Forfait'> = [
  'Réel Simplifié',
  'Réel Normal',
  'Synthétique / Forfait'
];

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  // Comptabilité & SYSCOHADA
  syscohadaVersion: 'SYSCOHADA Révisé 2026 (AUDCIF)',
  cashDeductibilityThreshold: 500000, // 500 000 FCFA selon article OHADA/CGI
  defaultVatRate: 18, // 18% par défaut zone UEMOA
  autoFlagLargeCashPayments: true,
  defaultDebitCashAccount: '5711 - Caisse Principale',
  defaultCreditSalesAccount: '7011 - Ventes de Marchandises',
  defaultDebitExpenseAccount: '6011 - Achats de Marchandises',

  // IA
  duplicateDetection: true,
  aiModelPreference: 'gemini-2.5-flash',

  // Préférences & Affichage
  defaultStartupView: 'simplified',
  numberFormatting: 'standard',
  cabinetName: 'Cabinet KM Consulting & Audit OHADA',
  expertLicenseNumber: 'ONECCA-CI N° 2024-889',

  // Audio & Notifications
  soundEnabled: true,
  soundType: 'fintech_chime',
  soundVolume: 0.7,
  notifyOnAnomaly: true,
  notifyOnTaxDeadline: true,
  notifyOnMobileMoneySync: true
};
