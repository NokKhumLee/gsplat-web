/**
 * ImageComparePanel
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders a drag-divider image comparison slider between two experiment
 * variants of a chosen scene.
 *
 * Expects:
 *   - A container element (#image-compare-panel)
 *   - The manifest array (from SceneRegistry.getManifest())
 *
 * Features:
 *   - Scene / left / right variant selectors
 *   - Frame stepper (prev | filename | next) + keyboard arrows
 *   - Smooth drag divider (CSS clip-path technique)
 *   - Metrics comparison bar
 *   - Responsive, re-renders on window resize
 */

export class ImageComparePanel {
  constructor(containerEl) {
    this.container = containerEl;
    this.manifest  = [];

    // State
    this.selectedScene    = null; // Scene object
    this.leftVariant      = null; // Variant object
    this.rightVariant     = null; // Variant object
    this.frameIndex       = 0;
    this.dividerX         = 50;   // percentage 0–100
    this.isDragging       = false;

    this._buildDOM();
    this._bindKeyboard();
    this._bindResize();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Called by CompareApp after manifest loads */
  setManifest(manifest) {
    this.manifest = manifest;
    this._populateSceneSelect();
  }

  // ── DOM Construction ───────────────────────────────────────────────────────

  _buildDOM() {
    this.container.innerHTML = '';
    this.container.className = 'image-compare-panel';

    // ── Top controls bar ───────────────────────────────────────────────
    const controls = document.createElement('div');
    controls.className = 'ic-controls';

    // Scene selector
    const sceneGroup = this._buildSelectGroup('SCENE', 'ic-scene-select');
    this.sceneSelect = sceneGroup.querySelector('select');
    this.sceneSelect.addEventListener('change', () => this._onSceneChange());

    // Left variant selector
    const leftGroup = this._buildSelectGroup('LEFT', 'ic-left-select');
    this.leftSelect = leftGroup.querySelector('select');
    this.leftSelect.addEventListener('change', () => this._onVariantChange());

    // Swap button
    const swapBtn = document.createElement('button');
    swapBtn.className = 'ic-swap-btn';
    swapBtn.title = 'Swap left ↔ right';
    swapBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M7 16V4m0 0L3 8m4-4l4 4"/><path d="M17 8v12m0 0l4-4m-4 4l-4-4"/>
    </svg>`;
    swapBtn.addEventListener('click', () => this._swapVariants());

    // Right variant selector
    const rightGroup = this._buildSelectGroup('RIGHT', 'ic-right-select');
    this.rightSelect = rightGroup.querySelector('select');
    this.rightSelect.addEventListener('change', () => this._onVariantChange());

    // Divider
    const sep = document.createElement('div');
    sep.className = 'ic-controls-sep';

    // Frame navigator
    const frameNav = document.createElement('div');
    frameNav.className = 'ic-frame-nav';

    this.prevBtn = document.createElement('button');
    this.prevBtn.className = 'ic-frame-btn';
    this.prevBtn.title = 'Previous frame (←)';
    this.prevBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <polyline points="15 18 9 12 15 6"/>
    </svg>`;
    this.prevBtn.addEventListener('click', () => this._stepFrame(-1));

    this.frameLabel = document.createElement('span');
    this.frameLabel.className = 'ic-frame-label';
    this.frameLabel.textContent = '—';

    this.nextBtn = document.createElement('button');
    this.nextBtn.className = 'ic-frame-btn';
    this.nextBtn.title = 'Next frame (→)';
    this.nextBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <polyline points="9 18 15 12 9 6"/>
    </svg>`;
    this.nextBtn.addEventListener('click', () => this._stepFrame(1));

    this.frameCounter = document.createElement('span');
    this.frameCounter.className = 'ic-frame-counter';
    this.frameCounter.textContent = '';

    frameNav.append(this.prevBtn, this.frameLabel, this.nextBtn, this.frameCounter);

    controls.append(sceneGroup, leftGroup, swapBtn, rightGroup, sep, frameNav);
    this.container.appendChild(controls);

    // ── Stage (the actual image slider) ───────────────────────────────
    this.stage = document.createElement('div');
    this.stage.className = 'ic-stage';

    // Left image layer
    this.leftLayer = document.createElement('div');
    this.leftLayer.className = 'ic-layer ic-layer-left';
    this.leftImg = document.createElement('img');
    this.leftImg.className = 'ic-img';
    this.leftImg.alt = 'Left variant';
    this.leftLayer.appendChild(this.leftImg);

    // Right image layer (clipped)
    this.rightLayer = document.createElement('div');
    this.rightLayer.className = 'ic-layer ic-layer-right';
    this.rightImg = document.createElement('img');
    this.rightImg.className = 'ic-img';
    this.rightImg.alt = 'Right variant';
    this.rightLayer.appendChild(this.rightImg);

    // Left label badge
    this.leftBadge = document.createElement('div');
    this.leftBadge.className = 'ic-badge ic-badge-left';

    // Right label badge
    this.rightBadge = document.createElement('div');
    this.rightBadge.className = 'ic-badge ic-badge-right';

    // Divider line + handle
    this.dividerEl = document.createElement('div');
    this.dividerEl.className = 'ic-divider';
    this.dividerEl.innerHTML = `
      <div class="ic-divider-line"></div>
      <div class="ic-divider-handle">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="9 18 3 12 9 6"/><polyline points="15 6 21 12 15 18"/>
        </svg>
      </div>`;

    // Empty state
    this.emptyState = document.createElement('div');
    this.emptyState.className = 'ic-empty';
    this.emptyState.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M9 3v18"/>
      </svg>
      <p>Select a scene and two variants to compare</p>`;

    this.stage.append(this.leftLayer, this.rightLayer, this.leftBadge, this.rightBadge, this.dividerEl, this.emptyState);
    this.container.appendChild(this.stage);

    // Loading overlay
    this.loadingOverlay = document.createElement('div');
    this.loadingOverlay.className = 'ic-loading';
    this.loadingOverlay.innerHTML = `<div class="ic-spinner"></div>`;
    this.loadingOverlay.style.display = 'none';
    this.stage.appendChild(this.loadingOverlay);

    // ── Metrics bar ───────────────────────────────────────────────────
    this.metricsBar = document.createElement('div');
    this.metricsBar.className = 'ic-metrics-bar';
    this._buildMetricsBar();
    this.container.appendChild(this.metricsBar);

    // ── Bind drag ──────────────────────────────────────────────────────
    this._bindDrag();

    // Initial state
    this._setDivider(50);
    this._showEmpty(true);
  }

  _buildSelectGroup(label, selectId) {
    const group = document.createElement('div');
    group.className = 'ic-select-group';

    const lbl = document.createElement('label');
    lbl.className = 'ic-select-label';
    lbl.textContent = label;
    lbl.setAttribute('for', selectId);

    const sel = document.createElement('select');
    sel.className = 'ic-select';
    sel.id = selectId;

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— select —';
    sel.appendChild(placeholder);

    group.append(lbl, sel);
    return group;
  }

  _buildMetricsBar() {
    this.metricsBar.innerHTML = `
      <div class="ic-metrics-side ic-metrics-left">
        <span class="ic-metrics-name">—</span>
        <div class="ic-metrics-chips"></div>
      </div>
      <div class="ic-metrics-vs">VS</div>
      <div class="ic-metrics-side ic-metrics-right">
        <span class="ic-metrics-name">—</span>
        <div class="ic-metrics-chips"></div>
      </div>`;
  }

  // ── Populate Selects ───────────────────────────────────────────────────────

  _populateSceneSelect() {
    this.sceneSelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— select scene —';
    this.sceneSelect.appendChild(placeholder);

    for (const scene of this.manifest) {
      const opt = document.createElement('option');
      opt.value = scene.id;
      opt.textContent = scene.label;
      this.sceneSelect.appendChild(opt);
    }

    // Auto-select first scene if available
    if (this.manifest.length > 0) {
      this.sceneSelect.value = this.manifest[0].id;
      this._onSceneChange();
    }
  }

  _populateVariantSelects(scene) {
    const buildOptions = (sel, currentId) => {
      sel.innerHTML = '';
      const ph = document.createElement('option');
      ph.value = '';
      ph.textContent = '— select variant —';
      sel.appendChild(ph);
      for (const v of scene.variants) {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.label;
        sel.appendChild(opt);
      }
      if (currentId) sel.value = currentId;
    };

    const leftId  = this.leftVariant?.id  ?? (scene.variants[0]?.id  ?? '');
    const rightId = this.rightVariant?.id ?? (scene.variants[1]?.id  ?? '');

    buildOptions(this.leftSelect,  leftId);
    buildOptions(this.rightSelect, rightId);
  }

  // ── Event Handlers ─────────────────────────────────────────────────────────

  _onSceneChange() {
    const sceneId = this.sceneSelect.value;
    this.selectedScene = this.manifest.find(s => s.id === sceneId) ?? null;
    this.frameIndex    = 0;

    if (!this.selectedScene) {
      this.leftVariant = this.rightVariant = null;
      this._populateVariantSelects({ variants: [] });
      this._showEmpty(true);
      return;
    }

    // Default left = first variant, right = second variant (if exists)
    this.leftVariant  = this.selectedScene.variants[0] ?? null;
    this.rightVariant = this.selectedScene.variants[1] ?? this.selectedScene.variants[0] ?? null;
    this._populateVariantSelects(this.selectedScene);
    this._render();
  }

  _onVariantChange() {
    if (!this.selectedScene) return;
    const leftId  = this.leftSelect.value;
    const rightId = this.rightSelect.value;
    this.leftVariant  = this.selectedScene.variants.find(v => v.id === leftId)  ?? null;
    this.rightVariant = this.selectedScene.variants.find(v => v.id === rightId) ?? null;
    this.frameIndex   = 0;
    this._render();
  }

  _swapVariants() {
    [this.leftVariant, this.rightVariant] = [this.rightVariant, this.leftVariant];
    if (this.leftVariant)  this.leftSelect.value  = this.leftVariant.id;
    if (this.rightVariant) this.rightSelect.value = this.rightVariant.id;
    this._render();
  }

  _stepFrame(delta) {
    const frames = this._frames();
    if (frames.length === 0) return;
    this.frameIndex = (this.frameIndex + delta + frames.length) % frames.length;
    this._renderImages();
  }

  // ── Core Render ────────────────────────────────────────────────────────────

  _frames() {
    // Use left variant's renderImages as the frame list
    return this.leftVariant?.renderImages ?? [];
  }

  _render() {
    const hasLeft  = !!this.leftVariant;
    const hasRight = !!this.rightVariant;

    if (!hasLeft && !hasRight) {
      this._showEmpty(true);
      return;
    }

    this._showEmpty(false);
    this._renderImages();
    this._renderMetrics();
    this._updateBadges();
  }

  _renderImages() {
    const frames = this._frames();
    const rightFrames = this.rightVariant?.renderImages ?? [];

    if (frames.length === 0) return;

    const fi = Math.min(this.frameIndex, frames.length - 1);
    const leftSrc  = frames[fi]      ?? '';
    const rightSrc = rightFrames[fi] ?? leftSrc;

    const filename = leftSrc.split('/').pop();
    this.frameLabel.textContent = filename;
    this.frameCounter.textContent = `${fi + 1} / ${frames.length}`;

    // Preload with loading state
    this.loadingOverlay.style.display = 'flex';
    let loadedCount = 0;
    const onLoad = () => {
      loadedCount++;
      if (loadedCount >= 2) this.loadingOverlay.style.display = 'none';
    };

    this.leftImg.onload  = onLoad;
    this.rightImg.onload = onLoad;
    this.leftImg.onerror = onLoad;
    this.rightImg.onerror = onLoad;

    this.leftImg.src  = leftSrc;
    this.rightImg.src = rightSrc;
  }

  _renderMetrics() {
    const leftM  = this.leftVariant?.metrics  ?? {};
    const rightM = this.rightVariant?.metrics ?? {};

    const fmt = (v, unit = '') => v != null ? `${typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(2) : v}${unit}` : '—';

    const renderChips = (container, metrics) => {
      container.innerHTML = '';
      const defs = [
        { key: 'psnr',   label: 'PSNR',   unit: ' dB', cls: 'chip-psnr'   },
        { key: 'ssim',   label: 'SSIM',   unit: '',    cls: 'chip-ssim'   },
        { key: 'fmllps', label: 'FMLLPS', unit: '',    cls: 'chip-fmllps' },
      ];
      for (const d of defs) {
        const chip = document.createElement('span');
        chip.className = `ic-metric-chip ${d.cls}`;
        chip.textContent = `${d.label} ${fmt(metrics[d.key], d.unit)}`;
        container.appendChild(chip);
      }
    };

    const leftName  = this.metricsBar.querySelector('.ic-metrics-left  .ic-metrics-name');
    const rightName = this.metricsBar.querySelector('.ic-metrics-right .ic-metrics-name');
    const leftChips = this.metricsBar.querySelector('.ic-metrics-left  .ic-metrics-chips');
    const rightChips= this.metricsBar.querySelector('.ic-metrics-right .ic-metrics-chips');

    if (leftName)   leftName.textContent  = this.leftVariant?.label  ?? '—';
    if (rightName)  rightName.textContent = this.rightVariant?.label ?? '—';
    if (leftChips)  renderChips(leftChips,  leftM);
    if (rightChips) renderChips(rightChips, rightM);
  }

  _updateBadges() {
    this.leftBadge.textContent  = this.leftVariant?.label  ?? '';
    this.rightBadge.textContent = this.rightVariant?.label ?? '';
  }

  _showEmpty(show) {
    this.emptyState.style.display      = show ? 'flex' : 'none';
    this.leftLayer.style.display       = show ? 'none' : 'block';
    this.rightLayer.style.display      = show ? 'none' : 'block';
    this.dividerEl.style.display       = show ? 'none' : 'flex';
    this.leftBadge.style.display       = show ? 'none' : 'block';
    this.rightBadge.style.display      = show ? 'none' : 'block';
    this.metricsBar.style.opacity      = show ? '0.4' : '1';
    this.frameLabel.textContent        = show ? '—' : this.frameLabel.textContent;
    this.frameCounter.textContent      = show ? '' : this.frameCounter.textContent;
  }

  // ── Drag Divider ───────────────────────────────────────────────────────────

  _setDivider(pct) {
    this.dividerX = Math.max(2, Math.min(98, pct));
    this.dividerEl.style.left          = `${this.dividerX}%`;
    this.rightLayer.style.clipPath     = `inset(0 0 0 ${this.dividerX}%)`;
    this.leftBadge.style.left          = `max(8px, min(calc(${this.dividerX}% - 16px), calc(${this.dividerX}% - 80px)))`;
    this.rightBadge.style.left         = `calc(${this.dividerX}% + 8px)`;
  }

  _bindDrag() {
    const startDrag = (clientX) => {
      this.isDragging = true;
      this.stage.classList.add('dragging');
    };

    const moveDrag = (clientX) => {
      if (!this.isDragging) return;
      const rect = this.stage.getBoundingClientRect();
      const pct  = ((clientX - rect.left) / rect.width) * 100;
      this._setDivider(pct);
    };

    const endDrag = () => {
      this.isDragging = false;
      this.stage.classList.remove('dragging');
    };

    // Mouse events
    this.dividerEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startDrag(e.clientX);
    });
    window.addEventListener('mousemove', (e) => moveDrag(e.clientX));
    window.addEventListener('mouseup',   endDrag);

    // Touch events
    this.dividerEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      startDrag(e.touches[0].clientX);
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      if (this.isDragging) moveDrag(e.touches[0].clientX);
    }, { passive: true });
    window.addEventListener('touchend', endDrag);

    // Also allow clicking anywhere on stage to jump divider
    this.stage.addEventListener('click', (e) => {
      if (e.target.closest('.ic-divider')) return;
      const rect = this.stage.getBoundingClientRect();
      const pct  = ((e.clientX - rect.left) / rect.width) * 100;
      this._setDivider(pct);
    });
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (!this.container.style.display || this.container.style.display === 'none') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === 'ArrowLeft')  { e.preventDefault(); this._stepFrame(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); this._stepFrame(1);  }
      // Nudge divider with A/D
      if (e.key === 'a' || e.key === 'A') this._setDivider(this.dividerX - 2);
      if (e.key === 'd' || e.key === 'D') this._setDivider(this.dividerX + 2);
    });
  }

  _bindResize() {
    window.addEventListener('resize', () => {
      // Re-apply divider position so it stays aligned
      this._setDivider(this.dividerX);
    });
  }
}
