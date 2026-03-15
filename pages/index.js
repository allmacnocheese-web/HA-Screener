// pages/index.js
import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'

const SIGNAL_CONFIG = {
  ENTRY_SIGNAL:      { label: 'Entry Signal Detected', color: '#ff4444', bg: 'rgba(255,68,68,0.12)', border: 'rgba(255,68,68,0.4)' },
  TRENDING_UP:       { label: 'Trending Up',           color: '#00e5a0', bg: 'rgba(0,229,160,0.10)', border: 'rgba(0,229,160,0.35)' },
  TRENDING_DOWN:     { label: 'Trending Down',         color: '#888',    bg: 'rgba(120,120,120,0.1)', border: 'rgba(120,120,120,0.3)' },
  NEUTRAL:           { label: 'Neutral',               color: '#666',    bg: 'rgba(100,100,100,0.08)', border: 'rgba(100,100,100,0.2)' },
  ERROR:             { label: 'Error',                 color: '#555',    bg: 'rgba(80,80,80,0.08)', border: 'rgba(80,80,80,0.2)' },
  INSUFFICIENT_DATA: { label: 'Loading…',             color: '#555',    bg: 'rgba(80,80,80,0.08)', border: 'rgba(80,80,80,0.2)' },
}

function formatPrice(price, ticker) {
  if (price === null) return '—'
  if (price < 0.01) return `$${price.toFixed(6)}`
  if (price < 1)    return `$${price.toFixed(4)}`
  if (price < 100)  return `$${price.toFixed(4)}`
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function CandleBlock({ bullish }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 14,
      height: 14,
      borderRadius: 3,
      background: bullish ? '#00e5a0' : '#ff4444',
      marginRight: 3,
    }} />
  )
}

function SignalBadge({ signal }) {
  const cfg = SIGNAL_CONFIG[signal] || SIGNAL_CONFIG.NEUTRAL
  const dot = signal === 'ENTRY_SIGNAL' ? '▲' : signal === 'TRENDING_UP' ? '▲' : '●'
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 10px',
      borderRadius: 20,
      border: `1px solid ${cfg.border}`,
      background: cfg.bg,
      color: cfg.color,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: 8 }}>{dot}</span>
      {cfg.label}
    </span>
  )
}

function AssetRow({ asset }) {
  const bestSignal = asset.timeframes?.reduce((best, tf) =>
    (tf.strength > (best?.strength ?? -1)) ? tf : best, null)

  const pct = asset.priceChangePercent
  const pctColor = pct > 0 ? '#00e5a0' : pct < 0 ? '#ff4444' : '#666'

  return (
    <div style={{
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      padding: '16px 0',
    }}>
      {/* Asset header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '0.02em' }}>
            {asset.ticker}
          </span>
          <span style={{ fontSize: 13, color: '#556', marginTop: 1 }}>— {asset.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {bestSignal && <SignalBadge signal={bestSignal.signal} />}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#e8e8e0' }}>
              {formatPrice(asset.price, asset.ticker)}
            </div>
            {pct !== null && (
              <div style={{ fontSize: 11, color: pctColor, marginTop: 1 }}>
                {pct > 0 ? '+' : ''}{pct?.toFixed(2)}%
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeframe rows */}
      {asset.timeframes?.map((tf) => (
        <div key={tf.timeframe} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 6,
          paddingLeft: 4,
        }}>
          <span style={{ fontSize: 10, color: '#445', width: 28, fontWeight: 600, letterSpacing: '0.05em' }}>
            {tf.timeframe}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {tf.blocks?.map((b, i) => <CandleBlock key={i} bullish={b.bullish} />)}
          </div>
          <span style={{ fontSize: 11, color: SIGNAL_CONFIG[tf.signal]?.color ?? '#555' }}>
            {SIGNAL_CONFIG[tf.signal]?.label ?? tf.signal}
          </span>
        </div>
      ))}
    </div>
  )
}

function ProgressBar({ progress }) {
  return (
    <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', margin: '0 0 0 0' }}>
      <div style={{
        height: '100%',
        width: `${progress}%`,
        background: 'linear-gradient(90deg, #f0b429, #f0b42988)',
        transition: 'width 0.4s ease',
      }} />
    </div>
  )
}

export default function Home() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)
  const [lastScan, setLastScan] = useState(null)

  const scan = useCallback(async () => {
    setLoading(true)
    setError(null)
    setProgress(10)

    // Animate progress bar
    const steps = [30, 55, 75, 90]
    let i = 0
    const timer = setInterval(() => {
      if (i < steps.length) { setProgress(steps[i]); i++ }
      else clearInterval(timer)
    }, 400)

    try {
      const res = await fetch('/api/scan')
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const json = await res.json()
      clearInterval(timer)
      setProgress(100)
      setData(json)
      setLastScan(new Date())
      setTimeout(() => setProgress(0), 600)
    } catch (err) {
      clearInterval(timer)
      setProgress(0)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { scan() }, [scan])

  const now = lastScan
    ? lastScan.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : '—'

  return (
    <>
      <Head>
        <title>PROSCAN Engine</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <div style={{
        minHeight: '100vh',
        background: '#0d0f14',
        color: '#c8c8c0',
        fontFamily: "'Inter', sans-serif",
      }}>
        {/* Header */}
        <div style={{
          background: '#111318',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          padding: '0 24px',
        }}>
          <div style={{
            maxWidth: 960,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 56,
          }}>
            <div>
              <div style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 18,
                fontWeight: 700,
                color: '#f0b429',
                letterSpacing: '0.08em',
              }}>PROSCAN ENGINE</div>
              <div style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 9,
                color: '#446',
                letterSpacing: '0.25em',
                marginTop: 1,
              }}>HEIKIN-ASHI SIGNAL SCANNER</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {data && (
                <span style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 11,
                  color: '#445',
                }}>
                  {data.total}/{data.total} 100% Last: {now}
                </span>
              )}
              <button
                onClick={scan}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  background: loading ? '#8a6a1a' : '#f0b429',
                  color: '#0d0f14',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 18px',
                  fontWeight: 700,
                  fontSize: 12,
                  letterSpacing: '0.06em',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: "'Space Mono', monospace",
                  transition: 'background 0.2s',
                }}
              >
                <span style={{ fontSize: 10 }}>▶</span>
                {loading ? 'SCANNING…' : 'SCAN MARKET'}
              </button>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <ProgressBar progress={progress} />

        {/* Tabs */}
        <div style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '0 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          gap: 0,
        }}>
          {['ALL', 'CRYPTO'].map((tab) => (
            <button key={tab} style={{
              padding: '12px 20px',
              background: 'none',
              border: 'none',
              borderBottom: tab === 'ALL' ? '2px solid #f0b429' : '2px solid transparent',
              color: tab === 'ALL' ? '#f0b429' : '#445',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.08em',
              cursor: 'pointer',
              fontFamily: "'Space Mono', monospace",
            }}>{tab}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px 60px' }}>
          {error && (
            <div style={{
              margin: '24px 0',
              padding: '14px 18px',
              background: 'rgba(255,68,68,0.08)',
              border: '1px solid rgba(255,68,68,0.25)',
              borderRadius: 8,
              color: '#ff6666',
              fontSize: 13,
            }}>
              Error: {error} — <button onClick={scan} style={{ background: 'none', border: 'none', color: '#f0b429', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
            </div>
          )}

          {!data && !error && (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#334' }}>
              <div style={{ fontSize: 13, letterSpacing: '0.1em', fontFamily: "'Space Mono', monospace" }}>
                SCANNING MARKET…
              </div>
            </div>
          )}

          {data && (
            <div style={{ marginTop: 8 }}>
              {/* Section header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 0 4px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                marginBottom: 4,
              }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: '#f0b429',
                  fontFamily: "'Space Mono', monospace",
                }}>CRYPTO</span>
                <span style={{ fontSize: 11, color: '#334' }}>{data.total} assets</span>
              </div>

              {data.assets.map((asset) => (
                <AssetRow key={asset.symbol} asset={asset} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
