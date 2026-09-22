import { ShieldCheck, Plus, Settings2, Sparkles, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { COLORS } from '../../utils/constants.js';

export function EmergencyFundCard({
  emergencyFund = {},
  monthlyBurnRate = 0,
  onOpenDepositModal,
  onOpenSettingsModal,
}) {
  const target = Number(emergencyFund.targetAmount || 50000);
  const current = Number(emergencyFund.currentAmount || 0);
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 100;

  // Obliczenie pokrycia miesięcy życia
  const safeBurnRate = monthlyBurnRate > 0 ? monthlyBurnRate : 5000;
  const monthsCovered = (current / safeBurnRate).toFixed(1);

  const formatPLN = (val) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const isFull = current >= target;

  return (
    <div
      style={{
        background: isFull
          ? 'linear-gradient(135deg, #18261e 0%, #171d18 100%)'
          : 'linear-gradient(135deg, #1E1E22 0%, #18181B 100%)',
        borderColor: isFull ? '#2f633a' : COLORS.border,
      }}
      className="rounded-2xl p-5 border space-y-4 shadow-sm relative overflow-hidden transition"
    >
      {/* Nagłówek i akcje */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              isFull
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
          >
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-base font-bold">
                Poduszka Płynnościowa
              </h3>
              {isFull ? (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 size={10} /> 100% Celu
                </span>
              ) : (
                <span className="text-[10px] bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-full font-semibold border border-amber-500/30">
                  {percent}% celu
                </span>
              )}
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              {emergencyFund.notes || 'Zabezpieczenie na wypadek nagłych wydatków i spadku przychodów'}
            </p>
          </div>
        </div>

        {/* Przyciski operacyjne */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenDepositModal}
            style={{ background: COLORS.accent, color: '#121214' }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shadow-sm hover:opacity-90 transition active:scale-95 cursor-pointer"
          >
            <Plus size={15} />
            <span>Wpłać / Wypłać</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettingsModal}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-200 bg-stone-800/80 hover:bg-stone-800 border border-stone-700/80 transition cursor-pointer"
            title="Dostosuj parametry poduszki"
          >
            <Settings2 size={16} />
          </button>
        </div>
      </div>

      {/* Kwoty i Pasek Postępu */}
      <div className="space-y-2 pt-1">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-stone-100 font-mono">
              {formatPLN(current)}
            </span>
            <span className="text-xs text-stone-400 font-mono">/ cel: {formatPLN(target)}</span>
          </div>

          <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
            {monthsCovered} mies. bezpieczeństwa
          </span>
        </div>

        {/* Pasek postępu */}
        <div className="w-full bg-stone-900 rounded-full h-3.5 p-0.5 border border-stone-800 overflow-hidden">
          <div
            style={{
              width: `${percent}%`,
              background: isFull
                ? 'linear-gradient(90deg, #10B981 0%, #34D399 100%)'
                : 'linear-gradient(90deg, #F59E0B 0%, #10B981 100%)',
            }}
            className="h-full rounded-full transition-all duration-500 shadow-sm"
          />
        </div>
      </div>

      {/* Podsumowanie i metryka pokrycia */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-stone-800/80 text-xs text-stone-300">
        <div className="flex items-center gap-2 bg-stone-900/50 p-2.5 rounded-xl border border-stone-800/60">
          <Sparkles size={14} className="text-amber-400 shrink-0" />
          <span>
            {isFull
              ? 'Poduszka jest w pełni zabezpieczona! Środki mogą w 100% zasilać inwestycje i nadpłaty.'
              : `Do pełnego celu brakuje ${formatPLN(Math.max(0, target - current))}.`}
          </span>
        </div>

        <div className="flex items-center gap-2 bg-stone-900/50 p-2.5 rounded-xl border border-stone-800/60">
          <TrendingUp size={14} className="text-emerald-400 shrink-0" />
          <span>
            Koszt stały rodziny: ~<strong>{formatPLN(safeBurnRate)}</strong> / msc.
          </span>
        </div>
      </div>
    </div>
  );
}
