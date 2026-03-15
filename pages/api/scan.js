// pages/api/scan.js
import { fetchKlines, fetchAllPrices, CRYPTO_ASSETS, TIMEFRAMES } from '../../lib/binance'
import { calcHeikinAshi, detectSignal, buildCandleBlocks } from '../../lib/heikinAshi'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Only fetch 2 timeframes per coin to stay within Vercel's 10s free-tier limit
// 1H uses days=1, 1D uses days=30
const ACTIVE_TIMEFRAMES = [
  { label: '1H', days: 1  },
  { label: '4H', days: 7  },
  { label: '1D', days: 30 },
]

export const config = { maxDuration: 60 } // Vercel Pro allows up to 60s; free tier ignores but doesn't break

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60')

  try {
    // One call gets all prices
    const ids = CRYPTO_ASSETS.map((a) => a.id)
    const prices = await fetchAllPrices(ids)

    const results = []

    for (const asset of CRYPTO_ASSETS) {
      const priceData = prices[asset.id]
      const price = priceData?.usd ?? null
      const priceChangePercent = priceData?.usd_24h_change ?? null

      const timeframeData = []

      for (const tf of ACTIVE_TIMEFRAMES) {
        try {
          await sleep(500) // stay under CoinGecko rate limit (30 calls/min free tier)
          const candles = await fetchKlines(asset.id, tf.days)
          const ha = calcHeikinAshi(candles)
          const { signal, strength } = detectSignal(ha)
          const blocks = buildCandleBlocks(ha)
          timeframeData.push({ timeframe: tf.label, signal, strength, blocks })
        } catch (err) {
          const label = err.message === 'RATE_LIMITED' ? 'Rate limited' : 'Error'
          timeframeData.push({ timeframe: tf.label, signal: 'ERROR', strength: 0, blocks: [], errorMsg: label })
        }
      }

      results.push({
        ...asset,
        price,
        prevClose: null,
        priceChangePercent,
        timeframes: timeframeData,
      })
    }

    res.status(200).json({
      assets: results,
      scannedAt: new Date().toISOString(),
      total: results.length,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
