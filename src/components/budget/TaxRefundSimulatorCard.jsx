import { useMemo } from 'react';
import { simulateTaxRefund } from '../../utils/taxCalculator.js';
import { Building2, Sparkles, ArrowRight, ShieldAlert, CheckCircle2, SlidersHorizontal, HelpCircle } from 'lucide-react';
import { COLORS } from '../../utils/constants.js';

export function TaxRefundSimulatorCard({
  taxOptimization = {},
  investmentPlan = {},
  onOpenTaxModal,
  onBookRefundToMortgage,
}) {
  const husband = investmentPlan.husbandIKZE || {};
  const wife = investmentPlan.wifeIKZE || {};

  const simulation = useMemo(() => {
    return simulateTaxRefund({
      husbandIncome: taxOptimization.husbandIncomeEst || 180000,
      wifeIncome: taxOptimization.wifeIncomeEst || 90000,
      husbandTaxesPaid: taxOptimization.husbandTaxesPaid || 24000,
      wifeTaxesPaid: taxOptimization.wifeTaxesPaid || 11000,
      husbandIKZE: husband.currentContributed || 0,
      wifeIKZE: wife.currentContributed || 0,
      enableJointFiling: taxOptimization.enableJointFiling !== false,
    });
  }, [taxOptimization, husband.currentContributed, wife.currentContributed]);

  const formatPLN = (val) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1C1F26 0%, #15181E 100%)',
        borderColor: '#2D3748',
      }}
      className="rounded-2xl p-5 border space-y-4 shadow-md relative overflow-hidden"
    >
      {/* Nagłówek */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
            <Building2 size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-base font-bold">
                Tarcza Podatkowa & Zwrot z PIT
              </h3>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold border border-indigo-500/30 flex items-center gap-1">
                <Sparkles size={10} /> PIT-{taxOptimization.year || 2026}
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Wspólne rozliczenie (JDG na skali + Etat) i maksymalizacja IKZE generuje coroczny zwrot podatku
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenTaxModal}
          style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-stone-200 hover:text-stone-100 hover:bg-stone-800 transition border cursor-pointer"
        >
          <SlidersHorizontal size={14} className="text-indigo-400" />
          <span>Symuluj PIT</span>
        </button>
      </div>

      {/* Główny wynik: Prognozowany Zwrot */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Kafelek Główny */}
        <div
          style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
          className="p-4 rounded-xl border md:col-span-1 flex flex-col justify-between"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
            Prognozowany zwrot z PIT
          </span>
          <div className="my-1.5">
            <span
              style={{ fontFamily: 'Fraunces' }}
              className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono"
            >
              +{formatPLN(simulation.projectedRefund)}
            </span>
          </div>
          <span className="text-[11px] text-stone-400">Wypłata z Urzędu Skarbowego wiosną</span>
        </div>

        {/* 2 Kafelki korzyści */}
        <div
          style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
          className="p-4 rounded-xl border md:col-span-2 space-y-3 flex flex-col justify-between"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="bg-stone-900/60 p-2.5 rounded-lg border border-stone-800">
              <span className="text-stone-400 text-[11px] block">Korzyść z odliczeń IKZE:</span>
              <strong className="text-amber-300 font-mono text-sm">+{formatPLN(simulation.ikzeTaxBenefit)}</strong>
              <span className="text-[10px] text-stone-500 block mt-0.5">
                Oszczędność podatkowa ({simulation.ikzeEffectiveYieldPercent}% wpłat)
              </span>
            </div>

            <div className="bg-stone-900/60 p-2.5 rounded-lg border border-stone-800">
              <span className="text-stone-400 text-[11px] block">Wspólne rozliczenie małżonków:</span>
              <strong className="text-indigo-300 font-mono text-sm">+{formatPLN(simulation.jointFilingBenefit)}</strong>
              <span className="text-[10px] text-stone-500 block mt-0.5">
                Optymalizacja progów podatkowych
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-stone-400 pt-1 border-t border-stone-800/80">
            <span>Łączne wpłaty na IKZE w tym roku: <strong>{formatPLN(simulation.totalIKZEContributed)}</strong></span>
            <span>Należny podatek: <strong>{formatPLN(simulation.finalDueTax)}</strong></span>
          </div>
        </div>
      </div>

      {/* Przycisk akcji jednorazowej nadpłaty hipoteki ze zwrotu */}
      <div className="bg-indigo-950/30 border border-indigo-800/40 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0">
            🏠
          </div>
          <div>
            <div className="text-xs font-bold text-stone-100">
              Reguła finansowa: Całość zwrotu z PIT na nadpłatę hipoteki
            </div>
            <div className="text-[11px] text-stone-400">
              Po otrzymaniu zwrotu z US, zaksięguj kwotę jako jednorazową transzę zmniejszającą kapitał kredytu.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onBookRefundToMortgage(simulation.projectedRefund)}
          disabled={simulation.projectedRefund <= 0}
          className="px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-400 text-stone-950 transition flex items-center justify-center gap-1.5 disabled:opacity-40 shadow-sm shrink-0 cursor-pointer"
        >
          <span>Nadpłać hipotekę ({formatPLN(simulation.projectedRefund)})</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
