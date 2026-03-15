// pages/api/scan.js — v3: explicit asset_type handling with fallback
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30')
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/signals?select=coin_id,ticker,name,asset_type,price,price_change_pct,timeframes,updated_at&order=asset_type.asc,ticker.asc`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    )
    if (!r.ok) throw new Error(`Supabase read failed: ${r.status} ${await r.text()}`)
    const data = await r.json()

    if (!data || data.length === 0) return res.status(200).json({ assets: [], seeding: true })

    const assets = data.map(row => ({
      id:                 row.coin_id,
      ticker:             row.ticker,
      name:               row.name,
      assetType:          row.asset_type || 'CRYPTO',
      price:              row.price,
      priceChangePercent: row.price_change_pct,
      timeframes:         row.timeframes || [],
      updatedAt:          row.updated_at,
    }))

    // Debug: log what asset types we have
    const types = [...new Set(assets.map(a => a.assetType))]

    res.status(200).json({
      assets,
      scannedAt: data[0]?.updated_at,
      total: assets.length,
      assetTypes: types, // helpful for debugging
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
