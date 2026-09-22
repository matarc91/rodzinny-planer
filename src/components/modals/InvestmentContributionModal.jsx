import { useState } from 'react';
import { COLORS, uid } from '../../utils/constants.js';
import { todayStr } from '../../utils/dateUtils.js';
import { ModalShell } from '../ui/ModalShell.jsx';
import { TrendingUp, Plus, Settings2, Sparkles } from 'lucide-react';

const inputStyle =
  'w-full border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition bg-stone-900 text-stone-100 placeholder-stone-500';

export function InvestmentContributionModal({
  initialType = 'husbandIKZE', // 'husbandIKZE' | 'wifeIKZE' | 'etf' | 'mortgage' | 'settings'
  investmentPlan = {},
  monthKey,
  onClose,
  onSavePlan,
  onRecordBudgetExpense,
}) {
  const [tab, setTab] = useState(initialType === 'settings' ? 'settings' : 'deposit');
  const [targetType, setTargetType] = useState(initialType === 'settings' ? 'husbandIKZE' : initialType);

  // Formularz wpłaty
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');
  const [syncToBudget, setSyncToBudget] = useState(true);

  // Formularz ustawień planu
  const [husbandLimit, setHusbandLimit] = useState(() => String(investmentPlan.husbandIKZE?.annualLimit || 14083.20));
  const [husbandCurrent, setHusbandCurrent] = useState(() => String(investmentPlan.husbandIKZE?.currentContributed || 0));
  const [wifeLimit, setWifeLimit] = useState(() => String(investmentPlan.wifeIKZE?.annualLimit || 9388.80));
  const [wifeCurrent, setWifeCurrent] = useState(() => String(investmentPlan.wifeIKZE?.currentContributed || 0));
  const [etfMonthly, setEtfMonthly] = useState(() => String(investmentPlan.etf?.monthlyTarget || 1500));
  const [etfTotal, setEtfTotal] = useState(() => String(investmentPlan.etf?.totalContributed || 0));
  const [mortgageMonthly, setMortgageMonthly] = useState(() => String(investmentPlan.mortgage?.monthlyOverpaymentTarget || 1000));
  const [mortgageTotal, setMortgageTotal] = useState(() => String(investmentPlan.mortgage?.totalOverpaid || 0));

  const getTargetTitle = (t) => {
    switch (t) {
      case 'husbandIKZE': return 'IKZE Mąż (JDG)';
      case 'wifeIKZE': return 'IKZE Żona (Etat)';
      case 'etf': return 'Portfel ETF';
      case 'mortgage': return 'Nadpłata Hipoteki';
      default: return 'Inwestycja';
    }
  };

  const handleDepositSubmit = (e) => {
    e?.preventDefault();
    const amountNum = parseFloat(amount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) return;

    const updatedPlan = { ...investmentPlan };

    if (targetType === 'husbandIKZE') {
      const cur = Number(updatedPlan.husbandIKZE?.currentContributed || 0);
      updatedPlan.husbandIKZE = {
        ...(updatedPlan.husbandIKZE || {}),
        currentContributed: cur + amountNum,
      };
    } else if (targetType === 'wifeIKZE') {
      const cur = Number(updatedPlan.wifeIKZE?.currentContributed || 0);
      updatedPlan.wifeIKZE = {
        ...(updatedPlan.wifeIKZE || {}),
        currentContributed: cur + amountNum,
      };
    } else if (targetType === 'etf') {
      const cur = Number(updatedPlan.etf?.totalContributed || 0);
      updatedPlan.etf = {
        ...(updatedPlan.etf || {}),
        totalContributed: cur + amountNum,
      };
    } else if (targetType === 'mortgage') {
      const cur = Number(updatedPlan.mortgage?.totalOverpaid || 0);
      updatedPlan.mortgage = {
        ...(updatedPlan.mortgage || {}),
        totalOverpaid: cur + amountNum,
      };
    }

    onSavePlan(updatedPlan);

    // Opcjonalne księgowanie w budżecie miesiąca jako wydatek / cel
    if (syncToBudget && onRecordBudgetExpense) {
      onRecordBudgetExpense({
        id: uid('exp_inv'),
        amount: amountNum,
        date: date || todayStr(),
        categoryId: 'goal',
        categoryName: getTargetTitle(targetType),
        goalId: targetType,
        goalName: getTargetTitle(targetType),
        goalIcon: targetType === 'mortgage' ? '🏠' : targetType === 'etf' ? '📈' : '💼',
        description: note.trim() || `Wpłata na ${getTargetTitle(targetType)}`,
        createdAt: new Date().toISOString(),
      });
    }

    onClose();
  };

  const handleSettingsSubmit = (e) => {
    e?.preventDefault();
    const updatedPlan = {
      husbandIKZE: {
        annualLimit: parseFloat(husbandLimit.replace(',', '.')) || 14083.20,
        currentContributed: parseFloat(husbandCurrent.replace(',', '.')) || 0,
      },
      wifeIKZE: {
        annualLimit: parseFloat(wifeLimit.replace(',', '.')) || 9388.80,
        currentContributed: parseFloat(wifeCurrent.replace(',', '.')) || 0,
      },
      etf: {
        monthlyTarget: parseFloat(etfMonthly.replace(',', '.')) || 1500,
        totalContributed: parseFloat(etfTotal.replace(',', '.')) || 0,
      },
      mortgage: {
        monthlyOverpaymentTarget: parseFloat(mortgageMonthly.replace(',', '.')) || 1000,
        totalOverpaid: parseFloat(mortgageTotal.replace(',', '.')) || 0,
      },
    };

    onSavePlan(updatedPlan);
    onClose();
  };

  return (
    <ModalShell
      title="Plan Inwestycyjny & Emerytalny"
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* Zakładki */}
        <div
          style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
          className="flex p-1 rounded-xl border text-xs font-semibold gap-1"
        >
          <button
            type="button"
            onClick={() => setTab('deposit')}
            style={{
              background: tab === 'deposit' ? COLORS.accent : 'transparent',
              color: tab === 'deposit' ? '#121214' : COLORS.inkSoft,
            }}
            className="flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sparkles size={14} />
            <span>Zaksięguj wpłatę</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('settings')}
            style={{
              background: tab === 'settings' ? COLORS.accent : 'transparent',
              color: tab === 'settings' ? '#121214' : COLORS.inkSoft,
            }}
            className="flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Settings2 size={14} />
            <span>Ustawienia celów</span>
          </button>
        </div>

        {tab === 'deposit' ? (
          <form onSubmit={handleDepositSubmit} className="space-y-4">
            {/* Wybór filaru */}
            <div>
              <label className="text-xs font-semibold mb-1.5 block text-stone-400">Wybierz cel inwestycji</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'husbandIKZE', name: 'IKZE Mąż (JDG)', icon: '💼' },
                  { id: 'wifeIKZE', name: 'IKZE Żona (Etat)', icon: '👩‍💼' },
                  { id: 'etf', name: 'Portfel ETF', icon: '📈' },
                  { id: 'mortgage', name: 'Nadpłata Hipoteki', icon: '🏠' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTargetType(item.id)}
                    style={{
                      background: targetType === item.id ? 'rgba(226, 176, 83, 0.15)' : COLORS.surfaceHighlight,
                      borderColor: targetType === item.id ? COLORS.accent : COLORS.border,
                      color: targetType === item.id ? COLORS.accent : COLORS.ink,
                    }}
                    className="p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
                  >
                    <span className="text-base">{item.icon}</span>
                    <span className="truncate">{item.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Kwota */}
            <div>
              <label className="text-xs font-semibold mb-1 block text-stone-400">Kwota wpłaty (PLN)</label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="np. 1200"
                className={inputStyle}
                required
                autoFocus
              />
            </div>

            {/* Data */}
            <div>
              <label className="text-xs font-semibold mb-1 block text-stone-400">Data operacji</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputStyle}
                required
              />
            </div>

            {/* Notatka */}
            <div>
              <label className="text-xs font-semibold mb-1 block text-stone-400">Notatka / Dom maklerski (opcjonalnie)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="np. Zakup VWCE / XTB / mBank"
                className={inputStyle}
              />
            </div>

            {/* Checkbox księgowania w budżecie */}
            <div className="flex items-center gap-2 bg-stone-900/60 p-3 rounded-xl border border-stone-800">
              <input
                type="checkbox"
                id="syncInvBudget"
                checked={syncToBudget}
                onChange={(e) => setSyncToBudget(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 bg-stone-900 border-stone-700"
              />
              <label htmlFor="syncInvBudget" className="text-xs text-stone-300 select-none cursor-pointer">
                Zaksięguj tę wpłatę również jako wydatek w budżecie tego miesiąca
              </label>
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
                disabled={!amount.trim()}
                style={{ background: COLORS.accent, color: '#121214' }}
                className="px-5 py-2.5 rounded-xl font-bold text-xs transition disabled:opacity-40 shadow-sm cursor-pointer"
              >
                Zaksięguj wpłatę
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSettingsSubmit} className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">IKZE Mąż (JDG)</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-stone-400 block mb-1">Limit roczny (PLN)</label>
                  <input
                    type="text"
                    value={husbandLimit}
                    onChange={(e) => setHusbandLimit(e.target.value)}
                    className={inputStyle}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-stone-400 block mb-1">Wpłacono w roku (PLN)</label>
                  <input
                    type="text"
                    value={husbandCurrent}
                    onChange={(e) => setHusbandCurrent(e.target.value)}
                    className={inputStyle}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-stone-800">
              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">IKZE Żona (Etat)</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-stone-400 block mb-1">Limit roczny (PLN)</label>
                  <input
                    type="text"
                    value={wifeLimit}
                    onChange={(e) => setWifeLimit(e.target.value)}
                    className={inputStyle}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-stone-400 block mb-1">Wpłacono w roku (PLN)</label>
                  <input
                    type="text"
                    value={wifeCurrent}
                    onChange={(e) => setWifeCurrent(e.target.value)}
                    className={inputStyle}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-stone-800">
              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">ETF & Hipoteka</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-stone-400 block mb-1">ETF cel (PLN / msc)</label>
                  <input
                    type="text"
                    value={etfMonthly}
                    onChange={(e) => setEtfMonthly(e.target.value)}
                    className={inputStyle}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-stone-400 block mb-1">Hipoteka nadpłata (PLN / msc)</label>
                  <input
                    type="text"
                    value={mortgageMonthly}
                    onChange={(e) => setMortgageMonthly(e.target.value)}
                    className={inputStyle}
                  />
                </div>
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
                Zapisz ustawienia planu
              </button>
            </div>
          </form>
        )}
      </div>
    </ModalShell>
  );
}
