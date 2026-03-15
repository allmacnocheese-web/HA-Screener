// lib/heikinAshi.js
// Converts raw OHLC candles into Heikin-Ashi candles and detects signals
 
export function calcHeikinAshi(candles) {
  // candles: array of { open, high, low, close }
  const ha = []
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    const haClose = (c.open + c.high + c.low + c.close) / 4
    let haOpen
    if (i === 0) {
      haOpen = (c.open + c.close) / 2
    } else {
      haOpen = (ha[i - 1].open + ha[i - 1].close) / 2
    }
    const haHigh = Math.max(c.high, haOpen, haClose)
    const haLow = Math.min(c.low, haOpen, haClose)
    ha.push({ open: haOpen, high: haHigh, low: haLow, close: haClose })
  }
  return ha
}
 
export function detectSignal(haCandles) {
  // Need at least 6 candles for reliable signal
  if (haCandles.length < 6) return { signal: 'INSUFFICIENT_DATA', strength: 0 }
 
  const recent = haCandles.slice(-6)
  const last = recent[recent.length - 1]
  const prev = recent[recent.length - 2]
 
  // Bullish candle: close > open (green)
  const isBullish = (c) => c.close > c.open
  // No lower wick = strong momentum
  const noLowerWick = (c) => Math.abs(c.low - Math.min(c.open, c.close)) < (c.close - c.open) * 0.1
 
  const bullishCount = recent.filter(isBullish).length
  const allBullish = recent.every(isBullish)
  const lastTwoBullish = isBullish(last) && isBullish(prev)
 
  // Entry signal: reversal from bearish to bullish
  const prevBearish = !isBullish(recent[recent.length - 3])
  const entrySignal = lastTwoBullish && prevBearish && noLowerWick(last)
 
  // Trending up: 4+ consecutive bullish candles, no lower wicks
  const trendingUp = bullishCount >= 4 && noLowerWick(last) && noLowerWick(prev)
 
  // Bearish / downtrend
  const bearishCount = recent.filter((c) => !isBullish(c)).length
  const trendingDown = bearishCount >= 4
 
  if (entrySignal) return { signal: 'ENTRY_SIGNAL', strength: 3 }
  if (trendingUp) return { signal: 'TRENDING_UP', strength: 2 }
  if (trendingDown) return { signal: 'TRENDING_DOWN', strength: 1 }
  return { signal: 'NEUTRAL', strength: 0 }
}
 
export function buildCandleBlocks(haCandles) {
  // Returns last 4 candles as colour blocks for the UI
  return haCandles.slice(-4).map((c) => ({
    bullish: c.close > c.open,
  }))
}
 
