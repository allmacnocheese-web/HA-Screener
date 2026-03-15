// pages/index.js — v6: Forex tab + clickable chart modal with HA candles + signal markers
import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'

const SIGNAL_CONFIG = {
  ENTRY_SIGNAL:  { label: 'Entry Signal Detected', color: '#ff4444', bg: 'rgba(255,68,68,0.12)', border: 'rgba(255,68,68,0.4)' },
  TRENDING_UP:   { label: 'Trending Up',           color: '#00e5a0', bg: 'rgba(0,229,160,0.10)', border: 'rgba(0,229,160,0.35)' },
  TRENDING_DOWN: { label: 'Trending Down',          color: '#888',    bg: 'rgba(120,120,120,0.1)', border: 'rgba(120,120,120,0.3)' },
  NEUTRAL:       { label: 'Neutral',               color: '#556',    bg: 'rgba(100,100,100,0.08)', border: 'rgba(100,100,100,0.2)' },
  ERROR:         { label: 'Error',                 color: '#333',    bg: 'transparent',           border: 'transparent' },
}
const TABS = ['ALL', 'CRYPTO', 'FOREX']

function formatPrice(p, isFx) {
  if (p == null) return '—'
  if (isFx) return p.toFixed(4)
  if (p < 0.001) return `$${p.toFixed(6)}`
  if (p < 1)     return `$${p.toFixed(4)}`
  if (p < 100)   return `$${p.toFixed(4)}`
  return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function timeAgo(iso) {
  if (!iso) return ''
  const s = Math.round((Date.now() - new Date(iso)) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  return `${Math.floor(s/3600)}h ago`
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

// ── Chart component ────────────────────────────────────────────────────────────
function HeikinAshiChart({ candles, signal }) {
  const svgRef = useRef(null)
  if (!candles || candles.length === 0) return (
    <div style={{ height:260, display:'flex', alignItems:'center', justifyContent:'center', color:'#334', fontSize:13 }}>No chart data available</div>
  )

  const W = 680, H = 240, PAD = { t:16, r:16, b:28, l:52 }
  const cw = (W - PAD.l - PAD.r) / candles.length
  const barW = Math.max(1, cw * 0.7)

  const highs = candles.map(c => c.high)
  const lows  = candles.map(c => c.low)
  const minP  = Math.min(...lows)  * 0.9995
  const maxP  = Math.max(...highs) * 1.0005
  const range = maxP - minP

  const yScale = v => PAD.t + (H - PAD.t - PAD.b) * (1 - (v - minP) / range)
  const xCenter = i => PAD.l + i * cw + cw / 2

  // Price labels
  const priceSteps = 5
  const priceLabels = Array.from({ length: priceSteps }, (_, i) => {
    const v = minP + (range / (priceSteps - 1)) * i
    return { v, y: yScale(v) }
  })

  // Signal markers
  const markers = []
  candles.forEach((c, i) => {
    if (signal === 'ENTRY_SIGNAL' && i === candles.length - 2) {
      markers.push({ i, type: 'entry', y: yScale(c.low) + 12 })
    }
    if (signal === 'TRENDING_UP' && i >= candles.length - 4 && c.close > c.open) {
      markers.push({ i, type: 'trend', y: yScale(c.low) + 10 })
    }
  })

  return (
    <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:'block' }}>
      {/* Grid lines */}
      {priceLabels.map(({ v, y }, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
          <text x={PAD.l - 6} y={y} textAnchor="end" dominantBaseline="central"
            style={{ fill:'#445', fontSize:10, fontFamily:'Space Mono, monospace' }}>
            {v < 10 ? v.toFixed(4) : v >= 1000 ? (v/1000).toFixed(1)+'k' : v.toFixed(2)}
          </text>
        </g>
      ))}

      {/* Candles */}
      {candles.map((c, i) => {
        const bullish = c.close >= c.open
        const color   = bullish ? '#00e5a0' : '#ff4444'
        const bodyTop = yScale(Math.max(c.open, c.close))
        const bodyBot = yScale(Math.min(c.open, c.close))
        const bodyH   = Math.max(1, bodyBot - bodyTop)
        const cx      = xCenter(i)
        return (
          <g key={i}>
            {/* Wick */}
            <line x1={cx} y1={yScale(c.high)} x2={cx} y2={yScale(c.low)}
              stroke={color} strokeWidth="1" opacity="0.6"/>
            {/* Body */}
            <rect x={cx - barW/2} y={bodyTop} width={barW} height={bodyH}
              fill={color} opacity="0.85" rx="1"/>
          </g>
        )
      })}

      {/* Signal markers */}
      {markers.map((m, i) => (
        <g key={i}>
          <polygon
            points={`${xCenter(m.i)},${m.y - 8} ${xCenter(m.i)-5},${m.y} ${xCenter(m.i)+5},${m.y}`}
            fill={m.type === 'entry' ? '#ff4444' : '#00e5a0'}
            opacity="0.9"
          />
        </g>
      ))}

      {/* Bottom axis line */}
      <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
    </svg>
  )
}

// ── Chart Modal ───────────────────────────────────────────────────────────────
function ChartModal({ asset, onClose }) {
  const [activeTf, setActiveTf] = useState(null)
  const tfs = asset.timeframes || []

  useEffect(() => {
    if (tfs.length > 0) setActiveTf(tfs[0].timeframe)
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const currentTf = tfs.find(t => t.timeframe === activeTf) || tfs[0]
  const isFx = asset.assetType === 'FOREX'
  const pct  = asset.priceChangePercent
  const pctColor = pct > 0 ? '#00e5a0' : pct < 0 ? '#ff4444' : '#666'

  return (
    <div
      onClick={onClose}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background:'#151820', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, width:'100%', maxWidth:760, maxHeight:'90vh', overflow:'auto' }}
      >
        {/* Modal header */}
        <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
              <span style={{ fontSize:24, fontWeight:700, color:'#fff', fontFamily:"'Space Mono',monospace" }}>{asset.ticker}</span>
              <span style={{ fontSize:13, color:'#556' }}>{asset.name}</span>
              <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background: isFx ? 'rgba(120,120,255,0.15)' : 'rgba(0,229,160,0.1)', color: isFx ? '#8888ff' : '#00e5a0', fontWeight:600, letterSpacing:'0.06em' }}>
                {asset.assetType}
              </span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              <span style={{ fontSize:22, fontWeight:700, color:'#e8e8e0' }}>{formatPrice(asset.price, isFx)}</span>
              {pct != null && (
                <span style={{ fontSize:13, color:pctColor }}>{pct > 0 ? '+' : ''}{pct.toFixed(2)}%</span>
              )}
              {currentTf && currentTf.signal !== 'ERROR' && <SignalBadge signal={currentTf.signal} />}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#556', fontSize:20, cursor:'pointer', padding:'4px 8px', lineHeight:1 }}>✕</button>
        </div>

        {/* Timeframe switcher */}
        <div style={{ padding:'12px 24px 0', display:'flex', gap:8 }}>
          {tfs.map(tf => (
            <button key={tf.timeframe} onClick={() => setActiveTf(tf.timeframe)} style={{
              padding:'5px 14px', borderRadius:6, border:'none', cursor:'pointer',
              background: activeTf === tf.timeframe ? '#f0b429' : 'rgba(255,255,255,0.06)',
              color: activeTf === tf.timeframe ? '#0d0f14' : '#667',
              fontSize:12, fontWeight:700, fontFamily:"'Space Mono',monospace",
              letterSpacing:'0.05em', transition:'all 0.15s',
            }}>{tf.timeframe}</button>
          ))}
        </div>

        {/* Chart */}
        <div style={{ padding:'16px 16px 8px' }}>
          <HeikinAshiChart candles={currentTf?.candles} signal={currentTf?.signal} />
        </div>

        {/* Signal rows */}
        <div style={{ padding:'8px 24px 20px' }}>
          <div style={{ fontSize:11, color:'#334', fontFamily:"'Space Mono',monospace", marginBottom:8, letterSpacing:'0.08em' }}>ALL TIMEFRAMES</div>
          {tfs.map(tf => (
            <div key={tf.timeframe} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:7 }}>
              <span style={{ fontSize:10, color:'#445', width:28, fontWeight:600, fontFamily:"'Space Mono',monospace" }}>{tf.timeframe}</span>
              <div style={{ display:'flex', gap:2 }}>
                {tf.blocks?.map((b, i) => <CandleBlock key={i} bullish={b.bullish} />)}
              </div>
              <span style={{ fontSize:11, color: SIGNAL_CONFIG[tf.signal]?.color ?? '#555' }}>
                {SIGNAL_CONFIG[tf.signal]?.label ?? tf.signal}
              </span>
            </div>
          ))}
          <div style={{ marginTop:12, fontSize:11, color:'#334' }}>
            Updated {timeAgo(asset.updatedAt)} · Click outside or press Esc to close
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Asset Row ─────────────────────────────────────────────────────────────────
function AssetRow({ asset, onClick }) {
  const tfs  = asset.timeframes || []
  const best = tfs.reduce((b, tf) => tf.strength > (b?.strength ?? -1) ? tf : b, null)
  const pct  = asset.priceChangePercent
  const isFx = asset.assetType === 'FOREX'
  const pctColor = pct > 0 ? '#00e5a0' : pct < 0 ? '#ff4444' : '#666'

  return (
    <div
      onClick={onClick}
      style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'16px 0', cursor:'pointer', transition:'background 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'}
      onMouseLeave={e => e.currentTarget.style.background='transparent'}
    >
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:18, fontWeight:700, color:'#fff', letterSpacing:'0.02em' }}>{asset.ticker}</span>
          <span style={{ fontSize:13, color:'#445' }}>— {asset.name}</span>
          <span style={{ fontSize:9, padding:'2px 6px', borderRadius:10, background: isFx ? 'rgba(120,120,255,0.1)' : 'rgba(0,229,160,0.07)', color: isFx ? '#6666cc' : '#00b87a', fontWeight:600, letterSpacing:'0.06em' }}>
            {asset.assetType}
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {best && best.signal !== 'ERROR' && <SignalBadge signal={best.signal} />}
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#e8e8e0' }}>{formatPrice(asset.price, isFx)}</div>
            {pct != null && <div style={{ fontSize:11, color:pctColor, marginTop:1 }}>{pct > 0 ? '+' : ''}{pct.toFixed(2)}%</div>}
          </div>
          <span style={{ fontSize:16, color:'#334' }}>›</span>
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [assets,    setAssets]    = useState([])
  const [loading,   setLoading]   = useState(false)
  const [seeding,   setSeeding]   = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [error,     setError]     = useState(null)
  const [tab,       setTab]       = useState('ALL')
  const [selected,  setSelected]  = useState(null) // asset for modal

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/scan')
      const data = await r.json()
      if (data.seeding) { setSeeding(true); setAssets([]) }
      else { setSeeding(false); setAssets(data.assets || []); setUpdatedAt(data.scannedAt) }
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = assets.filter(a => {
    if (tab === 'ALL')    return true
    if (tab === 'CRYPTO') return a.assetType === 'CRYPTO'
    if (tab === 'FOREX')  return a.assetType === 'FOREX'
    return true
  })

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
              {updatedAt && <span style={{ fontFamily:"'Space Mono',monospace", fontSize:11, color:'#445' }}>{assets.length} assets · {timeAgo(updatedAt)}</span>}
              <button onClick={load} disabled={loading} style={{ display:'flex', alignItems:'center', gap:7, background: loading ? '#8a6a1a' : '#f0b429', color:'#0d0f14', border:'none', borderRadius:6, padding:'8px 18px', fontWeight:700, fontSize:12, letterSpacing:'0.06em', cursor: loading ? 'not-allowed' : 'pointer', fontFamily:"'Space Mono',monospace" }}>
                <span style={{ fontSize:10 }}>▶</span>{loading ? 'LOADING…' : 'REFRESH'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ height:2, background: loading ? 'linear-gradient(90deg,#f0b429,#f0b42966)' : 'rgba(255,255,255,0.04)' }} />

        {/* Tabs */}
        <div style={{ maxWidth:960, margin:'0 auto', padding:'0 24px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding:'12px 20px', background:'none', border:'none', borderBottom: tab===t ? '2px solid #f0b429' : '2px solid transparent', color: tab===t ? '#f0b429' : '#445', fontSize:12, fontWeight:600, letterSpacing:'0.08em', cursor:'pointer', fontFamily:"'Space Mono',monospace" }}>{t}</button>
          ))}
        </div>

        {/* Asset list */}
        <div style={{ maxWidth:960, margin:'0 auto', padding:'0 24px 60px' }}>
          {seeding && (
            <div style={{ margin:'32px 0', padding:'20px 24px', background:'rgba(240,180,41,0.07)', border:'1px solid rgba(240,180,41,0.2)', borderRadius:10 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#f0b429', fontFamily:"'Space Mono',monospace", marginBottom:8 }}>▶ FIRST-TIME SETUP</div>
              <div style={{ fontSize:13, color:'#889', lineHeight:1.7 }}>
                Database is empty. Visit <span style={{ fontFamily:"'Space Mono',monospace", color:'#f0b429' }}>your-url.vercel.app/api/cron</span> to seed it. Takes ~3 min.
              </div>
            </div>
          )}
          {error && <div style={{ margin:'24px 0', padding:'14px 18px', background:'rgba(255,68,68,0.08)', border:'1px solid rgba(255,68,68,0.2)', borderRadius:8, color:'#ff6666', fontSize:13 }}>Error: {error}</div>}

          {filtered.length > 0 && (
            <>
              {['CRYPTO','FOREX'].map(type => {
                const group = filtered.filter(a => a.assetType === type)
                if (group.length === 0) return null
                return (
                  <div key={type} style={{ marginTop:8 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0 4px', borderBottom:'1px solid rgba(255,255,255,0.06)', marginBottom:4 }}>
                      <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.12em', color:'#f0b429', fontFamily:"'Space Mono',monospace" }}>{type}</span>
                      <span style={{ fontSize:11, color:'#334' }}>{group.length} assets</span>
                    </div>
                    {group.map(asset => (
                      <AssetRow key={asset.id} asset={asset} onClick={() => setSelected(asset)} />
                    ))}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* Chart modal */}
      {selected && <ChartModal asset={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
