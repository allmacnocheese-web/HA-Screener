import { useState, useEffect } from 'react'
import Head from 'next/head'

const SIG = {
  ENTRY_SIGNAL:  { label: 'Entry Signal', color: '#ff4444', bg: 'rgba(255,68,68,0.12)',   border: 'rgba(255,68,68,0.4)'   },
  TRENDING_UP:   { label: 'Trending Up',  color: '#00e5a0', bg: 'rgba(0,229,160,0.10)',  border: 'rgba(0,229,160,0.35)'  },
  TRENDING_DOWN: { label: 'Trending Down',color: '#888',    bg: 'rgba(130,130,130,0.1)', border: 'rgba(130,130,130,0.3)' },
  NEUTRAL:       { label: 'Neutral',      color: '#556',    bg: 'rgba(100,100,100,0.08)',border: 'rgba(100,100,100,0.2)' },
  ERROR:         { label: 'Error',        color: '#333',    bg: 'transparent',            border: 'transparent'          },
}

const TYPE_STYLE = {
  CRYPTO:    { bg: 'rgba(0,229,160,0.07)',    color: '#00b87a' },
  FOREX:     { bg: 'rgba(120,100,255,0.12)',  color: '#9988ff' },
  US_STOCKS: { bg: 'rgba(240,180,41,0.10)',   color: '#c89a2a' },
}

const TABS = [
  { key: 'ALL',      label: 'ALL'      },
  { key: 'CRYPTO',   label: 'CRYPTO'   },
  { key: 'FOREX',    label: 'FOREX'    },
  { key: 'US_STOCKS',label: 'US STOCKS'},
]

const fmtPrice = (p, type) => {
  if (p == null) return '—'
  if (type === 'FOREX')     return p.toFixed(4)
  if (p < 0.001) return `$${p.toFixed(6)}`
  if (p < 1)     return `$${p.toFixed(4)}`
  if (p < 100)   return `$${p.toFixed(4)}`
  return `$${p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const timeAgo = iso => {
  if (!iso) return ''
  const s = Math.round((Date.now() - new Date(iso)) / 1000)
  if (s < 60)   return `${s}s ago`
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  return `${Math.floor(s/3600)}h ago`
}

const Block = ({ bullish }) => (
  <span style={{ display:'inline-block', width:14, height:14, borderRadius:3, background: bullish ? '#00e5a0' : '#ff4444', marginRight:3 }}/>
)

const Badge = ({ signal }) => {
  const c = SIG[signal] || SIG.NEUTRAL
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, border:`1px solid ${c.border}`, background:c.bg, color:c.color, fontSize:11, fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase', whiteSpace:'nowrap' }}>
      <span style={{ fontSize:8 }}>{signal==='ENTRY_SIGNAL'||signal==='TRENDING_UP' ? '▲' : '●'}</span>
      {c.label}
    </span>
  )
}

const TypeTag = ({ type }) => {
  const s = TYPE_STYLE[type] || TYPE_STYLE.CRYPTO
  return (
    <span style={{ fontSize:9, padding:'2px 7px', borderRadius:10, fontWeight:700, letterSpacing:'0.06em', background:s.bg, color:s.color }}>
      {type === 'US_STOCKS' ? 'US' : type}
    </span>
  )
}

// ── Chart ─────────────────────────────────────────────────────────────────────
function Chart({ candles, signal }) {
  if (!candles || candles.length === 0) return (
    <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center', color:'#334', fontSize:12, fontFamily:"'Space Mono',monospace" }}>
      NO CHART DATA
    </div>
  )
  const W=660, H=200, PL=56, PR=12, PT=12, PB=28
  const cw = (W-PL-PR)/candles.length
  const bw = Math.max(1, cw*0.65)
  const highs = candles.map(c=>c.high), lows = candles.map(c=>c.low)
  const mn = Math.min(...lows)*0.9998, mx = Math.max(...highs)*1.0002
  const rng = mx - mn
  const yS = v => PT + (H-PT-PB)*(1-(v-mn)/rng)
  const xC = i => PL + i*cw + cw/2
  const labels = [0,1,2,3,4].map(i => ({ v: mn+(rng/4)*i, y: yS(mn+(rng/4)*i) }))

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:'block' }}>
      {labels.map(({v,y},i) => (
        <g key={i}>
          <line x1={PL} y1={y} x2={W-PR} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
          <text x={PL-5} y={y} textAnchor="end" dominantBaseline="central"
            style={{ fill:'#445', fontSize:9, fontFamily:'Space Mono,monospace' }}>
            {v<10 ? v.toFixed(4) : v>=1000 ? (v/1000).toFixed(1)+'k' : v.toFixed(2)}
          </text>
        </g>
      ))}
      {candles.map((c,i) => {
        const bull = c.close >= c.open, col = bull ? '#00e5a0' : '#ff4444'
        const top = yS(Math.max(c.open,c.close)), bot = yS(Math.min(c.open,c.close))
        const bh = Math.max(1, bot-top), cx = xC(i)
        return (
          <g key={i}>
            <line x1={cx} y1={yS(c.high)} x2={cx} y2={yS(c.low)} stroke={col} strokeWidth="0.8" opacity="0.5"/>
            <rect x={cx-bw/2} y={top} width={bw} height={bh} fill={col} opacity="0.85" rx="1"/>
          </g>
        )
      })}
      {(signal==='ENTRY_SIGNAL'||signal==='TRENDING_UP') && candles.slice(-4).map((_,idx) => {
        const i = candles.length-4+idx
        const c = candles[i]
        if (c.close < c.open) return null
        const col = signal==='ENTRY_SIGNAL' ? '#ff4444' : '#00e5a0'
        const y = yS(c.low) + 14
        return <polygon key={i} points={`${xC(i)},${y-8} ${xC(i)-5},${y} ${xC(i)+5},${y}`} fill={col} opacity="0.9"/>
      })}
      <line x1={PL} y1={H-PB} x2={W-PR} y2={H-PB} stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
    </svg>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ asset, onClose }) {
  const [tf, setTf] = useState(null)
  const tfs = asset.timeframes || []
  const pct = asset.priceChangePercent
  const pctColor = pct > 0 ? '#00e5a0' : pct < 0 ? '#ff4444' : '#666'

  useEffect(() => {
    if (tfs.length > 0) setTf(tfs[0].timeframe)
    const esc = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [])

  const cur = tfs.find(t => t.timeframe === tf) || tfs[0]

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.82)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#13161d', border:'1px solid rgba(255,255,255,0.1)', borderRadius:16, width:'100%', maxWidth:740, maxHeight:'90vh', overflowY:'auto' }}>

        {/* header */}
        <div style={{ padding:'20px 24px 14px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
              <span style={{ fontSize:22, fontWeight:700, color:'#fff', fontFamily:"'Space Mono',monospace" }}>{asset.ticker}</span>
              <span style={{ fontSize:13, color:'#556' }}>{asset.name}</span>
              <TypeTag type={asset.assetType}/>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <span style={{ fontSize:20, fontWeight:700, color:'#e8e8e0' }}>{fmtPrice(asset.price, asset.assetType)}</span>
              {pct != null && <span style={{ fontSize:13, color:pctColor }}>{pct>0?'+':''}{pct.toFixed(2)}%</span>}
              {cur && cur.signal !== 'ERROR' && <Badge signal={cur.signal}/>}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#556', fontSize:20, cursor:'pointer', padding:'4px 8px' }}>✕</button>
        </div>

        {/* timeframe tabs */}
        <div style={{ padding:'14px 24px 0', display:'flex', gap:8 }}>
          {tfs.map(t => (
            <button key={t.timeframe} onClick={() => setTf(t.timeframe)} style={{
              padding:'5px 16px', borderRadius:6, border:'none', cursor:'pointer',
              background: tf===t.timeframe ? '#f0b429' : 'rgba(255,255,255,0.06)',
              color:      tf===t.timeframe ? '#0d0f14' : '#667',
              fontSize:12, fontWeight:700, fontFamily:"'Space Mono',monospace", letterSpacing:'0.05em',
            }}>{t.timeframe}</button>
          ))}
        </div>

        {/* chart */}
        <div style={{ padding:'12px 16px 4px' }}>
          <Chart candles={cur?.candles} signal={cur?.signal}/>
        </div>

        {/* signal rows */}
        <div style={{ padding:'8px 24px 20px' }}>
          <div style={{ fontSize:10, color:'#334', fontFamily:"'Space Mono',monospace", marginBottom:8, letterSpacing:'0.1em' }}>SIGNAL SUMMARY</div>
          {tfs.map(t => (
            <div key={t.timeframe} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:7 }}>
              <span style={{ fontSize:10, color:'#445', width:28, fontWeight:600, fontFamily:"'Space Mono',monospace" }}>{t.timeframe}</span>
              <div style={{ display:'flex', gap:2 }}>{t.blocks?.map((b,i) => <Block key={i} bullish={b.bullish}/>)}</div>
              <span style={{ fontSize:11, color:SIG[t.signal]?.color??'#555' }}>{SIG[t.signal]?.label??t.signal}</span>
            </div>
          ))}
          <div style={{ marginTop:10, fontSize:11, color:'#334' }}>Updated {timeAgo(asset.updatedAt)} · Esc to close</div>
        </div>
      </div>
    </div>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────
function Row({ asset, onClick }) {
  const tfs  = asset.timeframes || []
  const best = tfs.reduce((b,t) => t.strength>(b?.strength??-1)?t:b, null)
  const pct  = asset.priceChangePercent
  const pctColor = pct>0 ? '#00e5a0' : pct<0 ? '#ff4444' : '#666'

  return (
    <div onClick={onClick}
      style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'16px 0', cursor:'pointer' }}
      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'}
      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:18, fontWeight:700, color:'#fff', letterSpacing:'0.02em' }}>{asset.ticker}</span>
          <span style={{ fontSize:13, color:'#445' }}>— {asset.name}</span>
          <TypeTag type={asset.assetType}/>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {best && best.signal!=='ERROR' && <Badge signal={best.signal}/>}
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#e8e8e0' }}>{fmtPrice(asset.price, asset.assetType)}</div>
            {pct!=null && <div style={{ fontSize:11, color:pctColor, marginTop:1 }}>{pct>0?'+':''}{pct.toFixed(2)}%</div>}
          </div>
          <span style={{ color:'#334', fontSize:14 }}>›</span>
        </div>
      </div>
      {tfs.map(t => (
        <div key={t.timeframe} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:5, paddingLeft:4 }}>
          <span style={{ fontSize:10, color:'#445', width:28, fontWeight:600, letterSpacing:'0.05em' }}>{t.timeframe}</span>
          <div style={{ display:'flex', gap:2 }}>{t.blocks?.map((b,i) => <Block key={i} bullish={b.bullish}/>)}</div>
          <span style={{ fontSize:11, color:SIG[t.signal]?.color??'#555' }}>{SIG[t.signal]?.label??t.signal}</span>
        </div>
      ))}
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────
function Section({ type, assets, onSelect }) {
  if (assets.length === 0) return null
  const LABELS = { CRYPTO:'CRYPTO', FOREX:'FOREX', US_STOCKS:'US STOCKS' }
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0 4px', borderBottom:'1px solid rgba(255,255,255,0.06)', marginBottom:4 }}>
        <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.12em', color:'#f0b429', fontFamily:"'Space Mono',monospace" }}>{LABELS[type]||type}</span>
        <span style={{ fontSize:11, color:'#334' }}>{assets.length} assets</span>
      </div>
      {assets.map(a => <Row key={a.id} asset={a} onClick={() => onSelect(a)}/>)}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const [assets,    setAssets]    = useState([])
  const [loading,   setLoading]   = useState(false)
  const [seeding,   setSeeding]   = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [error,     setError]     = useState(null)
  const [tab,       setTab]       = useState('ALL')
  const [modal,     setModal]     = useState(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const r = await fetch('/api/scan')
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      if (d.seeding) { setSeeding(true); setAssets([]) }
      else { setSeeding(false); setAssets(d.assets||[]); setUpdatedAt(d.scannedAt) }
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = assets.filter(a => tab==='ALL' || a.assetType===tab)
  const byType   = type => filtered.filter(a => a.assetType===type)

  return (
    <>
      <Head>
        <title>PROSCAN Engine</title>
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
        <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      </Head>

      <div style={{ minHeight:'100vh', background:'#0d0f14', color:'#c8c8c0', fontFamily:"'Inter',sans-serif" }}>

        {/* header */}
        <div style={{ background:'#111318', borderBottom:'1px solid rgba(255,255,255,0.07)', padding:'0 24px' }}>
          <div style={{ maxWidth:960, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', height:56 }}>
            <div>
              <div style={{ fontFamily:"'Space Mono',monospace", fontSize:18, fontWeight:700, color:'#f0b429', letterSpacing:'0.08em' }}>PROSCAN ENGINE</div>
              <div style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:'#446', letterSpacing:'0.25em', marginTop:1 }}>HEIKIN-ASHI SIGNAL SCANNER</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              {updatedAt && <span style={{ fontFamily:"'Space Mono',monospace", fontSize:11, color:'#445' }}>{assets.length} assets · {timeAgo(updatedAt)}</span>}
              <button onClick={load} disabled={loading} style={{ display:'flex', alignItems:'center', gap:7, background:loading?'#8a6a1a':'#f0b429', color:'#0d0f14', border:'none', borderRadius:6, padding:'8px 18px', fontWeight:700, fontSize:12, letterSpacing:'0.06em', cursor:loading?'not-allowed':'pointer', fontFamily:"'Space Mono',monospace" }}>
                <span style={{ fontSize:10 }}>▶</span>{loading?'LOADING…':'REFRESH'}
              </button>
            </div>
          </div>
        </div>

        {/* progress bar */}
        <div style={{ height:2, background:loading?'linear-gradient(90deg,#f0b429,#f0b42966)':'rgba(255,255,255,0.04)' }}/>

        {/* tabs */}
        <div style={{ maxWidth:960, margin:'0 auto', padding:'0 24px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding:'12px 16px', background:'none', border:'none', borderBottom:tab===t.key?'2px solid #f0b429':'2px solid transparent', color:tab===t.key?'#f0b429':'#445', fontSize:12, fontWeight:600, letterSpacing:'0.06em', cursor:'pointer', fontFamily:"'Space Mono',monospace", whiteSpace:'nowrap' }}>{t.label}</button>
          ))}
        </div>

        {/* content */}
        <div style={{ maxWidth:960, margin:'0 auto', padding:'0 24px 80px' }}>

          {seeding && (
            <div style={{ margin:'32px 0', padding:'20px 24px', background:'rgba(240,180,41,0.07)', border:'1px solid rgba(240,180,41,0.2)', borderRadius:10 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#f0b429', fontFamily:"'Space Mono',monospace", marginBottom:8 }}>▶ DATABASE EMPTY</div>
              <div style={{ fontSize:13, color:'#889', lineHeight:1.8 }}>
                Visit <span style={{ fontFamily:"'Space Mono',monospace", color:'#f0b429', fontSize:12 }}>your-url.vercel.app/api/cron</span> to seed all data (~8 min first run for all 3 asset classes).<br/>
                After that it auto-refreshes every 5 minutes.
              </div>
            </div>
          )}

          {error && (
            <div style={{ margin:'24px 0', padding:'14px 18px', background:'rgba(255,68,68,0.08)', border:'1px solid rgba(255,68,68,0.2)', borderRadius:8, color:'#ff6666', fontSize:13 }}>
              ⚠ {error}
            </div>
          )}

          <Section type="CRYPTO"    assets={byType('CRYPTO')}    onSelect={setModal}/>
          <Section type="FOREX"     assets={byType('FOREX')}     onSelect={setModal}/>
          <Section type="US_STOCKS" assets={byType('US_STOCKS')} onSelect={setModal}/>
        </div>
      </div>

      {modal && <Modal asset={modal} onClose={() => setModal(null)}/>}
    </>
  )
}
