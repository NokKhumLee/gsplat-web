#!/usr/bin/env node
/**
 * gen-manifest.js
 * ───────────────────────────────────────────────────────────────────────────
 * Auto-scans public/splats/ to regenerate public/scenes.json
 *
 * Convention:
 *   public/splats/<scene-id>/<variant-id>/<variant-id>.splat
 *   public/splats/<scene-id>/<variant-id>/render-images/*.png
 *
 * Usage:
 *   node scripts/gen-manifest.js
 *   node scripts/gen-manifest.js --dry-run   (print JSON, don't write)
 *
 * After adding a new experiment folder, re-run this script.
 * ───────────────────────────────────────────────────────────────────────────
 */

import { readdirSync, statSync, writeFileSync, existsSync } from 'fs';
import { join, relative, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const ROOT         = join(__dirname, '..');
const SPLATS_DIR   = join(ROOT, 'public', 'splats');
const MANIFEST_OUT = join(ROOT, 'public', 'scenes.json');
const DRY_RUN      = process.argv.includes('--dry-run');

/** Recursively list files with a given extension relative to a base dir */
function listFiles(dir, ext) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => extname(f).toLowerCase() === ext)
    .sort()
    .map(f => '/' + relative(join(ROOT, 'public'), join(dir, f)).replace(/\\/g, '/'));
}

/** Find the first .splat file in a directory */
function findSplat(dir) {
  if (!existsSync(dir)) return null;
  const found = readdirSync(dir).find(f => extname(f).toLowerCase() === '.splat');
  return found
    ? '/' + relative(join(ROOT, 'public'), join(dir, found)).replace(/\\/g, '/')
    : null;
}

/** Convert a kebab/snake-case id to a human label */
function toLabel(id) {
  return id
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/** Determine variant tag heuristically */
function inferTag(variantId) {
  if (variantId === 'original') return 'BASELINE';
  return 'EXPERIMENT';
}

// ── Scan ────────────────────────────────────────────────────────────────────

if (!existsSync(SPLATS_DIR)) {
  console.error(`[gen-manifest] ERROR: ${SPLATS_DIR} does not exist.`);
  process.exit(1);
}

const scenes = [];

const sceneDirs = readdirSync(SPLATS_DIR).filter(f => {
  return statSync(join(SPLATS_DIR, f)).isDirectory() && !f.startsWith('.');
}).sort();

for (const sceneId of sceneDirs) {
  const sceneDir  = join(SPLATS_DIR, sceneId);
  const variants  = [];

  const variantDirs = readdirSync(sceneDir).filter(f => {
    return statSync(join(sceneDir, f)).isDirectory() && !f.startsWith('.');
  }).sort();

  for (const variantId of variantDirs) {
    const variantDir   = join(sceneDir, variantId);
    const renderImgDir = join(variantDir, 'render-images');
    const splat        = findSplat(variantDir);
    const renderImages = listFiles(renderImgDir, '.png');

    variants.push({
      id: variantId,
      label: toLabel(variantId),
      tag: inferTag(variantId),
      splat,
      renderImages,
      metrics: { psnr: null, ssim: null, fmllps: null },
    });
  }

  // Use first render image of first variant as scene thumbnail
  const thumbnail = variants[0]?.renderImages?.[0] ?? null;

  scenes.push({
    id: sceneId,
    label: toLabel(sceneId),
    thumbnail,
    variants,
  });
}

const json = JSON.stringify(scenes, null, 2);

if (DRY_RUN) {
  console.log(json);
} else {
  writeFileSync(MANIFEST_OUT, json + '\n', 'utf8');
  console.log(`[gen-manifest] ✓ Written ${scenes.length} scene(s) → ${MANIFEST_OUT}`);
  scenes.forEach(s => {
    console.log(`  ${s.id}/`);
    s.variants.forEach(v => console.log(`    ${v.id}/  (${v.renderImages.length} frames, splat: ${v.splat ? '✓' : '✗'})`));
  });
}
