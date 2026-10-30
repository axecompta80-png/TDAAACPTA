import React from 'react';
import { JournalEntry } from '../../types';
import { History, ShieldCheck, X, CheckCircle2, AlertTriangle, Edit3, UserCheck } from 'lucide-react';

interface AuditTrailModalProps {
  entry: JournalEntry;
  onClose: () => void;
}

export const AuditTrailModal: React.FC<AuditTrailModalProps> = ({
  entry,
  onClose
}) => {
  return (
    <div className="fixed inset-0 bg-[#1E084A]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#DDD6FE] w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#1E084A] text-white px-6 py-4 flex items-center justify-between border-b border-[#3B1578]">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-[#A78BFA]" />
            <div>
              <h3 className="font-heading text-base font-bold text-white">
                Piste d'Audit Inaltérable (SYSCOHADA)
              </h3>
              <p className="text-[11px] text-[#C4B5FD] font-mono">
                Pièce {entry.pieceRef} • Traçabilité horodatée conforme OHADA
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-[#C4B5FD] hover:text-white rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Operation Summary */}
          <div className="p-4 bg-[#FAF8FF] border border-[#DDD6FE] rounded-xl text-xs space-y-2">
            <div className="flex justify-between items-start">
              <span className="font-bold text-[#1E084A]">{entry.label}</span>
              <span className="font-tabular font-black text-[#10B981]">
                {entry.amount.toLocaleString('fr-FR')} FCFA
              </span>
            </div>
            <div className="flex items-center justify-between text-[12px] font-mono text-[#534674] pt-1.5 border-t border-[#DDD6FE]">
              <span>{entry.journal} n° {entry.number} • Pièce {entry.pieceRef}</span>
            </div>
            <table className="w-full text-[12px] font-mono text-[#534674]">
              <tbody>
                {entry.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="pr-2">{l.accountCode} {l.accountLabel ?? ''}</td>
                    <td className="text-right">{l.debit ? l.debit.toLocaleString('fr-FR') : ''}</td>
                    <td className="text-right">{l.credit ? l.credit.toLocaleString('fr-FR') : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {entry.rawInput && (
              <p className="text-[11px] text-[#7C709A] italic">
                Source originale : "{entry.rawInput}" ({entry.inputType})
              </p>
            )}
          </div>

          {/* Timeline */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#7024E3] font-mono">
              Journal des Événements & Interventions
            </h4>

            <div className="relative pl-6 space-y-4 border-l-2 border-[#DDD6FE]">
              {entry.auditTrail.map((item) => {
                let icon = <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />;
                let badgeClass = 'bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]';

                if (item.action === 'anomaly_flagged' || item.action === 'cancelled' || item.action === 'unvalidated') {
                  icon = <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" />;
                  badgeClass = 'bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]';
                } else if (item.action === 'edited_by_expert') {
                  icon = <Edit3 className="w-3.5 h-3.5 text-[#7024E3]" />;
                  badgeClass = 'bg-[#F5F3FF] text-[#7024E3] border border-[#DDD6FE]';
                } else if (item.action === 'validated_by_expert') {
                  icon = <UserCheck className="w-3.5 h-3.5 text-[#10B981]" />;
                  badgeClass = 'bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0]';
                }

                return (
                  <div key={item.id} className="relative">
                    {/* Bullet */}
                    <div className="absolute -left-[31px] top-0.5 w-5 h-5 rounded-full bg-white border-2 border-[#7024E3] flex items-center justify-center">
                      <span className="w-2 h-2 rounded-full bg-[#7024E3]" />
                    </div>

                    {/* Step Card */}
                    <div className="bg-white border border-[#DDD6FE] p-3.5 rounded-xl shadow-2xs text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 text-[10.5px] font-bold uppercase rounded-full ${badgeClass}`}>
                          {item.action.replace(/_/g, ' ')}
                        </span>
                        <span className="font-mono text-[11px] text-[#7C709A]">
                          {new Date(item.timestamp).toLocaleString('fr-FR')}
                        </span>
                      </div>

                      <div className="font-semibold text-[#1E084A] flex items-center gap-1.5 pt-0.5">
                        <span>Auteur : {item.author}</span>
                      </div>

                      {item.notes && (
                        <p className="text-[12px] text-[#534674] pt-0.5">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legal Compliance Guarantee */}
          <div className="p-3.5 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl text-xs flex items-center gap-2.5 text-[#166534]">
            <ShieldCheck className="w-4 h-4 shrink-0 text-[#16A34A]" />
            <span>
              Cette piste d'audit garantit l'inaltérabilité des écritures conformément aux exigences de l'Acte Uniforme OHADA relatif au droit comptable.
            </span>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-gradient-to-r from-[#7024E3] to-[#8B5CF6] text-white text-xs font-bold rounded-xl shadow-xs hover:from-[#5B18C4] hover:to-[#7024E3] transition-all"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
