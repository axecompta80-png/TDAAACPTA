import * as XLSX from 'xlsx';

export type Sheet = { name: string; rows: (string | number | null | undefined)[][] };

/** Télécharge un classeur .xlsx (une feuille par tableau). */
export function downloadXlsx(filename: string, sheets: Sheet[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    // Largeur de colonne approximative d'après le contenu le plus long
    ws['!cols'] = (s.rows[0] ?? []).map((_, i) => ({
      wch: Math.min(60, Math.max(10, ...s.rows.map(r => String(r[i] ?? '').length + 2))),
    }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31)); // limite Excel : 31 caractères
  }
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export const fileSafe = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, '_');
