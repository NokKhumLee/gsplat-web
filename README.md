# GSplat Compare

A professional **3D Gaussian Splatting comparison viewer** built with [Three.js](https://threejs.org/) and [Spark](https://sparkjs.dev/). Load and compare multiple local `.splat` scenes side-by-side with synchronized cameras, and compare rendered test images between experiment variants with an interactive slider.

![GSplat Compare UI](public/web-demo.png)

---

## Features

- 🖼 **Flexible layouts** — Single, vertical split (2-panel), or quad grid (4-panel)
- 🖱 **Drag & Drop loading** — Drag scene variant cards from the sidebar onto any 3D panel
- 🔄 **Synchronized cameras** — Orbit in one panel and all others follow in real time (toggle on/off)
- 🔀 **Image Compare mode** — Drag-divider slider to compare rendered images between two variants frame-by-frame
- 📊 **Metric badges** — PSNR, SSIM, FM-LLPS scores per variant, shown in both modes
- 💾 **Session persistence** — Layout, panel assignments, and view mode survive page refresh
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
| Styling | Vanilla CSS + OKLCH design tokens |
| Package Manager | [pnpm](https://pnpm.io/) |

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- pnpm (`npm install -g pnpm`)

### Install & Run

```bash
git clone https://github.com/your-username/gsplat-web.git
cd gsplat-web

pnpm install
pnpm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Project Structure

```
gsplat-web/
├── public/
│   ├── scenes.json              ← virtual FS manifest (auto-generated or hand-edited)
│   ├── favicon.svg
│   └── splats/                  ← all scene assets live here
│       └── <scene>/
│           ├── <variant>/
│           │   ├── <variant>.splat
│           │   └── render-images/
│           │       ├── 00000.png
│           │       └── ...
│           └── README.md        ← detailed asset setup guide
├── scripts/
│   └── gen-manifest.js          ← auto-scans splats/ and writes scenes.json
├── src/
│   ├── config.js                ← manifest loader + SceneRegistry API
│   ├── imageCompare.js          ← ImageComparePanel (drag-slider + frame stepper)
│   ├── main.js                  ← CompareApp orchestrator
│   └── style.css                ← OKLCH design system + all component styles
├── index.html
├── vite.config.js
└── package.json
```

---

## Adding a New Scene / Experiment

### 1. Place your assets

Follow the folder convention under `public/splats/`:

```
public/splats/
└── garden/
    ├── original/
    │   ├── original.splat
    │   └── render-images/
    │       ├── 00000.png
    │       └── 00001.png
    └── fmllps-30k/
        ├── fmllps-30k.splat
        └── render-images/
            ├── 00000.png      ← same filename as the other variant (same test camera)
            └── 00001.png
```

> **Naming rules:** folder name = variant id = splat filename (without extension).
> Render images must use the **same filenames across all variants** of the same scene.

### 2. Regenerate `scenes.json`

```bash
npm run gen-manifest
```

This auto-scans `public/splats/` and rewrites `public/scenes.json`. Then open the file to fill in any known metrics.

### 3. (Alternative) Edit `scenes.json` manually

```json
{
  "id": "garden",
  "label": "Garden",
  "thumbnail": "/splats/garden/original/render-images/00000.png",
  "variants": [
    {
      "id": "original",
      "label": "Original (Baseline)",
      "tag": "BASELINE",
      "splat": "/splats/garden/original/original.splat",
      "renderImages": [
        "/splats/garden/original/render-images/00000.png",
        "/splats/garden/original/render-images/00001.png"
      ],
      "metrics": { "psnr": 27.4, "ssim": 0.83, "fmllps": null }
    },
    {
      "id": "fmllps-30k",
      "label": "FM-LLPS (30k steps)",
      "tag": "EXPERIMENT",
      "splat": "/splats/garden/fmllps-30k/fmllps-30k.splat",
      "renderImages": [
        "/splats/garden/fmllps-30k/render-images/00000.png",
        "/splats/garden/fmllps-30k/render-images/00001.png"
      ],
      "metrics": { "psnr": 28.9, "ssim": 0.87, "fmllps": 0.31 }
    }
  ]
}
```

### 4. Reload the app

A browser refresh is all that's needed. The app fetches `scenes.json` at startup and populates both the **3D sidebar** and the **Image Compare** panel automatically.

---

## Using the Viewer

### 3D View

| Action | Result |
|---|---|
| Click a **layout icon** (bottom toolbar) | Switch between 1 / 2 / 4 panel layouts |
| **Drag** a variant card → **drop** on a panel | Loads that `.splat` into the panel |
| **Orbit / zoom** in any panel | All panels follow when Sync Cameras is ON |
| Click **×** on a panel | Clears it back to the drop zone |
| Toggle **Sync Cameras** | Enable / disable synchronized camera movement |

### Image Compare Mode

Click **Image Compare** in the header to switch modes.

| Action | Result |
|---|---|
| **SCENE** dropdown | Select which scene to compare |
| **LEFT / RIGHT** dropdowns | Choose which two variants to compare |
| **⇄ swap button** | Swap left and right variants |
| **◀ / ▶ buttons** or **← → keys** | Step through render frames |
| **Drag the divider** or **click anywhere** | Move the comparison divider |
| **A / D keys** | Nudge the divider left / right |

---

## Supported Splat Formats

| Format | Extension | Notes |
|---|---|---|
| Standard splat | `.splat` | antimatter15 format |
| PLY | `.ply` | INRIA original + SuperSplat/gsplat compressed |
| Niantic compressed | `.spz` | Smallest file size |
| KSplat | `.ksplat` | mkkellogg optimized format |

---

## Metrics Reference

| Field | Better when | Description |
|---|---|---|
| `psnr` | Higher ↑ | Peak Signal-to-Noise Ratio (dB) |
| `ssim` | Higher ↑ | Structural Similarity Index (0–1) |
| `fmllps` | Lower ↓ | Foundational Model Low-Level Perceptual Similarity |

Set unknown values to `null` in `scenes.json` — the UI displays `—` for missing metrics.

---

## Coordinate Orientation

`.splat` files from standard 3DGS training use **OpenCV convention** (Y-down, Z-forward).
The viewer automatically applies a 180° X-axis rotation to correct this.

If your scene is already correctly oriented, add `"rotation": [0, 0, 0]` to the variant entry in `scenes.json`.

---

## Deploying to Vercel

This is a fully static Vite app — no backend required.

1. Push the repo to GitHub
2. Import the project in [Vercel](https://vercel.com/)
3. Framework preset: **Vite**
4. Build command: `pnpm run build`
5. Output directory: `dist`

`scenes.json` and all assets under `public/splats/` are served as static files automatically.

---

## License

MIT
