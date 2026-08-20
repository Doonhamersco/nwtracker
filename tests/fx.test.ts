/**
 * FX fetcher tests — all external HTTP is mocked via vi.stubGlobal("fetch").
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchFiatRatesToGbp,
  fetchCryptoPricesToGbp,
  fetchAllRatesForAccounts,
} from "@/lib/services/fx";

function mockFetch(data: unknown, status = 200) {
  return vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : "Error",
      json: async () => data,
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Frankfurter ─────────────────────────────────────────────────────────────

describe("fetchFiatRatesToGbp", () => {
  it("converts GBP→X rates to X→GBP by inverting", async () => {
    // Frankfurter returns rates FROM GBP: 1 GBP = 1.27 USD
    // So 1 USD = 1/1.27 GBP ≈ 0.787
    mockFetch({ base: "GBP", rates: { USD: 1.27, EUR: 1.16 } });

    const results = await fetchFiatRatesToGbp(["USD", "EUR"]);

    const usd = results.find((r) => r.fromCurrency === "USD");
    const eur = results.find((r) => r.fromCurrency === "EUR");

    expect(usd?.rate).toBeCloseTo(1 / 1.27);
    expect(eur?.rate).toBeCloseTo(1 / 1.16);
    expect(usd?.source).toBe("frankfurter");
    expect(usd?.toCurrency).toBe("GBP");
  });

  it("returns empty array when only GBP is passed", async () => {
    const results = await fetchFiatRatesToGbp(["GBP"]);
    expect(results).toHaveLength(0);
  });

  it("deduplicates currencies", async () => {
    mockFetch({ base: "GBP", rates: { USD: 1.27 } });
    const results = await fetchFiatRatesToGbp(["USD", "USD", "usd"]);
    expect(results).toHaveLength(1);
  });

  it("throws when the API returns a non-2xx status", async () => {
    mockFetch({}, 429);
    await expect(fetchFiatRatesToGbp(["USD"])).rejects.toThrow(
      "Frankfurter API error: 429"
    );
  });

  it("throws when a requested currency is missing from the response", async () => {
    mockFetch({ base: "GBP", rates: { EUR: 1.16 } });
    await expect(fetchFiatRatesToGbp(["USD"])).rejects.toThrow(
      "Frankfurter did not return a rate for USD"
    );
  });
});

// ─── CoinGecko ───────────────────────────────────────────────────────────────

describe("fetchCryptoPricesToGbp", () => {
  it("returns GBP price as the rate", async () => {
    mockFetch({ bitcoin: { gbp: 58000 }, ethereum: { gbp: 3200 } });

    const results = await fetchCryptoPricesToGbp(["bitcoin", "ethereum"]);

    const btc = results.find((r) => r.fromCurrency === "BITCOIN");
    const eth = results.find((r) => r.fromCurrency === "ETHEREUM");

    expect(btc?.rate).toBe(58000);
    expect(eth?.rate).toBe(3200);
    expect(btc?.source).toBe("coingecko");
    expect(btc?.toCurrency).toBe("GBP");
  });

  it("returns empty array when no coin IDs provided", async () => {
    const results = await fetchCryptoPricesToGbp([]);
    expect(results).toHaveLength(0);
  });

  it("throws when the API returns a non-2xx status", async () => {
    mockFetch({}, 503);
    await expect(fetchCryptoPricesToGbp(["bitcoin"])).rejects.toThrow(
      "CoinGecko API error: 503"
    );
  });

  it("throws when a coin is missing from the response", async () => {
    mockFetch({ ethereum: { gbp: 3200 } });
    await expect(fetchCryptoPricesToGbp(["bitcoin"])).rejects.toThrow(
      "CoinGecko did not return a GBP price for bitcoin"
    );
  });
});

// ─── Combined fetcher ─────────────────────────────────────────────────────────

describe("fetchAllRatesForAccounts", () => {
  it("routes fiat accounts to Frankfurter and crypto to CoinGecko", async () => {
    const fetchMock = vi.fn();

    // First call: Frankfurter (fiat USD)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ base: "GBP", rates: { USD: 1.27 } }),
    });
    // Second call: CoinGecko (bitcoin)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ bitcoin: { gbp: 58000 } }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const accounts = [
      { currencyCode: "GBP", coingeckoId: null },
      { currencyCode: "USD", coingeckoId: null },
      { currencyCode: "BTC", coingeckoId: "bitcoin" },
    ];

    const result = await fetchAllRatesForAccounts(accounts);

    expect(result.get("GBP")?.rate).toBe(1);
    expect(result.get("USD")?.rate).toBeCloseTo(1 / 1.27);
    expect(result.get("BTC")?.rate).toBe(58000);
    expect(result.get("BTC")?.source).toBe("coingecko");
  });

  it("GBP is always 1:1 with source=manual", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: {} }) }));

    const result = await fetchAllRatesForAccounts([
      { currencyCode: "GBP", coingeckoId: null },
    ]);

    const gbp = result.get("GBP");
    expect(gbp?.rate).toBe(1);
    expect(gbp?.source).toBe("manual");
  });
});
