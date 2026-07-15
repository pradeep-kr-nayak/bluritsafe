function buildTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

async function downloadUrl(url, filename) {
  const downloadId = await chrome.downloads.download({
    url,
    filename,
    saveAs: true,
  })

  return downloadId
}

async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return `data:${blob.type};base64,${btoa(binary)}`
}

async function captureVisiblePage(windowId) {
  const imageUrl = await chrome.tabs.captureVisibleTab(windowId, {
    format: 'png',
  })

  await downloadUrl(imageUrl, `bluritsafe-page-${buildTimestamp()}.png`)
}

async function cropVisibleCapture(imageUrl, rect, viewport) {
  const response = await fetch(imageUrl)
  const blob = await response.blob()
  const bitmap = await createImageBitmap(blob)

  const scaleX = bitmap.width / viewport.width
  const scaleY = bitmap.height / viewport.height
  const sourceX = Math.round(rect.x * scaleX)
  const sourceY = Math.round(rect.y * scaleY)
  const sourceWidth = Math.max(1, Math.round(rect.width * scaleX))
  const sourceHeight = Math.max(1, Math.round(rect.height * scaleY))

  const safeSourceX = clamp(sourceX, 0, bitmap.width - 1)
  const safeSourceY = clamp(sourceY, 0, bitmap.height - 1)
  const safeSourceWidth = clamp(sourceWidth, 1, bitmap.width - safeSourceX)
  const safeSourceHeight = clamp(sourceHeight, 1, bitmap.height - safeSourceY)

  const canvas = new OffscreenCanvas(safeSourceWidth, safeSourceHeight)
  const context = canvas.getContext('2d')

  context.drawImage(
    bitmap,
    safeSourceX,
    safeSourceY,
    safeSourceWidth,
    safeSourceHeight,
    0,
    0,
    safeSourceWidth,
    safeSourceHeight,
  )

  return canvas.convertToBlob({ type: 'image/png' })
}

async function captureSelection(windowId, rect, viewport) {
  const imageUrl = await chrome.tabs.captureVisibleTab(windowId, {
    format: 'png',
  })

  const croppedBlob = await cropVisibleCapture(imageUrl, rect, viewport)
  const dataUrl = await blobToDataUrl(croppedBlob)
  await downloadUrl(dataUrl, `bluritsafe-selection-${buildTimestamp()}.png`)
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CAPTURE_VISIBLE_PAGE') {
    captureVisiblePage(message.windowId)
      .then(() => sendResponse({ ok: true }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error.message || 'Could not capture the visible page.',
        }),
      )

    return true
  }

  if (message.type === 'CAPTURE_SELECTION') {
    const windowId = sender.tab?.windowId ?? message.windowId

    captureSelection(windowId, message.rect, message.viewport)
      .then(() => sendResponse({ ok: true }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error.message || 'Could not capture the selected area.',
        }),
      )

    return true
  }

  return false
})
