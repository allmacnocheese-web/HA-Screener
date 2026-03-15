// pages/index.js — v3 (progressive signal loading)
import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'

const SIGNAL_CONFIG = {
  ENTRY_SIGNAL:  { label: 'Entry Signal Detected', color: '#ff4444', bg: 'rgba(255,68,68,0.12)', border: 'rgba(255,68,68,0.4)' },
  TRENDING_UP:   { label: 'Trending Up',           color: '#00e5a0', bg: 'rgba(0,229,160,0.10)', border: 'rgba(0,229,160,0.35)' },
  TRENDING_DOWN: { label: 'Trending Down',          color: '#888',    bg: 'rgba(120,120,120,0.1)', border: 'rgba(120,120,120,0.3)' },
  NEUTRAL:       { label: 'Neutral',               color: '#556',    bg: 'rgba(100,100,100,0.08)', border: 'rgba(100,100,100,0.2)' },
  ERROR:         { label: 'Error',                 color: '#444',    bg: 'rgba(80,80,80,0.08)', border: 'rgba(80,80,80,0.2)' },
}

function formatPrice(p) {
  if (p == null) return '—'
  if (p < 0.001) return `$${p.toFixed(6)}`
  if (p < 1)     return `$${p.toFixed(4)}`
  if (p < 100)   return `$${p.toFixed(4)}`
  return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

function AssetRow({ asset, signals }) {
  const tfs = signals?.timeframes ?? null
  const best = tfs?.reduce((b, tf) => tf.strength > (b?.strength ?? -1) ? tf : b, null)
  const pct = asset.priceChangePercent
  const pctColor = pct > 0 ? '#00e5a0' : pct < 0 ? '#ff4444' : '#666'

  return (
    <div style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'16px 0' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:18, fontWeight:700, color:'#fff', letterSpacing:'0.02em' }}>{asset.ticker}</span>
          <span style={{ fontSize:13, color:'#445' }}>— {asset.name}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {best
            ? <SignalBadge signal={best.signal} />
            : <span style={{ fontSize:11, color:'#334', fontFamily:"'Space Mono',monospace" }}>scanning…</span>
          }
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#e8e8e0' }}>{formatPrice(asset.price)}</div>
            {pct != null && (
              <div style={{ fontSize:11, color:pctColor, marginTop:1 }}>{pct > 0 ? '+' : ''}{pct.toFixed(2)}%</div>
            )}
          </div>
        </div>
      </div>

      {tfs
        ? tfs.map((tf) => (
          <div key={tf.timeframe} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, paddingLeft:4 }}>
            <span style={{ fontSize:10, color:'#445', width:28, fontWeight:600, letterSpacing:'0.05em' }}>{tf.timeframe}</span>
            <div style={{ display:'flex', gap:2 }}>
              {tf.blocks?.map((b, i) => <CandleBlock key={i} bullish={b.bullish} />)}
            </div>
            <span style={{ fontSize:11, color: SIGNAL_CONFIG[tf.signal]?.color ?? '#555' }}>
              {SIGNAL_CONFIG[tf.signal]?.label ?? tf.signal}
            </span>
          </div>
        ))
        : ['1D','1W'].map((tf) => (
          <div key={tf} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, paddingLeft:4 }}>
            <span style={{ fontSize:10, color:'#334', width:28, fontWeight:600 }}>{tf}</span>
            <span style={{ fontSize:11, color:'#334' }}>fetching…</span>
          </div>
        ))
      }
    </div>
  )
}

export default function Home() {
  const [assets, setAssets]   = useState([])
  const [signals, setSignals] = useState({})
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [lastScan, setLastScan] = useState(null)
  const [loaded, setLoaded]   = useState(0)
  const scanRef = useRef(false)

  async function scan() {
    if (scanRef.current) return
    scanRef.current = true
    setLoading(true)
    setSignals({})
    setLoaded(0)
    setProgress(5)

    try {
      // 1. Fetch all prices in one fast call
      const r = await fetch('/api/scan')
      const data = await r.json()
      setAssets(data.assets || [])
      setLastScan(new Date())
      setProgress(15)

      // 2. Fetch signals for each coin, one at a time with 1.5s gap
      const list = data.assets || []
      for (let i = 0; i < list.length; i++) {
        const coin = list[i]
        try {
          const sr = await fetch(`/api/signals?id=${coin.id}`)
          const sd = await sr.json()
          setSignals(prev => ({ ...prev, [coin.id]: sd }))
          setLoaded(i + 1)
          setProgress(15 + Math.round(((i + 1) / list.length) * 85))
        } catch (e) {
          console.error('signal error', coin.id, e)
        }
        // Wait 1.5s between coins to stay under CoinGecko rate limit
        if (i < list.length - 1) await new Promise(r => setTimeout(r, 1500))
      }
    } catch(e) {
      console.error(e)
    } finally {
      setLoading(false)
      scanRef.current = false
    }
  }

  useEffect(() => { scan() }, [])

  const now = lastScan?.toLocaleTimeString('en-SG', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }) ?? '—'
  const total = assets.length || 10

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
              {lastScan && (
                <span style={{ fontFamily:"'Space Mono',monospace", fontSize:11, color:'#445' }}>
                  {loaded}/{total} Last: {now}
                </span>
              )}
              <button onClick={() => { scanRef.current = false; scan() }} disabled={loading} style={{
                display:'flex', alignItems:'center', gap:7,
                background: loading ? '#8a6a1a' : '#f0b429', color:'#0d0f14',
                border:'none', borderRadius:6, padding:'8px 18px',
                fontWeight:700, fontSize:12, letterSpacing:'0.06em',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily:"'Space Mono',monospace", transition:'background 0.2s',
              }}>
                <span style={{ fontSize:10 }}>▶</span>
                {loading ? 'SCANNING…' : 'SCAN MARKET'}
              </button>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height:2, background:'rgba(255,255,255,0.06)' }}>
          <div style={{ height:'100%', width:`${progress}%`, background:'linear-gradient(90deg,#f0b429,#f0b42966)', transition:'width 0.5s ease' }} />
        </div>

        {/* Tabs */}
        <div style={{ maxWidth:960, margin:'0 auto', padding:'0 24px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex' }}>
          {['ALL','CRYPTO'].map(tab => (
            <button key={tab} style={{ padding:'12px 20px', background:'none', border:'none', borderBottom: tab==='ALL' ? '2px solid #f0b429' : '2px solid transparent', color: tab==='ALL' ? '#f0b429' : '#445', fontSize:12, fontWeight:600, letterSpacing:'0.08em', cursor:'pointer', fontFamily:"'Space Mono',monospace" }}>{tab}</button>
          ))}
        </div>

        {/* Asset list */}
        <div style={{ maxWidth:960, margin:'0 auto', padding:'0 24px 60px' }}>
          {assets.length === 0 && (
            <div style={{ padding:'60px 0', textAlign:'center', color:'#334' }}>
              <div style={{ fontSize:13, letterSpacing:'0.1em', fontFamily:"'Space Mono',monospace" }}>SCANNING MARKET…</div>
            </div>
          )}
          {assets.length > 0 && (
            <div style={{ marginTop:8 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0 4px', borderBottom:'1px solid rgba(255,255,255,0.06)', marginBottom:4 }}>
                <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.12em', color:'#f0b429', fontFamily:"'Space Mono',monospace" }}>CRYPTO</span>
                <span style={{ fontSize:11, color:'#334' }}>{total} assets</span>
              </div>
              {assets.map(asset => (
                <AssetRow key={asset.id} asset={asset} signals={signals[asset.id] ?? null} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
