// pages/api/scan.js
// Server-side API route: fetches Binance data, runs HA signal engine, returns results
 
import { fetchKlines, fetchPrice, fetch24hChange, CRYPTO_ASSETS, TIMEFRAMES } from '../../lib/binance'
import { calcHeikinAshi, detectSignal, buildCandleBlocks } from '../../lib/heikinAshi'
 
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30')
 
  try {
    const results = await Promise.all(
      CRYPTO_ASSETS.map(async (asset) => {
        try {
          // Fetch signals for all timeframes in parallel
          const [price, stats, ...timeframeData] = await Promise.all([
            fetchPrice(asset.symbol),
            fetch24hChange(asset.symbol),
            ...TIMEFRAMES.map((tf) =>
              fetchKlines(asset.symbol, tf.value, 50).then((candles) => {
                const ha = calcHeikinAshi(candles)
                const { signal, strength } = detectSignal(ha)
                const blocks = buildCandleBlocks(ha)
                return { timeframe: tf.label, signal, strength, blocks }
              })
            ),
          ])
 
          return {
            ...asset,
            price,
            prevClose: stats?.prevClose ?? null,
            priceChangePercent: stats?.priceChangePercent ?? null,
            timeframes: timeframeData,
          }
        } catch (err) {
          return {
            ...asset,
            price: null,
            prevClose: null,
            priceChangePercent: null,
            timeframes: TIMEFRAMES.map((tf) => ({
              timeframe: tf.label,
              signal: 'ERROR',
              strength: 0,
              blocks: [],
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
 
