// pages/api/scan.js
// Fetches prices only — fast, no rate limit issues
import { fetchAllPrices, CRYPTO_ASSETS } from '../../lib/binance'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30')
  try {
    const ids = CRYPTO_ASSETS.map((a) => a.id)
    const prices = await fetchAllPrices(ids)
    const assets = CRYPTO_ASSETS.map((asset) => ({
      ...asset,
      price: prices[asset.id]?.usd ?? null,
      priceChangePercent: prices[asset.id]?.usd_24h_change ?? null,
    }))
    res.status(200).json({ assets, scannedAt: new Date().toISOString(), total: assets.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
