/**
 * GSplat Compare — Scene Registry
 *
 * Add your Luma capture URLs and metric results here.
 * Each entry represents one model/scene that will appear as a card in the sidebar.
 *
 * url: Luma capture URL (https://lumalabs.ai/capture/...) or a public .ply URL
 * thumbnail: path to a static image in /public/thumbnails/, or null for auto-placeholder
 * metrics: from your evaluation results (psnr, ssim, fmllps — set to null if unavailable)
 */

export const SCENES = [
  // ── Demo scene (using the existing public Luma capture) ─────────────────────
  {
    id: 'demo-luma',
    label: 'Demo Scene',
    model: 'Luma Capture',
    tag: 'DEMO',
    url: 'https://lumalabs.ai/capture/83e9aae8-7023-448e-83a6-53ccb377ec86',
    thumbnail: null,
    metrics: { psnr: null, ssim: null, fmllps: null },
  },

  // ── Your experiment results — replace URLs below ─────────────────────────────
  {
    id: 'garden-baseline',
    label: 'Garden — Baseline',
    model: 'L1 + SSIM',
    tag: 'BASELINE',
    url: 'https://lumalabs.ai/capture/REPLACE_WITH_YOUR_URL',
    thumbnail: null,
    metrics: { psnr: 23.67, ssim: 0.812, fmllps: 0.691 },
  },
  {
    id: 'garden-fmllps',
    label: 'Garden — FM-LLPS',
    model: 'FM-LLPS',
    tag: 'FM-LLPS',
    url: 'https://lumalabs.ai/capture/REPLACE_WITH_YOUR_URL',
    thumbnail: null,
    metrics: { psnr: 28.87, ssim: 0.931, fmllps: 0.412 },
  },
  {
    id: 'room-baseline',
    label: 'Room — Baseline',
    model: 'L1 + SSIM',
    tag: 'BASELINE',
    url: 'https://lumalabs.ai/capture/REPLACE_WITH_YOUR_URL',
    thumbnail: null,
    metrics: { psnr: 22.14, ssim: 0.798, fmllps: 0.723 },
  },
  {
    id: 'room-fmllps',
    label: 'Room — FM-LLPS',
    model: 'FM-LLPS',
    tag: 'FM-LLPS',
    url: 'https://lumalabs.ai/capture/REPLACE_WITH_YOUR_URL',
    thumbnail: null,
    metrics: { psnr: 27.44, ssim: 0.918, fmllps: 0.438 },
  },
  {
    id: 'bicycle-baseline',
    label: 'Bicycle — Baseline',
    model: 'L1 + SSIM',
    tag: 'BASELINE',
    url: 'https://lumalabs.ai/capture/REPLACE_WITH_YOUR_URL',
    thumbnail: null,
    metrics: { psnr: 21.89, ssim: 0.769, fmllps: 0.751 },
  },
  {
    id: 'bicycle-fmllps',
    label: 'Bicycle — FM-LLPS',
    model: 'FM-LLPS',
    tag: 'FM-LLPS',
    url: 'https://lumalabs.ai/capture/REPLACE_WITH_YOUR_URL',
    thumbnail: null,
    metrics: { psnr: 26.93, ssim: 0.907, fmllps: 0.445 },
  },
];

/** Retrieve a scene config by its id */
export function getSceneById(id) {
  return SCENES.find((s) => s.id === id) ?? null;
}
