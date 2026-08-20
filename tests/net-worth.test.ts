import { describe, it, expect } from "vitest";
import {
  convertToGbp,
  computeNetWorth,
  computeNetWorthFromInputs,
  computeMoMChange,
  computeSavingsRate,
  projectGoalCompletion,
} from "@/lib/engine/net-worth";

describe("convertToGbp", () => {
  it("converts USD to GBP using the provided rate", () => {
    // $1,000 at 0.79 USD→GBP = £790
    expect(convertToGbp(1000, 0.79)).toBeCloseTo(790);
  });

  it("passes through GBP unchanged (rate = 1)", () => {
    expect(convertToGbp(5000, 1)).toBe(5000);
  });

  it("converts BTC using a spot rate", () => {
    // 0.5 BTC at £58,000/BTC = £29,000
    expect(convertToGbp(0.5, 58000)).toBeCloseTo(29000);
  });

  it("throws if FX rate is zero", () => {
    expect(() => convertToGbp(1000, 0)).toThrow("FX rate must be positive");
  });

  it("throws if FX rate is negative", () => {
    expect(() => convertToGbp(1000, -1)).toThrow("FX rate must be positive");
  });
});

describe("computeNetWorth", () => {
  it("sums assets and subtracts liabilities", () => {
    const result = computeNetWorth([
      { accountType: "ASSET", valueGbp: 10000 },
      { accountType: "ASSET", valueGbp: 5000 },
      { accountType: "LIABILITY", valueGbp: 3000 },
    ]);
    expect(result).toBeCloseTo(12000);
  });

  it("returns zero for empty input", () => {
    expect(computeNetWorth([])).toBe(0);
  });

  it("returns negative net worth when liabilities exceed assets", () => {
    const result = computeNetWorth([
      { accountType: "ASSET", valueGbp: 2000 },
      { accountType: "LIABILITY", valueGbp: 10000 },
    ]);
    expect(result).toBeCloseTo(-8000);
  });

  it("handles all assets, no liabilities", () => {
    const result = computeNetWorth([
      { accountType: "ASSET", valueGbp: 3000 },
      { accountType: "ASSET", valueGbp: 7000 },
    ]);
    expect(result).toBeCloseTo(10000);
  });
});

describe("computeNetWorthFromInputs — multi-currency", () => {
  it("converts each account using its own snapshot FX rate", () => {
    // Cash: £5,000 GBP (rate 1)
    // ISA:  £3,000 GBP (rate 1)
    // BTC:  0.25 BTC at £50,000 = £12,500
    // Student loan: £8,000 GBP (rate 1)
    const { netWorthGbp, valuations } = computeNetWorthFromInputs([
      { accountType: "ASSET",     valueNative: 5000,  fxRateToGbp: 1 },
      { accountType: "ASSET",     valueNative: 3000,  fxRateToGbp: 1 },
      { accountType: "ASSET",     valueNative: 0.25,  fxRateToGbp: 50000 },
      { accountType: "LIABILITY", valueNative: 8000,  fxRateToGbp: 1 },
    ]);

    expect(valuations[2].valueGbp).toBeCloseTo(12500);
    expect(netWorthGbp).toBeCloseTo(5000 + 3000 + 12500 - 8000); // £12,500
  });
});

describe("FX snapshot isolation", () => {
  it("old snapshot net worth does NOT change when BTC price changes", () => {
    // Simulate June snapshot: BTC was £40,000
    const juneFxRate = 40000;
    const { netWorthGbp: juneNetWorth } = computeNetWorthFromInputs([
      { accountType: "ASSET", valueNative: 0.5, fxRateToGbp: juneFxRate },
    ]);
    expect(juneNetWorth).toBeCloseTo(20000);

    // December snapshot: BTC is now £80,000
    const decemberFxRate = 80000;
    const { netWorthGbp: decemberNetWorth } = computeNetWorthFromInputs([
      { accountType: "ASSET", valueNative: 0.5, fxRateToGbp: decemberFxRate },
    ]);
    expect(decemberNetWorth).toBeCloseTo(40000);

    // The June snapshot is immutable — it must still equal £20,000
    // (In the DB this is enforced by storing value_gbp at commit time;
    //  here we verify the engine never touches old values.)
    expect(juneNetWorth).toBeCloseTo(20000);
    expect(juneNetWorth).not.toBeCloseTo(decemberNetWorth);
  });
});

describe("computeMoMChange", () => {
  it("calculates absolute and percent change", () => {
    const { absoluteChange, percentChange } = computeMoMChange(12000, 10000);
    expect(absoluteChange).toBeCloseTo(2000);
    expect(percentChange).toBeCloseTo(20);
  });

  it("handles negative change", () => {
    const { absoluteChange, percentChange } = computeMoMChange(8000, 10000);
    expect(absoluteChange).toBeCloseTo(-2000);
    expect(percentChange).toBeCloseTo(-20);
  });

  it("returns null for both when no previous snapshot exists", () => {
    const { absoluteChange, percentChange } = computeMoMChange(10000, null);
    expect(absoluteChange).toBeNull();
    expect(percentChange).toBeNull();
  });

  it("returns null percentChange when previous is zero", () => {
    const { percentChange } = computeMoMChange(1000, 0);
    expect(percentChange).toBeNull();
  });
});

describe("computeSavingsRate", () => {
  it("calculates savings rate correctly", () => {
    // £4,000 income, £3,000 spend → 25% saved
    expect(computeSavingsRate(4000, 3000)).toBeCloseTo(25);
  });

  it("returns negative rate when spending exceeds income", () => {
    expect(computeSavingsRate(3000, 4000)).toBeCloseTo(-33.33);
  });

  it("returns null when income is zero", () => {
    expect(computeSavingsRate(0, 1000)).toBeNull();
  });

  it("returns 100% when spend is zero", () => {
    expect(computeSavingsRate(5000, 0)).toBeCloseTo(100);
  });
});

describe("projectGoalCompletion", () => {
  it("projects a future completion date from an upward trend", () => {
    const now = Date.now();
    const monthMs = 30 * 24 * 60 * 60 * 1000;
    const dataPoints = [
      { timestamp: now - 5 * monthMs, value: 5000 },
      { timestamp: now - 4 * monthMs, value: 6000 },
      { timestamp: now - 3 * monthMs, value: 7000 },
      { timestamp: now - 2 * monthMs, value: 8000 },
      { timestamp: now - 1 * monthMs, value: 9000 },
      { timestamp: now,               value: 10000 },
    ];
    const projection = projectGoalCompletion(dataPoints, 20000);
    expect(projection).not.toBeNull();
    expect(projection!.getTime()).toBeGreaterThan(now);
  });

  it("returns null with fewer than 2 data points", () => {
    expect(
      projectGoalCompletion([{ timestamp: Date.now(), value: 5000 }], 10000)
    ).toBeNull();
  });

  it("returns null when trend is moving away from target", () => {
    // Net worth declining but target is higher
    const now = Date.now();
    const monthMs = 30 * 24 * 60 * 60 * 1000;
    const dataPoints = [
      { timestamp: now - 2 * monthMs, value: 12000 },
      { timestamp: now - 1 * monthMs, value: 11000 },
      { timestamp: now,               value: 10000 },
    ];
    // Projection would be in the past (already passed the target going down)
    const projection = projectGoalCompletion(dataPoints, 20000);
    // Slope is negative, so projecting upward to 20000 gives a past timestamp → null
    expect(projection).toBeNull();
  });
});
