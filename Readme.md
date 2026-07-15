# BlurItSafe

Chrome extension built with React + Vite for privacy-friendly screenshots.

## What it does

- Click page elements like text blocks, tables, cards, and images to blur them.
- Toggle the same element again to remove blur.
- Download the visible page as a PNG.
- Drag to select a visible area and download just that section as a PNG.

## Local setup

```bash
npm install
npm run build
```

## Load in Chrome

1. Open `chrome://extensions`.
2. Turn on `Developer mode`.
3. Click `Load unpacked`.
4. Select the `dist` folder from this project.

## Usage

1. Open any normal website.
2. Click the `BlurItSafe` extension icon.
3. Start blur mode.
4. Click items on the page to blur or unblur them.
5. Download the visible page or choose `Select area and download`.

## Notes

- The area selection capture works on the currently visible viewport.
- Chrome internal pages like `chrome://extensions` do not allow content scripts, so the extension will not run there.
