/**
 * FX rate fetching services.
 *
 * Two sources:
 *   - Frankfurter (api.frankfurter.app) — ECB-backed fiat rates, free, no key required
 *   - CoinGecko (api.coingecko.com)     — crypto spot prices, free tier, no key required
 *
 * Both return rates TO GBP (base currency is always GBP).
 * Fetched rates are stored per-snapshot and never retroactively updated.
 */

export interface FxRateResult {
  fromCurrency: string;
  toCurrency: "GBP";
  rate: number;
  source: "frankfurter" | "coingecko" | "manual";
}

// ─── Fiat: Frankfurter ───────────────────────────────────────────────────────

const FRANKFURTER_BASE = "https://api.frankfurter.app";

/**
 * Fetch the current GBP rate for one or more fiat currencies.
 * Returns a map of { USD: 0.79, EUR: 0.85, ... }.
 *
 * Throws if the network request fails or the API returns an error.
 */
export async function fetchFiatRatesToGbp(
  currencies: string[]
): Promise<FxRateResult[]> {
  const unique = [...new Set(currencies.map((c) => c.toUpperCase()))].filter(
    (c) => c !== "GBP"
  );
  if (unique.length === 0) return [];

  const url = `${FRANKFURTER_BASE}/latest?from=GBP&to=${unique.join(",")}`;
  const res = await fetch(url, { next: { revalidate: 0 } });

  if (!res.ok) {
    throw new Error(`Frankfurter API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as {
    rates: Record<string, number>;
    base: string;
  };

  // Frankfurter returns rates from GBP → X; we need X → GBP, so invert
  return unique.map((currency) => {
    const rateFromGbp = data.rates[currency];
    if (!rateFromGbp) {
      throw new Error(`Frankfurter did not return a rate for ${currency}`);
    }
    return {
      fromCurrency: currency,
      toCurrency: "GBP" as const,
      rate: 1 / rateFromGbp,
      source: "frankfurter" as const,
    };
  });
}

// ─── Crypto: CoinGecko ───────────────────────────────────────────────────────

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

/**
 * Fetch GBP spot prices for one or more CoinGecko coin IDs.
 * e.g. fetchCryptoPricesToGbp(["bitcoin", "ethereum"])
 *
 * Returns a map of { bitcoin: 58000, ethereum: 3200, ... }.
 */
export async function fetchCryptoPricesToGbp(
  coinIds: string[]
): Promise<FxRateResult[]> {
  const unique = [...new Set(coinIds.map((id) => id.toLowerCase()))];
  if (unique.length === 0) return [];

  const url = `${COINGECKO_BASE}/simple/price?ids=${unique.join(",")}&vs_currencies=gbp`;
  const res = await fetch(url, { next: { revalidate: 0 } });

  if (!res.ok) {
    throw new Error(`CoinGecko API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as Record<string, { gbp: number }>;

  return unique.map((coinId) => {
    const price = data[coinId]?.gbp;
    if (!price) {
      throw new Error(`CoinGecko did not return a GBP price for ${coinId}`);
    }
    return {
      fromCurrency: coinId.toUpperCase(),
      toCurrency: "GBP" as const,
      rate: price,
      source: "coingecko" as const,
    };
  });
}

// ─── Combined fetcher ────────────────────────────────────────────────────────

export interface AccountRateRequest {
  currencyCode: string;
  coingeckoId?: string | null;
}

/**
 * Given a list of active accounts, fetch all required FX rates in parallel.
 * GBP accounts are skipped (rate = 1, always).
 * Crypto accounts use CoinGecko; fiat accounts use Frankfurter.
 *
 * Returns a map of currencyCode → FxRateResult (plus GBP itself at 1:1).
 */
export async function fetchAllRatesForAccounts(
  accounts: AccountRateRequest[]
): Promise<Map<string, FxRateResult>> {
  const result = new Map<string, FxRateResult>();

  // GBP is always 1:1
  result.set("GBP", { fromCurrency: "GBP", toCurrency: "GBP", rate: 1, source: "manual" });

  const fiatCurrencies: string[] = [];
  const cryptoIds: string[] = [];
  const cryptoCurrencyMap = new Map<string, string>(); // coinId → currencyCode

  for (const acc of accounts) {
    const currency = acc.currencyCode.toUpperCase();
    if (currency === "GBP") continue;
    if (acc.coingeckoId) {
      cryptoIds.push(acc.coingeckoId);
      cryptoCurrencyMap.set(acc.coingeckoId.toLowerCase(), currency);
    } else {
      fiatCurrencies.push(currency);
    }
  }

  const [fiatRates, cryptoRates] = await Promise.all([
    fetchFiatRatesToGbp(fiatCurrencies),
    fetchCryptoPricesToGbp(cryptoIds),
  ]);

  for (const rate of fiatRates) {
    result.set(rate.fromCurrency, rate);
  }

  for (const rate of cryptoRates) {
    // CoinGecko returns coin ID as key; map back to the currency code stored on the account
    const coinId = rate.fromCurrency.toLowerCase();
    const currencyCode = cryptoCurrencyMap.get(coinId) ?? rate.fromCurrency;
    result.set(currencyCode, { ...rate, fromCurrency: currencyCode });
  }

  return result;
}
