import { useState } from 'react';
import { COLORS, uid } from '../../utils/constants.js';
import { todayStr } from '../../utils/dateUtils.js';
import { ModalShell } from '../ui/ModalShell.jsx';
import { ShieldCheck, Plus, Minus, Settings2, Sparkles } from 'lucide-react';

const inputStyle =
  'w-full border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition bg-stone-900 text-stone-100 placeholder-stone-500';

export function EmergencyFundModal({
  emergencyFund = {},
  monthKey,
  onClose,
  onSaveFund,
  onRecordBudgetExpense,
}) {
  const [tab, setTab] = useState('transaction'); // 'transaction' | 'settings'

  // Transakcja wpłaty/wypłaty
  const [actionType, setActionType] = useState('deposit'); // 'deposit' | 'withdraw'
  const [txAmount, setTxAmount] = useState('');
  const [txDate, setTxDate] = useState(todayStr());
  const [txNote, setTxNote] = useState('');
  const [syncToBudget, setSyncToBudget] = useState(true);

  // Ustawienia celu
  const [targetAmount, setTargetAmount] = useState(() => String(emergencyFund.targetAmount || 50000));
  const [currentAmount, setCurrentAmount] = useState(() => String(emergencyFund.currentAmount || 0));
  const [monthlyTarget, setMonthlyTarget] = useState(() => String(emergencyFund.monthlyContributionTarget || 1000));
  const [notes, setNotes] = useState(() => emergencyFund.notes || '');

  const handleTransactionSubmit = (e) => {
    e?.preventDefault();
    const amountNum = parseFloat(txAmount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) return;

    const current = Number(emergencyFund.currentAmount || 0);
    const newCurrent = actionType === 'deposit' ? current + amountNum : Math.max(0, current - amountNum);

    const updatedFund = {
      ...emergencyFund,
      currentAmount: newCurrent,
      updatedAt: new Date().toISOString(),
    };

    onSaveFund(updatedFund);

    // Opcjonalne księgowanie w budżecie miesiąca
    if (syncToBudget && actionType === 'deposit' && onRecordBudgetExpense) {
      onRecordBudgetExpense({
        id: uid('exp_poduszka'),
        amount: amountNum,
        date: txDate,
        categoryId: 'goal',
        categoryName: 'Poduszka płynnościowa',
        goalId: 'emergency_fund',
        goalName: 'Poduszka bezpieczeństwa',
        goalIcon: '🛡️',
        description: txNote.trim() || 'Wpłata na poduszkę finansową',
        createdAt: new Date().toISOString(),
      });
    }

    onClose();
  };

  const handleSettingsSubmit = (e) => {
    e?.preventDefault();
    const targetNum = parseFloat(targetAmount.replace(',', '.'));
    const currentNum = parseFloat(currentAmount.replace(',', '.'));
    const monthlyNum = parseFloat(monthlyTarget.replace(',', '.'));

    const updatedFund = {
      ...emergencyFund,
      targetAmount: isNaN(targetNum) || targetNum < 0 ? 50000 : targetNum,
      currentAmount: isNaN(currentNum) || currentNum < 0 ? 0 : currentNum,
      monthlyContributionTarget: isNaN(monthlyNum) || monthlyNum < 0 ? 1000 : monthlyNum,
      notes: notes.trim(),
      updatedAt: new Date().toISOString(),
    };

    onSaveFund(updatedFund);
    onClose();
  };

  return (
    <ModalShell
      title="Poduszka Płynnościowa"
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
            onClick={() => setTab('transaction')}
            style={{
              background: tab === 'transaction' ? COLORS.accent : 'transparent',
              color: tab === 'transaction' ? '#121214' : COLORS.inkSoft,
            }}
            className="flex-1 py-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sparkles size={14} />
            <span>Wpłać / Wypłać</span>
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
            <span>Ustawienia celu</span>
          </button>
        </div>

        {tab === 'transaction' ? (
          <form onSubmit={handleTransactionSubmit} className="space-y-4">
            {/* Wybór Wpłata / Wypłata */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActionType('deposit')}
                style={{
                  background: actionType === 'deposit' ? 'rgba(78, 154, 88, 0.15)' : COLORS.surfaceHighlight,
                  borderColor: actionType === 'deposit' ? COLORS.success : COLORS.border,
                  color: actionType === 'deposit' ? '#4ade80' : COLORS.inkSoft,
                }}
                className="p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus size={16} />
                <span>Wpłata na poduszkę</span>
              </button>

              <button
                type="button"
                onClick={() => setActionType('withdraw')}
                style={{
                  background: actionType === 'withdraw' ? 'rgba(229, 115, 115, 0.15)' : COLORS.surfaceHighlight,
                  borderColor: actionType === 'withdraw' ? COLORS.warn : COLORS.border,
                  color: actionType === 'withdraw' ? '#f87171' : COLORS.inkSoft,
                }}
                className="p-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Minus size={16} />
                <span>Wypłata (awaria)</span>
              </button>
            </div>

            {/* Kwota */}
            <div>
              <label className="text-xs font-semibold mb-1 block text-stone-400">Kwota (PLN)</label>
              <input
                type="text"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                placeholder="np. 1500"
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
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className={inputStyle}
                required
              />
            </div>

            {/* Opis */}
            <div>
              <label className="text-xs font-semibold mb-1 block text-stone-400">Opis / Źródło (opcjonalnie)</label>
              <input
                type="text"
                value={txNote}
                onChange={(e) => setTxNote(e.target.value)}
                placeholder={actionType === 'deposit' ? 'np. Przelew z premii' : 'np. Nagła naprawa auta'}
                className={inputStyle}
              />
            </div>

            {/* Checkbox księgowania w budżecie */}
            {actionType === 'deposit' && (
              <div className="flex items-center gap-2 bg-stone-900/60 p-3 rounded-xl border border-stone-800">
                <input
                  type="checkbox"
                  id="syncBudget"
                  checked={syncToBudget}
                  onChange={(e) => setSyncToBudget(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 bg-stone-900 border-stone-700"
                />
                <label htmlFor="syncBudget" className="text-xs text-stone-300 select-none cursor-pointer">
                  Zaksięguj tę wpłatę również jako wydatek na cel w budżecie tego miesiąca
                </label>
              </div>
            )}

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
                disabled={!txAmount.trim()}
                style={{ background: COLORS.accent, color: '#121214' }}
                className="px-5 py-2.5 rounded-xl font-bold text-xs transition disabled:opacity-40 shadow-sm cursor-pointer"
              >
                {actionType === 'deposit' ? 'Zaksięguj wpłatę' : 'Zaksięguj wypłatę'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSettingsSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold mb-1 block text-stone-400">Docelowa kwota poduszki (PLN)</label>
              <input
                type="text"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="np. 50000"
                className={inputStyle}
                required
              />
              <span className="text-[11px] text-stone-500 mt-0.5 block">
                Zalecana wielkość to równowartość 3-6 miesięcy stałych kosztów życia rodziny.
              </span>
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block text-stone-400">Aktualny stan oszczędności w poduszce (PLN)</label>
              <input
                type="text"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                placeholder="np. 25000"
                className={inputStyle}
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block text-stone-400">Docelowa miesięczna wpłata (PLN/msc)</label>
              <input
                type="text"
                value={monthlyTarget}
                onChange={(e) => setMonthlyTarget(e.target.value)}
                placeholder="np. 1000"
                className={inputStyle}
              />
            </div>

            <div>
              <label className="text-xs font-semibold mb-1 block text-stone-400">Lokalizacja środków / Notatka</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="np. Konto Oszczędnościowe PKO + Lokata 3M"
                className={inputStyle}
              />
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
                Zapisz ustawienia
              </button>
            </div>
          </form>
        )}
      </div>
    </ModalShell>
  );
}
