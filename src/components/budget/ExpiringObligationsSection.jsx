import { useState } from 'react';
import { Clock, Plus, Sparkles, Pencil, Trash2, CheckCircle2, TrendingUp } from 'lucide-react';
import { COLORS } from '../../utils/constants.js';

export function ExpiringObligationsSection({
  obligations = [],
  onOpenAddModal,
  onOpenEditModal,
  onIncrementPaid,
  onDeleteObligation,
}) {
  const formatPLN = (val) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  // Wyliczenie łącznej kwoty miesięcznych rat
  const activeObligations = obligations.filter((o) => !o.isCompleted && o.paidInstallments < o.totalInstallments);
  const completedObligations = obligations.filter((o) => o.isCompleted || o.paidInstallments >= o.totalInstallments);

  const totalMonthlyActive = activeObligations.reduce((sum, o) => sum + Number(o.monthlyAmount || 0), 0);
  const totalMonthlyFreed = completedObligations.reduce((sum, o) => sum + Number(o.monthlyAmount || 0), 0);

  // Najbliższe wygasające zobowiązanie
  const nextExpiring = [...activeObligations].sort((a, b) => {
    const remA = a.totalInstallments - a.paidInstallments;
    const remB = b.totalInstallments - b.paidInstallments;
    return remA - remB;
  })[0];

  return (
    <div
      style={{ background: COLORS.surface, borderColor: COLORS.border }}
      className="rounded-2xl p-5 border space-y-4 shadow-sm"
    >
      {/* Nagłówek i przycisk dodawania */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center shrink-0 border border-orange-500/20">
            <Clock size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-base font-bold">
                Zobowiązania terminowe i raty
              </h3>
              <span className="text-[10px] font-mono text-stone-400 bg-stone-900 px-2 py-0.5 rounded-full border border-stone-800">
                {activeObligations.length} aktywne
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Śledzenie spłat rat 0% i zobowiązań o określonej liczbie miesięcy
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenAddModal}
          style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-stone-200 hover:text-stone-100 hover:bg-stone-800 transition border cursor-pointer"
        >
          <Plus size={14} className="text-amber-400" />
          <span>Dodaj ratę</span>
        </button>
      </div>

      {/* Podsumowanie rat */}
      {(totalMonthlyActive > 0 || nextExpiring) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {totalMonthlyActive > 0 && (
            <div className="bg-stone-900/60 border border-stone-800 p-3 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/15 text-orange-400 flex items-center justify-center shrink-0">
                <Clock size={16} />
              </div>
              <div className="text-xs">
                <div className="font-bold text-stone-200">
                  Łącznie w ratach: {formatPLN(totalMonthlyActive)} / msc
                </div>
                <div className="text-stone-400 text-[11px] mt-0.5">
                  Bieżące miesięczne obciążenie budżetu z tytułu aktywnych rat
                </div>
              </div>
            </div>
          )}

          {nextExpiring && (
            <div className="bg-amber-950/20 border border-amber-800/30 p-3 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                <Sparkles size={16} />
              </div>
              <div className="text-xs">
                <div className="font-bold text-amber-200">
                  Za {nextExpiring.totalInstallments - nextExpiring.paidInstallments} msc koniec: {nextExpiring.title}
                </div>
                <div className="text-stone-400 text-[11px] mt-0.5">
                  Uwolni się +{formatPLN(nextExpiring.monthlyAmount)} / msc wolnych środków w budżecie
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista Zobowiązań */}
      {obligations.length === 0 ? (
        <div className="text-center py-6 text-stone-500 text-xs italic border border-dashed border-stone-800 rounded-xl">
          Brak zdefiniowanych rat 0% lub kosztów terminowych. Kliknij „Dodaj ratę 0%”, aby monitorować wygasanie zobowiązań.
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          {obligations.map((item) => {
            const isDone = item.isCompleted || item.paidInstallments >= item.totalInstallments;
            const remaining = Math.max(0, item.totalInstallments - item.paidInstallments);
            const progressPercent = Math.min(100, Math.round((item.paidInstallments / item.totalInstallments) * 100));

            return (
              <div
                key={item.id}
                style={{ background: COLORS.surfaceHighlight, borderColor: isDone ? '#2d4a34' : COLORS.border }}
                className={`p-3.5 rounded-xl border space-y-2.5 transition ${isDone ? 'opacity-70' : 'hover:border-stone-700'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl shrink-0">{item.icon || '⚡'}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-bold truncate ${isDone ? 'line-through text-stone-400' : 'text-stone-100'}`}>
                          {item.title}
                        </span>
                        {isDone ? (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold border border-emerald-500/30 flex items-center gap-0.5">
                            <CheckCircle2 size={10} /> Spłacone całkowicie!
                          </span>
                        ) : (
                          <span className="text-[10px] bg-stone-900 text-stone-300 font-mono px-2 py-0.5 rounded border border-stone-800">
                            Pozostało: {remaining} msc
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-stone-400 flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-amber-300 font-bold">{formatPLN(item.monthlyAmount)} / msc</span>
                        <span>•</span>
                        <span>Rata {item.paidInstallments} z {item.totalInstallments}</span>
                        {item.endDate && (
                          <>
                            <span>•</span>
                            <span>Koniec: {item.endDate.slice(0, 7)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Przyciski akcji */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isDone && (
                      <button
                        type="button"
                        onClick={() => onIncrementPaid(item.id)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition flex items-center gap-1 cursor-pointer"
                        title="Zwiększ liczbę spłaconych rat o 1"
                      >
                        <Plus size={13} />
                        <span>+1 Rata</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onOpenEditModal(item)}
                      className="p-1.5 rounded-lg text-stone-500 hover:text-amber-400 hover:bg-stone-800 transition cursor-pointer"
                      title="Edytuj zobowiązanie"
                    >
                      <Pencil size={15} />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteObligation(item.id)}
                      className="p-1.5 rounded-lg text-stone-500 hover:text-rose-400 hover:bg-stone-800 transition cursor-pointer"
                      title="Usuń zobowiązanie"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Pasek postępu spłaty */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono text-stone-400">
                    <span>Spłacono: {progressPercent}%</span>
                    <span>Łącznie: {formatPLN(item.monthlyAmount * item.totalInstallments)}</span>
                  </div>
                  <div className="w-full bg-stone-900 rounded-full h-2 overflow-hidden border border-stone-800">
                    <div
                      style={{
                        width: `${progressPercent}%`,
                        background: isDone
                          ? '#10B981'
                          : 'linear-gradient(90deg, #F59E0B 0%, #E2B053 100%)',
                      }}
                      className="h-full rounded-full transition-all duration-300"
                    />
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
