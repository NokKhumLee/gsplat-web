import './style.css';
import { LumaSplatsThree } from '@lumaai/luma-web';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { SCENES } from './config.js';

// ─────────────────────────────────────────────────────────────────────────────
// SceneRegistry — merges hardcoded SCENES with localStorage custom scenes
// ─────────────────────────────────────────────────────────────────────────────
class SceneRegistry {
    static STORAGE_KEY = 'gsplat_custom_scenes';

    static getCustomScenes() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
        } catch { return []; }
    }

    static getAllScenes() {
        return [...SCENES, ...this.getCustomScenes()];
    }

    static addScene(scene) {
        const scenes = this.getCustomScenes();
        scenes.push({ ...scene, custom: true });
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(scenes));
    }

    static removeScene(id) {
        const scenes = this.getCustomScenes().filter(s => s.id !== id);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(scenes));
    }

    static findById(id) {
        return this.getAllScenes().find(s => s.id === id) ?? null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PanelViewer — one Three.js renderer + scene per panel slot
// ─────────────────────────────────────────────────────────────────────────────
class PanelViewer {
    constructor(slotEl, id) {
        this.slotEl = slotEl;
        this.id = id;
        this.sceneConfig = null;
        this.splat = null;

        // Callbacks
        this.onCameraChange = null; // (matrix4) => void

        // Three.js objects
        this.threeScene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.animFrameId = null;
        this._suppressSync = false;

        // Build DOM structure
        this._buildDOM();
        this._showDropZone();
    }

    _buildDOM() {
        this.slotEl.innerHTML = '';
        this.slotEl.classList.add('drop-zone-state');

        // Label bar (always visible)
        this.labelBar = document.createElement('div');
        this.labelBar.className = 'panel-label-bar has-controls';
        this.labelBar.style.display = 'none';
        this.slotEl.appendChild(this.labelBar);

        this.sceneName = document.createElement('span');
        this.sceneName.className = 'panel-scene-name';
        this.labelBar.appendChild(this.sceneName);

        const rightControls = document.createElement('div');
        rightControls.className = 'panel-right-controls';

        this.metricBadge = document.createElement('span');
        this.metricBadge.className = 'panel-metric';
        rightControls.appendChild(this.metricBadge);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'panel-close-btn';
        closeBtn.title = 'Clear panel';
        closeBtn.innerHTML = '✕';
        closeBtn.addEventListener('click', () => this.clearScene());
        rightControls.appendChild(closeBtn);

        this.labelBar.appendChild(rightControls);

        // Canvas container (three.js renders here)
        this.canvasContainer = document.createElement('div');
        this.canvasContainer.style.cssText = 'position:absolute;inset:0;';
        this.slotEl.appendChild(this.canvasContainer);

        // Drop zone overlay
        this.dropZoneEl = document.createElement('div');
        this.dropZoneEl.className = 'drop-zone-content';
        this.dropZoneEl.innerHTML = `
      <svg class="drop-zone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="4"/><circle cx="5" cy="7" r="2.5"/><circle cx="19" cy="7" r="2.5"/>
        <circle cx="5" cy="17" r="2.5"/><circle cx="19" cy="17" r="2.5"/>
      </svg>
      <span class="drop-zone-text">Drop a scene here</span>`;
        this.slotEl.appendChild(this.dropZoneEl);

        // Loading overlay
        this.loadingEl = document.createElement('div');
        this.loadingEl.className = 'panel-loading';
        this.loadingEl.style.display = 'none';
        this.loadingEl.innerHTML = `<div class="spinner"></div><span class="loading-text">Loading splat…</span>`;
        this.slotEl.appendChild(this.loadingEl);
    }

    _showDropZone() {
        this.slotEl.classList.add('drop-zone-state');
        this.dropZoneEl.style.display = '';
        this.labelBar.style.display = 'none';
        this.canvasContainer.style.display = 'none';
        this.loadingEl.style.display = 'none';
    }

    _showLoading() {
        this.slotEl.classList.remove('drop-zone-state');
        this.dropZoneEl.style.display = 'none';
        this.canvasContainer.style.display = '';
        this.loadingEl.style.display = '';
        this.labelBar.style.display = 'flex';
        this.sceneName.textContent = 'Loading…';
        this.metricBadge.textContent = '';
    }

    _showScene() {
        this.loadingEl.style.display = 'none';
    }

    _initThree() {
        if (this.renderer) this._destroyThree();

        this.threeScene = new THREE.Scene();

        const w = this.canvasContainer.clientWidth || 400;
        const h = this.canvasContainer.clientHeight || 300;

        this.camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
        this.camera.position.set(0, 1.5, 4);

        this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', alpha: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.canvasContainer.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.06;
        this.controls.rotateSpeed = 0.8;

        // Emit camera changes for sync
        this.controls.addEventListener('change', () => {
            if (!this._suppressSync && this.onCameraChange) {
                this.onCameraChange(this.camera.matrix.clone(), this.controls.target.clone());
            }
        });

        this._startLoop();
    }

    _destroyThree() {
        if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
        if (this.splat) { this.threeScene.remove(this.splat); this.splat = null; }
        if (this.renderer) { this.renderer.dispose(); this.canvasContainer.innerHTML = ''; this.renderer = null; }
        if (this.controls) { this.controls.dispose(); this.controls = null; }
        this.threeScene = null;
        this.camera = null;
    }

    _startLoop() {
        const loop = () => {
            this.animFrameId = requestAnimationFrame(loop);
            if (this.controls) this.controls.update();
            if (this.renderer && this.threeScene && this.camera) {
                this.renderer.render(this.threeScene, this.camera);
            }
        };
        loop();
    }

    /** Set camera from external matrix (slave sync) */
    applyCameraMatrix(matrix, target) {
        if (!this.camera || !this.controls) return;
        this._suppressSync = true;
        this.camera.matrix.copy(matrix);
        this.camera.matrix.decompose(this.camera.position, this.camera.quaternion, this.camera.scale);
        if (target) this.controls.target.copy(target);
        this.controls.update();
        this._suppressSync = false;
    }

    /** Load a scene from config */
    setScene(sceneConfig) {
        if (this.sceneConfig?.id === sceneConfig.id) return;
        this.clearScene(false); // destroy previous without resetting to drop zone yet
        this.sceneConfig = sceneConfig;

        this._showLoading();
        this._initThree();

        this.splat = new LumaSplatsThree({
            source: sceneConfig.url,
            loadingAnimationEnabled: false,
        });
        this.threeScene.add(this.splat);

        const ready = () => {
            this._showScene();
            this.sceneName.textContent = sceneConfig.label;
            const m = sceneConfig.metrics;
            if (m?.psnr != null) {
                this.metricBadge.textContent = `PSNR ${m.psnr.toFixed(2)}`;
            } else {
                this.metricBadge.textContent = '';
            }
        };

        if (this.splat.onLoad !== undefined) {
            this.splat.onLoad = ready;
        } else {
            setTimeout(ready, 1500); // fallback
        }

        this.resize();
    }

    /** Clear the panel back to drop-zone state */
    clearScene(resetUI = true) {
        this.sceneConfig = null;
        this._destroyThree();
        if (resetUI) this._showDropZone();
    }

    /** Resize renderer to match current slot dimensions */
    resize() {
        if (!this.renderer || !this.camera) return;
        const w = this.canvasContainer.clientWidth;
        const h = this.canvasContainer.clientHeight;
        if (w === 0 || h === 0) return;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// CameraSyncController — master/slave camera coupling
// ─────────────────────────────────────────────────────────────────────────────
class CameraSyncController {
    constructor() {
        this.enabled = true;
        this.panels = []; // PanelViewer[]
    }

    register(panel) {
        this.panels.push(panel);
        panel.onCameraChange = (matrix, target) => {
            if (!this.enabled) return;
            for (const other of this.panels) {
                if (other !== panel && other.sceneConfig) {
                    other.applyCameraMatrix(matrix, target);
                }
            }
        };
    }

    unregister(panel) {
        this.panels = this.panels.filter(p => p !== panel);
        panel.onCameraChange = null;
    }

    setEnabled(val) { this.enabled = val; }
}


// ─────────────────────────────────────────────────────────────────────────────
// PanelManager — layout switching and slot lifecycle
// ─────────────────────────────────────────────────────────────────────────────
class PanelManager {
    constructor(gridEl, syncController) {
        this.gridEl = gridEl;
        this.syncCtrl = syncController;
        this.panels = []; // PanelViewer[]
        this.currentLayout = 'split';
        this._setLayout('split');
    }

    _setLayout(layout) {
        const counts = { single: 1, split: 2, quad: 4 };
        const targetCount = counts[layout] ?? 2;
        this.currentLayout = layout;
        this.gridEl.className = `layout-${layout}`;

        // Destroy surplus panels
        while (this.panels.length > targetCount) {
            const p = this.panels.pop();
            this.syncCtrl.unregister(p);
            p.clearScene();
            p.slotEl.remove();
        }

        // Create missing panels
        while (this.panels.length < targetCount) {
            const slotEl = document.createElement('div');
            slotEl.className = 'panel-slot';
            slotEl.dataset.panelId = this.panels.length;
            this.gridEl.appendChild(slotEl);
            const viewer = new PanelViewer(slotEl, this.panels.length);
            this.syncCtrl.register(viewer);
            this.panels.push(viewer);
        }

        // Re-order in DOM (ensure correct order)
        this.panels.forEach(p => this.gridEl.appendChild(p.slotEl));

        // Resize all
        requestAnimationFrame(() => this.resizeAll());
    }

    switchLayout(layout) {
        if (layout === this.currentLayout) return;
        this._setLayout(layout);
    }

    resizeAll() {
        this.panels.forEach(p => p.resize());
    }

    getPanelBySlot(slotEl) {
        return this.panels.find(p => p.slotEl === slotEl) ?? null;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// AddSceneModal — form dialog for registering a new scene to localStorage
// ─────────────────────────────────────────────────────────────────────────────
class AddSceneModal {
    constructor(onSave) {
        this.onSave = onSave;
        this._buildDOM();
    }

    _buildDOM() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';
        this.overlay.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header">
          <h2 id="modal-title" class="modal-title">Register Scene</h2>
          <button class="modal-close" id="modal-close-btn" title="Close">✕</button>
        </div>

        <form id="add-scene-form" class="modal-form" novalidate>
          <div class="form-group">
            <label class="form-label" for="field-label">Scene Name <span class="required">*</span></label>
            <input class="form-input" id="field-label" type="text" placeholder="e.g. Garden — FM-LLPS" required />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="field-model">Model / Loss <span class="required">*</span></label>
              <input class="form-input" id="field-model" type="text" list="model-suggestions" placeholder="e.g. FM-LLPS" required />
              <datalist id="model-suggestions">
                <option value="L1 + SSIM"/>
                <option value="FM-LLPS"/>
                <option value="Hybrid α·L1+β·SSIM+γ·FM-LLPS"/>
              </datalist>
            </div>
            <div class="form-group">
              <label class="form-label" for="field-tag">Tag</label>
              <input class="form-input" id="field-tag" type="text" placeholder="BASELINE" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="field-url">Luma Capture URL <span class="required">*</span></label>
            <input class="form-input" id="field-url" type="url" placeholder="https://lumalabs.ai/capture/..." required />
          </div>

          <div class="form-divider"><span>Metrics <span class="form-optional">(optional)</span></span></div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="field-psnr">PSNR (dB)</label>
              <input class="form-input" id="field-psnr" type="number" step="0.01" min="0" placeholder="28.87" />
            </div>
            <div class="form-group">
              <label class="form-label" for="field-ssim">SSIM</label>
              <input class="form-input" id="field-ssim" type="number" step="0.001" min="0" max="1" placeholder="0.931" />
            </div>
            <div class="form-group">
              <label class="form-label" for="field-fmllps">FM-LLPS</label>
              <input class="form-input" id="field-fmllps" type="number" step="0.001" min="0" max="1" placeholder="0.412" />
            </div>
          </div>

          <div id="form-error" class="form-error" style="display:none"></div>

          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" id="modal-cancel-btn">Cancel</button>
            <button type="submit" class="btn btn-primary">Add Scene</button>
          </div>
        </form>
      </div>`;

        document.body.appendChild(this.overlay);

        // Wire close / cancel
        this.overlay.querySelector('#modal-close-btn').addEventListener('click', () => this.hide());
        this.overlay.querySelector('#modal-cancel-btn').addEventListener('click', () => this.hide());
        this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.hide(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.hide(); });

        // Submit
        this.overlay.querySelector('#add-scene-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this._handleSubmit();
        });
    }

    _handleSubmit() {
        const get = (id) => this.overlay.querySelector(id).value.trim();
        const errorEl = this.overlay.querySelector('#form-error');

        const label = get('#field-label');
        const model = get('#field-model');
        const url   = get('#field-url');

        // Validation
        if (!label || !model || !url) {
            errorEl.textContent = 'Scene Name, Model / Loss and URL are required.';
            errorEl.style.display = '';
            return;
        }
        try { new URL(url); } catch {
            errorEl.textContent = 'Please enter a valid URL.';
            errorEl.style.display = '';
            return;
        }
        errorEl.style.display = 'none';

        const toNum = (id) => { const v = parseFloat(get(id)); return isNaN(v) ? null : v; };

        const scene = {
            id: `custom-${Date.now()}`,
            label,
            model,
            tag: get('#field-tag') || model.toUpperCase().slice(0, 10),
            url,
            thumbnail: null,
            metrics: { psnr: toNum('#field-psnr'), ssim: toNum('#field-ssim'), fmllps: toNum('#field-fmllps') },
        };

        SceneRegistry.addScene(scene);
        this.onSave(scene);
        this._resetForm();
        this.hide();
    }

    _resetForm() {
        this.overlay.querySelector('#add-scene-form').reset();
        this.overlay.querySelector('#form-error').style.display = 'none';
    }

    show() {
        this.overlay.classList.add('visible');
        this.overlay.querySelector('#field-label').focus();
    }

    hide() { this.overlay.classList.remove('visible'); }
}


// ─────────────────────────────────────────────────────────────────────────────
// SceneSidebar — renders draggable scene cards
// ─────────────────────────────────────────────────────────────────────────────
class SceneSidebar {
    constructor(listEl, onDragStart, onAddClick) {
        this.listEl = listEl;
        this.onDragStart = onDragStart;
        this.onAddClick = onAddClick;
        this._render();
        this._buildAddButton();
    }

    refresh() { this._render(); }

    _render() {
        this.listEl.innerHTML = '';
        for (const scene of SceneRegistry.getAllScenes()) {
            const card = this._buildCard(scene);
            this.listEl.appendChild(card);
        }
    }

    _buildAddButton() {
        const footer = document.createElement('div');
        footer.className = 'sidebar-footer';
        const btn = document.createElement('button');
        btn.className = 'btn-add-scene';
        btn.id = 'add-scene-btn';
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
          Add Scene`;
        btn.addEventListener('click', () => this.onAddClick());
        footer.appendChild(btn);
        // Insert after scene-list
        this.listEl.parentElement.appendChild(footer);
    }

    _buildCard(scene) {
        const card = document.createElement('div');
        card.className = 'scene-card';
        card.draggable = true;
        card.dataset.sceneId = scene.id;

        // Drag handle
        const handle = document.createElement('div');
        handle.className = 'card-drag-handle';
        handle.innerHTML = '<span></span><span></span><span></span>';
        card.appendChild(handle);

        // Thumbnail
        const thumbEl = document.createElement('div');
        thumbEl.className = 'card-thumb';
        if (scene.thumbnail) {
            const img = document.createElement('img');
            img.src = scene.thumbnail;
            img.alt = scene.label;
            thumbEl.appendChild(img);
        } else {
            thumbEl.innerHTML = `
        <div class="card-thumb-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="4"/>
            <circle cx="5" cy="7" r="2"/>
            <circle cx="19" cy="7" r="2"/>
          </svg>
        </div>`;
        }
        card.appendChild(thumbEl);

        // Info
        const info = document.createElement('div');
        info.className = 'card-info';

        const label = document.createElement('div');
        label.className = 'card-label';
        label.textContent = scene.label;
        info.appendChild(label);

        const chips = document.createElement('div');
        chips.className = 'card-chips';

        const modelChip = document.createElement('span');
        modelChip.className = 'chip chip-model';
        modelChip.textContent = scene.model;
        chips.appendChild(modelChip);

        if (scene.metrics?.psnr != null) {
            const psnrChip = document.createElement('span');
            psnrChip.className = 'chip chip-psnr';
            psnrChip.textContent = `PSNR ${scene.metrics.psnr.toFixed(1)}`;
            chips.appendChild(psnrChip);
        }

        info.appendChild(chips);
        card.appendChild(info);

        // Delete button (custom scenes only)
        if (scene.custom) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'card-delete-btn';
            deleteBtn.title = 'Remove scene';
            deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>`;
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                SceneRegistry.removeScene(scene.id);
                this._render();
            });
            card.appendChild(deleteBtn);
        }

        // Drag events
        card.addEventListener('dragstart', (e) => {
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'copy';
            e.dataTransfer.setData('text/scene-id', scene.id);
            const ghost = document.createElement('div');
            ghost.className = 'drag-ghost';
            ghost.textContent = scene.label;
            document.body.appendChild(ghost);
            e.dataTransfer.setDragImage(ghost, 60, 16);
            setTimeout(() => ghost.remove(), 0);
            this.onDragStart(scene);
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
        });

        return card;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// DragDropController — connects sidebar → panel slots
// ─────────────────────────────────────────────────────────────────────────────
class DragDropController {
    constructor(panelManager) {
        this.panelManager = panelManager;
        this._activeDragScene = null;
        this._bindGrid();
    }

    setActiveDragScene(scene) { this._activeDragScene = scene; }

    _bindGrid() {
        const grid = this.panelManager.gridEl;

        grid.addEventListener('dragover', (e) => {
            const slot = e.target.closest('.panel-slot');
            if (!slot) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            slot.classList.add('drag-over');
        });

        grid.addEventListener('dragleave', (e) => {
            const slot = e.target.closest('.panel-slot');
            if (slot && !slot.contains(e.relatedTarget)) {
                slot.classList.remove('drag-over');
            }
        });

        grid.addEventListener('drop', (e) => {
            e.preventDefault();
            const slot = e.target.closest('.panel-slot');
            if (!slot) return;
            slot.classList.remove('drag-over');

            const sceneId = e.dataTransfer.getData('text/scene-id');
            const scene = SceneRegistry.findById(sceneId);
            if (!scene) return;

            const panel = this.panelManager.getPanelBySlot(slot);
            if (panel) panel.setScene(scene);
        });
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// HeaderBar — sync toggle and FPS counter
// ─────────────────────────────────────────────────────────────────────────────
class HeaderBar {
    constructor(syncCtrl) {
        this.syncCtrl = syncCtrl;
        this.fpsEl = document.getElementById('fps-counter');
        this.toggleBtn = document.getElementById('sync-toggle');

        this._lastTime = performance.now();
        this._frameCount = 0;

        this.toggleBtn.addEventListener('click', () => {
            const isOn = this.toggleBtn.getAttribute('aria-checked') === 'true';
            this.toggleBtn.setAttribute('aria-checked', String(!isOn));
            this.syncCtrl.setEnabled(!isOn);
        });

        this._startFPS();
    }

    _startFPS() {
        const tick = () => {
            requestAnimationFrame(tick);
            this._frameCount++;
            const now = performance.now();
            const elapsed = now - this._lastTime;
            if (elapsed >= 500) {
                const fps = Math.round((this._frameCount / elapsed) * 1000);
                this.fpsEl.textContent = Math.min(fps, 120);
                this._frameCount = 0;
                this._lastTime = now;
            }
        };
        tick();
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// CompareApp — root orchestrator
// ─────────────────────────────────────────────────────────────────────────────
class CompareApp {
    constructor() {
        this.syncCtrl = new CameraSyncController();
        this.panelManager = new PanelManager(
            document.getElementById('panel-grid'),
            this.syncCtrl
        );
        this.headerBar = new HeaderBar(this.syncCtrl);
        this.dragDropCtrl = new DragDropController(this.panelManager);

        this.modal = new AddSceneModal((newScene) => {
            this.sidebar.refresh();
        });

        this.sidebar = new SceneSidebar(
            document.getElementById('scene-list'),
            (scene) => this.dragDropCtrl.setActiveDragScene(scene),
            () => this.modal.show()
        );

        this._bindLayoutToolbar();
        this._bindResize();
    }

    _bindLayoutToolbar() {
        document.querySelectorAll('.layout-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.layout-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.panelManager.switchLayout(btn.dataset.layout);
            });
        });
    }

    _bindResize() {
        const ro = new ResizeObserver(() => {
            requestAnimationFrame(() => this.panelManager.resizeAll());
        });
        ro.observe(document.getElementById('panel-grid'));
        window.addEventListener('resize', () => this.panelManager.resizeAll());
    }
}

// Boot
new CompareApp();