import React, { useState } from 'react';
import { Building2, LogOut, ArrowRight, Sparkles } from 'lucide-react';
import { BrandLogo } from '../BrandLogo';
import { CurrentUser } from '../../utils/authApi';
import { DossierInfo } from '../../types';
import { OHADA_COUNTRIES, ACTIVITY_SECTORS, FISCAL_REGIMES, detectUserCountry, dossierCurrency } from '../../data/initialSettings';

interface CompanySetupProps {
  currentUser: CurrentUser;
  onLogout: () => void;
  onSubmit: (company: DossierInfo) => Promise<unknown> | unknown;
}

type DossierForm = DossierInfo;

const countryDefaults = (c: typeof OHADA_COUNTRIES[number]) => ({
  country: c.name,
  city: c.city,
  phone: `${c.phonePrefix} `,
  currency: dossierCurrency(c),
});

const EMPTY_FORM: Omit<DossierForm, 'country' | 'city' | 'phone' | 'currency'> = {
  name: '',
  managerName: '',
  activity: '',
  rccm: '',
  ifu: '',
  regimeFiscal: 'Réel Simplifié',
};

/**
 * « Informations de l'entreprise », juste après l'inscription.
 * Crée la comptabilité de l'entreprise elle-même : ce n'est pas un dossier, et aucun dossier
 * n'est nécessaire pour commencer (aucune donnée de démonstration n'est injectée).
 */
export const CompanySetup: React.FC<CompanySetupProps> = ({ currentUser, onLogout, onSubmit }) => {
  const [form, setForm] = useState<DossierForm>(() => ({ ...EMPTY_FORM, ...countryDefaults(detectUserCountry()), name: currentUser.name }));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (patch: Partial<DossierForm>) => setForm(prev => ({ ...prev, ...patch }));

  const handleCountryChange = (countryName: string) => {
    const found = OHADA_COUNTRIES.find(c => c.name === countryName);
    if (!found) return;
    const prev = OHADA_COUNTRIES.find(c => c.name === form.country);
    const next = countryDefaults(found);
    // On ne remplace la ville et l'indicatif que s'ils n'ont pas été personnalisés.
    set({
      country: next.country,
      currency: next.currency,
      ...(!form.city.trim() || form.city === prev?.city ? { city: next.city } : {}),
      ...(prev && form.phone.startsWith(prev.phonePrefix)
        ? { phone: found.phonePrefix + form.phone.slice(prev.phonePrefix.length) }
        : !form.phone.trim() ? { phone: next.phone } : {}),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError("Indiquez le nom de l'entreprise ou de l'activité.");
    if (!form.managerName.trim()) return setError('Indiquez le nom du gérant.');
    if (!form.phone.trim()) return setError('Indiquez un numéro de téléphone.');
    if (!form.activity.trim()) return setError("Choisissez ou saisissez votre secteur d'activité.");
    if (!form.rccm.trim()) return setError('Indiquez le numéro RCCM.');
    if (!form.ifu.trim()) return setError("Indiquez le numéro d'IFU.");
    setSubmitting(true);
    try {
      await onSubmit({ ...form });
    } catch (err: any) {
      setError(err?.message || 'Création impossible pour le moment.');
    } finally {
      setSubmitting(false);
    }
  };

  const field = 'w-full px-3 py-2.5 rounded-lg border border-[#DDD6FE] text-sm focus:outline-none focus:ring-2 focus:ring-[#7024E3]/30 bg-white';
  const label = 'text-xs font-bold text-[#534674] mb-1 block';

  return (
    <div className="min-h-screen bg-[#F8F7FD] flex flex-col">
      <header className="w-full bg-white border-b border-[#EDE9FE] px-4 lg:px-8 py-3.5 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo variant="full" />
            <span className="hidden sm:block w-px h-8 bg-[#EDE9FE]" />
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-[#7024E3]">
              <Sparkles className="w-4 h-4" />
              Premier paramétrage
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs font-bold text-[#1E084A]">{currentUser.name}</span>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] text-[#7024E3] text-xs font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>Se déconnecter</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 lg:p-8">
        <div className="bg-white border border-[#DDD6FE] rounded-2xl shadow-xl p-6 lg:p-8">
          <div className="flex items-start gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#7024E3] to-[#8B5CF6] flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-heading text-xl font-black text-[#1E084A]">Informations de l'entreprise</h1>
              <p className="text-sm text-[#7C709A] mt-1">
                Renseignez votre entreprise pour commencer à enregistrer vos ventes et vos achats. Vous pourrez ensuite
                ajouter des dossiers, chacun avec sa propre comptabilité, depuis le bouton « Ajouter un Dossier ».
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={label}>Nom de l'entreprise *</label>
                <input className={field} value={form.name} onChange={e => set({ name: e.target.value })} placeholder="ex : Quincaillerie Moderne SARL" />
              </div>
              <div>
                <label className={label}>Gérant / responsable *</label>
                <input className={field} value={form.managerName} onChange={e => set({ managerName: e.target.value })} placeholder="ex : Amadou Diallo" />
              </div>
              <div>
                <label className={label}>Téléphone *</label>
                <input className={field} value={form.phone} onChange={e => set({ phone: e.target.value })} placeholder={`${form.phone.split(' ')[0] || '+225'} 07 00 00 00 00`} />
              </div>
              <div>
                <label className={label}>Secteur d'activité *</label>
                <input
                  className={field}
                  list="activity-sectors"
                  value={form.activity}
                  onChange={e => set({ activity: e.target.value })}
                  placeholder="Choisissez dans la liste ou saisissez"
                />
                <datalist id="activity-sectors">
                  {ACTIVITY_SECTORS.map(a => <option key={a} value={a} />)}
                </datalist>
              </div>
              <div>
                <label className={label}>Régime fiscal *</label>
                <select className={field} value={form.regimeFiscal} onChange={e => set({ regimeFiscal: e.target.value as DossierForm['regimeFiscal'] })}>
                  {FISCAL_REGIMES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Pays *</label>
                <select className={field} value={form.country} onChange={e => handleCountryChange(e.target.value)}>
                  {OHADA_COUNTRIES.map(c => <option key={c.code} value={c.name}>{c.flag} {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Ville *</label>
                <input className={field} value={form.city} onChange={e => set({ city: e.target.value })} placeholder="ex : Abidjan, Dakar, Douala..." />
              </div>
              <div>
                <label className={label}>N° RCCM *</label>
                <input className={field} value={form.rccm} onChange={e => set({ rccm: e.target.value })} placeholder="ex : CI-ABJ-2026-B-14299" />
              </div>
              <div>
                <label className={label}>N° IFU *</label>
                <input className={field} value={form.ifu} onChange={e => set({ ifu: e.target.value })} placeholder="ex : 0824911K" />
              </div>
            </div>

            {error && (
              <div className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity"
            >
              <span>{submitting ? 'Enregistrement…' : 'Enregistrer et commencer'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};
