// Single file for ALL data sources: crypto (CoinGecko) + forex (Alpha Vantage + open.er-api)

// ── CRYPTO ───────────────────────────────────────────────────────────────────
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

// ── FOREX ────────────────────────────────────────────────────────────────────
export const FOREX = [
  { id: 'eurusd', from: 'EUR', to: 'USD', ticker: 'EUR/USD', name: 'Euro / US Dollar'              },
  { id: 'gbpusd', from: 'GBP', to: 'USD', ticker: 'GBP/USD', name: 'British Pound / US Dollar'    },
  { id: 'usdjpy', from: 'USD', to: 'JPY', ticker: 'USD/JPY', name: 'US Dollar / Japanese Yen'     },
  { id: 'audusd', from: 'AUD', to: 'USD', ticker: 'AUD/USD', name: 'Australian Dollar / US Dollar' },
]

export async function fetchForexPrice(from, to) {
  const r = await fetch(`https://open.er-api.com/v6/latest/${from}`, { next: { revalidate: 60 } })
  if (!r.ok) throw new Error(`FX price ${from}/${to}: ${r.status}`)
  const d = await r.json()
  if (!d.rates?.[to]) throw new Error(`No rate for ${to}`)
  return d.rates[to]
}

export async function fetchForexOHLC(from, to) {
  const key = process.env.ALPHA_VANTAGE_KEY
  if (!key) throw new Error('ALPHA_VANTAGE_KEY not set')
  const url = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${from}&to_symbol=${to}&outputsize=compact&apikey=${key}`
  const r = await fetch(url, { next: { revalidate: 300 } })
  if (!r.ok) throw new Error(`AV ${from}/${to}: ${r.status}`)
  const d = await r.json()
  if (d['Note'])        throw new Error(`AV rate limit: ${d['Note']}`)
  if (d['Information']) throw new Error(`AV limit: ${d['Information']}`)
  const series = d['Time Series FX (Daily)']
  if (!series) throw new Error(`No AV data for ${from}/${to}: ${JSON.stringify(d).slice(0,120)}`)
  return Object.entries(series)
    .sort(([a],[b]) => new Date(a) - new Date(b))
    .map(([, v]) => ({ open: +v['1. open'], high: +v['2. high'], low: +v['3. low'], close: +v['4. close'] }))
}

// ── US STOCKS ────────────────────────────────────────────────────────────────
export const STOCKS = [
  { id: 'aapl',  ticker: 'AAPL',  name: 'Apple'            },
  { id: 'msft',  ticker: 'MSFT',  name: 'Microsoft'        },
  { id: 'nvda',  ticker: 'NVDA',  name: 'NVIDIA'           },
  { id: 'amzn',  ticker: 'AMZN',  name: 'Amazon'           },
  { id: 'googl', ticker: 'GOOGL', name: 'Alphabet'         },
  { id: 'meta',  ticker: 'META',  name: 'Meta'             },
  { id: 'tsla',  ticker: 'TSLA',  name: 'Tesla'            },
  { id: 'jpm',   ticker: 'JPM',   name: 'JPMorgan Chase'   },
  { id: 'v',     ticker: 'V',     name: 'Visa'             },
  { id: 'unh',   ticker: 'UNH',   name: 'UnitedHealth'     },
]

export async function fetchStockOHLC(symbol) {
  const key = process.env.ALPHA_VANTAGE_KEY
  if (!key) throw new Error('ALPHA_VANTAGE_KEY not set')
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${key}`
  const r = await fetch(url, { next: { revalidate: 300 } })
  if (!r.ok) throw new Error(`AV stock ${symbol}: ${r.status}`)
  const d = await r.json()
  if (d['Note'])        throw new Error(`AV rate limit`)
  if (d['Information']) throw new Error(`AV limit`)
  const series = d['Time Series (Daily)']
  if (!series) throw new Error(`No data for ${symbol}: ${JSON.stringify(d).slice(0,100)}`)
  return Object.entries(series)
    .sort(([a],[b]) => new Date(a) - new Date(b))
    .map(([, v]) => ({ open: +v['1. open'], high: +v['2. high'], low: +v['3. low'], close: +v['4. close'] }))
}

export async function fetchStockPrice(symbol) {
  const key = process.env.ALPHA_VANTAGE_KEY
  if (!key) throw new Error('ALPHA_VANTAGE_KEY not set')
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${key}`
  const r = await fetch(url, { next: { revalidate: 60 } })
  if (!r.ok) throw new Error(`AV quote ${symbol}: ${r.status}`)
  const d = await r.json()
  const q = d['Global Quote']
  if (!q || !q['05. price']) throw new Error(`No quote for ${symbol}`)
  return {
    price:  parseFloat(q['05. price']),
    change: parseFloat(q['10. change percent']?.replace('%','') || '0'),
  }
}
