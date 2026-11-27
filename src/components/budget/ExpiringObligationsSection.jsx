import { Clock, Plus, Sparkles, Pencil, Trash2, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';
import { COLORS } from '../../utils/constants.js';

export function getObligationMonthState(obligation, monthKey) {
  const paidMonths = Array.isArray(obligation.paidMonths) ? obligation.paidMonths : [];
  const basePaid =
    typeof obligation.initialPaidInstallments === 'number'
      ? obligation.initialPaidInstallments
      : Math.max(0, (obligation.paidInstallments || 0) - paidMonths.length);
  const totalInstallments = Number(obligation.totalInstallments) || 1;
  const totalPaidOverall = Math.min(totalInstallments, basePaid + paidMonths.length);
  const paidUpToMonth = Math.min(
    totalInstallments,
    basePaid + (monthKey ? paidMonths.filter((m) => m <= monthKey).length : paidMonths.length)
  );
  const isPaidInMonth = Boolean(monthKey && paidMonths.includes(monthKey));
  const isMaxReached = totalPaidOverall >= totalInstallments;
  const isDoneInMonth = obligation.isCompleted || paidUpToMonth >= totalInstallments;

  return {
    paidMonths,
    basePaid,
    totalPaidOverall,
    paidUpToMonth,
    isPaidInMonth,
    isMaxReached,
    isDoneInMonth,
  };
}

export function ExpiringObligationsSection({
  obligations = [],
  monthKey,
  onOpenAddModal,
  onOpenEditModal,
  onIncrementPaid,
  onUndoPaid,
  onDeleteObligation,
}) {
  const formatPLN = (val) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const enrichedObligations = obligations.map((o) => ({
    ...o,
    _state: getObligationMonthState(o, monthKey),
  }));

  const activeObligations = enrichedObligations.filter((o) => !o._state.isDoneInMonth);
  const paidThisMonthObligations = enrichedObligations.filter((o) => o._state.isPaidInMonth);

  const totalMonthlyActive = activeObligations.reduce((sum, o) => sum + Number(o.monthlyAmount || 0), 0);
  const totalPaidThisMonth = paidThisMonthObligations.reduce((sum, o) => sum + Number(o.monthlyAmount || 0), 0);

  // Najbliższe wygasające zobowiązanie
  const nextExpiring = [...activeObligations].sort((a, b) => {
    const remA = a.totalInstallments - a._state.paidUpToMonth;
    const remB = b.totalInstallments - b._state.paidUpToMonth;
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
                Raty
              </h3>
              <span className="text-[10px] font-mono text-stone-400 bg-stone-900 px-2 py-0.5 rounded-full border border-stone-800">
                {activeObligations.length} aktywne
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Śledzenie spłat rat i ich wpływ na budżet w wybranym miesiącu
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
      {(totalMonthlyActive > 0 || totalPaidThisMonth > 0 || nextExpiring) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {(totalPaidThisMonth > 0 || totalMonthlyActive > 0) && (
            <div className="bg-stone-900/60 border border-stone-800 p-3 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/15 text-orange-400 flex items-center justify-center shrink-0">
                <Clock size={16} />
              </div>
              <div className="text-xs">
                <div className="font-bold text-stone-200">
                  Opłacono w tym msc: {formatPLN(totalPaidThisMonth)}
                </div>
                <div className="text-stone-400 text-[11px] mt-0.5">
                  Łącznie aktywne raty: {formatPLN(totalMonthlyActive)} / msc
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
                  Za {Math.max(0, nextExpiring.totalInstallments - nextExpiring._state.paidUpToMonth)} msc koniec: {nextExpiring.title}
                </div>
                <div className="text-stone-400 text-[11px] mt-0.5">
                  Uwolni się +{formatPLN(nextExpiring.monthlyAmount)} / msc wolnych środków
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista Rat */}
      {enrichedObligations.length === 0 ? (
        <div className="text-center py-6 text-stone-500 text-xs italic border border-dashed border-stone-800 rounded-xl">
          Brak zdefiniowanych rat. Kliknij „Dodaj ratę”, aby śledzić spłaty i uwzględniać je w budżecie.
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          {enrichedObligations.map((item) => {
            const { paidUpToMonth, isPaidInMonth, isMaxReached, isDoneInMonth } = item._state;
            const remaining = Math.max(0, item.totalInstallments - paidUpToMonth);
            const progressPercent = Math.min(100, Math.round((paidUpToMonth / item.totalInstallments) * 100));

            return (
              <div
                key={item.id}
                style={{ background: COLORS.surfaceHighlight, borderColor: isDoneInMonth ? '#2d4a34' : COLORS.border }}
                className={`p-3.5 rounded-xl border space-y-2.5 transition ${
                  isDoneInMonth && !isPaidInMonth ? 'opacity-70' : 'hover:border-stone-700'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl shrink-0">{item.icon || '⚡'}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-sm font-bold truncate ${
                            isDoneInMonth ? 'line-through text-stone-400' : 'text-stone-100'
                          }`}
                        >
                          {item.title}
                        </span>
                        {isDoneInMonth ? (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold border border-emerald-500/30 flex items-center gap-0.5">
                            <CheckCircle2 size={10} /> Spłacone całkowicie!
                          </span>
                        ) : (
                          <span className="text-[10px] bg-stone-900 text-stone-300 font-mono px-2 py-0.5 rounded border border-stone-800">
                            Pozostało: {remaining} msc
                          </span>
                        )}

                        {isPaidInMonth ? (
                          <span
                            title="Rata została opłacona w tym miesiącu i odjęta od dostępnych środków"
                            className="text-[10px] bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded font-semibold border border-emerald-500/30 flex items-center gap-1"
                          >
                            <CheckCircle2 size={10} /> Opłacono w tym msc (-{formatPLN(item.monthlyAmount)})
                          </span>
                        ) : !isDoneInMonth ? (
                          <span
                            title="Rata nie została jeszcze opłacona w tym miesiącu — kliknij „Opłać ratę”, aby uwzględnić ją w budżecie tego miesiąca"
                            className="text-[10px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded font-semibold border border-amber-500/25 flex items-center gap-1 cursor-help"
                          >
                            <AlertCircle size={10} /> Nieopłacono w tym msc
                          </span>
                        ) : null}
                      </div>

                      <div className="text-xs text-stone-400 flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="font-mono text-amber-300 font-bold">{formatPLN(item.monthlyAmount)} / msc</span>
                        <span>•</span>
                        <span>
                          Rata {paidUpToMonth} z {item.totalInstallments}
                        </span>
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
                    {isPaidInMonth ? (
                      <button
                        type="button"
                        onClick={() => onUndoPaid?.(item.id)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition flex items-center gap-1 cursor-pointer"
                        title="Cofnij opłacenie raty w tym miesiącu"
                      >
                        <RotateCcw size={12} />
                        <span>Cofnij</span>
                      </button>
                    ) : (
                      !isDoneInMonth && (
                        <button
                          type="button"
                          disabled={isMaxReached}
                          onClick={() => onIncrementPaid(item.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1 ${
                            isMaxReached
                              ? 'bg-stone-900 text-stone-600 border-stone-800 cursor-not-allowed'
                              : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/30 cursor-pointer'
                          }`}
                          title={
                            isMaxReached
                              ? 'Osiągnięto maksymalną liczbę spłaconych rat'
                              : 'Opłać ratę w tym miesiącu (zwiększa postęp o 1 i odejmuje kwotę z budżetu miesiąca)'
                          }
                        >
                          <Plus size={13} />
                          <span>Opłać ratę</span>
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      onClick={() => onOpenEditModal(item)}
                      className="p-1.5 rounded-lg text-stone-500 hover:text-amber-400 hover:bg-stone-800 transition cursor-pointer"
                      title="Edytuj ratę"
                    >
                      <Pencil size={15} />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteObligation(item.id)}
                      className="p-1.5 rounded-lg text-stone-500 hover:text-rose-400 hover:bg-stone-800 transition cursor-pointer"
                      title="Usuń ratę"
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
                        background: isDoneInMonth
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
