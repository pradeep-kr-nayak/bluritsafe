import { useEffect, useLayoutEffect, useState } from 'react'
import {
  Camera,
  Eraser,
  ScanSearch,
  WandSparkles,
} from 'lucide-react'

const unsupportedUrlPrefixes = ['chrome://', 'edge://', 'about:', 'brave://']
const DEFAULT_BLUR_INTENSITY = 10
const MIN_BLUR_INTENSITY = 2
const MAX_BLUR_INTENSITY = 24

function isUnsupportedUrl(url = '') {
  return unsupportedUrlPrefixes.some((prefix) => url.startsWith(prefix))
}

function getPageLabel(tab) {
  try {
    if (tab?.url) {
      return new URL(tab.url).hostname.replace(/^www\./, '')
    }
  } catch {}

  return tab?.title || 'Current page'
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

function isMissingReceiverError(error) {
  const message = error?.message || ''

  return (
    message.includes('Receiving end does not exist') ||
    message.includes('Could not establish connection')
  )
}

async function injectContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  })
}

async function sendToActiveTab(message, options = {}) {
  const { injectIfMissing = true } = options
  const tab = await getActiveTab()

  if (!tab?.id || !tab.url || isUnsupportedUrl(tab.url)) {
    return {
      ok: false,
      unsupported: true,
      error: 'This page does not allow extension scripts.',
    }
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, message)
    return {
      ok: true,
      tab,
      response,
    }
  } catch (error) {
    if (isMissingReceiverError(error)) {
      if (!injectIfMissing) {
        return {
          ok: false,
          tab,
          missingReceiver: true,
          error: 'Could not reach the page.',
        }
      }

      try {
        await injectContentScript(tab.id)
        const retryResponse = await chrome.tabs.sendMessage(tab.id, message)

        return {
          ok: true,
          tab,
          response: retryResponse,
        }
      } catch (retryError) {
        return {
          ok: false,
          error: retryError.message || 'Could not reach the page.',
        }
      }
    }

    return {
      ok: false,
      error: error.message || 'Could not reach the page.',
    }
  }
}

async function prepareVisibleCapture() {
  const preparation = await sendToActiveTab(
    { type: 'PREPARE_CAPTURE' },
    { injectIfMissing: false },
  )

  if (!preparation.ok && !preparation.missingReceiver) {
    return preparation
  }

  const tab = preparation.tab || (await getActiveTab())

  try {
    await chrome.runtime.sendMessage({
      type: 'CAPTURE_VISIBLE_PAGE',
      windowId: tab.windowId,
    })

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error.message || 'Capture failed.',
    }
  }
}

function PopupLogo() {
  return (
    <svg
      className="popup-logo"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      role="img"
      aria-label="Blur Capture Logo"
    >
      <defs>
        <linearGradient
          id="popup-logo-bg"
          x1="72"
          y1="72"
          x2="440"
          y2="440"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#22C55E" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>

        <linearGradient
          id="popup-logo-lens"
          x1="214"
          y1="208"
          x2="304"
          y2="302"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#22C55E" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
      </defs>

      <rect
        x="56"
        y="56"
        width="400"
        height="400"
        rx="64"
        fill="url(#popup-logo-bg)"
      />

      <g
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M132 190V132H190" />
        <path d="M322 132H380V190" />
        <path d="M380 322V380H322" />
        <path d="M190 380H132V322" />
      </g>

      <path
        d="
          M203 185
          H259
          C300 185 326 205 326 238
          C326 258 316 273 299 283
          C321 292 334 310 334 333
          C334 371 305 389 262 389
          H203
          Z
        "
        fill="#FFFFFF"
        opacity="0.18"
      />

      <path
        d="
          M230 211
          H257
          C280 211 293 221 293 239
          C293 257 280 267 257 267
          H230
          Z

          M230 300
          H262
          C287 300 301 311 301 331
          C301 351 287 362 262 362
          H230
          Z
        "
        fill="url(#popup-logo-bg)"
        fillRule="evenodd"
        opacity="0.9"
      />

      <circle cx="256" cy="256" r="64" fill="#FFFFFF" />
      <circle cx="256" cy="256" r="40" fill="url(#popup-logo-lens)" />
      <circle cx="256" cy="256" r="18" fill="#FFFFFF" />
      <circle cx="278" cy="234" r="6" fill="#FFFFFF" opacity="0.9" />
    </svg>
  )
}

function App() {
  const [blurModeEnabled, setBlurModeEnabled] = useState(false)
  const [blurredCount, setBlurredCount] = useState(0)
  const [blurIntensity, setBlurIntensity] = useState(DEFAULT_BLUR_INTENSITY)
  const [pageLabel, setPageLabel] = useState('Loading current tab...')
  const [error, setError] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [unsupported, setUnsupported] = useState(false)

  useLayoutEffect(() => {
    const popupWidth = '448px'
    const popupMinHeight = '294px'

    document.documentElement.style.width = popupWidth
    document.documentElement.style.minWidth = popupWidth
    document.documentElement.style.minHeight = popupMinHeight
    document.body.style.width = popupWidth
    document.body.style.minWidth = popupWidth
    document.body.style.minHeight = popupMinHeight

    const root = document.getElementById('root')

    if (root) {
      root.style.width = popupWidth
      root.style.minHeight = popupMinHeight
    }
  }, [])

  async function refreshState() {
    const tab = await getActiveTab()

    if (!tab?.url || isUnsupportedUrl(tab.url)) {
      setUnsupported(true)
      setPageLabel('Open any normal website to use BlurItSafe.')
      setError('')
      return
    }

    setUnsupported(false)
    setPageLabel(getPageLabel(tab))

    const result = await sendToActiveTab(
      { type: 'GET_STATE' },
      { injectIfMissing: false },
    )

    if (result.missingReceiver) {
      setError('')
      setBlurModeEnabled(false)
      setBlurredCount(0)
      setBlurIntensity(DEFAULT_BLUR_INTENSITY)
      return
    }

    if (!result.ok) {
      setError(result.error || 'Could not inspect the page.')
      return
    }

    setError('')
    setBlurModeEnabled(Boolean(result.response?.blurModeEnabled))
    setBlurredCount(Number(result.response?.blurredCount || 0))
    setBlurIntensity(Number(result.response?.blurIntensity || DEFAULT_BLUR_INTENSITY))
  }

  useEffect(() => {
    refreshState()
  }, [])

  async function handleToggleBlurMode() {
    setIsBusy(true)
    setError('')

    const result = await sendToActiveTab({
      type: 'SET_BLUR_MODE',
      enabled: !blurModeEnabled,
    })

    setIsBusy(false)

    if (!result.ok) {
      setError(result.error || 'Could not update blur mode.')
      return
    }

    const nextState = Boolean(result.response?.blurModeEnabled)
    setBlurModeEnabled(nextState)
    setBlurredCount(Number(result.response?.blurredCount || 0))

    if (nextState) {
      window.close()
    }
  }

  async function handleClearBlurs() {
    setIsBusy(true)
    setError('')

    const result = await sendToActiveTab({ type: 'CLEAR_BLURS' })

    setIsBusy(false)

    if (!result.ok) {
      setError(result.error || 'Could not clear blurred items.')
      return
    }

    setBlurredCount(0)
    setBlurModeEnabled(Boolean(result.response?.blurModeEnabled))
  }

  async function handleVisibleCapture() {
    setIsBusy(true)
    setError('')

    const result = await prepareVisibleCapture()

    setIsBusy(false)

    if (!result.ok) {
      setError(result.error || 'Could not download the screenshot.')
      return
    }

    await refreshState()
  }

  async function handleSelectionCapture() {
    setIsBusy(true)
    setError('')

    const result = await sendToActiveTab({ type: 'START_SELECTION_CAPTURE' })

    setIsBusy(false)

    if (!result.ok) {
      setError(result.error || 'Could not start area selection.')
      return
    }

    window.close()
  }

  async function handleBlurIntensityChange(event) {
    const nextValue = Number(event.target.value)
    setBlurIntensity(nextValue)
    setError('')

    const result = await sendToActiveTab({
      type: 'SET_BLUR_INTENSITY',
      value: nextValue,
    })

    if (!result.ok) {
      setError(result.error || 'Could not update blur intensity.')
      return
    }

    setBlurIntensity(Number(result.response?.blurIntensity || nextValue))
  }

  const intensityPercent =
    ((blurIntensity - MIN_BLUR_INTENSITY) / (MAX_BLUR_INTENSITY - MIN_BLUR_INTENSITY)) * 100

  return (
    <main className="popup-shell">
      <section className="dashboard-card">
        <div className="top-strip">
          <div className="brand-block">
            <div className="brand-mark" aria-hidden="true">
              <PopupLogo />
            </div>
            <div className="hero-copy">
              <h1>BlurItSafe</h1>
              <p className="hero-subtitle">Private screenshot tool for cleaner sharing</p>
            </div>
          </div>
          <div className="chip-row">
            <span className={`status-pill ${blurModeEnabled ? 'active' : ''}`}>
              {blurModeEnabled ? 'Mode on' : 'Ready'}
            </span>
            <span className="count-pill">{blurredCount}</span>
          </div>
        </div>

        <div className="hero-grid">
          <section className="dial-card">
            <div
              className="intensity-dial"
              style={{ '--dial-progress': `${intensityPercent}%` }}
            >
              <div className="intensity-core">
                <span className="dial-value">{blurIntensity}</span>
                <span className="dial-unit">px</span>
              </div>
            </div>
            <div className="dial-copy">
              <p className="mini-label">Intensity</p>
              <strong>Blur strength</strong>
            </div>
          </section>

          <section className="info-card">
            <div className="info-row">
              <span>Site</span>
              <strong title={pageLabel}>
                {unsupported ? 'Unsupported' : pageLabel}
              </strong>
            </div>
            <div className="info-row">
              <span>Blurred</span>
              <strong>{blurredCount}</strong>
            </div>
            <div className="slider-panel">
              <div className="slider-header">
                <span>Adjust blur</span>
                <strong>{blurIntensity}px</strong>
              </div>
              <input
                className="blur-slider"
                type="range"
                min={MIN_BLUR_INTENSITY}
                max={MAX_BLUR_INTENSITY}
                step="1"
                value={blurIntensity}
                disabled={unsupported || isBusy}
                onChange={handleBlurIntensityChange}
              />
            </div>
          </section>
        </div>

        <div className="action-grid">
          <button
            className="action-tile action-tile-primary"
            disabled={unsupported || isBusy}
            onClick={handleToggleBlurMode}
          >
            <span className="action-icon-wrap" aria-hidden="true">
              <WandSparkles className="action-icon" />
            </span>
            <span className="action-copy">
              <span className="action-kicker">Blur</span>
              <strong>{blurModeEnabled ? 'Stop mode' : 'Start mode'}</strong>
            </span>
          </button>

          <button
            className="action-tile"
            disabled={unsupported || isBusy || blurredCount === 0}
            onClick={handleClearBlurs}
          >
            <span className="action-icon-wrap" aria-hidden="true">
              <Eraser className="action-icon" />
            </span>
            <span className="action-copy">
              <span className="action-kicker">Reset</span>
              <strong>Clear all</strong>
            </span>
          </button>

          <button
            className="action-tile"
            disabled={unsupported || isBusy}
            onClick={handleVisibleCapture}
          >
            <span className="action-icon-wrap" aria-hidden="true">
              <Camera className="action-icon" />
            </span>
            <span className="action-copy">
              <span className="action-kicker">Capture</span>
              <strong>Visible page</strong>
            </span>
          </button>

          <button
            className="action-tile"
            disabled={unsupported || isBusy}
            onClick={handleSelectionCapture}
          >
            <span className="action-icon-wrap" aria-hidden="true">
              <ScanSearch className="action-icon" />
            </span>
            <span className="action-copy">
              <span className="action-kicker">Capture</span>
              <strong>Select area</strong>
            </span>
          </button>
        </div>

        <footer className="popup-footer">
          <div className="footer-brand-lockup">
            <div className="footer-copy">
              <p className="footer-kicker">From</p>
              <p className="footer-brand">grazytools.com</p>
            </div>
          </div>
          <p className="footer-tagline">Great &amp; Easy Tools</p>
        </footer>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}
    </main>
  )
}

export default App
