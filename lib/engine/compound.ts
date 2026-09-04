/**
 * Monthly-compounded future value of a present value plus a level monthly contribution.
 * Rate is an annual real return (e.g. 0.07). Years may be fractional.
 */
export function compoundFutureValue(
  presentValue: number,
  monthlyContribution: number,
  annualRate: number,
  years: number
): number {
  if (years <= 0) return presentValue;
  const months = years * 12;
  const r = annualRate / 12;
  if (r === 0) {
    return presentValue + monthlyContribution * months;
  }
  const growth = Math.pow(1 + r, months);
  const fvPv = presentValue * growth;
  const fvPmt = monthlyContribution * ((growth - 1) / r);
  return fvPv + fvPmt;
}

/** Grow a pot for one year with a level annual contribution paid monthly. */
export function growOneYear(
  presentValue: number,
  annualContribution: number,
  annualRate: number
): number {
  return compoundFutureValue(
    presentValue,
    annualContribution / 12,
    annualRate,
    1
  );
}
