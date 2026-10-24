import React, { useState } from 'react';
import { ClientDossier, Invoice, JournalEntry, PaymentMethod } from '../../types';
import { PAYMENT_METHOD_LABEL } from '../../utils/paymentAccounts';
import { computeInvoiceTotals } from '../../utils/invoices';
import { api } from '../../utils/api';
import { printInvoice } from '../expert/InvoicesPanel';
import { Receipt, X, Printer, Check, QrCode } from 'lucide-react';

interface QuickInvoiceModalProps {
  activeDossier: ClientDossier;
  onClose: () => void;
  /** Propriétaire du dossier : la facture est émise tout de suite (écritures générées). */
  issueDirectly: boolean;
  onCreated: (invoice: Invoice, entries: JournalEntry[]) => void;
}

/**
 * Reçu / facture au comptant express. Pour le propriétaire du dossier, la facture est émise
 * aussitôt (411 / 70x / 4431 + encaissement) ; sinon elle est soumise à validation.
 */
export const QuickInvoiceModal: React.FC<QuickInvoiceModalProps> = ({
  activeDossier,
  issueDirectly,
  onClose,
  onCreated
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(5000);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [appliedTva, setAppliedTva] = useState(false);
  const [created, setCreated] = useState<Invoice | null>(null);
  const [error, setError] = useState('');
  const isCreated = created !== null;

  const { totalTVA: tvaAmount, totalTTC } = computeInvoiceTotals([{ quantity, unitPrice }], appliedTva ? 18 : 0);
  const invoiceNumber = created?.number ?? '';

  const handleGenerateAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !itemName || totalTTC <= 0) return;
    setError('');
    try {
      const inv = await api.createInvoice(activeDossier.id, {
        date: new Date().toISOString().slice(0, 10),
        mode: 'cash',
        paymentMethod,
        customerName,
        customerPhone: customerPhone || undefined,
        vatRate: appliedTva ? 18 : 0,
        lines: [{ description: itemName, quantity, unitPrice }],
      }, true);
      const { invoice, entries } = issueDirectly ? await api.validateInvoice(inv.id) : { invoice: inv, entries: [] };
      onCreated(invoice, entries);
      setCreated(invoice);
    } catch (err: any) {
      setError(err?.message || "Erreur lors de l'enregistrement de la facture.");
    }
  };

  return (
    <div className="fixed inset-0 bg-[#1E084A]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#DDD6FE] w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#1E084A] text-white px-6 py-4 flex items-center justify-between border-b border-[#3B1578]">
          <div className="flex items-center gap-2.5">
            <Receipt className="w-5 h-5 text-[#A78BFA]" />
            <h3 className="font-heading text-base font-bold text-white">
              {isCreated ? 'Facture enregistrée' : 'Émettre un Reçu / Facture Simplifiée'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-[#C4B5FD] hover:text-white rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {!isCreated ? (
          <form onSubmit={handleGenerateAndSave} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-[#1E084A] mb-1.5">
                  Nom du client / acheteur *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Entreprise Koné ou M. Yao"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full text-xs p-2.5 bg-[#F8F7FD] border border-[#DDD6FE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7024E3]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E084A] mb-1.5">
                  Téléphone WhatsApp (pour envoi)
                </label>
                <input
                  type="text"
                  placeholder="+225 07 00 00 00"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full text-xs p-2.5 bg-[#F8F7FD] border border-[#DDD6FE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7024E3]/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1E084A] mb-1.5">
                Désignation des marchandises ou prestation *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: 5 sacs de ciment CPJ 42.5"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full text-xs p-2.5 bg-[#F8F7FD] border border-[#DDD6FE] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7024E3]/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-[#1E084A] mb-1.5">
                  Quantité
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-xs p-2.5 bg-[#F8F7FD] border border-[#DDD6FE] rounded-xl focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E084A] mb-1.5">
                  Prix unitaire (FCFA)
                </label>
                <input
                  type="number"
                  min="100"
                  step="100"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-xs p-2.5 bg-[#F8F7FD] border border-[#DDD6FE] rounded-xl focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div>
                <label className="block text-xs font-bold text-[#1E084A] mb-1.5">
                  Moyen de paiement
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e: any) => setPaymentMethod(e.target.value)}
                  className="w-full text-xs p-2.5 bg-[#F8F7FD] border border-[#DDD6FE] rounded-xl focus:outline-none"
                >
                  <option value="cash">Espèces (Caisse magasin)</option>
                  <option value="orange_money">Orange Money</option>
                  <option value="wave">Wave</option>
                  <option value="mtn_momo">MTN Mobile Money</option>
                  <option value="moov_money">Moov Money</option>
                  <option value="bank_transfer">Virement bancaire</option>
                  <option value="cheque">Chèque bancaire</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="tva-check"
                  checked={appliedTva}
                  onChange={(e) => setAppliedTva(e.target.checked)}
                  className="w-4 h-4 accent-[#7024E3]"
                />
                <label htmlFor="tva-check" className="text-xs font-semibold text-[#1E084A] cursor-pointer">
                  Appliquer TVA 18% (Entreprise au réel)
                </label>
              </div>
            </div>

            {/* Total Recap */}
            <div className="p-3.5 bg-[#F5F3FF] border border-[#DDD6FE] rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs text-[#7C709A] block font-medium">Montant Total à Payer :</span>
                {appliedTva && (
                  <span className="text-[11px] text-[#7024E3] font-mono block">
                    Dont TVA 18% : {tvaAmount.toLocaleString('fr-FR')} FCFA
                  </span>
                )}
              </div>
              <div className="text-xl font-black font-tabular text-[#1E084A]">
                {totalTTC.toLocaleString('fr-FR')} <span className="text-xs font-mono text-[#7024E3]">FCFA</span>
              </div>
            </div>

            {error && <p className="text-xs text-[#B91C1C] font-bold">{error}</p>}
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-[#1E084A] border border-[#DDD6FE] rounded-xl hover:bg-[#F8F7FD] transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white text-xs font-bold rounded-xl shadow-xs hover:from-[#5B18C4] hover:to-[#7024E3] transition-all"
              >
                Créer la facture
              </button>
            </div>
          </form>
        ) : (
          /* Receipt Card Preview Ready to Print */
          <div className="p-6 space-y-4">
            <div className="p-5 bg-white border border-[#DDD6FE] rounded-2xl shadow-2xs space-y-3">
              <div className="flex justify-between items-start border-b border-[#EDE9FE] pb-3">
                <div>
                  <h4 className="font-heading text-lg font-bold text-[#1E084A]">
                    {activeDossier.name}
                  </h4>
                  <p className="text-[12px] text-[#7C709A] font-mono">
                    RCCM: {activeDossier.rccm} • IFU: {activeDossier.ifu}
                  </p>
                  <p className="text-[12px] text-[#7C709A]">{activeDossier.city}, {activeDossier.country}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold bg-[#F5F3FF] text-[#7024E3] px-2.5 py-1 rounded-lg border border-[#DDD6FE]">
                    {invoiceNumber}
                  </span>
                  <span className="block text-[11px] text-[#7C709A] font-mono mt-1">
                    Date : {new Date().toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>

              <div className="text-xs space-y-1 text-[#1E084A]">
                <p><strong>Client :</strong> {customerName}</p>
                {customerPhone && <p><strong>Tél :</strong> {customerPhone}</p>}
                <p><strong>Article :</strong> {quantity}x {itemName} @ {unitPrice.toLocaleString('fr-FR')} F</p>
                <p><strong>Règlement :</strong> {PAYMENT_METHOD_LABEL[paymentMethod]}</p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#EDE9FE]">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-[#1E084A] p-1 rounded-lg flex items-center justify-center shadow-xs">
                    <QrCode className="w-8 h-8 text-white" />
                  </div>
                  <span className="text-[10.5px] font-mono text-[#7C709A]">
                    Norme e-Facture OHADA
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-[#7C709A] block">Total TTC Réglé</span>
                  <span className="text-xl font-black font-tabular text-[#10B981]">
                    {totalTTC.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl text-xs text-[#166534] flex items-center gap-2">
              <Check className="w-4 h-4 text-[#16A34A] shrink-0" />
              <span>{created?.status === 'validated'
                ? <>Facture émise. Les écritures (client 411, vente 7011{tvaAmount > 0 ? ', TVA 4431' : ''} et encaissement) sont passées dans votre comptabilité.</>
                : <>Facture enregistrée et soumise à validation. Les écritures (client 411, vente 7011{tvaAmount > 0 ? ', TVA 4431' : ''} et encaissement) seront passées dès sa validation.</>}</span>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => created && printInvoice(created, activeDossier)}
                className="px-4 py-2 text-xs font-bold text-[#1E084A] bg-[#F5F3FF] border border-[#DDD6FE] rounded-xl flex items-center gap-1.5 hover:bg-[#EDE9FE] transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer</span>
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2 bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white text-xs font-bold rounded-xl shadow-xs hover:from-[#5B18C4] hover:to-[#7024E3] transition-all"
              >
                Terminer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
