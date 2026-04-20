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
  }
];

/** Retrieve a scene config by its id */
export function getSceneById(id) {
  return SCENES.find((s) => s.id === id) ?? null;
}
