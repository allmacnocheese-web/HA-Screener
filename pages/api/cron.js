// /api/cron — fetches crypto + forex + US stocks, saves to Supabase
import { CRYPTO, CRYPTO_TF, FOREX, STOCKS,
         fetchCryptoPrices, fetchCryptoOHLC,
         fetchForexPrice, fetchForexOHLC,
         fetchStockOHLC, fetchStockPrice } from '../../lib/sources'
import { calcHeikinAshi, detectSignal, getBlocks } from '../../lib/heikinAshi'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const sleep  = ms => new Promise(r => setTimeout(r, ms))

async function upsert(rows) {
  const r = await fetch(`${SB_URL}/rest/v1/signals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  })
  if (!r.ok) throw new Error(`Supabase upsert: ${await r.text()}`)
}

export default async function handler(req, res) {
  const log  = []
  const rows = []

  try {
    // ── CRYPTO ────────────────────────────────────────────────────────────
    log.push('=== CRYPTO ===')
    const prices = await fetchCryptoPrices(CRYPTO.map(a => a.id))
    log.push(`prices: ${Object.keys(prices).length} coins`)

    for (const asset of CRYPTO) {
      const p = prices[asset.id]
      const tfs = []
      for (const tf of CRYPTO_TF) {
        try {
          await sleep(12000)
          const raw = await fetchCryptoOHLC(asset.id, tf.days)
          const ha  = calcHeikinAshi(raw)
          const sig = detectSignal(ha)
          tfs.push({ timeframe: tf.label, ...sig, blocks: getBlocks(ha), candles: raw.slice(-60) })
          log.push(`  ${asset.ticker} ${tf.label}: ${sig.signal}`)
        } catch(e) {
          tfs.push({ timeframe: tf.label, signal: 'ERROR', strength: 0, blocks: [], candles: [] })
          log.push(`  ${asset.ticker} ${tf.label}: ERROR — ${e.message}`)
        }
      }
      rows.push({
        coin_id: asset.id, ticker: asset.ticker, name: asset.name,
        asset_type: 'CRYPTO', price: p?.usd ?? null,
        price_change_pct: p?.usd_24h_change ?? null,
        timeframes: tfs, updated_at: new Date().toISOString(),
      })
    }

    // ── FOREX ─────────────────────────────────────────────────────────────
    log.push('=== FOREX ===')
    const avKey = process.env.ALPHA_VANTAGE_KEY
    log.push(`ALPHA_VANTAGE_KEY: ${avKey ? `SET (${avKey.slice(0,4)}...)` : 'NOT SET ❌'}`)

    for (const fx of FOREX) {
      try {
        await sleep(15000)
        const price = await fetchForexPrice(fx.from, fx.to)
        const ohlc  = await fetchForexOHLC(fx.from, fx.to)
        const ha1d  = calcHeikinAshi(ohlc)
        const sig1d = detectSignal(ha1d)
        const ha1w  = calcHeikinAshi(ohlc.slice(-35))
        const sig1w = detectSignal(ha1w)
        const pct   = ohlc.length >= 2
          ? ((ohlc.at(-1).close - ohlc.at(-2).close) / ohlc.at(-2).close) * 100
          : null
        rows.push({
          coin_id: fx.id, ticker: fx.ticker, name: fx.name,
          asset_type: 'FOREX', price, price_change_pct: pct,
          timeframes: [
            { timeframe: '1D', ...sig1d, blocks: getBlocks(ha1d), candles: ohlc.slice(-60) },
            { timeframe: '1W', ...sig1w, blocks: getBlocks(ha1w), candles: ohlc.slice(-60) },
          ],
          updated_at: new Date().toISOString(),
        })
        log.push(`  ${fx.ticker}: ${sig1d.signal}`)
      } catch(e) {
        log.push(`  ${fx.ticker}: ERROR — ${e.message}`)
        rows.push({ coin_id: fx.id, ticker: fx.ticker, name: fx.name, asset_type: 'FOREX', price: null, price_change_pct: null, timeframes: [], updated_at: new Date().toISOString() })
      }
    }

    // ── US STOCKS ─────────────────────────────────────────────────────────
    log.push('=== US STOCKS ===')

    for (const stock of STOCKS) {
      try {
        await sleep(15000) // AV free: 5 calls/min — 15s gap keeps us safe
        const { price, change } = await fetchStockPrice(stock.ticker)
        const ohlc = await fetchStockOHLC(stock.ticker)
        await sleep(15000)

        const ha1d  = calcHeikinAshi(ohlc)
        const sig1d = detectSignal(ha1d)
        const ha1w  = calcHeikinAshi(ohlc.slice(-35))
        const sig1w = detectSignal(ha1w)

        rows.push({
          coin_id: stock.id, ticker: stock.ticker, name: stock.name,
          asset_type: 'US_STOCKS', price, price_change_pct: change,
          timeframes: [
            { timeframe: '1D', ...sig1d, blocks: getBlocks(ha1d), candles: ohlc.slice(-60) },
            { timeframe: '1W', ...sig1w, blocks: getBlocks(ha1w), candles: ohlc.slice(-60) },
          ],
          updated_at: new Date().toISOString(),
        })
        log.push(`  ${stock.ticker}: ${sig1d.signal} @ $${price}`)
      } catch(e) {
        log.push(`  ${stock.ticker}: ERROR — ${e.message}`)
        rows.push({ coin_id: stock.id, ticker: stock.ticker, name: stock.name, asset_type: 'US_STOCKS', price: null, price_change_pct: null, timeframes: [], updated_at: new Date().toISOString() })
      }
    }

    log.push(`=== SAVING ${rows.length} rows ===`)
    await upsert(rows)
    log.push('DONE ✓')

    res.status(200).json({ ok: true, total: rows.length, breakdown: { crypto: CRYPTO.length, forex: FOREX.length, stocks: STOCKS.length }, log })
  } catch(err) {
    log.push(`FATAL: ${err.message}`)
    res.status(500).json({ error: err.message, log })
  }
}
