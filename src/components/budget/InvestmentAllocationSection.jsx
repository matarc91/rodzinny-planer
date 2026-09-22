import { useState } from 'react';
import { TrendingUp, Plus, Settings2, ShieldCheck, CheckCircle2, Sparkles, Building2, User, Landmark } from 'lucide-react';
import { COLORS } from '../../utils/constants.js';

export function InvestmentAllocationSection({
  investmentPlan = {},
  onOpenContributionModal,
  onOpenSettingsModal,
}) {
  const currentMonthNum = new Date().getMonth(); // 0-11
  const monthsLeftInYear = Math.max(1, 12 - currentMonthNum);

  const husband = investmentPlan.husbandIKZE || { annualLimit: 14083.20, currentContributed: 0 };
  const wife = investmentPlan.wifeIKZE || { annualLimit: 9388.80, currentContributed: 0 };
  const etf = investmentPlan.etf || { monthlyTarget: 1500, totalContributed: 0 };
  const mortgage = investmentPlan.mortgage || { monthlyOverpaymentTarget: 1000, totalOverpaid: 0 };

  const formatPLN = (val) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const husbandPercent = Math.min(100, Math.round(((husband.currentContributed || 0) / (husband.annualLimit || 1)) * 100));
  const wifePercent = Math.min(100, Math.round(((wife.currentContributed || 0) / (wife.annualLimit || 1)) * 100));

  const husbandRemaining = Math.max(0, (husband.annualLimit || 0) - (husband.currentContributed || 0));
  const wifeRemaining = Math.max(0, (wife.annualLimit || 0) - (wife.currentContributed || 0));

  const husbandSuggestedMonthly = Math.round(husbandRemaining / monthsLeftInYear);
  const wifeSuggestedMonthly = Math.round(wifeRemaining / monthsLeftInYear);

  return (
    <div
      style={{ background: COLORS.surface, borderColor: COLORS.border }}
      className="rounded-2xl p-5 border space-y-4 shadow-sm"
    >
      {/* Nagłówek i akcje */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
            <TrendingUp size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 style={{ fontFamily: 'Fraunces', color: COLORS.ink }} className="text-base font-bold">
                Sztywny Plan Inwestycyjny
              </h3>
              <span className="text-[10px] bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-full font-semibold border border-amber-500/30">
                Alokacja docelowa
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Maksymalizacja IKZE (tarcza podatkowa), stałe zakupy ETF oraz systematyczna redukcja hipoteki
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenSettingsModal}
          className="p-2 rounded-xl text-stone-400 hover:text-stone-200 bg-stone-800/80 hover:bg-stone-800 border border-stone-700/80 transition cursor-pointer"
          title="Dostosuj limity i cele inwestycyjne"
        >
          <Settings2 size={16} />
        </button>
      </div>

      {/* 4 Filary Inwestycyjne */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
        {/* 1. IKZE MĄŻ (JDG) */}
        <div
          style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
          className="p-4 rounded-xl border space-y-3 flex flex-col justify-between"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">💼</span>
                <div>
                  <h4 className="text-sm font-bold text-stone-100">IKZE Mąż (JDG)</h4>
                  <span className="text-[11px] text-stone-400 font-mono">Limit roczny: {formatPLN(husband.annualLimit)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenContributionModal('husbandIKZE')}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition flex items-center gap-1 cursor-pointer"
              >
                <Plus size={13} />
                <span>Wpłać</span>
              </button>
            </div>

            {/* Pasek postępu */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="font-bold text-stone-200">{formatPLN(husband.currentContributed)}</span>
                <span className="text-stone-400">{husbandPercent}%</span>
              </div>
              <div className="w-full bg-stone-900 rounded-full h-2 overflow-hidden border border-stone-800">
                <div
                  style={{
                    width: `${husbandPercent}%`,
                    background: husbandPercent >= 100 ? '#10B981' : 'linear-gradient(90deg, #F59E0B 0%, #10B981 100%)',
                  }}
                  className="h-full rounded-full transition-all duration-300"
                />
              </div>
            </div>
          </div>

          <div className="text-[11px] text-stone-400 bg-stone-900/60 p-2 rounded-lg border border-stone-800/80 flex items-center justify-between">
            <span>Pozostało do limitu: <strong className="text-stone-200">{formatPLN(husbandRemaining)}</strong></span>
            {husbandRemaining > 0 ? (
              <span className="text-amber-300">~{formatPLN(husbandSuggestedMonthly)} / msc</span>
            ) : (
              <span className="text-emerald-400 font-bold flex items-center gap-0.5"><CheckCircle2 size={11} /> Maks!</span>
            )}
          </div>
        </div>

        {/* 2. IKZE ŻONA (ETAT) */}
        <div
          style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
          className="p-4 rounded-xl border space-y-3 flex flex-col justify-between"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">👩‍💼</span>
                <div>
                  <h4 className="text-sm font-bold text-stone-100">IKZE Żona (Etat)</h4>
                  <span className="text-[11px] text-stone-400 font-mono">Limit roczny: {formatPLN(wife.annualLimit)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenContributionModal('wifeIKZE')}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition flex items-center gap-1 cursor-pointer"
              >
                <Plus size={13} />
                <span>Wpłać</span>
              </button>
            </div>

            {/* Pasek postępu */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="font-bold text-stone-200">{formatPLN(wife.currentContributed)}</span>
                <span className="text-stone-400">{wifePercent}%</span>
              </div>
              <div className="w-full bg-stone-900 rounded-full h-2 overflow-hidden border border-stone-800">
                <div
                  style={{
                    width: `${wifePercent}%`,
                    background: wifePercent >= 100 ? '#10B981' : 'linear-gradient(90deg, #F59E0B 0%, #10B981 100%)',
                  }}
                  className="h-full rounded-full transition-all duration-300"
                />
              </div>
            </div>
          </div>

          <div className="text-[11px] text-stone-400 bg-stone-900/60 p-2 rounded-lg border border-stone-800/80 flex items-center justify-between">
            <span>Pozostało do limitu: <strong className="text-stone-200">{formatPLN(wifeRemaining)}</strong></span>
            {wifeRemaining > 0 ? (
              <span className="text-amber-300">~{formatPLN(wifeSuggestedMonthly)} / msc</span>
            ) : (
              <span className="text-emerald-400 font-bold flex items-center gap-0.5"><CheckCircle2 size={11} /> Maks!</span>
            )}
          </div>
        </div>

        {/* 3. PORTFEL ETF */}
        <div
          style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
          className="p-4 rounded-xl border space-y-3 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">📈</span>
              <div>
                <h4 className="text-sm font-bold text-stone-100">Fundusze ETF</h4>
                <span className="text-[11px] text-stone-400 font-mono">Cel miesięczny: {formatPLN(etf.monthlyTarget)} / msc</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenContributionModal('etf')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition flex items-center gap-1 cursor-pointer"
            >
              <Plus size={13} />
              <span>Zainwestuj</span>
            </button>
          </div>

          <div className="text-[11px] text-stone-400 bg-stone-900/60 p-2.5 rounded-lg border border-stone-800/80 flex items-center justify-between">
            <span>Łącznie zainwestowano:</span>
            <strong className="text-sm font-bold text-emerald-400 font-mono">{formatPLN(etf.totalContributed)}</strong>
          </div>
        </div>

        {/* 4. NADPŁATY HIPOTEKI */}
        <div
          style={{ background: COLORS.surfaceHighlight, borderColor: COLORS.border }}
          className="p-4 rounded-xl border space-y-3 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏠</span>
              <div>
                <h4 className="text-sm font-bold text-stone-100">Nadpłaty Hipoteki</h4>
                <span className="text-[11px] text-stone-400 font-mono">Cel miesięczny: {formatPLN(mortgage.monthlyOverpaymentTarget)} / msc</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenContributionModal('mortgage')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition flex items-center gap-1 cursor-pointer"
            >
              <Plus size={13} />
              <span>Nadpłać</span>
            </button>
          </div>

          <div className="text-[11px] text-stone-400 bg-stone-900/60 p-2.5 rounded-lg border border-stone-800/80 flex items-center justify-between">
            <span>Łącznie nadpłacony kapitał:</span>
            <strong className="text-sm font-bold text-emerald-400 font-mono">{formatPLN(mortgage.totalOverpaid)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
