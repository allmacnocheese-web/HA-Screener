// pages/api/scan.js
// Server-side API route: fetches CoinGecko data, runs HA signal engine, returns results

import { fetchKlines, fetchAllPrices, CRYPTO_ASSETS, TIMEFRAMES } from '../../lib/binance'
import { calcHeikinAshi, detectSignal, buildCandleBlocks } from '../../lib/heikinAshi'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30')

  try {
    // Fetch all prices in one API call
    const ids = CRYPTO_ASSETS.map((a) => a.id)
    const prices = await fetchAllPrices(ids)

    // Fetch OHLC + run signals for each asset
    const results = await Promise.all(
      CRYPTO_ASSETS.map(async (asset) => {
        try {
          const priceData = prices[asset.id]
          const price = priceData?.usd ?? null
          const priceChangePercent = priceData?.usd_24h_change ?? null

          // Fetch signals for all timeframes in parallel
          const timeframeData = await Promise.all(
            TIMEFRAMES.map(async (tf) => {
              try {
                const candles = await fetchKlines(asset.id, tf.days)
                const ha = calcHeikinAshi(candles)
                const { signal, strength } = detectSignal(ha)
                const blocks = buildCandleBlocks(ha)
                return { timeframe: tf.label, signal, strength, blocks }
              } catch {
                return { timeframe: tf.label, signal: 'ERROR', strength: 0, blocks: [] }
              }
            })
          )

          return {
            ...asset,
            price,
            prevClose: null,
            priceChangePercent,
            timeframes: timeframeData,
          }
        } catch (err) {
          return {
            ...asset,
            price: null,
            prevClose: null,
            priceChangePercent: null,
            timeframes: TIMEFRAMES.map((tf) => ({
              timeframe: tf.label, signal: 'ERROR', strength: 0, blocks: [],
            })),
            error: err.message,
          }
        }
      })
    )

    res.status(200).json({
      assets: results,
      scannedAt: new Date().toISOString(),
      total: results.length,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
