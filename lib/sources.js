// sources.js — CoinGecko for crypto, Yahoo Finance for forex + stocks
// No API keys needed for any of these

// ── CRYPTO (CoinGecko) ───────────────────────────────────────────────────────
export const CRYPTO = [
  { id: 'bitcoin',       ticker: 'BTC',  name: 'Bitcoin'   },
  { id: 'ethereum',      ticker: 'ETH',  name: 'Ethereum'  },
  { id: 'solana',        ticker: 'SOL',  name: 'Solana'    },
  { id: 'binancecoin',   ticker: 'BNB',  name: 'BNB'       },
  { id: 'ripple',        ticker: 'XRP',  name: 'Ripple'    },
  { id: 'cardano',       ticker: 'ADA',  name: 'Cardano'   },
  { id: 'dogecoin',      ticker: 'DOGE', name: 'Dogecoin'  },
  { id: 'chainlink',     ticker: 'LINK', name: 'Chainlink' },
  { id: 'polkadot',      ticker: 'DOT',  name: 'Polkadot'  },
  { id: 'matic-network', ticker: 'MATIC',name: 'Polygon'   },
]
export const CRYPTO_TF = [
  { label: '1D', days: 30 },
  { label: '1W', days: 90 },
]
export async function fetchCryptoPrices(ids) {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`
  const r = await fetch(url, { next: { revalidate: 60 } })
  if (!r.ok) throw new Error(`CoinGecko price: ${r.status}`)
  return r.json()
}
export async function fetchCryptoOHLC(id, days) {
  const url = `https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=${days}`
  const r = await fetch(url, { next: { revalidate: 300 } })
  if (r.status === 429) throw new Error('RATE_LIMITED')
  if (!r.ok) throw new Error(`CoinGecko OHLC ${id}: ${r.status}`)
  const data = await r.json()
  if (!Array.isArray(data) || data.length < 6) throw new Error('insufficient data')
  return data.map(k => ({ open: k[1], high: k[2], low: k[3], close: k[4] }))
}

// ── YAHOO FINANCE helper ─────────────────────────────────────────────────────
// Works for both Forex (symbol=EURUSD=X) and Stocks (symbol=AAPL)
async function yahooOHLC(symbol, range = '3mo', interval = '1d') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    next: { revalidate: 300 },
  })
  if (!r.ok) throw new Error(`Yahoo ${symbol}: ${r.status}`)
  const d = await r.json()
  const result = d?.chart?.result?.[0]
  if (!result) throw new Error(`No Yahoo data for ${symbol}`)
  const { open, high, low, close } = result.indicators.quote[0]
  const timestamps = result.timestamp
  return timestamps.map((t, i) => ({
    ts:    t,
    open:  open[i],
    high:  high[i],
    low:   low[i],
    close: close[i],
  })).filter(c => c.open != null && c.close != null) // strip null candles
}

async function yahooPrice(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    next: { revalidate: 60 },
  })
  if (!r.ok) throw new Error(`Yahoo price ${symbol}: ${r.status}`)
  const d = await r.json()
  const result = d?.chart?.result?.[0]
  if (!result) throw new Error(`No price for ${symbol}`)
  const closes = result.indicators.quote[0].close.filter(Boolean)
  const price = closes[closes.length - 1]
  const prev  = closes[closes.length - 2] ?? closes[closes.length - 1]
  const pct   = ((price - prev) / prev) * 100
  return { price, pct }
}

// ── FOREX (Yahoo Finance — no key needed) ────────────────────────────────────
// Yahoo uses EURUSD=X format for forex pairs
export const FOREX = [
  { id: 'eurusd', symbol: 'EURUSD=X', ticker: 'EUR/USD', name: 'Euro / US Dollar'               },
  { id: 'gbpusd', symbol: 'GBPUSD=X', ticker: 'GBP/USD', name: 'British Pound / US Dollar'      },
  { id: 'usdjpy', symbol: 'USDJPY=X', ticker: 'USD/JPY', name: 'US Dollar / Japanese Yen'       },
  { id: 'audusd', symbol: 'AUDUSD=X', ticker: 'AUD/USD', name: 'Australian Dollar / US Dollar'  },
]
export async function fetchForexOHLC(symbol) {
  return yahooOHLC(symbol, '3mo', '1d')
}
export async function fetchForexPrice(symbol) {
  return yahooPrice(symbol)
}

// ── US STOCKS (Yahoo Finance — no key needed) ────────────────────────────────
export const STOCKS = [
  { id: 'aapl',  ticker: 'AAPL',  name: 'Apple'          },
  { id: 'msft',  ticker: 'MSFT',  name: 'Microsoft'      },
  { id: 'nvda',  ticker: 'NVDA',  name: 'NVIDIA'         },
  { id: 'amzn',  ticker: 'AMZN',  name: 'Amazon'         },
  { id: 'googl', ticker: 'GOOGL', name: 'Alphabet'       },
  { id: 'meta',  ticker: 'META',  name: 'Meta'           },
  { id: 'tsla',  ticker: 'TSLA',  name: 'Tesla'          },
  { id: 'jpm',   ticker: 'JPM',   name: 'JPMorgan Chase' },
  { id: 'v',     ticker: 'V',     name: 'Visa'           },
  { id: 'unh',   ticker: 'UNH',   name: 'UnitedHealth'   },
]
export async function fetchStockOHLC(ticker) {
  return yahooOHLC(ticker, '3mo', '1d')
}
export async function fetchStockPrice(ticker) {
  return yahooPrice(ticker)
}
