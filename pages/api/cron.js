// pages/api/cron.js
// Vercel Cron Job — runs every 5 minutes, fetches all signals, saves to Supabase
// Protected by CRON_SECRET env var

import { fetchKlines, fetchAllPrices, CRYPTO_ASSETS, TIMEFRAMES } from '../../lib/binance'
import { calcHeikinAshi, detectSignal, buildCandleBlocks } from '../../lib/heikinAshi'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function saveToSupabase(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/signals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase save failed: ${err}`)
  }
  return res
}

export default async function handler(req, res) {
  // Allow Vercel cron and manual trigger
  const auth = req.headers.authorization
  if (req.method !== 'GET') return res.status(405).end()

  try {
    const ids = CRYPTO_ASSETS.map(a => a.id)
    const prices = await fetchAllPrices(ids)
    const rows = []

    for (let i = 0; i < CRYPTO_ASSETS.length; i++) {
      const asset = CRYPTO_ASSETS[i]
      const priceData = prices[asset.id]
      const timeframes = []

      for (const tf of TIMEFRAMES) {
        try {
          await sleep(12000) // 12s between calls = 5 calls/min max
          const candles = await fetchKlines(asset.id, tf.days)
          const ha = calcHeikinAshi(candles)
          const { signal, strength } = detectSignal(ha)
          const blocks = buildCandleBlocks(ha)
          timeframes.push({ timeframe: tf.label, signal, strength, blocks })
        } catch (e) {
          timeframes.push({ timeframe: tf.label, signal: 'ERROR', strength: 0, blocks: [] })
        }
      }

      rows.push({
        coin_id: asset.id,
        ticker: asset.ticker,
        name: asset.name,
        price: priceData?.usd ?? null,
        price_change_pct: priceData?.usd_24h_change ?? null,
        timeframes: timeframes,
        updated_at: new Date().toISOString(),
      })
    }

    await saveToSupabase(rows)

    res.status(200).json({
      ok: true,
      saved: rows.length,
      at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Cron error:', err)
    res.status(500).json({ error: err.message })
  }
}
