/**
 * Police Scotland Pension Scheme 2015 (CARE).
 * Each year adds pensionablePay / accrualDivisor of annual income (today's money).
 */

export function salaryForServiceYear(payScale: number[], serviceYear: number): number {
  if (payScale.length === 0) return 0;
  if (serviceYear < 1) return payScale[0];
  if (serviceYear <= payScale.length) return payScale[serviceYear - 1];
  return payScale[payScale.length - 1];
}

/** Accrual added in a single service year. */
export function yearAccrual(
  pensionablePay: number,
  accrualDivisor: number
): number {
  if (accrualDivisor <= 0) return 0;
  return pensionablePay / accrualDivisor;
}

/** Sum of CARE accruals for service years 1..throughYear. */
export function accruedAnnualPension(
  payScale: number[],
  accrualDivisor: number,
  throughYear: number
): number {
  if (throughYear < 1) return 0;
  let total = 0;
  for (let year = 1; year <= throughYear; year++) {
    total += yearAccrual(salaryForServiceYear(payScale, year), accrualDivisor);
  }
  return total;
}

/**
 * Commute a fraction of annual pension for a tax-free lump sum.
 * Default Gemini example: 25% of £28k at factor 12 → £21k/year + £84k cash.
 */
export function commutePension(
  annualPension: number,
  commutationFactor: number,
  commuteFraction = 0.25
): { reducedAnnual: number; lumpSum: number; commutedAnnual: number } {
  const commutedAnnual = annualPension * commuteFraction;
  return {
    commutedAnnual,
    reducedAnnual: annualPension - commutedAnnual,
    lumpSum: commutedAnnual * commutationFactor,
  };
}
