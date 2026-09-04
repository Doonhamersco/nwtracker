/**
 * Simplified Scottish income tax + employee NI for plan cashflow.
 * Lower bands are 2025/26-ish constants. The higher-rate threshold is an assumption
 * because it moves and is the only band the SIPP top-slice cares about.
 *
 * Police and SIPP contributions reduce taxable pay. NI is charged on gross
 * (police scheme is not treated as salary sacrifice here).
 */

const PERSONAL_ALLOWANCE = 12_570;
const STARTER_END = 15_397;
const BASIC_END = 27_491;
const ADVANCED_END = 75_000;
const TOP_END = 125_140;

const STARTER_RATE = 0.19;
const BASIC_RATE = 0.2;
const INTERMEDIATE_RATE = 0.21;
const HIGHER_RATE = 0.42;
const ADVANCED_RATE = 0.45;
const TOP_RATE = 0.48;

const NI_PRIMARY_THRESHOLD = 12_570;
const NI_UEL = 50_270;
const NI_MAIN_RATE = 0.08;
const NI_UPPER_RATE = 0.02;

function taxOnSlice(income: number, from: number, to: number, rate: number): number {
  const band = Math.min(income, to) - from;
  return band > 0 ? band * rate : 0;
}

export function scottishIncomeTax(
  taxablePay: number,
  higherRateThreshold: number
): number {
  if (taxablePay <= PERSONAL_ALLOWANCE) return 0;

  const higherStart = Math.max(BASIC_END, higherRateThreshold);
  let tax = 0;
  tax += taxOnSlice(taxablePay, PERSONAL_ALLOWANCE, STARTER_END, STARTER_RATE);
  tax += taxOnSlice(taxablePay, STARTER_END, BASIC_END, BASIC_RATE);
  tax += taxOnSlice(taxablePay, BASIC_END, higherStart, INTERMEDIATE_RATE);
  tax += taxOnSlice(taxablePay, higherStart, ADVANCED_END, HIGHER_RATE);
  tax += taxOnSlice(taxablePay, ADVANCED_END, TOP_END, ADVANCED_RATE);
  if (taxablePay > TOP_END) {
    tax += (taxablePay - TOP_END) * TOP_RATE;
  }
  return tax;
}

export function employeeNI(grossPay: number): number {
  if (grossPay <= NI_PRIMARY_THRESHOLD) return 0;
  const mainSlice = Math.min(grossPay, NI_UEL) - NI_PRIMARY_THRESHOLD;
  const upperSlice = Math.max(0, grossPay - NI_UEL);
  return mainSlice * NI_MAIN_RATE + upperSlice * NI_UPPER_RATE;
}

export function monthlyTakeHome(input: {
  grossAnnual: number;
  policeContributionRate: number;
  sippAnnual: number;
  higherRateThreshold: number;
}): number {
  const police = input.grossAnnual * input.policeContributionRate;
  const taxable = Math.max(0, input.grossAnnual - police - input.sippAnnual);
  const tax = scottishIncomeTax(taxable, input.higherRateThreshold);
  const ni = employeeNI(input.grossAnnual);
  return (input.grossAnnual - police - input.sippAnnual - tax - ni) / 12;
}
