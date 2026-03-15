// pages/api/signals.js
// Fetches OHLC + signals for ONE coin — called per-coin from the frontend
import { fetchKlines, TIMEFRAMES } from '../../lib/binance'
import { calcHeikinAshi, detectSignal, buildCandleBlocks } from '../../lib/heikinAshi'

export default async function handler(req, res) {
  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'Missing id' })

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=120')

  const timeframeData = []
  for (const tf of TIMEFRAMES) {
    try {
      const candles = await fetchKlines(id, tf.days)
      const ha = calcHeikinAshi(candles)
      const { signal, strength } = detectSignal(ha)
      const blocks = buildCandleBlocks(ha)
      timeframeData.push({ timeframe: tf.label, signal, strength, blocks })
    } catch (err) {
      timeframeData.push({ timeframe: tf.label, signal: 'ERROR', strength: 0, blocks: [], errorMsg: err.message })
    }
  }

  res.status(200).json({ id, timeframes: timeframeData })
}
