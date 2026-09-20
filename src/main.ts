import './style.css';
import { VideoSource } from './core/VideoSource';
import { BlobDetector } from './core/BlobDetector';
import { ConnectedComponents } from './core/ConnectedComponents';
import { BlobTracker } from './core/BlobTracker';
import { Topology } from './core/Topology';
import { OverlayRenderer } from './render/OverlayRenderer';
import { ControlPanel } from './ui/ControlPanel';
import { DEFAULT_CONFIG, PRESETS } from './ui/Presets';
import { TrackerConfig } from './core/types';

class App {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private videoSource: VideoSource;
  private blobDetector: BlobDetector;
  private ccl: ConnectedComponents;
  private blobTracker: BlobTracker;
  private topology: Topology;
  private renderer: OverlayRenderer;
  private controlPanel: ControlPanel;
  private config: TrackerConfig;

  private lastTime = performance.now();
  private frameCount = 0;
  private currentFps = 60.0;

  // Zoom & Pan Viewport State
  private zoom = 1.0;
  private panX = 0;
  private panY = 0;
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private hasMovedDuringPan = false;
  private isSpaceDown = false;
  private canvasWrapper!: HTMLElement;
  private viewport!: HTMLElement;
  private hudZoom!: HTMLElement;

  constructor() {
    this.canvas = document.getElementById('mainCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;

    this.videoSource = new VideoSource();
    this.blobDetector = new BlobDetector();
    this.ccl = new ConnectedComponents();
    this.blobTracker = new BlobTracker();
    this.topology = new Topology();
    this.renderer = new OverlayRenderer();

    this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

    this.controlPanel = new ControlPanel(this.config, (newConf) => {
      this.config = newConf;
    });

    this.initEventListeners();
    this.initEyedropper();
    this.initZoomAndPan();

    // Start in empty state: artist selects or drops their image first
    this.showCanvasWorkspace(false);

    // Start render loop
    requestAnimationFrame(this.loop.bind(this));
  }

  private showCanvasWorkspace(show: boolean) {
    const canvas = document.getElementById('mainCanvas');
    const emptyState = document.getElementById('emptyState');
    const hudBar = document.getElementById('hudBar');
    if (canvas) canvas.style.display = show ? 'block' : 'none';
    if (emptyState) emptyState.style.display = show ? 'none' : 'flex';
    if (hudBar) hudBar.style.display = show ? 'flex' : 'none';
  }

  private initEventListeners() {
    const btnUpload = document.getElementById('btnUpload')!;
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    const btnEmptySelect = document.getElementById('btnEmptySelect');
    const emptyDropArea = document.getElementById('emptyDropArea');
    const btnSnapshot = document.getElementById('btnSnapshot')!;
    const btnReset = document.getElementById('btnReset')!;
    const btnImportJson = document.getElementById('btnImportJson')!;
    const jsonFileInput = document.getElementById('jsonFileInput') as HTMLInputElement;
    const btnExportJson = document.getElementById('btnExportJson')!;

    // Open image file picker
    btnEmptySelect?.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    emptyDropArea?.addEventListener('click', () => {
      fileInput.click();
    });

    btnUpload.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (file.type.startsWith('image/')) {
        await this.videoSource.loadUserImageFile(file);
        this.resetZoom();
        this.showCanvasWorkspace(true);
      }
    });

    // JSON Parameters Import & Export
    btnImportJson.addEventListener('click', () => {
      jsonFileInput.click();
    });

    jsonFileInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      this.importConfigJson(file);
      jsonFileInput.value = '';
    });

    btnExportJson.addEventListener('click', () => {
      this.exportConfigJson();
    });

    // Reset Parameters to Default
    btnReset.addEventListener('click', () => {
      this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      this.controlPanel.setConfig(this.config);
      this.resetZoom();
    });

    // Snapshot Lossless PNG Export
    btnSnapshot.addEventListener('click', () => {
      this.takeSnapshot();
    });

    // Drag and drop image onto canvas/viewport
    const canvasWrapper = document.getElementById('canvasWrapper');
    if (canvasWrapper) {
      ['dragenter', 'dragover'].forEach(eventName => {
        canvasWrapper.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          canvasWrapper.classList.add('drag-over');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        canvasWrapper.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          canvasWrapper.classList.remove('drag-over');
        });
      });

      canvasWrapper.addEventListener('drop', async (e: DragEvent) => {
        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;
        const file = files[0];
        if (file.type.startsWith('image/')) {
          await this.videoSource.loadUserImageFile(file);
          this.resetZoom();
          this.showCanvasWorkspace(true);
        } else if (file.name.endsWith('.json')) {
          this.importConfigJson(file);
        }
      });
    }
  }

  private exportConfigJson() {
    const jsonString = JSON.stringify(this.config, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `blob_tracker_config_${Date.now()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  private importConfigJson(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        const merged: TrackerConfig = {
          ...DEFAULT_CONFIG,
          ...parsed,
          detection: { ...DEFAULT_CONFIG.detection, ...(parsed.detection || {}) },
          boxes: { ...DEFAULT_CONFIG.boxes, ...(parsed.boxes || {}) },
          markers: { ...DEFAULT_CONFIG.markers, ...(parsed.markers || {}) },
          labels: { ...DEFAULT_CONFIG.labels, ...(parsed.labels || {}) },
          lines: { ...DEFAULT_CONFIG.lines, ...(parsed.lines || {}) },
          regionFX: { ...DEFAULT_CONFIG.regionFX, ...(parsed.regionFX || {}) },
          compositing: { ...DEFAULT_CONFIG.compositing, ...(parsed.compositing || {}) },
          animation: { ...DEFAULT_CONFIG.animation, ...(parsed.animation || {}) },
          hudExtras: { ...DEFAULT_CONFIG.hudExtras, ...(parsed.hudExtras || {}) },
        };
        this.config = merged;
        this.controlPanel.setConfig(this.config);
      } catch (err) {
        alert('JSON 參數檔案解析失敗，請確認檔案格式是否正確。');
      }
    };
    reader.readAsText(file);
  }

  private toggleBottomBar(show: boolean) {
    const bar = document.getElementById('bottomBar');
    if (bar) bar.style.display = show ? 'flex' : 'none';
  }

  private initEyedropper() {
    const dropper = document.getElementById('dropperIndicator');
    if (!dropper) return;

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.config.detection.mode !== 'color_key' || this.isPanning) {
        dropper.style.display = 'none';
        return;
      }
      dropper.style.display = 'block';
      const rect = this.canvas.getBoundingClientRect();
      dropper.style.left = `${e.clientX}px`;
      dropper.style.top = `${e.clientY}px`;
    });

    this.canvas.addEventListener('mouseleave', () => {
      dropper.style.display = 'none';
    });

    this.canvas.addEventListener('click', (e) => {
      if (this.config.detection.mode !== 'color_key') return;
      if (this.hasMovedDuringPan) return;

      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;

      const px = Math.floor((e.clientX - rect.left) * scaleX);
      const py = Math.floor((e.clientY - rect.top) * scaleY);

      if (px >= 0 && px < this.canvas.width && py >= 0 && py < this.canvas.height) {
        const pixel = this.ctx.getImageData(px, py, 1, 1).data;
        const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
        this.config.detection.keyColor = hex;
        this.controlPanel.renderAllControls();
      }
    });
  }

  private applyTransform() {
    if (this.canvasWrapper) {
      this.canvasWrapper.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    }
    if (this.hudZoom) {
      this.hudZoom.textContent = `${Math.round(this.zoom * 100)}%`;
    }
  }

  private resetZoom() {
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.applyTransform();
  }

  private initZoomAndPan() {
    this.canvasWrapper = document.getElementById('canvasWrapper')!;
    this.viewport = document.getElementById('viewport')!;
    this.hudZoom = document.getElementById('hudZoom')!;
    const btnZoomReset = document.getElementById('btnZoomReset');

    btnZoomReset?.addEventListener('click', () => {
      this.resetZoom();
    });

    // Double-click on viewport/canvas to reset zoom and center
    this.viewport.addEventListener('dblclick', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.viewport-hud-bar')) return;
      if (this.videoSource.hasSource()) {
        this.resetZoom();
      }
    });

    // Mouse wheel zoom centered under cursor
    this.viewport.addEventListener('wheel', (e: WheelEvent) => {
      if (!this.videoSource.hasSource()) return;
      e.preventDefault();

      const prevZoom = this.zoom;
      // Scrolling up zooms in, down zooms out
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      const nextZoom = Math.min(10.0, Math.max(0.15, prevZoom * factor));

      if (Math.abs(nextZoom - prevZoom) < 0.001) return;

      const rect = this.canvasWrapper.getBoundingClientRect();
      const currCenterX = rect.left + rect.width / 2;
      const currCenterY = rect.top + rect.height / 2;

      const ratio = nextZoom / prevZoom;
      this.panX += (1 - ratio) * (e.clientX - currCenterX);
      this.panY += (1 - ratio) * (e.clientY - currCenterY);
      this.zoom = nextZoom;

      this.applyTransform();
    }, { passive: false });

    // Spacebar listener for Photoshop Hand Tool
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        this.isSpaceDown = true;
        if (this.videoSource.hasSource() && !this.isPanning) {
          this.viewport.style.cursor = 'grab';
        }
      }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        this.isSpaceDown = false;
        if (!this.isPanning) {
          this.viewport.style.cursor = '';
        }
      }
    });

    // Start panning with Middle click, Right click, Space+Left, or Left drag
    this.viewport.addEventListener('mousedown', (e: MouseEvent) => {
      if (!this.videoSource.hasSource()) return;
      if ((e.target as HTMLElement).closest('.viewport-hud-bar')) return;

      const isMiddle = e.button === 1;
      const isRight = e.button === 2;
      const isSpaceLeft = e.button === 0 && this.isSpaceDown;
      const isBackgroundLeft = e.button === 0 && (e.target === this.viewport || e.target === this.canvasWrapper);
      const isCanvasLeft = e.button === 0 && e.target === this.canvas;

      if (isMiddle || isRight || isSpaceLeft || isBackgroundLeft || isCanvasLeft) {
        this.isPanning = true;
        this.hasMovedDuringPan = false;
        this.panStartX = e.clientX;
        this.panStartY = e.clientY;
        this.viewport.style.cursor = 'grabbing';
        if (isMiddle || isRight) {
          e.preventDefault();
        }
      }
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isPanning) return;

      const dx = e.clientX - this.panStartX;
      const dy = e.clientY - this.panStartY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        this.hasMovedDuringPan = true;
      }

      this.panX += dx;
      this.panY += dy;
      this.panStartX = e.clientX;
      this.panStartY = e.clientY;

      this.applyTransform();
    });

    window.addEventListener('mouseup', () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.viewport.style.cursor = this.isSpaceDown ? 'grab' : '';
      }
    });

    // Prevent default context menu if user dragged with right click
    this.viewport.addEventListener('contextmenu', (e: MouseEvent) => {
      if (this.hasMovedDuringPan || this.isPanning) {
        e.preventDefault();
      }
    });
  }

  private takeSnapshot() {
    const link = document.createElement('a');
    link.download = `blob_track_${Date.now()}.png`;
    link.href = this.canvas.toDataURL('image/png');
    link.click();
  }

  private loop(now: number) {
    // Calculate FPS
    this.frameCount++;
    if (now - this.lastTime >= 500) {
      this.currentFps = (this.frameCount * 1000) / (now - this.lastTime);
      this.frameCount = 0;
      this.lastTime = now;
      const fpsEl = document.getElementById('hudFps');
      if (fpsEl) fpsEl.textContent = this.currentFps.toFixed(1);
    }

    this.videoSource.update();

    if (!this.videoSource.hasSource()) {
      requestAnimationFrame(this.loop.bind(this));
      return;
    }

    const src = this.videoSource.getSource();
    const sw = this.videoSource.getWidth();
    const sh = this.videoSource.getHeight();

    if (sw > 0 && sh > 0) {
      if (this.canvas.width !== sw || this.canvas.height !== sh) {
        this.canvas.width = sw;
        this.canvas.height = sh;
      }

      // 1. Detection
      const detection = this.blobDetector.detect(src, sw, sh, this.config);

      // 2. Connected Component Labeling
      const rawBlobs = this.ccl.extractBlobs(
        detection.mask,
        detection.width,
        detection.height,
        detection.scaleX,
        detection.scaleY,
        this.config
      );

      // 3. Temporal Tracking & Smoothing
      const trackedBlobs = this.blobTracker.update(rawBlobs, this.config);

      // 4. Topology Connection Lines
      const edges = this.topology.generateEdges(trackedBlobs, this.config);

      // 5. Render All Elements
      this.renderer.render(
        this.ctx,
        sw,
        sh,
        src,
        trackedBlobs,
        edges,
        detection,
        this.config,
        this.currentFps
      );

      // Update Viewport HUD Info
      const blobCountEl = document.getElementById('hudBlobCount');
      if (blobCountEl) blobCountEl.textContent = trackedBlobs.length.toString();
      const modeEl = document.getElementById('hudMode');
      if (modeEl) modeEl.textContent = this.config.detection.mode.toUpperCase();
    }

    requestAnimationFrame(this.loop.bind(this));
  }
}

// Boot application
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
