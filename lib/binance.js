// lib/binance.js
// Uses CoinGecko public API — no geo-restrictions, no API key needed

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'

// CoinGecko coin IDs mapped to display info
export const CRYPTO_ASSETS = [
  { id: 'solana',    symbol: 'SOLUSDT',   name: 'Solana',    ticker: 'SOL'   },
  { id: 'cardano',   symbol: 'ADAUSDT',   name: 'Cardano',   ticker: 'ADA'   },
  { id: 'ethereum',  symbol: 'ETHUSDT',   name: 'Ethereum',  ticker: 'ETH'   },
  { id: 'binancecoin', symbol: 'BNBUSDT', name: 'BNB',       ticker: 'BNB'   },
  { id: 'dogecoin',  symbol: 'DOGEUSDT',  name: 'Dogecoin',  ticker: 'DOGE'  },
  { id: 'bitcoin',   symbol: 'BTCUSDT',   name: 'Bitcoin',   ticker: 'BTC'   },
  { id: 'ripple',    symbol: 'XRPUSDT',   name: 'Ripple',    ticker: 'XRP'   },
  { id: 'polkadot',  symbol: 'DOTUSDT',   name: 'Polkadot',  ticker: 'DOT'   },
  { id: 'matic-network', symbol: 'MATICUSDT', name: 'Polygon', ticker: 'MATIC' },
  { id: 'chainlink', symbol: 'LINKUSDT',  name: 'Chainlink', ticker: 'LINK'  },
]

export const TIMEFRAMES = [
  { label: '15m', value: '15m', days: 1  },
  { label: '1H',  value: '1h',  days: 2  },
  { label: '4H',  value: '4h',  days: 7  },
  { label: '1D',  value: '1d',  days: 30 },
]

// Fetch OHLC candles from CoinGecko
// CoinGecko /ohlc returns [timestamp, open, high, low, close]
// days param: 1 = ~30min candles, 7 = 4h candles, 30 = 1d candles
export async function fetchKlines(coinId, days = 7) {
  const url = `${COINGECKO_BASE}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`
  const res = await fetch(url, { next: { revalidate: 60 } })
  if (!res.ok) throw new Error(`CoinGecko error for ${coinId}: ${res.status}`)
  const data = await res.json()
  if (!Array.isArray(data) || data.length === 0) throw new Error(`No OHLC data for ${coinId}`)
  return data.map((k) => ({
    open:  k[1],
    high:  k[2],
    low:   k[3],
    close: k[4],
  }))
}

// Fetch current price + 24h change for all assets in one call (saves API quota)
export async function fetchAllPrices(ids) {
  const joined = ids.join(',')
  const url = `${COINGECKO_BASE}/simple/price?ids=${joined}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=false`
  const res = await fetch(url, { next: { revalidate: 30 } })
  if (!res.ok) throw new Error(`CoinGecko price error: ${res.status}`)
  return res.json()
  // Returns: { bitcoin: { usd: 60000, usd_24h_change: 2.3 }, ... }
}
