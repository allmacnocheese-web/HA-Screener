// lib/binance.js
// CoinGecko public API — no geo-restrictions, no API key needed

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'

export const CRYPTO_ASSETS = [
  { id: 'solana',        symbol: 'SOLUSDT',   name: 'Solana',    ticker: 'SOL'   },
  { id: 'cardano',       symbol: 'ADAUSDT',   name: 'Cardano',   ticker: 'ADA'   },
  { id: 'ethereum',      symbol: 'ETHUSDT',   name: 'Ethereum',  ticker: 'ETH'   },
  { id: 'binancecoin',   symbol: 'BNBUSDT',   name: 'BNB',       ticker: 'BNB'   },
  { id: 'dogecoin',      symbol: 'DOGEUSDT',  name: 'Dogecoin',  ticker: 'DOGE'  },
  { id: 'bitcoin',       symbol: 'BTCUSDT',   name: 'Bitcoin',   ticker: 'BTC'   },
  { id: 'ripple',        symbol: 'XRPUSDT',   name: 'Ripple',    ticker: 'XRP'   },
  { id: 'polkadot',      symbol: 'DOTUSDT',   name: 'Polkadot',  ticker: 'DOT'   },
  { id: 'matic-network', symbol: 'MATICUSDT', name: 'Polygon',   ticker: 'MATIC' },
  { id: 'chainlink',     symbol: 'LINKUSDT',  name: 'Chainlink', ticker: 'LINK'  },
]

// Each timeframe maps to a CoinGecko OHLC days value
// CoinGecko OHLC granularity: 1d=30min, 7d=4h, 30d=1d candles
export const TIMEFRAMES = [
  { label: '15m', value: '15m', days: 1  },
  { label: '1H',  value: '1h',  days: 1  },
  { label: '4H',  value: '4h',  days: 7  },
  { label: '1D',  value: '1d',  days: 30 },
]

// Fetch OHLC candles — [timestamp, open, high, low, close]
export async function fetchKlines(coinId, days = 7) {
  const url = `${COINGECKO_BASE}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 120 },
  })
  if (res.status === 429) throw new Error('RATE_LIMITED')
  if (!res.ok) throw new Error(`CoinGecko ${res.status} for ${coinId}`)
  const data = await res.json()
  if (!Array.isArray(data) || data.length < 6) throw new Error(`Insufficient data for ${coinId}`)
  return data.map((k) => ({
    open:  k[1],
    high:  k[2],
    low:   k[3],
    close: k[4],
  }))
}

// Fetch prices for all coins in ONE call — very efficient
export async function fetchAllPrices(ids) {
  const url = `${COINGECKO_BASE}/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 30 },
  })
  if (!res.ok) throw new Error(`Price fetch failed: ${res.status}`)
  return res.json()
}
