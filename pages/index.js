// pages/index.js — v5 (reads from Supabase cache, instant load)
import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'

const SIGNAL_CONFIG = {
  ENTRY_SIGNAL:  { label: 'Entry Signal Detected', color: '#ff4444', bg: 'rgba(255,68,68,0.12)', border: 'rgba(255,68,68,0.4)' },
  TRENDING_UP:   { label: 'Trending Up',           color: '#00e5a0', bg: 'rgba(0,229,160,0.10)', border: 'rgba(0,229,160,0.35)' },
  TRENDING_DOWN: { label: 'Trending Down',          color: '#888',    bg: 'rgba(120,120,120,0.1)', border: 'rgba(120,120,120,0.3)' },
  NEUTRAL:       { label: 'Neutral',               color: '#556',    bg: 'rgba(100,100,100,0.08)', border: 'rgba(100,100,100,0.2)' },
  ERROR:         { label: 'Error',                 color: '#333',    bg: 'transparent', border: 'transparent' },
}

function formatPrice(p) {
  if (p == null) return '—'
  if (p < 0.001) return `$${p.toFixed(6)}`
  if (p < 1)     return `$${p.toFixed(4)}`
  if (p < 100)   return `$${p.toFixed(4)}`
  return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function timeAgo(iso) {
  if (!iso) return ''
  const secs = Math.round((Date.now() - new Date(iso)) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs/60)}m ago`
  return `${Math.floor(secs/3600)}h ago`
}

function CandleBlock({ bullish }) {
  return <span style={{ display:'inline-block', width:14, height:14, borderRadius:3, background: bullish ? '#00e5a0' : '#ff4444', marginRight:3 }} />
}

function SignalBadge({ signal }) {
  const cfg = SIGNAL_CONFIG[signal] || SIGNAL_CONFIG.NEUTRAL
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, border:`1px solid ${cfg.border}`, background:cfg.bg, color:cfg.color, fontSize:11, fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase', whiteSpace:'nowrap' }}>
      <span style={{ fontSize:8 }}>{signal === 'ENTRY_SIGNAL' || signal === 'TRENDING_UP' ? '▲' : '●'}</span>
      {cfg.label}
    </span>
  )
}

function AssetRow({ asset }) {
  const tfs  = asset.timeframes ?? []
  const best = tfs.reduce((b, tf) => tf.strength > (b?.strength ?? -1) ? tf : b, null)
  const pct  = asset.priceChangePercent
  const pctColor = pct > 0 ? '#00e5a0' : pct < 0 ? '#ff4444' : '#666'

  return (
    <div style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'16px 0' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:18, fontWeight:700, color:'#fff', letterSpacing:'0.02em' }}>{asset.ticker}</span>
          <span style={{ fontSize:13, color:'#445' }}>— {asset.name}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {best && best.signal !== 'ERROR' && <SignalBadge signal={best.signal} />}
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#e8e8e0' }}>{formatPrice(asset.price)}</div>
            {pct != null && (
              <div style={{ fontSize:11, color:pctColor, marginTop:1 }}>{pct > 0 ? '+' : ''}{pct.toFixed(2)}%</div>
            )}
          </div>
        </div>
      </div>
      {tfs.map(tf => (
        <div key={tf.timeframe} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, paddingLeft:4 }}>
          <span style={{ fontSize:10, color:'#445', width:28, fontWeight:600, letterSpacing:'0.05em' }}>{tf.timeframe}</span>
          <div style={{ display:'flex', gap:2 }}>
            {tf.blocks?.map((b, i) => <CandleBlock key={i} bullish={b.bullish} />)}
          </div>
          <span style={{ fontSize:11, color: SIGNAL_CONFIG[tf.signal]?.color ?? '#555' }}>
            {SIGNAL_CONFIG[tf.signal]?.label ?? tf.signal}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function Home() {
  const [assets,   setAssets]   = useState([])
  const [loading,  setLoading]  = useState(false)
  const [seeding,  setSeeding]  = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [error,    setError]    = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/scan')
      const data = await r.json()
      if (data.seeding) {
        setSeeding(true)
        setAssets([])
      } else {
        setSeeding(false)
        setAssets(data.assets || [])
        setUpdatedAt(data.scannedAt)
      }
    } catch(e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const total = assets.length

  return (
    <>
      <Head>
        <title>PROSCAN Engine</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ minHeight:'100vh', background:'#0d0f14', color:'#c8c8c0', fontFamily:"'Inter',sans-serif" }}>

        {/* Header */}
        <div style={{ background:'#111318', borderBottom:'1px solid rgba(255,255,255,0.07)', padding:'0 24px' }}>
          <div style={{ maxWidth:960, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', height:56 }}>
            <div>
              <div style={{ fontFamily:"'Space Mono',monospace", fontSize:18, fontWeight:700, color:'#f0b429', letterSpacing:'0.08em' }}>PROSCAN ENGINE</div>
              <div style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:'#446', letterSpacing:'0.25em', marginTop:1 }}>HEIKIN-ASHI SIGNAL SCANNER</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              {updatedAt && (
                <span style={{ fontFamily:"'Space Mono',monospace", fontSize:11, color:'#445' }}>
                  {total}/{total} · updated {timeAgo(updatedAt)}
                </span>
              )}
              <button onClick={load} disabled={loading} style={{ display:'flex', alignItems:'center', gap:7, background: loading ? '#8a6a1a' : '#f0b429', color:'#0d0f14', border:'none', borderRadius:6, padding:'8px 18px', fontWeight:700, fontSize:12, letterSpacing:'0.06em', cursor: loading ? 'not-allowed' : 'pointer', fontFamily:"'Space Mono',monospace", transition:'background 0.2s' }}>
                <span style={{ fontSize:10 }}>▶</span>
                {loading ? 'LOADING…' : 'REFRESH'}
              </button>
            </div>
          </div>
        </div>

        {/* Thin gold bar */}
        <div style={{ height:2, background: loading ? 'linear-gradient(90deg,#f0b429,#f0b42966)' : 'rgba(255,255,255,0.04)' }} />

        {/* Tabs */}
        <div style={{ maxWidth:960, margin:'0 auto', padding:'0 24px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex' }}>
          {['ALL','CRYPTO'].map(tab => (
            <button key={tab} style={{ padding:'12px 20px', background:'none', border:'none', borderBottom: tab==='ALL' ? '2px solid #f0b429' : '2px solid transparent', color: tab==='ALL' ? '#f0b429' : '#445', fontSize:12, fontWeight:600, letterSpacing:'0.08em', cursor:'pointer', fontFamily:"'Space Mono',monospace" }}>{tab}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ maxWidth:960, margin:'0 auto', padding:'0 24px 60px' }}>

          {/* Seeding state */}
          {seeding && (
            <div style={{ margin:'32px 0', padding:'20px 24px', background:'rgba(240,180,41,0.07)', border:'1px solid rgba(240,180,41,0.2)', borderRadius:10 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#f0b429', fontFamily:"'Space Mono',monospace", marginBottom:8 }}>
                ▶ FIRST-TIME SETUP
              </div>
              <div style={{ fontSize:13, color:'#889', lineHeight:1.7 }}>
                The database is empty. Trigger the first data fetch by visiting:<br/>
                <span style={{ fontFamily:"'Space Mono',monospace", color:'#f0b429', fontSize:12 }}>
                  your-url.vercel.app/api/cron
                </span>
                <br/>This takes ~3 minutes. After that, data refreshes automatically every 5 minutes.
              </div>
            </div>
          )}

          {error && (
            <div style={{ margin:'24px 0', padding:'14px 18px', background:'rgba(255,68,68,0.08)', border:'1px solid rgba(255,68,68,0.2)', borderRadius:8, color:'#ff6666', fontSize:13 }}>
              Error: {error}
            </div>
          )}

          {!seeding && assets.length === 0 && !error && (
            <div style={{ padding:'60px 0', textAlign:'center', color:'#334' }}>
              <div style={{ fontSize:13, letterSpacing:'0.1em', fontFamily:"'Space Mono',monospace" }}>LOADING…</div>
            </div>
          )}

          {assets.length > 0 && (
            <div style={{ marginTop:8 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0 4px', borderBottom:'1px solid rgba(255,255,255,0.06)', marginBottom:4 }}>
                <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.12em', color:'#f0b429', fontFamily:"'Space Mono',monospace" }}>CRYPTO</span>
                <span style={{ fontSize:11, color:'#334' }}>{total} assets</span>
              </div>
              {assets.map(asset => <AssetRow key={asset.id} asset={asset} />)}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
