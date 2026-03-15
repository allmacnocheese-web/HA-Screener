// pages/api/cron.js — v3: robust error logging, forex debug
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
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Supabase upsert failed: ${txt}`)
  }
}

export default async function handler(req, res) {
  const log = []  // collect a log so we can return it for debugging

  try {
    const rows = []

    // ── CRYPTO ──────────────────────────────────────────────
    log.push('Fetching crypto prices...')
    const prices = await fetchAllPrices(CRYPTO_ASSETS.map(a => a.id))
    log.push(`Got prices for ${Object.keys(prices).length} coins`)

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
          timeframes.push({ timeframe: tf.label, signal, strength, blocks, candles: candles.slice(-60) })
        } catch (e) {
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
      log.push(`✓ ${asset.ticker}`)
    }

    // ── FOREX ────────────────────────────────────────────────
    log.push('Starting forex...')
    const avKey = process.env.ALPHA_VANTAGE_KEY
    log.push(`Alpha Vantage key: ${avKey ? `set (${avKey.substring(0,4)}...)` : 'MISSING'}`)

    for (const fx of FOREX_ASSETS) {
      try {
        log.push(`Fetching ${fx.ticker}...`)
        await sleep(2000)

        const price = await fetchForexPrice(fx.from, fx.to)
        log.push(`  price: ${price}`)

        const ohlc = await fetchForexOHLC(fx.from, fx.to)
        log.push(`  ohlc candles: ${ohlc.length}`)

        const ha = calcHeikinAshi(ohlc)
        const { signal, strength } = detectSignal(ha)
        const blocks = buildCandleBlocks(ha)

        const weeklyOhlc = ohlc.slice(-35)
        const haW = calcHeikinAshi(weeklyOhlc)
        const sigW = detectSignal(haW)

        const pctChange = ohlc.length >= 2
          ? ((ohlc[ohlc.length-1].close - ohlc[ohlc.length-2].close) / ohlc[ohlc.length-2].close) * 100
          : null

        rows.push({
          coin_id: fx.id,
          ticker: fx.ticker,
          name: fx.name,
          asset_type: 'FOREX',
          price,
          price_change_pct: pctChange,
          timeframes: [
            { timeframe: '1D', signal, strength, blocks, candles: ohlc.slice(-60) },
            { timeframe: '1W', signal: sigW.signal, strength: sigW.strength, blocks: buildCandleBlocks(haW), candles: ohlc.slice(-60) },
          ],
          updated_at: new Date().toISOString(),
        })
        log.push(`✓ ${fx.ticker} — ${signal}`)
      } catch (e) {
        log.push(`✗ ${fx.ticker} ERROR: ${e.message}`)
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

    log.push(`Saving ${rows.length} rows to Supabase...`)
    await upsert(rows)
    log.push('Done!')

    res.status(200).json({ ok: true, saved: rows.length, log })
  } catch (err) {
    log.push(`FATAL: ${err.message}`)
    res.status(500).json({ error: err.message, log })
  }
}
