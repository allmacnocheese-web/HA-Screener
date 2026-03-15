// pages/api/cron.js — v2 with Forex support
import { fetchKlines, fetchAllPrices, CRYPTO_ASSETS, TIMEFRAMES } from '../../lib/binance'
import { fetchForexOHLC, fetchForexPrice, FOREX_ASSETS } from '../../lib/forex'
import { calcHeikinAshi, detectSignal, buildCandleBlocks } from '../../lib/heikinAshi'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function upsert(rows) {
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
  if (!res.ok) throw new Error(`Supabase upsert failed: ${await res.text()}`)
}

export default async function handler(req, res) {
  try {
    const rows = []

    // ── CRYPTO ──────────────────────────────────────────────
    const prices = await fetchAllPrices(CRYPTO_ASSETS.map(a => a.id))

    for (const asset of CRYPTO_ASSETS) {
      const priceData = prices[asset.id]
      const timeframes = []
      for (const tf of TIMEFRAMES) {
        try {
          await sleep(12000)
          const candles = await fetchKlines(asset.id, tf.days)
          const ha = calcHeikinAshi(candles)
          const { signal, strength } = detectSignal(ha)
          const blocks = buildCandleBlocks(ha)
          // Store raw candles too (for charting)
          timeframes.push({ timeframe: tf.label, signal, strength, blocks, candles: candles.slice(-60) })
        } catch {
          timeframes.push({ timeframe: tf.label, signal: 'ERROR', strength: 0, blocks: [], candles: [] })
        }
      }
      rows.push({
        coin_id: asset.id,
        ticker: asset.ticker,
        name: asset.name,
        asset_type: 'CRYPTO',
        price: priceData?.usd ?? null,
        price_change_pct: priceData?.usd_24h_change ?? null,
        timeframes,
        updated_at: new Date().toISOString(),
      })
    }

    // ── FOREX ────────────────────────────────────────────────
    for (const fx of FOREX_ASSETS) {
      try {
        await sleep(2000)
        const price = await fetchForexPrice(fx.from, fx.to)
        const ohlc  = await fetchForexOHLC(fx.from, fx.to)
        const ha    = calcHeikinAshi(ohlc)
        const { signal, strength } = detectSignal(ha)
        const blocks = buildCandleBlocks(ha)

        // Weekly slice (last 7 daily candles as a proxy for weekly signal)
        const weeklyOhlc = ohlc.slice(-35)
        const haW = calcHeikinAshi(weeklyOhlc)
        const sigW = detectSignal(haW)

        rows.push({
          coin_id: fx.id,
          ticker: fx.ticker,
          name: fx.name,
          asset_type: 'FOREX',
          price,
          price_change_pct: ohlc.length >= 2
            ? ((ohlc[ohlc.length-1].close - ohlc[ohlc.length-2].close) / ohlc[ohlc.length-2].close) * 100
            : null,
          timeframes: [
            { timeframe: '1D', signal, strength, blocks, candles: ohlc.slice(-60) },
            { timeframe: '1W', signal: sigW.signal, strength: sigW.strength, blocks: buildCandleBlocks(haW), candles: ohlc.slice(-60) },
          ],
          updated_at: new Date().toISOString(),
        })
      } catch (e) {
        rows.push({
          coin_id: fx.id,
          ticker: fx.ticker,
          name: fx.name,
          asset_type: 'FOREX',
          price: null,
          price_change_pct: null,
          timeframes: [],
          updated_at: new Date().toISOString(),
        })
      }
    }

    await upsert(rows)
    res.status(200).json({ ok: true, saved: rows.length, at: new Date().toISOString() })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}
