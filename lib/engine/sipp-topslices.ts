/**
 * Annual SIPP contribution that pins taxable pay (after the police contribution)
 * to the Scottish higher-rate threshold. Zero until taxable pay would exceed it.
 *
 * taxable = gross * (1 - policeContributionRate)
 * sippAnnual = max(0, taxable - scottishHigherRateThreshold)
 */
export function sippTopSliceAnnual(
  grossSalary: number,
  policeContributionRate: number,
  scottishHigherRateThreshold: number
): number {
  const taxable = grossSalary * (1 - policeContributionRate);
  return Math.max(0, taxable - scottishHigherRateThreshold);
}
