import './style.css';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { loadManifest, getManifest, getAllScenes, findById } from './config.js';
import { ImageComparePanel } from './imageCompare.js';

// ─────────────────────────────────────────────────────────────────────────────
// SceneRegistry — wraps manifest-driven config.js
// ─────────────────────────────────────────────────────────────────────────────
class SceneRegistry {
    static getAllScenes() { return getAllScenes(); }
    static findById(id)   { return findById(id); }
}

// ─────────────────────────────────────────────────────────────────────────────
// SessionStore — persists layout, panel assignments & sync state to localStorage
// ─────────────────────────────────────────────────────────────────────────────
class SessionStore {
    static KEYS = {
        layout: 'gsplat_layout',
        panels: 'gsplat_panel_state',
        sync:   'gsplat_sync_enabled',
        mode:   'gsplat_view_mode',
    };

    static saveLayout(layout) {
        try { localStorage.setItem(this.KEYS.layout, layout); } catch {}
    }

    static savePanels(panels) {
        try {
            const state = panels.map((p, i) => ({
                slot: i,
                sceneId: p.sceneConfig?.id ?? null,
            }));
            localStorage.setItem(this.KEYS.panels, JSON.stringify(state));
        } catch {}
    }

    static saveSync(enabled) {
        try { localStorage.setItem(this.KEYS.sync, String(enabled)); } catch {}
    }

    static saveMode(mode) {
        try { localStorage.setItem(this.KEYS.mode, mode); } catch {}
    }

    static load() {
        try {
            return {
                layout: localStorage.getItem(this.KEYS.layout) ?? 'split',
                panels: JSON.parse(localStorage.getItem(this.KEYS.panels) || '[]'),
                sync:   localStorage.getItem(this.KEYS.sync) !== 'false',
                mode:   localStorage.getItem(this.KEYS.mode) ?? '3d',
            };
        } catch {
            return { layout: 'split', panels: [], sync: true, mode: '3d' };
        }
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
        this.sparkRenderer = null;

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

        // SparkRenderer manages GPU-based splat sorting for this panel
        this.sparkRenderer = new SparkRenderer({ renderer: this.renderer });
        this.threeScene.add(this.sparkRenderer);

        this._startLoop();
    }

    _destroyThree() {
        if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
        if (this.splat) { this.threeScene.remove(this.splat); this.splat.dispose?.(); this.splat = null; }
        if (this.sparkRenderer) { this.threeScene.remove(this.sparkRenderer); this.sparkRenderer.dispose?.(); this.sparkRenderer = null; }
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
        if (this._onStateChange) this._onStateChange();

        this._showLoading();
        this._initThree();

        // SplatMesh loads .splat / .ply / .spz files natively
        this.splat = new SplatMesh({ url: sceneConfig.url });

        // .splat files use OpenCV convention (Y-down, Z-forward).
        // Rotate 180° on X to convert to Three.js Y-up coordinate system.
        const rot = sceneConfig.rotation ?? [Math.PI, 0, 0]; // [x, y, z] euler radians
        this.splat.rotation.set(rot[0], rot[1], rot[2]);

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

        // Spark fires 'loaded' when the splat file is fully parsed
        this.splat.addEventListener('loaded', ready, { once: true });
        this._loadingFallback = setTimeout(ready, 4000); // fallback if event doesn't fire

        this.resize();
    }

    /** Clear the panel back to drop-zone state */
    clearScene(resetUI = true) {
        clearTimeout(this._loadingFallback);
        this.sceneConfig = null;
        this._destroyThree();
        if (resetUI) {
            this._showDropZone();
            if (this._onStateChange) this._onStateChange();
        }
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

    switchLayout(layout, silent = false) {
        if (layout === this.currentLayout) return;
        this._setLayout(layout);
        if (!silent) SessionStore.saveLayout(layout);
    }

    resizeAll() {
        this.panels.forEach(p => p.resize());
    }

    getPanelBySlot(slotEl) {
        return this.panels.find(p => p.slotEl === slotEl) ?? null;
    }
}



// ─────────────────────────────────────────────────────────────────────────────
// SceneSidebar — renders draggable scene cards
// ─────────────────────────────────────────────────────────────────────────────
class SceneSidebar {
    constructor(listEl, onDragStart) {
        this.listEl = listEl;
        this.onDragStart = onDragStart;
    }

    render() {
        this.listEl.innerHTML = '';
        const scenes = SceneRegistry.getAllScenes();

        if (scenes.length === 0) {
            this.listEl.innerHTML = `<div class="sidebar-empty">No scenes found in scenes.json</div>`;
            return;
        }

        // Group by sceneId for visual grouping
        const groups = {};
        for (const scene of scenes) {
            if (!groups[scene.sceneId]) groups[scene.sceneId] = [];
            groups[scene.sceneId].push(scene);
        }

        for (const [sceneId, variants] of Object.entries(groups)) {
            // Scene group header
            const groupHeader = document.createElement('div');
            groupHeader.className = 'scene-group-header';
            groupHeader.textContent = variants[0].label.split('—')[0].trim();
            this.listEl.appendChild(groupHeader);

            for (const scene of variants) {
                const card = this._buildCard(scene);
                this.listEl.appendChild(card);
            }
        }
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
        // Show variant label only (after the '—')
        label.textContent = scene.label.includes('—')
            ? scene.label.split('—')[1].trim()
            : scene.label;
        info.appendChild(label);

        const chips = document.createElement('div');
        chips.className = 'card-chips';

        if (scene.tag) {
            const tagChip = document.createElement('span');
            tagChip.className = `chip chip-tag chip-tag-${scene.tag.toLowerCase()}`;
            tagChip.textContent = scene.tag;
            chips.appendChild(tagChip);
        }

        if (scene.metrics?.psnr != null) {
            const psnrChip = document.createElement('span');
            psnrChip.className = 'chip chip-psnr';
            psnrChip.textContent = `PSNR ${scene.metrics.psnr.toFixed(1)}`;
            chips.appendChild(psnrChip);
        }

        info.appendChild(chips);
        card.appendChild(info);

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
            const next = !isOn;
            this.toggleBtn.setAttribute('aria-checked', String(next));
            this.syncCtrl.setEnabled(next);
            SessionStore.saveSync(next);
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
// ModeController — switches between 3D view and Image Compare view
// ─────────────────────────────────────────────────────────────────────────────
class ModeController {
    constructor(panelManager) {
        this.panelManager = panelManager;
        this.currentMode  = '3d';

        this.view3d      = document.getElementById('view-3d');
        this.viewCompare = document.getElementById('view-compare');
        this.syncWrap    = document.getElementById('sync-control-wrap');
        this.fpsWrap     = document.getElementById('fps-display-wrap');

        this.btn3d      = document.getElementById('mode-3d');
        this.btnCompare = document.getElementById('mode-compare');

        this.btn3d.addEventListener('click',      () => this.switchTo('3d'));
        this.btnCompare.addEventListener('click', () => this.switchTo('compare'));
    }

    switchTo(mode, silent = false) {
        if (mode === this.currentMode) return;
        this.currentMode = mode;

        const is3d = mode === '3d';
        this.view3d.style.display      = is3d ? '' : 'none';
        this.viewCompare.style.display = is3d ? 'none' : '';
        this.syncWrap.style.display    = is3d ? '' : 'none';
        this.fpsWrap.style.display     = is3d ? '' : 'none';

        this.btn3d.classList.toggle('active',      is3d);
        this.btnCompare.classList.toggle('active', !is3d);

        if (is3d) {
            // Trigger resize so Three.js panels recalculate
            requestAnimationFrame(() => this.panelManager.resizeAll());
        }

        if (!silent) SessionStore.saveMode(mode);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// CompareApp — root orchestrator
// ─────────────────────────────────────────────────────────────────────────────
class CompareApp {
    constructor() {
        this.syncCtrl    = new CameraSyncController();
        this.panelManager = new PanelManager(
            document.getElementById('panel-grid'),
            this.syncCtrl
        );
        this.headerBar    = new HeaderBar(this.syncCtrl);
        this.dragDropCtrl = new DragDropController(this.panelManager);
        this.modeCtrl     = new ModeController(this.panelManager);

        this.sidebar = new SceneSidebar(
            document.getElementById('scene-list'),
            (scene) => this.dragDropCtrl.setActiveDragScene(scene)
        );

        this.imageCompare = new ImageComparePanel(
            document.getElementById('image-compare-panel')
        );

        this._bindLayoutToolbar();
        this._bindResize();

        // Load manifest then boot
        this._boot();
    }

    async _boot() {
        const manifest = await loadManifest();

        // Feed manifest to both the sidebar and image compare panel
        this.sidebar.render();
        this.imageCompare.setManifest(manifest);

        // Restore session (layout, panels, mode)
        this._restoreSession();
    }

    // ── Wire each panel so any state change auto-saves to localStorage ──────────
    _hookPanelSave() {
        const save = () => SessionStore.savePanels(this.panelManager.panels);
        for (const panel of this.panelManager.panels) {
            panel._onStateChange = save;
        }
    }

    // ── Restore persisted layout, sync state, mode, and panel assignments ───────
    _restoreSession() {
        const saved = SessionStore.load();

        // 1. Restore layout (silent = skip saving back while restoring)
        const layoutToRestore = saved.layout;
        if (layoutToRestore !== this.panelManager.currentLayout) {
            this.panelManager.switchLayout(layoutToRestore, true);
            document.querySelectorAll('.layout-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.layout === layoutToRestore);
            });
        }

        // 2. Restore sync toggle UI
        const syncEnabled = saved.sync;
        this.syncCtrl.setEnabled(syncEnabled);
        const toggleBtn = document.getElementById('sync-toggle');
        if (toggleBtn) toggleBtn.setAttribute('aria-checked', String(syncEnabled));

        // 3. Hook panel save callbacks
        this._hookPanelSave();

        // 4. Restore panel scene assignments
        requestAnimationFrame(() => {
            for (const entry of saved.panels) {
                if (entry.sceneId == null) continue;
                const scene = SceneRegistry.findById(entry.sceneId);
                const panel = this.panelManager.panels[entry.slot];
                if (scene && panel) panel.setScene(scene);
            }
        });

        // 5. Restore view mode
        if (saved.mode === 'compare') {
            this.modeCtrl.switchTo('compare', true);
        }
    }

    _bindLayoutToolbar() {
        document.querySelectorAll('.layout-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.layout-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.panelManager.switchLayout(btn.dataset.layout);
                this._hookPanelSave();
                SessionStore.savePanels(this.panelManager.panels);
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