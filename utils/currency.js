require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const dayjs = require("dayjs");

const CACHE_FILE = path.join(__dirname, "../data/exchange_rates_cache.json");
const BASE_CURRENCY = process.env.BASE_CURRENCY || "KZT";
const INTERMEDIATE_CURRENCY = "EUR";
const EXCHANGE_API_URL = "https://api.exchangeratesapi.io/v1";

// Cache duration in milliseconds (24 hours)
const CACHE_DURATION = 24 * 60 * 60 * 1000;

// Check if API key is available
const hasApiKey = () => {
  return !!process.env.EXCHANGE_RATES_API_KEY;
};

// Ensure cache directory exists
const ensureCacheDir = () => {
  const dir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Load cached rates
const loadCache = () => {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
      return cache;
    }
  } catch (error) {
    console.error("Error loading exchange rate cache:", error);
  }
  return {};
};

// Save rates to cache
const saveCache = (cache) => {
  try {
    ensureCacheDir();
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error("Error saving exchange rate cache:", error);
  }
};

// Get exchange rate for a specific date
async function getExchangeRate(fromCurrency, date) {
  if (fromCurrency === BASE_CURRENCY) return 1;

  const dateStr = dayjs(date).format("YYYY-MM-DD");
  const cacheKey = `${fromCurrency}_${dateStr}`;

  // Load cache
  const cache = loadCache();

  // Check if cache is valid (not older than 24 hours)
  if (cache[cacheKey] && cache[cacheKey].timestamp) {
    const cacheAge = Date.now() - cache[cacheKey].timestamp;
    if (cacheAge < CACHE_DURATION) {
      return cache[cacheKey].rate;
    }
  }

  // If no API key, use cached rate or return null
  if (!hasApiKey()) {
    if (cache[cacheKey]?.rate) {
      console.log(
        `Using cached rate for ${fromCurrency} from ${dateStr} (no API key)`
      );
      return cache[cacheKey].rate;
    }
    console.log(
      `No API key available and no cached rate for ${fromCurrency} on ${dateStr}`
    );
    return null;
  }

  try {
    // Get rates for both currencies relative to EUR
    const response = await axios.get(`${EXCHANGE_API_URL}/${dateStr}`, {
      params: {
        access_key: process.env.EXCHANGE_RATES_API_KEY,
        base: INTERMEDIATE_CURRENCY,
        symbols: `${fromCurrency},${BASE_CURRENCY}`,
      },
    });

    console.log(`\nExchange rates API response for ${dateStr}:`);
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data?.rates) {
      const fromRate = response.data.rates[fromCurrency];
      const toRate = response.data.rates[BASE_CURRENCY];

      if (fromRate && toRate) {
        // Calculate rate through EUR
        // If we have 1 EUR = X USD and 1 EUR = Y KZT
        // Then 1 USD = (Y/X) KZT
        const rate = toRate / fromRate;

        // Update cache with timestamp
        cache[cacheKey] = {
          rate,
          timestamp: Date.now(),
        };
        saveCache(cache);

        console.log(
          `\nCalculated rate for ${fromCurrency} to ${BASE_CURRENCY}:`
        );
        console.log(`1 ${fromCurrency} = ${rate} ${BASE_CURRENCY}`);
        console.log(`(1 EUR = ${fromRate} ${fromCurrency})`);
        console.log(`(1 EUR = ${toRate} ${BASE_CURRENCY})`);

        return rate;
      }
    }

    // If historical rate fails, try latest rate
    try {
      const response = await axios.get(`${EXCHANGE_API_URL}/latest`, {
        params: {
          access_key: process.env.EXCHANGE_RATES_API_KEY,
          base: INTERMEDIATE_CURRENCY,
          symbols: `${fromCurrency},${BASE_CURRENCY}`,
        },
      });

      if (response.data?.rates) {
        const fromRate = response.data.rates[fromCurrency];
        const toRate = response.data.rates[BASE_CURRENCY];

        if (fromRate && toRate) {
          const rate = toRate / fromRate;

          // Update cache with timestamp
          cache[cacheKey] = {
            rate,
            timestamp: Date.now(),
          };
          saveCache(cache);

          console.log(
            `\nUsing latest calculated rate for ${fromCurrency} to ${BASE_CURRENCY}:`
          );
          console.log(`1 ${fromCurrency} = ${rate} ${BASE_CURRENCY}`);
          console.log(`(1 EUR = ${fromRate} ${fromCurrency})`);
          console.log(`(1 EUR = ${toRate} ${BASE_CURRENCY})`);

          return rate;
        }
      }
    } catch (error) {
      console.error(
        `\nError fetching latest exchange rate for ${fromCurrency}:`,
        error.message
      );
    }

    // If we have any cached rate, use it as fallback
    if (cache[cacheKey]?.rate) {
      console.log(`Using cached rate for ${fromCurrency} from ${dateStr}`);
      return cache[cacheKey].rate;
    }
  } catch (error) {
    console.error(
      `\nError fetching exchange rate for ${fromCurrency} on ${dateStr}:`,
      error.message
    );
  }

  return null;
}

// Convert amount to base currency
async function convertToBaseCurrency(amount, fromCurrency, date) {
  const rate = await getExchangeRate(fromCurrency, date);
  if (rate === null) {
    console.error(
      `Could not convert ${amount} ${fromCurrency} to ${BASE_CURRENCY}`
    );
    return amount;
  }
  return amount * rate;
}

// Format amount in specified currency
function formatCurrency(amount, currency = BASE_CURRENCY) {
  const options = {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  };

  // For KZT, we don't need decimal places
  if (currency === "KZT") {
    options.minimumFractionDigits = 0;
    options.maximumFractionDigits = 0;
  } else {
    options.minimumFractionDigits = 2;
    options.maximumFractionDigits = 2;
  }

  return new Intl.NumberFormat("en-US", options).format(amount);
}

module.exports = {
  BASE_CURRENCY,
  convertToBaseCurrency,
  formatCurrency,
  hasApiKey,
};
