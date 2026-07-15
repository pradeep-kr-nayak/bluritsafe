const BLURRED_CLASS = 'bluritsafe-blurred'
const ROOT_ID = 'bluritsafe-root'
const STYLE_ID = 'bluritsafe-style'
const HIGHLIGHT_ID = 'bluritsafe-highlight'
const STATUS_ID = 'bluritsafe-status'
const SELECTION_LAYER_ID = 'bluritsafe-selection-layer'
const SELECTION_BOX_ID = 'bluritsafe-selection-box'
const CAPTURE_DELAY_MS = 180
const MAX_Z_INDEX = '2147483647'
const DEFAULT_BLUR_INTENSITY = 10
const CAPTURE_UI_HIDE_MS = 900
const CONTROL_TARGETS = [
  'button',
  'a',
  'label',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="menuitem"]',
].join(', ')

const MEDIA_TARGETS = ['img', 'picture', 'svg', 'canvas', 'video', 'figure'].join(', ')
const TABLE_TARGETS = ['td', 'th', 'tr', 'thead', 'tbody', 'table'].join(', ')
const TEXT_TARGETS = [
  'pre',
  'code',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'span',
  'strong',
  'em',
  'small',
  'mark',
  'figcaption',
  'li',
].join(', ')
const CONTAINER_TARGETS = [
  'article',
  'section',
  'header',
  'footer',
  'aside',
  'main',
  'nav',
  'figure',
  'div',
].join(', ')

if (typeof window.__blurItSafeCleanup === 'function') {
  try {
    window.__blurItSafeCleanup()
  } catch {}
}

initBlurItSafe()

function initBlurItSafe() {
  removeExistingOverlayUi()

  const state = {
    blurModeEnabled: false,
    blurIntensity: DEFAULT_BLUR_INTENSITY,
    selectionModeEnabled: false,
    isDraggingSelection: false,
    isDraggingStatus: false,
    blurredElements: new Set(),
    selectionStart: null,
    selectionRect: null,
    restoreCaptureUiTimer: null,
    captureSuppressedUntil: 0,
    statusPointerId: null,
    statusOffset: { x: 0, y: 0 },
  }
  const listeners = []

  const elements = createOverlayElements()
  const overlayRoot = elements.root
  const highlightBox = elements.highlightBox
  const statusPill = elements.statusPill
  const selectionLayer = elements.selectionLayer
  const selectionBox = elements.selectionBox

  updateStatus()
  updateSelectionMode()
  applyBlurIntensity()

  addListener(document, 'mousemove', handleHover, true)
  addListener(document, 'click', handleClick, true)
  addListener(window, 'keydown', handleKeydown, true)
  addListener(selectionLayer, 'mousedown', handleSelectionStart, true)
  addListener(window, 'mousemove', handleSelectionMove, true)
  addListener(window, 'mouseup', handleSelectionEnd, true)
  addListener(statusPill, 'pointerdown', handleStatusDragStart, true)
  addListener(window, 'pointermove', handleStatusDragMove, true)
  addListener(window, 'pointerup', handleStatusDragEnd, true)

  const handleRuntimeMessage = (message, sender, sendResponse) => {
    if (message.type === 'GET_STATE') {
      sendResponse(buildStateResponse())
      return false
    }

    if (message.type === 'SET_BLUR_MODE') {
      state.blurModeEnabled = Boolean(message.enabled)
      state.selectionModeEnabled = false
      state.isDraggingSelection = false
      hideSelectionBox()
      updateStatus()
      updateSelectionMode()
      sendResponse(buildStateResponse())
      return false
    }

    if (message.type === 'SET_BLUR_INTENSITY') {
      state.blurIntensity = normalizeBlurIntensity(message.value)
      applyBlurIntensity()
      sendResponse(buildStateResponse())
      return false
    }

    if (message.type === 'CLEAR_BLURS') {
      clearBlurredElements()
      updateStatus()
      sendResponse(buildStateResponse())
      return false
    }

    if (message.type === 'START_SELECTION_CAPTURE') {
      state.blurModeEnabled = false
      state.selectionModeEnabled = true
      state.isDraggingSelection = false
      hideHighlight()
      updateStatus('Drag to select an area')
      updateSelectionMode()
      sendResponse(buildStateResponse())
      return false
    }

    if (message.type === 'PREPARE_CAPTURE') {
      prepareForCapture()
      waitForCaptureUiToSettle().then(() => sendResponse({ ok: true }))
      return true
    }

    return false
  }

  chrome.runtime.onMessage.addListener(handleRuntimeMessage)
  window.__blurItSafeCleanup = cleanup

  function addListener(target, type, handler, capture = false) {
    target.addEventListener(type, handler, capture)
    listeners.push(() => target.removeEventListener(type, handler, capture))
  }

  function cleanup() {
    clearTimeout(state.restoreCaptureUiTimer)

    while (listeners.length > 0) {
      const removeListener = listeners.pop()

      try {
        removeListener()
      } catch {}
    }

    chrome.runtime.onMessage.removeListener(handleRuntimeMessage)
    removeExistingOverlayUi()
    delete window.__blurItSafeCleanup
  }

  function buildStateResponse() {
    return {
      blurModeEnabled: state.blurModeEnabled,
      blurIntensity: state.blurIntensity,
      selectionModeEnabled: state.selectionModeEnabled,
      blurredCount: state.blurredElements.size,
    }
  }

  function createOverlayElements() {
    const root = document.createElement('div')
    root.id = ROOT_ID
    root.setAttribute('aria-hidden', 'true')
    root.innerHTML = `
      <div id="${HIGHLIGHT_ID}"></div>
      <div id="${STATUS_ID}"></div>
      <div id="${SELECTION_LAYER_ID}">
        <div id="${SELECTION_BOX_ID}"></div>
      </div>
    `

    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      #${ROOT_ID} {
        position: fixed;
        inset: 0;
        z-index: ${MAX_Z_INDEX};
        pointer-events: none;
      }

      #${HIGHLIGHT_ID} {
        position: fixed;
        display: none;
        border: 2px solid rgba(12, 111, 255, 0.95);
        background: rgba(12, 111, 255, 0.12);
        border-radius: 10px;
        box-shadow: 0 0 0 200vmax rgba(6, 18, 40, 0);
      }

      #${STATUS_ID} {
        position: fixed;
        top: 16px;
        right: 16px;
        max-width: 260px;
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(10, 24, 43, 0.92);
        color: #fff;
        font:
          600 13px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 10px 30px rgba(2, 16, 41, 0.28);
        cursor: grab;
        pointer-events: auto;
        user-select: none;
      }

      #${SELECTION_LAYER_ID} {
        position: fixed;
        inset: 0;
        display: none;
        pointer-events: none;
        cursor: crosshair;
        background: rgba(9, 20, 38, 0.12);
      }

      #${SELECTION_BOX_ID} {
        position: fixed;
        display: none;
        border: 2px dashed rgba(255, 255, 255, 0.96);
        background:
          linear-gradient(135deg, rgba(31, 120, 255, 0.35), rgba(24, 219, 176, 0.2));
        box-shadow: 0 0 0 9999px rgba(2, 15, 31, 0.35);
      }

      .${BLURRED_CLASS} {
        filter: blur(var(--bluritsafe-blur-intensity, ${DEFAULT_BLUR_INTENSITY}px)) !important;
        transition: filter 120ms ease;
      }
    `

    document.documentElement.append(root, style)

    return {
      root,
      highlightBox: root.querySelector(`#${HIGHLIGHT_ID}`),
      statusPill: root.querySelector(`#${STATUS_ID}`),
      selectionLayer: root.querySelector(`#${SELECTION_LAYER_ID}`),
      selectionBox: root.querySelector(`#${SELECTION_BOX_ID}`),
    }
  }

  function removeExistingOverlayUi() {
    document.querySelectorAll(`#${ROOT_ID}`).forEach((element) => element.remove())
    document.querySelectorAll(`#${STYLE_ID}`).forEach((element) => element.remove())
  }

  function updateStatus(message) {
    if (message) {
      statusPill.style.display = 'block'
      statusPill.textContent = message
      return
    }

    if (state.selectionModeEnabled) {
      statusPill.style.display = 'block'
      statusPill.textContent = 'Drag to select an area'
      return
    }

    if (state.blurModeEnabled) {
      statusPill.style.display = 'block'
      statusPill.textContent = 'Blur mode: click any item to blur or unblur'
      return
    }

    if (state.blurredElements.size === 0) {
      statusPill.style.display = 'none'
      return
    }

    statusPill.style.display = 'block'
    statusPill.textContent = `Blurred items: ${state.blurredElements.size}`
  }

  function updateSelectionMode() {
    selectionLayer.style.display = state.selectionModeEnabled ? 'block' : 'none'
    selectionLayer.style.pointerEvents = state.selectionModeEnabled ? 'auto' : 'none'
  }

  function applyBlurIntensity() {
    const blurValue = `${state.blurIntensity}px`

    document.documentElement.style.setProperty('--bluritsafe-blur-intensity', blurValue)

    for (const element of state.blurredElements) {
      if (!document.documentElement.contains(element)) {
        state.blurredElements.delete(element)
        continue
      }

      element.style.setProperty('--bluritsafe-blur-intensity', blurValue)
    }
  }

  function isInsideExtensionUi(node) {
    return Boolean(node?.closest?.(`#${ROOT_ID}`))
  }

  function handleHover(event) {
    if (Date.now() < state.captureSuppressedUntil) {
      hideHighlight()
      return
    }

    if (!state.blurModeEnabled || state.selectionModeEnabled) {
      hideHighlight()
      return
    }

    if (isInsideExtensionUi(event.target)) {
      hideHighlight()
      return
    }

    const target = resolveBlurTarget(event.target)

    if (!target) {
      hideHighlight()
      return
    }

    const rect = target.getBoundingClientRect()

    if (rect.width < 4 || rect.height < 4) {
      hideHighlight()
      return
    }

    highlightBox.style.display = 'block'
    highlightBox.style.top = `${rect.top}px`
    highlightBox.style.left = `${rect.left}px`
    highlightBox.style.width = `${rect.width}px`
    highlightBox.style.height = `${rect.height}px`
  }

  function handleClick(event) {
    if (!state.blurModeEnabled || state.selectionModeEnabled) {
      return
    }

    if (isInsideExtensionUi(event.target)) {
      return
    }

    const target = resolveBlurTarget(event.target)

    if (!target) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()

    toggleBlur(target)
    updateStatus()
  }

  function handleKeydown(event) {
    if (event.key !== 'Escape') {
      return
    }

    if (state.selectionModeEnabled) {
      cancelSelection()
      updateStatus('Selection cancelled')
      window.setTimeout(() => updateStatus(), 1000)
      return
    }

    if (state.blurModeEnabled) {
      state.blurModeEnabled = false
      hideHighlight()
      updateStatus('Blur mode off')
      window.setTimeout(() => updateStatus(), 1000)
    }
  }

  function handleSelectionStart(event) {
    if (!state.selectionModeEnabled) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    state.isDraggingSelection = true
    state.selectionStart = { x: event.clientX, y: event.clientY }
    state.selectionRect = { x: event.clientX, y: event.clientY, width: 0, height: 0 }
    drawSelectionRect(state.selectionRect)
  }

  function handleSelectionMove(event) {
    if (!state.selectionModeEnabled || !state.isDraggingSelection || !state.selectionStart) {
      return
    }

    const rect = getRectFromPoints(state.selectionStart, {
      x: event.clientX,
      y: event.clientY,
    })

    state.selectionRect = rect
    drawSelectionRect(rect)
  }

  function handleSelectionEnd(event) {
    if (!state.selectionModeEnabled || !state.isDraggingSelection || !state.selectionStart) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    state.isDraggingSelection = false
    const rect = getRectFromPoints(state.selectionStart, {
      x: event.clientX,
      y: event.clientY,
    })

    if (rect.width < 12 || rect.height < 12) {
      cancelSelection()
      updateStatus('Selection too small')
      window.setTimeout(() => updateStatus(), 1000)
      return
    }

    state.selectionRect = rect
    completeSelectionCapture(rect)
  }

  function handleStatusDragStart(event) {
    if (state.selectionModeEnabled) {
      return
    }

    const rect = statusPill.getBoundingClientRect()
    state.isDraggingStatus = true
    state.statusPointerId = event.pointerId
    state.statusOffset = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }

    statusPill.style.cursor = 'grabbing'
    statusPill.setPointerCapture?.(event.pointerId)
    event.preventDefault()
    event.stopPropagation()
  }

  function handleStatusDragMove(event) {
    if (!state.isDraggingStatus || state.statusPointerId !== event.pointerId) {
      return
    }

    const rect = statusPill.getBoundingClientRect()
    const maxLeft = Math.max(8, window.innerWidth - rect.width - 8)
    const maxTop = Math.max(8, window.innerHeight - rect.height - 8)
    const nextLeft = clamp(event.clientX - state.statusOffset.x, 8, maxLeft)
    const nextTop = clamp(event.clientY - state.statusOffset.y, 8, maxTop)

    statusPill.style.left = `${nextLeft}px`
    statusPill.style.top = `${nextTop}px`
    statusPill.style.right = 'auto'
  }

  function handleStatusDragEnd(event) {
    if (!state.isDraggingStatus || state.statusPointerId !== event.pointerId) {
      return
    }

    state.isDraggingStatus = false
    state.statusPointerId = null
    statusPill.style.cursor = 'grab'
    statusPill.releasePointerCapture?.(event.pointerId)
  }

  function resolveBlurTarget(node) {
    const target = node instanceof Element ? node : node?.parentElement

    if (!target || !document.documentElement.contains(target)) {
      return null
    }

    const controlTarget = target.closest(CONTROL_TARGETS)

    if (isUsableBlurTarget(controlTarget)) {
      return controlTarget
    }

    const cellTarget = target.closest('td, th')

    if (isUsableBlurTarget(cellTarget)) {
      return cellTarget
    }

    const mediaTarget = target.closest(MEDIA_TARGETS)

    if (isUsableBlurTarget(mediaTarget)) {
      return mediaTarget
    }

    const textTarget = target.closest(TEXT_TARGETS)

    if (isUsableBlurTarget(textTarget)) {
      return textTarget
    }

    const tableTarget = target.closest(TABLE_TARGETS)

    if (isUsableBlurTarget(tableTarget)) {
      return tableTarget
    }

    return pickBestContainerTarget(target)
  }

  function isUsableBlurTarget(element) {
    if (!(element instanceof Element) || isInsideExtensionUi(element)) {
      return false
    }

    if (element === document.body || element === document.documentElement) {
      return false
    }

    const rect = element.getBoundingClientRect()

    if (rect.width < 4 || rect.height < 4) {
      return false
    }

    return true
  }

  function pickBestContainerTarget(target) {
    const viewportArea = window.innerWidth * window.innerHeight
    let current = target
    let bestTarget = null
    let bestScore = Number.NEGATIVE_INFINITY
    let depth = 0

    while (current && current !== document.body && current !== document.documentElement) {
      if (isUsableBlurTarget(current) && current.matches(CONTAINER_TARGETS)) {
        const rect = current.getBoundingClientRect()
        const area = rect.width * rect.height
        const areaRatio = viewportArea > 0 ? area / viewportArea : 0
        const contentScore = current.textContent?.trim() ? 18 : 0
        const sizePenalty = areaRatio > 0.55 ? 70 : areaRatio > 0.35 ? 35 : 0
        const tagBonus = current.tagName === 'DIV' ? 14 : 20
        const score = tagBonus + contentScore - depth * 8 - sizePenalty

        if (score > bestScore) {
          bestScore = score
          bestTarget = current
        }
      }

      current = current.parentElement
      depth += 1
    }

    return bestTarget || (isUsableBlurTarget(target) ? target : null)
  }

  function toggleBlur(target) {
    const isBlurred = target.classList.toggle(BLURRED_CLASS)

    if (isBlurred) {
      target.style.setProperty('--bluritsafe-blur-intensity', `${state.blurIntensity}px`)
      state.blurredElements.add(target)
    } else {
      target.style.removeProperty('--bluritsafe-blur-intensity')
      state.blurredElements.delete(target)
    }
  }

  function clearBlurredElements() {
    for (const element of state.blurredElements) {
      element.classList.remove(BLURRED_CLASS)
      element.style.removeProperty('--bluritsafe-blur-intensity')
    }

    state.blurredElements.clear()
  }

  function normalizeBlurIntensity(value) {
    const numericValue = Number(value)

    if (!Number.isFinite(numericValue)) {
      return DEFAULT_BLUR_INTENSITY
    }

    return Math.min(24, Math.max(2, Math.round(numericValue)))
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max)
  }

  function getRectFromPoints(start, end) {
    const x = Math.min(start.x, end.x)
    const y = Math.min(start.y, end.y)
    const width = Math.abs(end.x - start.x)
    const height = Math.abs(end.y - start.y)

    return { x, y, width, height }
  }

  function drawSelectionRect(rect) {
    selectionBox.style.display = 'block'
    selectionBox.style.left = `${rect.x}px`
    selectionBox.style.top = `${rect.y}px`
    selectionBox.style.width = `${rect.width}px`
    selectionBox.style.height = `${rect.height}px`
  }

  function hideSelectionBox() {
    selectionBox.style.display = 'none'
  }

  function hideHighlight() {
    highlightBox.style.display = 'none'
  }

  function cancelSelection() {
    state.selectionModeEnabled = false
    state.isDraggingSelection = false
    state.selectionStart = null
    state.selectionRect = null
    hideSelectionBox()
    updateSelectionMode()
  }

  function prepareForCapture() {
    clearTimeout(state.restoreCaptureUiTimer)
    state.captureSuppressedUntil = Date.now() + CAPTURE_UI_HIDE_MS
    hideHighlight()
    hideSelectionBox()
    overlayRoot.style.visibility = 'hidden'

    state.restoreCaptureUiTimer = window.setTimeout(() => {
      state.captureSuppressedUntil = 0
      overlayRoot.style.visibility = 'visible'
      updateStatus()
    }, CAPTURE_UI_HIDE_MS)
  }

  function waitForCaptureUiToSettle() {
    return new Promise((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.setTimeout(resolve, CAPTURE_DELAY_MS)
        })
      })
    })
  }

  function completeSelectionCapture(rect) {
    cancelSelection()
    prepareForCapture()

    window.setTimeout(async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'CAPTURE_SELECTION',
          rect,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        })

        if (!response?.ok) {
          updateStatus(response?.error || 'Capture failed')
          window.setTimeout(() => updateStatus(), 1200)
          return
        }

        updateStatus('Selection downloaded')
        window.setTimeout(() => updateStatus(), 1200)
      } catch (error) {
        updateStatus(error.message || 'Capture failed')
        window.setTimeout(() => updateStatus(), 1200)
      }
    }, CAPTURE_DELAY_MS)
  }
}
