# GSplat Compare

A professional **3D Gaussian Splatting comparison viewer** built with [Three.js](https://threejs.org/) and [Spark](https://sparkjs.dev/). Load and compare multiple local `.splat` scenes side-by-side with synchronized cameras — perfect for evaluating rendering quality between different training configurations (e.g. Baseline vs FM-LLPS).

![GSplat Compare UI](public/web-demo.png)

---

## Features

- 🖼 **Flexible layouts** — Single, vertical split (2-panel), or quad grid (4-panel)
- 🖱 **Drag & Drop loading** — Drag scene cards from the sidebar onto any panel
- 🔄 **Synchronized cameras** — Orbit in one panel and all others follow in real time (toggle on/off)
- 📊 **Metric badges** — PSNR, SSIM, FM-LLPS scores displayed per panel
- 💾 **Session persistence** — Layout, panel assignments, and sync state survive page refresh (localStorage)
- 🌑 **Dark mode by default** — Premium dark theme with OKLCH color system
- ⚡ **Vite + pnpm** — Fast dev server with HMR

---

## Tech Stack

| Layer | Library |
|---|---|
| 3D Rendering | [Three.js](https://threejs.org/) |
| Splat Renderer | [@sparkjsdev/spark](https://sparkjs.dev/) |
| Camera Controls | `three/examples/jsm/controls/OrbitControls` |
| Bundler | [Vite](https://vitejs.dev/) |
| Styling | Vanilla CSS |
| Package Manager | [pnpm](https://pnpm.io/) |

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- pnpm (`npm install -g pnpm`)

### Install & Run

```bash
# Clone the repo
git clone https://github.com/your-username/gsplat-web.git
cd gsplat-web

# Install dependencies
pnpm install

# Start the dev server
pnpm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Adding Scenes

All scenes are registered statically in `src/config.js`. Place your `.splat` / `.ply` / `.spz` files in the `public/splats/` directory, then add an entry to the `SCENES` array:

```js
// src/config.js
{
  id: 'garden-fmllps',            // unique string ID
  label: 'Garden — FM-LLPS',      // sidebar card display name
  model: 'FM-LLPS',               // model / loss type
  tag: 'EXP',                     // short uppercase tag
  url: '/splats/garden_fmllps.splat',
  thumbnail: null,                 // or '/thumbnails/garden.jpg'
  rotation: [Math.PI, 0, 0],      // optional — default corrects Y-axis flip
  metrics: { psnr: 28.87, ssim: 0.931, fmllps: 0.412 },
},
```

Save → Vite hot-reloads and the card appears in the sidebar immediately.

### Supported File Formats

| Format | Extension | Notes |
|---|---|---|
| Standard splat | `.splat` | antimatter15 format |
| PLY | `.ply` | INRIA original + SuperSplat/gsplat compressed variants |
| Niantic compressed | `.spz` | Smallest file size |
| KSplat | `.ksplat` | mkkellogg optimized format |

### Coordinate Orientation

`.splat` files from standard 3DGS training use **OpenCV convention** (Y-down). The viewer automatically applies a 180° X-axis rotation to correct this. If a scene is already correctly oriented, set `rotation: [0, 0, 0]` in its config entry.

---

## Using the Viewer

| Action | Result |
|---|---|
| Click a **layout icon** (bottom toolbar) | Switch between 1 / 2 / 4 panel layouts |
| **Drag** a scene card → **drop** on a panel | Loads that splat into the panel |
| **Orbit / zoom** in any panel | All panels follow when "Sync Cameras" is ON |
| Click **×** on a panel | Clears it back to the drop zone |
| Toggle **Sync Cameras** (top right) | Enable / disable synchronized camera movement |
| **Refresh** the page | Layout and panel assignments are restored automatically |

---

## Project Structure

```
gsplat-web/
├── public/
│   ├── favicon.svg
│   ├── web-demo.png          # screenshot used in this README
│   └── splats/               # ← place .splat / .ply / .spz files here
├── src/
│   ├── config.js             # ← register your scenes here
│   ├── main.js               # app logic (CompareApp, PanelViewer, DragDrop, etc.)
│   ├── style.css             # OKLCH design system + component styles
│   └── assets/
├── index.html
├── vite.config.js
└── package.json
```

---

## Metrics Reference

| Metric | Better when | Description |
|---|---|---|
| **PSNR** | Higher ↑ | Peak Signal-to-Noise Ratio (dB) |
| **SSIM** | Higher ↑ | Structural Similarity Index (0–1) |
| **FM-LLPS** | Lower ↓ | Foundational Model Low-Level Perceptual Similarity |

---

## Deploying to Vercel

This is a fully static Vite app — no backend required.

1. Push the repo to GitHub
2. Import the project in [Vercel](https://vercel.com/)
3. Framework preset: **Vite**
4. Build command: `pnpm run build`
5. Output directory: `dist`

`.splat` files in `public/splats/` are served as static assets automatically.

---

## License

MIT
