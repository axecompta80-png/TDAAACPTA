import * as XLSX from 'xlsx';
import { JournalEntry, PaymentMethod, TransactionStatus } from '../types';
import { SYSCOHADA_ACCOUNTS } from '../data/syscohadaPlan';
import { detectPaymentMethod, paymentMethodFromCell, treasuryAccountFor, normalizeText } from './paymentAccounts';

export interface ParsedRowPreview {
  id: string;
  rowIndex: number;
  selected: boolean;
  date: string;
  pieceRef: string;
  label: string;
  amount: number;
  debitAccountCode: string;
  debitAccountLabel: string;
  creditAccountCode: string;
  creditAccountLabel: string;
  paymentMethod: PaymentMethod;
  tvaAmount: number;
  confidenceScore: number;
  anomaly?: string;
  originalRaw: Record<string, any>;
}

export interface ColumnMapping {
  dateCol: string;
  labelCol: string;
  amountCol: string;
  debitCol?: string; // If separate amount for debit
  creditCol?: string; // If separate amount for credit
  pieceRefCol?: string;
  debitAccountCol?: string; // If explicit account code
  creditAccountCol?: string; // If explicit account code
  paymentMethodCol?: string;
}

// Intelligent detection of column names from headers
export function detectColumns(headers: string[]): ColumnMapping {
  const norm = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  let dateCol = '';
  let labelCol = '';
  let amountCol = '';
  let debitCol = '';
  let creditCol = '';
  let pieceRefCol = '';
  let debitAccountCol = '';
  let creditAccountCol = '';
  let paymentMethodCol = '';

  headers.forEach(h => {
    const n = norm(h);
    if (!dateCol && (n.includes('date') || n === 'jour' || n === 'periode' || n.includes('valeur'))) {
      dateCol = h;
    } else if (!pieceRefCol && (n.includes('piece') || n.includes('ref') || n.includes('facture') || n.includes('num') || n.includes('n°') || n.includes('recu'))) {
      pieceRefCol = h;
    } else if (!debitAccountCol && (n.includes('compte d') || n.includes('debit compte') || n.includes('code d') || n === 'compte debit' || n === 'cpt debit' || n === 'compte_debit')) {
      debitAccountCol = h;
    } else if (!creditAccountCol && (n.includes('compte c') || n.includes('credit compte') || n.includes('code c') || n === 'compte credit' || n === 'cpt credit' || n === 'compte_credit')) {
      creditAccountCol = h;
    } else if (!debitCol && (n === 'debit' || n === 'depense' || n === 'retrait' || n.includes('montant debit') || n.includes('debits'))) {
      debitCol = h;
    } else if (!creditCol && (n === 'credit' || n === 'recette' || n === 'depot' || n.includes('montant credit') || n.includes('credits'))) {
      creditCol = h;
    } else if (!amountCol && (n.includes('montant') || n.includes('total') || n.includes('solde') || n === 'prix' || n === 'ttc' || n === 'valeur')) {
      amountCol = h;
    } else if (!paymentMethodCol && (n.includes('reglement') || n.includes('paiement') || n.includes('moyen') || n.includes('canal') || n.includes('mode'))) {
      paymentMethodCol = h;
    } else if (!labelCol && (n.includes('libelle') || n.includes('designation') || n.includes('description') || n.includes('motif') || n.includes('operation') || n.includes('detail') || n.includes('tiers') || n.includes('nom'))) {
      labelCol = h;
    }
  });

  // Fallbacks if not detected
  if (!labelCol && headers.length > 0) {
    const candidates = headers.filter(h => h !== dateCol && h !== amountCol && h !== debitCol && h !== creditCol);
    if (candidates.length > 0) labelCol = candidates[0];
  }

  if (!amountCol && !debitCol && !creditCol && headers.length > 1) {
    amountCol = headers[1];
  }

  return {
    dateCol: dateCol || (headers[0] || ''),
    labelCol: labelCol || (headers[1] || ''),
    amountCol: amountCol || '',
    debitCol: debitCol || undefined,
    creditCol: creditCol || undefined,
    pieceRefCol: pieceRefCol || undefined,
    debitAccountCol: debitAccountCol || undefined,
    creditAccountCol: creditAccountCol || undefined,
    paymentMethodCol: paymentMethodCol || undefined
  };
}

// Smart keyword-based SYSCOHADA account matching
export function classifyTransactionSmart(
  label: string, 
  amount: number, 
  isCreditMovement: boolean = false,
  explicitDebit?: string,
  explicitCredit?: string,
  paymentHint?: string
): { 
  debitCode: string; 
  debitLabel: string; 
  creditCode: string; 
  creditLabel: string; 
  paymentMethod: PaymentMethod; 
  confidence: number;
  anomaly?: string;
} {
  const norm = normalizeText(label);

  // Mode de paiement : la colonne dédiée prime, sinon le libellé ; espèces si rien n'est précisé.
  // Le compte de trésorerie en découle : espèces 5711, chèque/virement 5211, Orange 5261, MTN 5262, Wave 5263, Moov 5264.
  const method: PaymentMethod = paymentMethodFromCell(paymentHint) ?? detectPaymentMethod(label) ?? 'cash';
  const treasuryCode = treasuryAccountFor(method).code;

  // If explicit codes are given, use them
  if (explicitDebit && explicitCredit) {
    const deb = SYSCOHADA_ACCOUNTS.find(a => a.code === explicitDebit);
    const cred = SYSCOHADA_ACCOUNTS.find(a => a.code === explicitCredit);
    return {
      debitCode: explicitDebit,
      debitLabel: deb ? deb.label : `Compte ${explicitDebit}`,
      creditCode: explicitCredit,
      creditLabel: cred ? cred.label : `Compte ${explicitCredit}`,
      paymentMethod: method,
      confidence: 96
    };
  }

  // Rule-based classification based on African Francophone business context
  let debitCode = '6011';
  let creditCode = treasuryCode;
  let confidence = 88;
  let anomaly: string | undefined = undefined;

  // 1. Sales / Ventes / Encaissments
  if (
    norm.includes('vente') || 
    norm.includes('recette') || 
    norm.includes('facture v') || 
    norm.includes('client') || 
    norm.includes('versement client') ||
    norm.includes('paiement recu') ||
    norm.includes('prestation') ||
    isCreditMovement
  ) {
    debitCode = treasuryCode; // Trésorerie reçoit
    creditCode = norm.includes('service') || norm.includes('prestation') || norm.includes('consulting') ? '7061' : '7011';
    confidence = 94;
  }
  // 2. Achats de marchandises & matières
  else if (
    norm.includes('achat') || 
    norm.includes('fournisseur') || 
    norm.includes('ciment') || 
    norm.includes('marchandise') || 
    norm.includes('riz') || 
    norm.includes('huile') || 
    norm.includes('savon') || 
    norm.includes('stock') ||
    norm.includes('boisson')
  ) {
    debitCode = norm.includes('matiere') ? '6021' : '6011';
    creditCode = treasuryCode;
    confidence = 92;
  }
  // 3. Electricité / Eau
  else if (norm.includes('electricite') || norm.includes('cie') || norm.includes('sbee') || norm.includes('senelec') || norm.includes('eneo')) {
    debitCode = '6051';
    creditCode = treasuryCode;
    confidence = 95;
  } else if (norm.includes('eau') || norm.includes('sodeci') || norm.includes('soneb') || norm.includes('sde') || norm.includes('camwater')) {
    debitCode = '6052';
    creditCode = treasuryCode;
    confidence = 95;
  }
  // 4. Carburant et transport
  else if (norm.includes('carburant') || norm.includes('essence') || norm.includes('gasoil') || norm.includes('totalenergies') || norm.includes('shell')) {
    debitCode = '6053';
    creditCode = treasuryCode;
    confidence = 93;
  } else if (norm.includes('transport') || norm.includes('livraison') || norm.includes('taxi') || norm.includes('peage') || norm.includes('fret')) {
    debitCode = '6121';
    creditCode = treasuryCode;
    confidence = 91;
  }
  // 5. Loyer
  else if (norm.includes('loyer') || norm.includes('bail') || norm.includes('locat')) {
    debitCode = '6221';
    creditCode = treasuryCode;
    confidence = 96;
  }
  // 6. Télécommunications / Internet
  else if (norm.includes('telephone') || norm.includes('internet') || norm.includes('forfait') || norm.includes('connexion') || norm.includes('canalbox')) {
    debitCode = '6271';
    creditCode = treasuryCode;
    confidence = 94;
  }
  // 7. Salaires & Avances
  else if (norm.includes('salaire') || norm.includes('paie') || norm.includes('avance sur salaire') || norm.includes('gardien') || norm.includes('personnel')) {
    debitCode = '6411';
    creditCode = treasuryCode;
    confidence = 93;
  }
  // 8. Frais bancaires / commissions
  else if (norm.includes('frais de tenue') || norm.includes('commission') || norm.includes('agios') || norm.includes('frais retrait')) {
    debitCode = '6311';
    creditCode = treasuryCode;
    confidence = 92;
  }
  // 9. Immobilisations
  else if (norm.includes('ordinateur') || norm.includes('laptop') || norm.includes('imprimante') || norm.includes('climatiseur') || norm.includes('moto') || norm.includes('vehicule')) {
    debitCode = norm.includes('moto') || norm.includes('vehicule') ? '215' : '244';
    creditCode = treasuryCode;
    confidence = 89;
  }
  // Default general expense
  else {
    debitCode = '6011';
    creditCode = treasuryCode;
    confidence = 82;
    anomaly = 'Classification par défaut : vérifier l’intitulé de la dépense';
  }

  // Sanity check on cash amounts (OHADA: payments > 500 000 FCFA in cash have tax warnings)
  if (method === 'cash' && amount > 500000) {
    anomaly = 'Paiement en espèces supérieur à 500 000 FCFA : attention à la déductibilité fiscale OHADA';
  }

  const debAcc = SYSCOHADA_ACCOUNTS.find(a => a.code === debitCode);
  const credAcc = SYSCOHADA_ACCOUNTS.find(a => a.code === creditCode);

  return {
    debitCode,
    debitLabel: debAcc ? debAcc.label : `Compte ${debitCode}`,
    creditCode,
    creditLabel: credAcc ? credAcc.label : `Compte ${creditCode}`,
    paymentMethod: method,
    confidence,
    anomaly
  };
}

// Parse Excel file buffer into raw JSON rows
export function parseExcelBuffer(buffer: ArrayBuffer): { sheetNames: string[]; rowsBySheet: Record<string, any[]> } {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetNames = workbook.SheetNames;
  const rowsBySheet: Record<string, any[]> = {};

  sheetNames.forEach(name => {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    rowsBySheet[name] = rows;
  });

  return { sheetNames, rowsBySheet };
}

// Generate sample downloadable Excel template files
export function generateSampleExcelTemplate(type: 'journal_syscohada' | 'releve_bancaire_mobile'): Uint8Array {
  const wb = XLSX.utils.book_new();

  if (type === 'journal_syscohada') {
    const data = [
      [
        'Date',
        'N° Pièce',
        'Libellé de l\'opération',
        'Compte Débit',
        'Compte Crédit',
        'Montant TTC',
        'TVA (18%)',
        'Moyen de Paiement'
      ],
      [
        '2026-09-02',
        'FAC-2026-081',
        'Vente de 20 sacs de riz parfumé',
        '5711',
        '7011',
        185000,
        33300,
        'Espèces'
      ],
      [
        '2026-09-03',
        'FAC-2026-082',
        'Prestation maintenance informatique',
        '5263',
        '7061',
        250000,
        45000,
        'Wave'
      ],
      [
        '2026-09-04',
        'BE-2026-041',
        'Achat fournitures d\'électricité CIE',
        '6051',
        '5261',
        42500,
        0,
        'Orange Money'
      ],
      [
        '2026-09-05',
        'LOY-09-2026',
        'Loyer boutique commerciale - Septembre',
        '6221',
        '5211',
        300000,
        0,
        'Virement Bancaire'
      ],
      [
        '2026-09-06',
        'FOURN-109',
        'Réapprovisionnement ciment et fer',
        '6011',
        '5711',
        650000,
        117000,
        'Espèces'
      ]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    // Add column widths
    ws['!cols'] = [
      { wch: 14 },
      { wch: 16 },
      { wch: 42 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Journal_SYSCOHADA');
  } else {
    // Relevé bancaire / Mobile Money
    const data = [
      ['Date', 'Référence', 'Libellé de la Transaction', 'Débit (Dépenses)', 'Crédit (Recettes)', 'Canal / Moyen'],
      ['2026-09-01', 'WAV-00918', 'Paiement client Moussa Traoré', '', 145000, 'Wave'],
      ['2026-09-02', 'OM-88219', 'Achat carburant Total Ouaga', 25000, '', 'Orange Money'],
      ['2026-09-03', 'VIR-44120', 'Règlement client ETS Alafia', '', 480000, 'Banque'],
      ['2026-09-04', 'CHQ-10029', 'Achat imprimante HP LaserJet', 175000, '', 'Chèque'],
      ['2026-09-05', 'MOM-5510', 'Abonnement Internet MTN Fibre', 35000, '', 'MTN MoMo'],
      ['2026-09-06', 'CAI-0012', 'Vente comptoir boutique cash', '', 210000, 'Espèces']
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 16 },
      { wch: 38 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Releve_Transactions');
  }

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(out);
}
