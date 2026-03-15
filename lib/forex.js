// lib/forex.js
// Forex data via Alpha Vantage (free, 25 calls/day) for OHLC
// and exchangerate-api.com for live prices (free, no key needed)

const AV_KEY = process.env.ALPHA_VANTAGE_KEY || 'demo'
const AV_BASE = 'https://www.alphavantage.co/query'

export const FOREX_ASSETS = [
  { id: 'eurusd', from: 'EUR', to: 'USD', ticker: 'EUR/USD', name: 'Euro / US Dollar' },
  { id: 'gbpusd', from: 'GBP', to: 'USD', ticker: 'GBP/USD', name: 'British Pound / US Dollar' },
  { id: 'usdjpy', from: 'USD', to: 'JPY', ticker: 'USD/JPY', name: 'US Dollar / Japanese Yen' },
  { id: 'audusd', from: 'AUD', to: 'USD', ticker: 'AUD/USD', name: 'Australian Dollar / US Dollar' },
]

// Fetch live FX rate using free exchangerate-api (no key needed)
export async function fetchForexPrice(from, to) {
  const url = `https://open.er-api.com/v6/latest/${from}`
  const res = await fetch(url, { next: { revalidate: 60 } })
  if (!res.ok) throw new Error(`FX price error: ${res.status}`)
  const data = await res.json()
  return data.rates?.[to] ?? null
}

// Fetch daily OHLC from Alpha Vantage
export async function fetchForexOHLC(from, to, outputsize = 'compact') {
  const url = `${AV_BASE}?function=FX_DAILY&from_symbol=${from}&to_symbol=${to}&outputsize=${outputsize}&apikey=${AV_KEY}`
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`AV error: ${res.status}`)
  const data = await res.json()

  const series = data['Time Series FX (Daily)']
  if (!series) throw new Error(data['Note'] || data['Information'] || 'No OHLC data')

  return Object.entries(series)
    .sort(([a], [b]) => new Date(a) - new Date(b))
    .map(([date, v]) => ({
      date,
      open:  parseFloat(v['1. open']),
      high:  parseFloat(v['2. high']),
      low:   parseFloat(v['3. low']),
      close: parseFloat(v['4. close']),
    }))
}
