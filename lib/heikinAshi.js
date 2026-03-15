export function calcHeikinAshi(candles) {
  const ha = []
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    const haClose = (c.open + c.high + c.low + c.close) / 4
    const haOpen  = i === 0 ? (c.open + c.close) / 2 : (ha[i-1].open + ha[i-1].close) / 2
    ha.push({ open: haOpen, high: Math.max(c.high, haOpen, haClose), low: Math.min(c.low, haOpen, haClose), close: haClose })
  }
  return ha
}

export function detectSignal(ha) {
  if (ha.length < 6) return { signal: 'NEUTRAL', strength: 0 }
  const recent = ha.slice(-6)
  const last = recent[5], prev = recent[4]
  const bull = c => c.close > c.open
  const noLow = c => Math.abs(c.low - Math.min(c.open, c.close)) < (Math.abs(c.close - c.open)) * 0.15
  const bullCount = recent.filter(bull).length
  const entry = bull(last) && bull(prev) && !bull(recent[3]) && noLow(last)
  const up    = bullCount >= 4 && noLow(last) && noLow(prev)
  const down  = recent.filter(c => !bull(c)).length >= 4
  if (entry) return { signal: 'ENTRY_SIGNAL', strength: 3 }
  if (up)    return { signal: 'TRENDING_UP',  strength: 2 }
  if (down)  return { signal: 'TRENDING_DOWN', strength: 1 }
  return { signal: 'NEUTRAL', strength: 0 }
}

export function getBlocks(ha) {
  return ha.slice(-4).map(c => ({ bullish: c.close > c.open }))
}
