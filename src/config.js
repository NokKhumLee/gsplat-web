/**
 * GSplat Compare — Scene Registry
 *
 * Add your scene entries here.
 * Each entry represents one model/scene that will appear as a card in the sidebar.
 *
 * url: path to a static .splat, .ply, or .spz file served from /public/splats/,
 *      e.g. '/splats/garden.splat'  — OR — a full public URL to a remotely hosted file
 * thumbnail: path to a static image in /public/thumbnails/, or null for auto-placeholder
 * rotation: optional [x, y, z] Euler rotation in radians applied to the SplatMesh.
 *            Default is [Math.PI, 0, 0] which corrects the standard Y-axis flip.
 *            Set to [0, 0, 0] if your scene is already correctly oriented.
 * metrics: from your evaluation results (psnr, ssim, fmllps — set to null if unavailable)
 */

export const SCENES = [
  // ── Demo scene ──────────────────────────────────────────────────────────────
  // Place your .splat files in /public/splats/ and reference them like below.
  // Example using a publicly available .splat from mkkellogg's demo data:
  {
    id: 'demo-garden',
    label: 'Garden (Demo)',
    model: 'Baseline',
    tag: 'DEMO',
    url: '/splats/garden.splat',
    thumbnail: null,
    metrics: { psnr: null, ssim: null, fmllps: null },
  }
];

/** Retrieve a scene config by its id */
export function getSceneById(id) {
  return SCENES.find((s) => s.id === id) ?? null;
}
