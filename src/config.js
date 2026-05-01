/**
 * GSplat Compare — Scene Registry (Manifest-Driven)
 *
 * Loads public/scenes.json at app startup.
 * Structure:
 *   scenes.json → array of Scene objects
 *   Scene  { id, label, thumbnail, variants[] }
 *   Variant { id, label, tag, splat, renderImages[], metrics }
 *
 * The flat SCENES export retains compatibility with the existing 3D drag-drop sidebar.
 * The manifest export is used by the ImageComparePanel.
 */

// ─── Runtime state ────────────────────────────────────────────────────────────
let _manifest = []; // Scene[]

/**
 * Fetch and parse public/scenes.json.
 * Must be called once before any other registry access.
 * @returns {Promise<Scene[]>}
 */
export async function loadManifest() {
  try {
    const res = await fetch('/scenes.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _manifest = await res.json();
  } catch (err) {
    console.warn('[SceneRegistry] Failed to load scenes.json, falling back to empty manifest.', err);
    _manifest = [];
  }
  return _manifest;
}

/** Return the full hierarchical manifest (Scene[] with nested variants) */
export function getManifest() {
  return _manifest;
}

/**
 * Return a flat list of variants shaped for the 3D sidebar / SceneRegistry.
 * Each variant becomes a "scene" entry compatible with PanelViewer.setScene().
 */
export function getAllScenes() {
  return _manifest.flatMap(scene =>
    scene.variants.map(v => ({
      id:        `${scene.id}::${v.id}`,
      label:     `${scene.label} — ${v.label}`,
      sceneId:   scene.id,
      variantId: v.id,
      model:     v.label,
      tag:       v.tag ?? null,
      url:       v.splat,
      thumbnail: v.renderImages?.[0] ?? null,
      metrics:   v.metrics ?? { psnr: null, ssim: null, fmllps: null },
      rotation:  [Math.PI, 0, 0],
    }))
  );
}

/** Find a flat scene entry by its composite id (`sceneId::variantId`) */
export function findById(id) {
  return getAllScenes().find(s => s.id === id) ?? null;
}

/** Find a scene object from the manifest by scene id */
export function findScene(sceneId) {
  return _manifest.find(s => s.id === sceneId) ?? null;
}

/** Find a specific variant within a scene */
export function findVariant(sceneId, variantId) {
  return findScene(sceneId)?.variants.find(v => v.id === variantId) ?? null;
}
