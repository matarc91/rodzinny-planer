import { useState } from 'react';
import { COLORS, uid } from '../../utils/constants.js';
import { todayStr } from '../../utils/dateUtils.js';
import { ModalShell } from '../ui/ModalShell.jsx';
import { Clock, Calendar, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

const COMMON_OBLIGATION_ICONS = ['⚡', '📺', '📱', '🛋️', '🚗', '💻', '🚲', '🏠', '🔧', '🎓', '🎯'];

const TARGET_REDIRECT_OPTIONS = [
  { id: 'mortgage_overpayment', name: 'Nadpłata kredytu hipotecznego', icon: '🏠' },
  { id: 'emergency_fund', name: 'Poduszka finansowa', icon: '🛡️' },
  { id: 'etf', name: 'Inwestycje w fundusze ETF', icon: '📈' },
  { id: 'ikze_husband', name: 'IKZE Mąż (JDG)', icon: '💼' },
  { id: 'ikze_wife', name: 'IKZE Żona (Etat)', icon: '👩‍💼' },
  { id: 'custom', name: 'Inny cel oszczędnościowy', icon: '🎯' },
];

const inputStyle =
  'w-full border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition bg-stone-900 text-stone-100 placeholder-stone-500';

export function ExpiringObligationModal({
  initialObligation = null,
  onClose,
  onSave,
}) {
  const isEditing = Boolean(initialObligation?.id);

  const [title, setTitle] = useState(() => initialObligation?.title || '');
  const [monthlyAmount, setMonthlyAmount] = useState(() =>
    initialObligation?.monthlyAmount ? String(initialObligation.monthlyAmount) : ''
  );
  const [totalInstallments, setTotalInstallments] = useState(() =>
    initialObligation?.totalInstallments ? String(initialObligation.totalInstallments) : '12'
  );
  const [paidInstallments, setPaidInstallments] = useState(() =>
    initialObligation?.paidInstallments !== undefined ? String(initialObligation.paidInstallments) : '0'
  );
  const [startDate, setStartDate] = useState(() => initialObligation?.startDate || todayStr().slice(0, 7) + '-01');
  const [redirectToTarget, setRedirectToTarget] = useState(() => initialObligation?.redirectToTarget || 'mortgage_overpayment');
  const [targetName, setTargetName] = useState(() => initialObligation?.targetName || 'Nadpłata kredytu hipotecznego');
  const [icon, setIcon] = useState(() => initialObligation?.icon || '⚡');

  const handleRedirectOptionSelect = (option) => {
    setRedirectToTarget(option.id);
    if (option.id !== 'custom') {
      setTargetName(option.name);
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    const amountNum = parseFloat(monthlyAmount.replace(',', '.'));
    const totalNum = parseInt(totalInstallments, 10);
    const paidNum = parseInt(paidInstallments, 10);

    if (!title.trim() || isNaN(amountNum) || amountNum <= 0 || isNaN(totalNum) || totalNum <= 0) {
      return;
    }

    const safePaid = isNaN(paidNum) || paidNum < 0 ? 0 : Math.min(paidNum, totalNum);
    const remainingMonths = Math.max(0, totalNum - safePaid);

    // Wyliczenie szacowanej daty zakończenia
    const startD = new Date(startDate || todayStr());
    const endD = new Date(startD.getFullYear(), startD.getMonth() + totalNum, 0);
    const endDateStr = endD.toISOString().slice(0, 10);

    const savedObligation = {
      id: initialObligation?.id || uid('obl'),
      title: title.trim(),
      monthlyAmount: amountNum,
      totalInstallments: totalNum,
      paidInstallments: safePaid,
      startDate: startDate || todayStr().slice(0, 7) + '-01',
      endDate: endDateStr,
      redirectToTarget,
      targetName: targetName.trim() || 'Nadpłata kredytu',
      icon: icon || '⚡',
      isCompleted: safePaid >= totalNum,
      createdAt: initialObligation?.createdAt || new Date().toISOString(),
      updatedAt: isEditing ? new Date().toISOString() : undefined,
    };

    onSave(savedObligation);
    onClose();
  };

  return (
    <ModalShell
      title={isEditing ? 'Edytuj ratę 0% / zobowiązanie' : 'Dodaj ratę 0% lub koszt terminowy'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Ikona + Nazwa */}
        <div>
          <label className="text-xs font-semibold mb-1 block text-stone-400">Nazwa zobowiązania</label>
          <div className="flex gap-2">
            <div className="relative">
              <input
                type="text"
                maxLength={2}
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-12 text-center py-2.5 rounded-xl bg-stone-900 border border-stone-700 text-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="np. Raty 0% Sprzęt AGD, Telefony, RTV..."
              className={inputStyle}
              required
              autoFocus
            />
          </div>
          {/* Szybkie emotikony */}
          <div className="flex gap-1.5 overflow-x-auto pt-1.5 no-scrollbar">
            {COMMON_OBLIGATION_ICONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setIcon(emoji)}
                className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition border ${
                  icon === emoji ? 'border-amber-400 bg-amber-500/20' : 'border-stone-800 bg-stone-900 hover:border-stone-700'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Miesięczna rata i liczba rat */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold mb-1 block text-stone-400">Rata (PLN / msc)</label>
            <input
              type="text"
              value={monthlyAmount}
              onChange={(e) => setMonthlyAmount(e.target.value)}
              placeholder="np. 450"
              className={inputStyle}
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold mb-1 block text-stone-400">Liczba wszystkich rat</label>
            <input
              type="number"
              min={1}
              max={360}
              value={totalInstallments}
              onChange={(e) => setTotalInstallments(e.target.value)}
              placeholder="np. 20"
              className={inputStyle}
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold mb-1 block text-stone-400">Dotychczas spłacono</label>
            <input
              type="number"
              min={0}
              max={totalInstallments ? parseInt(totalInstallments, 10) : 360}
              value={paidInstallments}
              onChange={(e) => setPaidInstallments(e.target.value)}
              placeholder="np. 8"
              className={inputStyle}
              required
            />
          </div>
        </div>

        {/* Data rozpoczęcia */}
        <div>
          <label className="text-xs font-semibold mb-1 block text-stone-400">Miesiąc rozpoczęcia spłaty</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputStyle}
            required
          />
        </div>

        {/* Automatyczne przekierowanie uwolnionego kapitału */}
        <div className="space-y-2 pt-1 border-t border-stone-800/80">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
            <Sparkles size={14} />
            <span>Po wygaśnięciu raty: gdzie automatycznie przekierować uwolnioną kwotę?</span>
          </div>
          <p className="text-[11px] text-stone-400 leading-relaxed">
            Gdy spłacisz ostatnią ratę, system automatycznie doda tę miesięczną kwotę do wybranego celu inwestycyjnego lub poduszki.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {TARGET_REDIRECT_OPTIONS.map((opt) => {
              const isSelected = redirectToTarget === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleRedirectOptionSelect(opt)}
                  style={{
                    background: isSelected ? 'rgba(226, 176, 83, 0.12)' : COLORS.surfaceHighlight,
                    borderColor: isSelected ? COLORS.accent : COLORS.border,
                    color: isSelected ? COLORS.accent : COLORS.ink,
                  }}
                  className="p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 text-left transition cursor-pointer"
                >
                  <span className="text-base">{opt.icon}</span>
                  <span className="truncate flex-1">{opt.name}</span>
                </button>
              );
            })}
          </div>

          {redirectToTarget === 'custom' && (
            <div className="pt-2">
              <label className="text-xs font-semibold mb-1 block text-stone-400">Wpisz nazwę własnego celu</label>
              <input
                type="text"
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                placeholder="np. Remont domu, Nowy samochód"
                className={inputStyle}
                required
              />
            </div>
          )}
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
            disabled={!title.trim() || !monthlyAmount.trim()}
            style={{ background: COLORS.accent, color: '#121214' }}
            className="px-5 py-2.5 rounded-xl font-bold text-xs transition disabled:opacity-40 shadow-sm cursor-pointer"
          >
            {isEditing ? 'Zapisz zmiany w zobowiązaniu' : 'Dodaj zobowiązanie'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
