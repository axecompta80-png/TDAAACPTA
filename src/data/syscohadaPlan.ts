import { SYSCOHADAAccount } from '../types';

export const SYSCOHADA_ACCOUNTS: SYSCOHADAAccount[] = [
  // Classe 1 : Ressources Durables
  { code: '101', label: 'Capital social', classNumber: 1, category: 'bilan_passif' },
  { code: '102', label: 'Capital personnel (exploitant individuel)', classNumber: 1, category: 'bilan_passif' },
  { code: '111', label: 'Réserve légale', classNumber: 1, category: 'bilan_passif' },
  { code: '131', label: 'Résultat net de l’exercice (Bénéfice)', classNumber: 1, category: 'bilan_passif' },
  { code: '162', label: 'Emprunts et dettes bancaires', classNumber: 1, category: 'bilan_passif' },
  
  // Classe 2 : Actif Immobilisé
  { code: '215', label: 'Matériel de transport (camions, tricycles)', classNumber: 2, category: 'bilan_actif' },
  { code: '241', label: 'Matériel et outillage industriel', classNumber: 2, category: 'bilan_actif' },
  { code: '244', label: 'Matériel de bureau et informatique', classNumber: 2, category: 'bilan_actif' },
  { code: '245', label: 'Mobilier de bureau et étals', classNumber: 2, category: 'bilan_actif' },
  
  // Classe 3 : Stocks
  { code: '2815', label: 'Amortissements du matériel de transport', classNumber: 2, category: 'bilan_actif' },
  { code: '2841', label: 'Amortissements du matériel et outillage', classNumber: 2, category: 'bilan_actif' },
  { code: '2844', label: 'Amortissements du matériel de bureau et informatique', classNumber: 2, category: 'bilan_actif' },
  { code: '2845', label: 'Amortissements du mobilier de bureau et étals', classNumber: 2, category: 'bilan_actif' },

  { code: '311', label: 'Marchandises (stocks généraux)', classNumber: 3, category: 'bilan_actif' },
  { code: '321', label: 'Matières premières et fournitures liées', classNumber: 3, category: 'bilan_actif' },
  
  // Classe 4 : Comptes de Tiers
  { code: '4011', label: 'Fournisseurs d’exploitation', classNumber: 4, category: 'bilan_passif' },
  { code: '4111', label: 'Clients ordinaires', classNumber: 4, category: 'bilan_actif' },
  { code: '4211', label: 'Personnel, salaires et rémunérations dues', classNumber: 4, category: 'bilan_passif' },
  { code: '4311', label: 'Sécurité sociale (CNPS / CNSS / IPRES)', classNumber: 4, category: 'bilan_passif' },
  { code: '4431', label: 'État, TVA facturée sur ventes (18%)', classNumber: 4, category: 'bilan_passif' },
  { code: '4452', label: 'État, TVA déductible sur achats et services (18%)', classNumber: 4, category: 'bilan_actif' },
  { code: '4441', label: 'État, TVA due / à décaisser', classNumber: 4, category: 'bilan_passif' },
  { code: '4471', label: 'État, Impôts sur les bénéfices & acomptes', classNumber: 4, category: 'bilan_passif' },
  { code: '4711', label: 'Compte d’attente créditeur/débiteur', classNumber: 4, category: 'bilan_actif' },

  // Classe 5 : Trésorerie
  { code: '5211', label: 'Banque locale (Ecobank, Coris, SG, UBA)', classNumber: 5, category: 'tresorerie' },
  { code: '5261', label: 'Portefeuille Orange Money Entreprise', classNumber: 5, category: 'tresorerie' },
  { code: '5262', label: 'Portefeuille MTN Mobile Money', classNumber: 5, category: 'tresorerie' },
  { code: '5263', label: 'Portefeuille Wave Business', classNumber: 5, category: 'tresorerie' },
  { code: '5264', label: 'Portefeuille Moov Money', classNumber: 5, category: 'tresorerie' },
  { code: '5711', label: 'Caisse principale (espèces)', classNumber: 5, category: 'tresorerie' },
  { code: '5721', label: 'Caisse magasin / point de vente', classNumber: 5, category: 'tresorerie' },

  // Classe 6 : Charges des Activités Ordinaires
  { code: '6011', label: 'Achats de marchandises (revente en l’état)', classNumber: 6, category: 'charge' },
  { code: '6021', label: 'Achats de matières premières (production)', classNumber: 6, category: 'charge' },
  { code: '6051', label: 'Fournitures d’électricité (CIE / SENELEC / ENEO)', classNumber: 6, category: 'charge' },
  { code: '6052', label: 'Fournitures d’eau (SODECI / SDE / CAMWATER)', classNumber: 6, category: 'charge' },
  { code: '6053', label: 'Carburant et lubrifiants', classNumber: 6, category: 'charge' },
  { code: '6121', label: 'Transports sur achats et livraisons', classNumber: 6, category: 'charge' },
  { code: '6221', label: 'Locations immobilières (boutique, dépôt)', classNumber: 6, category: 'charge' },
  { code: '6241', label: 'Entretien et réparations matériels', classNumber: 6, category: 'charge' },
  { code: '6271', label: 'Frais de télécommunications & Internet', classNumber: 6, category: 'charge' },
  { code: '6311', label: 'Frais bancaires et commissions Mobile Money', classNumber: 6, category: 'charge' },
  { code: '6411', label: 'Salaires et émoluments des employés', classNumber: 6, category: 'charge' },
  { code: '6451', label: 'Charges sociales patronales', classNumber: 6, category: 'charge' },
  { code: '6811', label: 'Dotations aux amortissements d’exploitation', classNumber: 6, category: 'charge' },
  { code: '6581', label: 'Frais divers de gestion courante', classNumber: 6, category: 'charge' },

  // Classe 7 : Produits des Activités Ordinaires
  { code: '7011', label: 'Ventes de marchandises au comptant', classNumber: 7, category: 'produit' },
  { code: '7012', label: 'Ventes de marchandises à crédit', classNumber: 7, category: 'produit' },
  { code: '7021', label: 'Ventes de produits confectionnés / finis', classNumber: 7, category: 'produit' },
  { code: '7061', label: 'Prestations de services et travaux', classNumber: 7, category: 'produit' },
  { code: '7071', label: 'Commissions et produits accessoires', classNumber: 7, category: 'produit' },

  // Classe 8 : Comptes Hors Activités Ordinaires (HAO)
  { code: '8111', label: 'Valeurs comptables des cessions d’immobilisations', classNumber: 8, category: 'charge' },
  { code: '8211', label: 'Produits des cessions d’immobilisations', classNumber: 8, category: 'produit' },
  { code: '8511', label: 'Dons et subventions exceptionnelles reçus', classNumber: 8, category: 'produit' }
];

/**
 * Comptes personnalisés des dossiers (sous-comptes), chargés depuis /api/bootstrap.
 * ponytail: ajoutés au tableau partagé pour que tous les écrans existants les voient sans prop
 * supplémentaire ; passer par un contexte React si le plan doit se rafraîchir sans rechargement.
 */
export function registerCustomAccounts(list: SYSCOHADAAccount[]) {
  for (const a of list) {
    const i = SYSCOHADA_ACCOUNTS.findIndex(x => x.code === a.code);
    if (i >= 0) SYSCOHADA_ACCOUNTS[i] = a;
    else SYSCOHADA_ACCOUNTS.push(a);
  }
  SYSCOHADA_ACCOUNTS.sort((a, b) => a.code.localeCompare(b.code));
}

/** Comptes utilisables dans un dossier : plan standard + ses propres comptes actifs. */
export function accountsForDossier(dossierId: string): SYSCOHADAAccount[] {
  return SYSCOHADA_ACCOUNTS.filter(a => (!a.dossierId || a.dossierId === dossierId) && a.active !== false);
}

export function getAccountByCode(code: string): SYSCOHADAAccount | undefined {
  return SYSCOHADA_ACCOUNTS.find(a => a.code === code || a.code.startsWith(code));
}

export function formatSYSCOHADALabel(code: string): string {
  const acc = getAccountByCode(code);
  return acc ? `${acc.code} - ${acc.label}` : code;
}
