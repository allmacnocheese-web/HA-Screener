// lib/binance.js
// Fetches OHLC kline data from Binance public API (no API key needed for market data)
 
const BINANCE_BASE = 'https://api.binance.com/api/v3'
 
export const CRYPTO_ASSETS = [
  { symbol: 'SOLUSDT', name: 'Solana', ticker: 'SOL' },
  { symbol: 'ADAUSDT', name: 'Cardano', ticker: 'ADA' },
  { symbol: 'ETHUSDT', name: 'Ethereum', ticker: 'ETH' },
  { symbol: 'BNBUSDT', name: 'BNB', ticker: 'BNB' },
  { symbol: 'DOGEUSDT', name: 'Dogecoin', ticker: 'DOGE' },
  { symbol: 'BTCUSDT', name: 'Bitcoin', ticker: 'BTC' },
  { symbol: 'XRPUSDT', name: 'Ripple', ticker: 'XRP' },
  { symbol: 'DOTUSDT', name: 'Polkadot', ticker: 'DOT' },
  { symbol: 'MATICUSDT', name: 'Polygon', ticker: 'MATIC' },
  { symbol: 'LINKUSDT', name: 'Chainlink', ticker: 'LINK' },
]
 
export const TIMEFRAMES = [
  { label: '15m', value: '15m' },
  { label: '1H',  value: '1h' },
  { label: '4H',  value: '4h' },
  { label: '1D',  value: '1d' },
]
 
export async function fetchKlines(symbol, interval = '1h', limit = 50) {
  const url = `${BINANCE_BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  const res = await fetch(url, { next: { revalidate: 60 } })
  if (!res.ok) throw new Error(`Binance error for ${symbol}: ${res.status}`)
  const data = await res.json()
  // Binance kline: [openTime, open, high, low, close, ...]
  return data.map((k) => ({
    open:  parseFloat(k[1]),
    high:  parseFloat(k[2]),
    low:   parseFloat(k[3]),
    close: parseFloat(k[4]),
  }))
}
 
export async function fetchPrice(symbol) {
  const url = `${BINANCE_BASE}/ticker/price?symbol=${symbol}`
  const res = await fetch(url, { next: { revalidate: 10 } })
  if (!res.ok) throw new Error(`Price error for ${symbol}`)
  const data = await res.json()
  return parseFloat(data.price)
}
 
export async function fetch24hChange(symbol) {
  const url = `${BINANCE_BASE}/ticker/24hr?symbol=${symbol}`
  const res = await fetch(url, { next: { revalidate: 30 } })
  if (!res.ok) return null
  const data = await res.json()
  return {
    priceChangePercent: parseFloat(data.priceChangePercent),
    prevClose: parseFloat(data.prevClosePrice),
  }
}
 
