/**
 * Kalkulator podatkowy dla małżonków (Polska: Skala podatkowa 12% / 32%, kwota wolna 30 000 zł)
 * z uwzględnieniem ulgi na IKZE (JDG + Etat) oraz wspólnego rozliczenia małżonków.
 */

// Limity IKZE wg lat
export const IKZE_ANNUAL_LIMITS = {
  2024: { jdg: 14083.20, etat: 9388.80 },
  2025: { jdg: 15050.40, etat: 10033.60 },
  2026: { jdg: 16000.00, etat: 10600.00 },
};

export const TAX_SCALE = {
  TAX_FREE_AMOUNT: 30000,
  FIRST_BRACKET_LIMIT: 120000,
  FIRST_BRACKET_RATE: 0.12,
  SECOND_BRACKET_RATE: 0.32,
  DECREASING_AMOUNT: 3600, // 30 000 * 12%
};

/**
 * Oblicza podatek dla pojedynczej osoby na skali podatkowej
 * @param {number} income Dochód do opodatkowania (po odliczeniu IKZE)
 */
export function calculateSingleTax(income) {
  const taxableIncome = Math.max(0, Number(income) || 0);
  if (taxableIncome <= TAX_SCALE.TAX_FREE_AMOUNT) {
    return 0;
  }

  if (taxableIncome <= TAX_SCALE.FIRST_BRACKET_LIMIT) {
    return Math.max(0, taxableIncome * TAX_SCALE.FIRST_BRACKET_RATE - TAX_SCALE.DECREASING_AMOUNT);
  }

  // II próg: 10 800 zł (podatek od 120k) + 32% od nadwyżki ponad 120k
  const taxFromFirstBracket = TAX_SCALE.FIRST_BRACKET_LIMIT * TAX_SCALE.FIRST_BRACKET_RATE - TAX_SCALE.DECREASING_AMOUNT;
  const excess = taxableIncome - TAX_SCALE.FIRST_BRACKET_LIMIT;
  return taxFromFirstBracket + excess * TAX_SCALE.SECOND_BRACKET_RATE;
}

/**
 * Oblicza podatek przy wspólnym rozliczeniu małżonków
 * @param {number} incomeHusband Dochód męża (po odliczeniu IKZE męża)
 * @param {number} incomeWife Dochód żony (po odliczeniu IKZE żony)
 */
export function calculateJointTax(incomeHusband, incomeWife) {
  const incH = Math.max(0, Number(incomeHusband) || 0);
  const incW = Math.max(0, Number(incomeWife) || 0);
  const totalIncome = incH + incW;

  // Średni dochód na osobę
  const avgIncome = totalIncome / 2;

  // Podatek od połowy dochodu pomnożony przez 2
  const taxForOne = calculateSingleTax(avgIncome);
  return taxForOne * 2;
}

/**
 * Kompleksowa symulacja rozliczenia podatkowego i zwrotu z PIT
 */
export function simulateTaxRefund({
  husbandIncome = 180000,
  wifeIncome = 90000,
  husbandTaxesPaid = 26000,
  wifeTaxesPaid = 12000,
  husbandIKZE = 14083.20,
  wifeIKZE = 9388.80,
  enableJointFiling = true,
}) {
  // Dochody przed odliczeniem IKZE
  const grossHusband = Number(husbandIncome) || 0;
  const grossWife = Number(wifeIncome) || 0;
  const totalTaxesPaid = (Number(husbandTaxesPaid) || 0) + (Number(wifeTaxesPaid) || 0);

  // Dochody po odliczeniu IKZE
  const netHusbandWithIKZE = Math.max(0, grossHusband - (Number(husbandIKZE) || 0));
  const netWifeWithIKZE = Math.max(0, grossWife - (Number(wifeIKZE) || 0));

  // 1. Podatek bez IKZE (rozliczenie osobne i wspólne)
  const taxSeparateNoIKZE = calculateSingleTax(grossHusband) + calculateSingleTax(grossWife);
  const taxJointNoIKZE = calculateJointTax(grossHusband, grossWife);

  // 2. Podatek Z IKZE (rozliczenie osobne i wspólne)
  const taxSeparateWithIKZE = calculateSingleTax(netHusbandWithIKZE) + calculateSingleTax(netWifeWithIKZE);
  const taxJointWithIKZE = calculateJointTax(netHusbandWithIKZE, netWifeWithIKZE);

  // Wybór docelowego podatku w zależności od opcji wspólnego rozliczenia
  const effectiveFinalTax = enableJointFiling ? taxJointWithIKZE : taxSeparateWithIKZE;
  const effectiveTaxNoIKZE = enableJointFiling ? taxJointNoIKZE : taxSeparateNoIKZE;

  // Korzyść z samego wspólnego rozliczenia (bez IKZE)
  const jointFilingBenefit = Math.max(0, taxSeparateNoIKZE - taxJointNoIKZE);

  // Korzyść z samych odliczeń IKZE
  const ikzeTaxBenefit = Math.max(0, effectiveTaxNoIKZE - effectiveFinalTax);

  // Całkowita prognozowana kwota zwrotu podatku
  const projectedRefund = Math.max(0, totalTaxesPaid - effectiveFinalTax);

  // Szacowana efektywna stopa zwrotu z wpłat IKZE (np. 12% lub 32%)
  const totalIKZEContributed = (Number(husbandIKZE) || 0) + (Number(wifeIKZE) || 0);
  const ikzeEffectiveYieldPercent =
    totalIKZEContributed > 0 ? ((ikzeTaxBenefit / totalIKZEContributed) * 100).toFixed(1) : '0.0';

  return {
    totalGrossIncome: grossHusband + grossWife,
    totalTaxesPaid,
    finalDueTax: Math.round(effectiveFinalTax),
    taxWithoutIKZE: Math.round(effectiveTaxNoIKZE),
    projectedRefund: Math.round(projectedRefund),
    jointFilingBenefit: Math.round(jointFilingBenefit),
    ikzeTaxBenefit: Math.round(ikzeTaxBenefit),
    ikzeEffectiveYieldPercent,
    totalIKZEContributed,
  };
}
