// pages/api/scan.js — reads all assets from Supabase, grouped by type
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30')
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/signals?select=*&order=asset_type.asc,ticker.asc`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    })
    if (!r.ok) throw new Error(`Supabase read failed: ${r.status}`)
    const data = await r.json()
    if (!data || data.length === 0) return res.status(200).json({ assets: [], seeding: true })

    const assets = data.map(row => ({
      id: row.coin_id,
      ticker: row.ticker,
      name: row.name,
      assetType: row.asset_type,
      price: row.price,
      priceChangePercent: row.price_change_pct,
      timeframes: row.timeframes,
      updatedAt: row.updated_at,
    }))
    res.status(200).json({ assets, scannedAt: data[0]?.updated_at, total: assets.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
