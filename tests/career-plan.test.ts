import { describe, it, expect } from "vitest";
import { compoundFutureValue, growOneYear } from "@/lib/engine/compound";
import {
  accruedAnnualPension,
  commutePension,
  salaryForServiceYear,
} from "@/lib/engine/police-care";
import { sippTopSliceAnnual } from "@/lib/engine/sipp-topslices";
import { monthlyTakeHome } from "@/lib/engine/scottish-tax";
import {
  DEFAULT_CONSTABLE_PAY_SCALE,
  DEFAULT_START_DATE,
  ageOnDate,
  defaultAssumptions,
  projectCareer,
} from "@/lib/engine/career-projection";

describe("compoundFutureValue", () => {
  it("matches Gemini £300/mo at 7% for 5 and 10 years", () => {
    expect(compoundFutureValue(0, 300, 0.07, 5)).toBeCloseTo(21_478, 0);
    expect(compoundFutureValue(0, 300, 0.07, 10)).toBeCloseTo(51_925, 0);
  });

  it("matches Gemini 20 / 25 / 30 year ISA pots", () => {
    expect(compoundFutureValue(0, 300, 0.07, 20)).toBeCloseTo(156_278, 0);
    expect(compoundFutureValue(0, 300, 0.07, 25)).toBeCloseTo(243_022, 0);
    expect(compoundFutureValue(0, 300, 0.07, 30)).toBeCloseTo(365_991, 0);
  });

  it("passes through present value when years is zero", () => {
    expect(compoundFutureValue(10_000, 300, 0.07, 0)).toBe(10_000);
  });
});

describe("police CARE", () => {
  it("uses a 10-point Constable scale from 34k to 55k", () => {
    expect(DEFAULT_CONSTABLE_PAY_SCALE[0]).toBe(34_000);
    expect(DEFAULT_CONSTABLE_PAY_SCALE[9]).toBe(55_000);
    expect(salaryForServiceYear(DEFAULT_CONSTABLE_PAY_SCALE, 11)).toBe(55_000);
  });

  it("accrues ~£28k/year after 30 years with no promotion", () => {
    const accrued = accruedAnnualPension(DEFAULT_CONSTABLE_PAY_SCALE, 55.3, 30);
    expect(Math.round(accrued)).toBe(27_939);
  });

  it("commutes 25% at factor 12 into ~£21k + ~£84k", () => {
    const accrued = accruedAnnualPension(DEFAULT_CONSTABLE_PAY_SCALE, 55.3, 30);
    const { reducedAnnual, lumpSum } = commutePension(accrued, 12, 0.25);
    expect(Math.round(reducedAnnual)).toBe(20_954);
    expect(Math.round(lumpSum)).toBe(83_816);
  });
});

describe("sipp top-slice", () => {
  it("is zero at £44k because the police contribution already pulls taxable pay below the band", () => {
    expect(sippTopSliceAnnual(44_000, 0.1344, 43_663)).toBe(0);
  });

  it("is about £310–£330/mo at top Constable £55k", () => {
    const annual = sippTopSliceAnnual(55_000, 0.1344, 43_663);
    expect(annual / 12).toBeGreaterThan(300);
    expect(annual / 12).toBeLessThan(340);
    expect(annual).toBeCloseTo(3_945, 0);
  });
});

describe("take-home cashflow", () => {
  it("year 1 take-home is in the ballpark of Gemini’s £2,085", () => {
    const monthly = monthlyTakeHome({
      grossAnnual: 34_000,
      policeContributionRate: 0.1344,
      sippAnnual: 0,
      higherRateThreshold: 43_663,
    });
    expect(monthly).toBeGreaterThan(1_900);
    expect(monthly).toBeLessThan(2_200);
  });

  it("year 10 take-home still rises vs year 5 after the SIPP top-slice", () => {
    const y5 = monthlyTakeHome({
      grossAnnual: salaryForServiceYear(DEFAULT_CONSTABLE_PAY_SCALE, 5),
      policeContributionRate: 0.1344,
      sippAnnual: sippTopSliceAnnual(
        salaryForServiceYear(DEFAULT_CONSTABLE_PAY_SCALE, 5),
        0.1344,
        43_663
      ),
      higherRateThreshold: 43_663,
    });
    const y10 = monthlyTakeHome({
      grossAnnual: 55_000,
      policeContributionRate: 0.1344,
      sippAnnual: sippTopSliceAnnual(55_000, 0.1344, 43_663),
      higherRateThreshold: 43_663,
    });
    expect(y10).toBeGreaterThan(y5);
  });
});

describe("projectCareer ages", () => {
  it("uses DOB 2005 and an Oct 2026 start, not Gemini’s age-25 start", () => {
    expect(ageOnDate("2005-01-01", DEFAULT_START_DATE)).toBe(21);
    const projection = projectCareer(defaultAssumptions(), { isaGbp: 0, sippGbp: 0 }, DEFAULT_START_DATE);
    const year30 = projection.years.find((y) => y.serviceYear === 30);
    expect(year30?.age).toBe(51);
    expect(
      Math.round(projection.milestones.find((m) => m.serviceYear === 30)?.policeAccruedAnnual ?? 0)
    ).toBe(27_939);
  });

  it("carries current ISA actuals into the forward path", () => {
    const fromZero = projectCareer(
      defaultAssumptions(),
      { isaGbp: 0, sippGbp: 0 },
      DEFAULT_START_DATE
    );
    const withSeed = projectCareer(
      defaultAssumptions(),
      { isaGbp: 5_000, sippGbp: 0 },
      DEFAULT_START_DATE
    );
    expect(withSeed.years[4].isaPot).toBeGreaterThan(fromZero.years[4].isaPot);
  });
});

describe("growOneYear", () => {
  it("is equivalent to compoundFutureValue over 1 year", () => {
    expect(growOneYear(10_000, 3_600, 0.07)).toBeCloseTo(
      compoundFutureValue(10_000, 300, 0.07, 1)
    );
  });
});
