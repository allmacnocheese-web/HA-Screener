// /api/scan — reads all signals from Supabase, returns grouped by asset_type
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30')
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/signals?select=coin_id,ticker,name,asset_type,price,price_change_pct,timeframes,updated_at&order=asset_type.asc,ticker.asc`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    )
    if (!r.ok) throw new Error(`Supabase: ${r.status} ${await r.text()}`)
    const rows = await r.json()
    if (!rows.length) return res.status(200).json({ assets: [], seeding: true })

    const assets = rows.map(row => ({
      id:                 row.coin_id,
      ticker:             row.ticker,
      name:               row.name,
      assetType:          row.asset_type ?? 'CRYPTO',
      price:              row.price,
      priceChangePercent: row.price_change_pct,
      timeframes:         row.timeframes ?? [],
      updatedAt:          row.updated_at,
    }))

    res.status(200).json({
      assets,
      scannedAt:  rows[0]?.updated_at,
      total:      assets.length,
      breakdown:  { crypto: assets.filter(a=>a.assetType==='CRYPTO').length, forex: assets.filter(a=>a.assetType==='FOREX').length },
    })
  } catch(err) {
    res.status(500).json({ error: err.message })
  }
}
