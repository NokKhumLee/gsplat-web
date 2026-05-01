# /public/splats/ — Scene Asset Directory

This directory is the **virtual file system** for all scenes and experiments.
Each subfolder represents a **scene**, and each subfolder inside it represents an **experiment variant**.

---

## Directory Convention

```
public/splats/
└── <scene-id>/                         ← one folder per scene (e.g. "garden", "bicycle")
    ├── <variant-id>/                   ← one folder per experiment variant
    │   ├── <variant-id>.splat          ← the trained .splat model
    │   └── render-images/             ← rendered test images from this variant
    │       ├── 00000.png
    │       ├── 00001.png
    │       └── ...
    └── <another-variant-id>/
        ├── <another-variant-id>.splat
        └── render-images/
            └── ...
```

### Naming Rules

| Item | Convention | Example |
|---|---|---|
| Scene folder | lowercase, hyphen-separated | `garden`, `bicycle-colmap` |
| Variant folder | lowercase, hyphen-separated | `original`, `fmllps-30k` |
| Splat file | same name as the variant folder | `original.splat`, `fmllps-30k.splat` |
| Render images | zero-padded frame index | `00000.png`, `00001.png` |

> **Frame matching:** For the image comparison slider to work correctly, both variants
> of the same scene must have render images with **identical filenames**
> (e.g. both have `00000.png`, `00001.png`, …). These correspond to the same test camera viewpoints.

---

## Registering a New Scene

### Step 1 — Place your assets

Create the folder structure under `public/splats/`:

```
public/splats/
└── bicycle/
    ├── original/
    │   ├── original.splat
    │   └── render-images/
    │       ├── 00000.png
    │       └── 00001.png
    └── fmllps-30k/
        ├── fmllps-30k.splat
        └── render-images/
            ├── 00000.png
            └── 00001.png
```

### Step 2 — Regenerate `scenes.json` (recommended)

Run the auto-scan helper from the project root:

```bash
npm run gen-manifest
# or
node scripts/gen-manifest.js
```

This scans `public/splats/` and rewrites `public/scenes.json` automatically.
You can then open `scenes.json` to fill in any known metrics.

### Step 3 — (Alternative) Edit `scenes.json` manually

If you prefer, add your scene directly to `public/scenes.json`:

```jsonc
{
  "id": "bicycle",                        // must match the folder name
  "label": "Bicycle",                     // display name in the UI
  "thumbnail": "/splats/bicycle/original/render-images/00000.png",
  "variants": [
    {
      "id": "original",                   // must match the subfolder name
      "label": "Original (Baseline)",     // shown in selectors and cards
      "tag": "BASELINE",                  // chip label: "BASELINE" or "EXPERIMENT"
      "splat": "/splats/bicycle/original/original.splat",
      "renderImages": [
        "/splats/bicycle/original/render-images/00000.png",
        "/splats/bicycle/original/render-images/00001.png"
      ],
      "metrics": { "psnr": 25.1, "ssim": 0.80, "fmllps": null }
    },
    {
      "id": "fmllps-30k",
      "label": "FM-LLPS (30k steps)",
      "tag": "EXPERIMENT",
      "splat": "/splats/bicycle/fmllps-30k/fmllps-30k.splat",
      "renderImages": [
        "/splats/bicycle/fmllps-30k/render-images/00000.png",
        "/splats/bicycle/fmllps-30k/render-images/00001.png"
      ],
      "metrics": { "psnr": 26.4, "ssim": 0.83, "fmllps": 0.31 }
    }
  ]
}
```

### Step 4 — Reload the app

The app fetches `scenes.json` on startup. A dev-server page refresh is enough to see your new scene in both the **3D sidebar** and the **Image Compare** panel.

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

Fill in `metrics` in `scenes.json` after running your evaluation pipeline.
Leave unknown values as `null` — the UI displays `—` for missing metrics.

| Field | Better when | Description |
|---|---|---|
| `psnr` | Higher ↑ | Peak Signal-to-Noise Ratio (dB) |
| `ssim` | Higher ↑ | Structural Similarity Index (0–1) |
| `fmllps` | Lower ↓ | Foundational Model Low-Level Perceptual Similarity |

---

## Coordinate Orientation

`.splat` files from standard 3DGS training use **OpenCV convention** (Y-down, Z-forward).
The viewer automatically applies a 180° X-axis rotation (`[Math.PI, 0, 0]`) to correct this.

If your scene is already correctly oriented (e.g. a `.ply` from SuperSplat), add
`"rotation": [0, 0, 0]` as a field on the variant in `scenes.json`.
