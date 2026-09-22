import { useState, useMemo } from 'react';
import { COLORS } from '../../utils/constants.js';
import { simulateTaxRefund, IKZE_ANNUAL_LIMITS } from '../../utils/taxCalculator.js';
import { ModalShell } from '../ui/ModalShell.jsx';
import { Building2, Sparkles, CheckCircle2, TrendingUp, Info } from 'lucide-react';

const inputStyle =
  'w-full border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition bg-stone-900 text-stone-100 placeholder-stone-500';

export function TaxSimulatorModal({
  taxOptimization = {},
  investmentPlan = {},
  onClose,
  onSaveTaxConfig,
}) {
  const husband = investmentPlan.husbandIKZE || {};
  const wife = investmentPlan.wifeIKZE || {};

  const [year, setYear] = useState(() => String(taxOptimization.year || 2026));
  const [husbandIncome, setHusbandIncome] = useState(() => String(taxOptimization.husbandIncomeEst || 180000));
  const [wifeIncome, setWifeIncome] = useState(() => String(taxOptimization.wifeIncomeEst || 90000));
  const [husbandTaxesPaid, setHusbandTaxesPaid] = useState(() => String(taxOptimization.husbandTaxesPaid || 24000));
  const [wifeTaxesPaid, setWifeTaxesPaid] = useState(() => String(taxOptimization.wifeTaxesPaid || 11000));
  const [enableJointFiling, setEnableJointFiling] = useState(() => taxOptimization.enableJointFiling !== false);

  // Symulacja w czasie rzeczywistym
  const simulation = useMemo(() => {
    return simulateTaxRefund({
      husbandIncome: parseFloat(husbandIncome.replace(',', '.')) || 0,
      wifeIncome: parseFloat(wifeIncome.replace(',', '.')) || 0,
      husbandTaxesPaid: parseFloat(husbandTaxesPaid.replace(',', '.')) || 0,
      wifeTaxesPaid: parseFloat(wifeTaxesPaid.replace(',', '.')) || 0,
      husbandIKZE: husband.currentContributed || 0,
      wifeIKZE: wife.currentContributed || 0,
      enableJointFiling,
    });
  }, [husbandIncome, wifeIncome, husbandTaxesPaid, wifeTaxesPaid, husband.currentContributed, wife.currentContributed, enableJointFiling]);

  const formatPLN = (val) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const handleSave = (e) => {
    e?.preventDefault();
    onSaveTaxConfig({
      ...taxOptimization,
      year: parseInt(year, 10) || 2026,
      husbandIncomeEst: parseFloat(husbandIncome.replace(',', '.')) || 180000,
      wifeIncomeEst: parseFloat(wifeIncome.replace(',', '.')) || 90000,
      husbandTaxesPaid: parseFloat(husbandTaxesPaid.replace(',', '.')) || 24000,
      wifeTaxesPaid: parseFloat(wifeTaxesPaid.replace(',', '.')) || 11000,
      enableJointFiling,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <ModalShell
      title="Kalkulator Podatkowy PIT & Symulacja IKZE"
      onClose={onClose}
    >
      <form onSubmit={handleSave} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {/* Karta Wyniku Symulacji Na Żywo */}
        <div
          style={{ background: 'linear-gradient(135deg, #1C1F26 0%, #15181E 100%)', borderColor: '#3B4861' }}
          className="p-4 rounded-xl border space-y-2 text-center"
        >
          <span className="text-xs uppercase tracking-wider text-stone-400 font-semibold">
            Prognozowany Zwrot z PIT (Wiosna {parseInt(year, 10) + 1})
          </span>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono">
            +{formatPLN(simulation.projectedRefund)}
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-800 text-xs">
            <div className="text-stone-300">
              Ulga z IKZE: <strong className="text-amber-300">+{formatPLN(simulation.ikzeTaxBenefit)}</strong>
            </div>
            <div className="text-stone-300">
              Wspólne PIT: <strong className="text-indigo-300">+{formatPLN(simulation.jointFilingBenefit)}</strong>
            </div>
          </div>
        </div>

        {/* Opcja wspólnego rozliczenia */}
        <div className="flex items-center gap-2 bg-stone-900/80 p-3 rounded-xl border border-stone-800">
          <input
            type="checkbox"
            id="jointFiling"
            checked={enableJointFiling}
            onChange={(e) => setEnableJointFiling(e.target.checked)}
            className="w-4 h-4 rounded text-indigo-500 bg-stone-900 border-stone-700"
          />
          <label htmlFor="jointFiling" className="text-xs font-semibold text-stone-200 select-none cursor-pointer">
            Wspólne rozliczenie małżonków (Wyrównanie progów 12% / 32%)
          </label>
        </div>

        {/* Dochody szacowane */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold mb-1 block text-stone-400">Dochód Mąż JDG (PLN / rok)</label>
            <input
              type="text"
              value={husbandIncome}
              onChange={(e) => setHusbandIncome(e.target.value)}
              placeholder="np. 180000"
              className={inputStyle}
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold mb-1 block text-stone-400">Dochód Żona Etat (PLN / rok)</label>
            <input
              type="text"
              value={wifeIncome}
              onChange={(e) => setWifeIncome(e.target.value)}
              placeholder="np. 90000"
              className={inputStyle}
              required
            />
          </div>
        </div>

        {/* Zapłacone zaliczki na podatek */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold mb-1 block text-stone-400">Zaliczki PIT Mąż JDG (PLN)</label>
            <input
              type="text"
              value={husbandTaxesPaid}
              onChange={(e) => setHusbandTaxesPaid(e.target.value)}
              placeholder="np. 24000"
              className={inputStyle}
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold mb-1 block text-stone-400">Zaliczki PIT Żona Etat (PLN)</label>
            <input
              type="text"
              value={wifeTaxesPaid}
              onChange={(e) => setWifeTaxesPaid(e.target.value)}
              placeholder="np. 11000"
              className={inputStyle}
              required
            />
          </div>
        </div>

        {/* Informacja o stanie IKZE */}
        <div className="bg-stone-900/60 p-3 rounded-xl border border-stone-800 text-xs text-stone-400 space-y-1">
          <div className="flex items-center gap-1 text-amber-300 font-semibold">
            <Info size={13} />
            <span>Uwzględnione wpłaty na IKZE w symulacji:</span>
          </div>
          <div className="flex justify-between">
            <span>IKZE Mąż: {formatPLN(husband.currentContributed || 0)} / {formatPLN(husband.annualLimit || 14083.20)}</span>
            <span>IKZE Żona: {formatPLN(wife.currentContributed || 0)} / {formatPLN(wife.annualLimit || 9388.80)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-stone-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-400 hover:bg-stone-800 transition cursor-pointer"
          >
            Anuluj
          </button>
          <button
            type="submit"
            style={{ background: COLORS.accent, color: '#121214' }}
            className="px-5 py-2.5 rounded-xl font-bold text-xs transition shadow-sm cursor-pointer"
          >
            Zapisz parametry symulacji
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
