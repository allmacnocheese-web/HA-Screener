// lib/binance.js
// CoinGecko public API — no geo-restrictions, no API key needed

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'

export const CRYPTO_ASSETS = [
  { id: 'solana',        name: 'Solana',    ticker: 'SOL'   },
  { id: 'cardano',       name: 'Cardano',   ticker: 'ADA'   },
  { id: 'ethereum',      name: 'Ethereum',  ticker: 'ETH'   },
  { id: 'binancecoin',   name: 'BNB',       ticker: 'BNB'   },
  { id: 'dogecoin',      name: 'Dogecoin',  ticker: 'DOGE'  },
  { id: 'bitcoin',       name: 'Bitcoin',   ticker: 'BTC'   },
  { id: 'ripple',        name: 'Ripple',    ticker: 'XRP'   },
  { id: 'polkadot',      name: 'Polkadot',  ticker: 'DOT'   },
  { id: 'matic-network', name: 'Polygon',   ticker: 'MATIC' },
  { id: 'chainlink',     name: 'Chainlink', ticker: 'LINK'  },
]

// Two timeframes only: 1D (30 days data) and 1W (90 days data)
export const TIMEFRAMES = [
  { label: '1D', days: 30 },
  { label: '1W', days: 90 },
]

export async function fetchKlines(coinId, days) {
  const url = `${COINGECKO_BASE}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 300 }, // cache 5 minutes
  })
  if (res.status === 429) throw new Error('RATE_LIMITED')
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
  const data = await res.json()
  if (!Array.isArray(data) || data.length < 6) throw new Error('Insufficient data')
  return data.map((k) => ({ open: k[1], high: k[2], low: k[3], close: k[4] }))
}

export async function fetchAllPrices(ids) {
  const url = `${COINGECKO_BASE}/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 60 },
  })
  if (!res.ok) throw new Error(`Price fetch failed: ${res.status}`)
  return res.json()
}
