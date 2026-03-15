// /api/cron — CoinGecko for crypto, Yahoo Finance for forex + stocks
import { CRYPTO, CRYPTO_TF, FOREX, STOCKS,
         fetchCryptoPrices, fetchCryptoOHLC,
         fetchForexOHLC, fetchForexPrice,
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

function buildTfs(ohlc) {
  // 1D = full 3mo daily candles, 1W = last 35 candles as weekly proxy
  const ha1d  = calcHeikinAshi(ohlc)
  const sig1d = detectSignal(ha1d)
  const ha1w  = calcHeikinAshi(ohlc.slice(-35))
  const sig1w = detectSignal(ha1w)
  return [
    { timeframe: '1D', ...sig1d, blocks: getBlocks(ha1d), candles: ohlc.slice(-60) },
    { timeframe: '1W', ...sig1w, blocks: getBlocks(ha1w), candles: ohlc.slice(-60) },
  ]
}

export default async function handler(req, res) {
  const log  = []
  const rows = []

  try {
    // ── CRYPTO (CoinGecko, 12s gap) ───────────────────────────────────────
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

    // ── FOREX (Yahoo Finance, no rate limit) ──────────────────────────────
    log.push('=== FOREX (Yahoo Finance) ===')
    for (const fx of FOREX) {
      try {
        await sleep(500) // tiny gap just to be polite
        const [ohlc, { price, pct }] = await Promise.all([
          fetchForexOHLC(fx.symbol),
          fetchForexPrice(fx.symbol),
        ])
        log.push(`  ${fx.ticker}: price=${price.toFixed(4)}, candles=${ohlc.length}`)
        rows.push({
          coin_id: fx.id, ticker: fx.ticker, name: fx.name,
          asset_type: 'FOREX', price, price_change_pct: pct,
          timeframes: buildTfs(ohlc),
          updated_at: new Date().toISOString(),
        })
        log.push(`  ${fx.ticker}: ${detectSignal(calcHeikinAshi(ohlc)).signal}`)
      } catch(e) {
        log.push(`  ${fx.ticker}: ERROR — ${e.message}`)
        rows.push({ coin_id: fx.id, ticker: fx.ticker, name: fx.name, asset_type: 'FOREX', price: null, price_change_pct: null, timeframes: [], updated_at: new Date().toISOString() })
      }
    }

    // ── US STOCKS (Yahoo Finance, no rate limit) ───────────────────────────
    log.push('=== US STOCKS (Yahoo Finance) ===')
    for (const stock of STOCKS) {
      try {
        await sleep(500)
        const [ohlc, { price, pct }] = await Promise.all([
          fetchStockOHLC(stock.ticker),
          fetchStockPrice(stock.ticker),
        ])
        log.push(`  ${stock.ticker}: $${price.toFixed(2)}, candles=${ohlc.length}`)
        rows.push({
          coin_id: stock.id, ticker: stock.ticker, name: stock.name,
          asset_type: 'US_STOCKS', price, price_change_pct: pct,
          timeframes: buildTfs(ohlc),
          updated_at: new Date().toISOString(),
        })
        log.push(`  ${stock.ticker}: ${detectSignal(calcHeikinAshi(ohlc)).signal}`)
      } catch(e) {
        log.push(`  ${stock.ticker}: ERROR — ${e.message}`)
        rows.push({ coin_id: stock.id, ticker: stock.ticker, name: stock.name, asset_type: 'US_STOCKS', price: null, price_change_pct: null, timeframes: [], updated_at: new Date().toISOString() })
      }
    }

    log.push(`=== SAVING ${rows.length} rows ===`)
    await upsert(rows)
    log.push('ALL DONE ✓')

    res.status(200).json({
      ok: true, total: rows.length,
      breakdown: { crypto: CRYPTO.length, forex: FOREX.length, stocks: STOCKS.length },
      log,
    })
  } catch(err) {
    log.push(`FATAL: ${err.message}`)
    res.status(500).json({ error: err.message, log })
  }
}
