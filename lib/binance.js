// lib/binance.js
// Fetches OHLC kline data from Binance public API (no API key needed for market data)

// Binance blocks api.binance.com from Vercel/cloud IPs — fallback chain fixes this
const BINANCE_HOSTS = [
  'https://api4.binance.com/api/v3',
  'https://api3.binance.com/api/v3',
  'https://api2.binance.com/api/v3',
  'https://api1.binance.com/api/v3',
]

async function binanceFetch(path, cacheSeconds = 60) {
  let lastError
  for (const base of BINANCE_HOSTS) {
    try {
      const res = await fetch(`${base}${path}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: cacheSeconds },
      })
      if (res.ok) return res
      lastError = new Error(`HTTP ${res.status} from ${base}`)
    } catch (e) {
      lastError = e
    }
  }
  throw lastError
}

export const CRYPTO_ASSETS = [
  { symbol: 'SOLUSDT',   name: 'Solana',    ticker: 'SOL'   },
  { symbol: 'ADAUSDT',   name: 'Cardano',   ticker: 'ADA'   },
  { symbol: 'ETHUSDT',   name: 'Ethereum',  ticker: 'ETH'   },
  { symbol: 'BNBUSDT',   name: 'BNB',       ticker: 'BNB'   },
  { symbol: 'DOGEUSDT',  name: 'Dogecoin',  ticker: 'DOGE'  },
  { symbol: 'BTCUSDT',   name: 'Bitcoin',   ticker: 'BTC'   },
  { symbol: 'XRPUSDT',   name: 'Ripple',    ticker: 'XRP'   },
  { symbol: 'DOTUSDT',   name: 'Polkadot',  ticker: 'DOT'   },
  { symbol: 'MATICUSDT', name: 'Polygon',   ticker: 'MATIC' },
  { symbol: 'LINKUSDT',  name: 'Chainlink', ticker: 'LINK'  },
]

export const TIMEFRAMES = [
  { label: '15m', value: '15m' },
  { label: '1H',  value: '1h'  },
  { label: '4H',  value: '4h'  },
  { label: '1D',  value: '1d'  },
]

export async function fetchKlines(symbol, interval = '1h', limit = 50) {
  const res = await binanceFetch(
    `/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`, 60
  )
  const data = await res.json()
  return data.map((k) => ({
    open:  parseFloat(k[1]),
    high:  parseFloat(k[2]),
    low:   parseFloat(k[3]),
    close: parseFloat(k[4]),
  }))
}

export async function fetchPrice(symbol) {
  const res = await binanceFetch(`/ticker/price?symbol=${symbol}`, 10)
  const data = await res.json()
  return parseFloat(data.price)
}

export async function fetch24hChange(symbol) {
  try {
    const res = await binanceFetch(`/ticker/24hr?symbol=${symbol}`, 30)
    const data = await res.json()
    return {
      priceChangePercent: parseFloat(data.priceChangePercent),
      prevClose: parseFloat(data.prevClosePrice),
    }
  } catch {
    return null
  }
}
