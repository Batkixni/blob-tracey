export type SourceType = 'image' | 'video' | 'webcam' | 'synthetic';

export class VideoSource {
  private currentType: SourceType = 'image';
  private imageElement: HTMLImageElement | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private syntheticCanvas: HTMLCanvasElement;
  private syntheticCtx: CanvasRenderingContext2D;
  private webcamStream: MediaStream | null = null;
  private syntheticAngle = 0;

  public onSourceChanged: (() => void) | null = null;

  constructor() {
    this.syntheticCanvas = document.createElement('canvas');
    this.syntheticCanvas.width = 1280;
    this.syntheticCanvas.height = 720;
    this.syntheticCtx = this.syntheticCanvas.getContext('2d')!;

    // Create shared video element
    this.videoElement = document.createElement('video');
    this.videoElement.autoplay = true;
    this.videoElement.loop = true;
    this.videoElement.muted = true;
    this.videoElement.playsInline = true;
  }

  public async loadSampleImage(url: string): Promise<void> {
    this.stopMediaStream();
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.imageElement = img;
        this.currentType = 'image';
        if (this.onSourceChanged) this.onSourceChanged();
        resolve();
      };
      img.onerror = (e) => reject(e);
      img.src = url;
    });
  }

  public async loadUserImageFile(file: File): Promise<void> {
    const url = URL.createObjectURL(file);
    await this.loadSampleImage(url);
  }

  public async loadUserVideoFile(file: File): Promise<void> {
    this.stopMediaStream();
    const url = URL.createObjectURL(file);
    this.currentType = 'video';
    this.videoElement!.src = url;
    await this.videoElement!.play();
    if (this.onSourceChanged) this.onSourceChanged();
  }

  public async startWebcam(): Promise<void> {
    this.stopMediaStream();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    this.webcamStream = stream;
    this.currentType = 'webcam';
    this.videoElement!.srcObject = stream;
    await this.videoElement!.play();
    if (this.onSourceChanged) this.onSourceChanged();
  }

  public useSynthetic(): void {
    this.stopMediaStream();
    this.currentType = 'synthetic';
    if (this.onSourceChanged) this.onSourceChanged();
  }

  public stopMediaStream(): void {
    if (this.webcamStream) {
      this.webcamStream.getTracks().forEach(t => t.stop());
      this.webcamStream = null;
    }
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.src = '';
      this.videoElement.srcObject = null;
    }
  }

  public update(): void {
    if (this.currentType === 'synthetic') {
      this.renderSyntheticFrame();
    }
  }

  private renderSyntheticFrame(): void {
    const ctx = this.syntheticCtx;
    const w = this.syntheticCanvas.width;
    const h = this.syntheticCanvas.height;

    // Dark cyberpunk background grid
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, w, h);

    // Subtle background grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    this.syntheticAngle += 0.02;

    // Draw several moving geometric targets (blue, cyan, white)
    const shapes = [
      { x: w * 0.3 + Math.cos(this.syntheticAngle * 1.3) * 160, y: h * 0.4 + Math.sin(this.syntheticAngle) * 90, r: 60, color: '#0070f3' },
      { x: w * 0.65 + Math.sin(this.syntheticAngle * 0.9) * 180, y: h * 0.5 + Math.cos(this.syntheticAngle * 1.1) * 110, r: 85, color: '#00d2ff' },
      { x: w * 0.5 + Math.cos(this.syntheticAngle * 0.7) * 120, y: h * 0.75 + Math.sin(this.syntheticAngle * 1.5) * 60, r: 45, color: '#38bdf8' },
      { x: w * 0.2 + Math.sin(this.syntheticAngle * 1.6) * 90, y: h * 0.7 + Math.cos(this.syntheticAngle * 0.8) * 80, r: 50, color: '#ffffff' },
      { x: w * 0.8 + Math.cos(this.syntheticAngle * 1.1) * 80, y: h * 0.3 + Math.sin(this.syntheticAngle * 1.4) * 70, r: 40, color: '#2563eb' },
    ];

    for (const s of shapes) {
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();

      // White high-contrast center core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  public getSource(): CanvasImageSource {
    switch (this.currentType) {
      case 'image':
        return this.imageElement || this.syntheticCanvas;
      case 'video':
      case 'webcam':
        return this.videoElement!;
      case 'synthetic':
        return this.syntheticCanvas;
    }
  }

  public getWidth(): number {
    switch (this.currentType) {
      case 'image':
        return this.imageElement?.naturalWidth || 1280;
      case 'video':
      case 'webcam':
        return this.videoElement?.videoWidth || 1280;
      case 'synthetic':
        return this.syntheticCanvas.width;
    }
  }

  public getHeight(): number {
    switch (this.currentType) {
      case 'image':
        return this.imageElement?.naturalHeight || 720;
      case 'video':
      case 'webcam':
        return this.videoElement?.videoHeight || 720;
      case 'synthetic':
        return this.syntheticCanvas.height;
    }
  }

  public getType(): SourceType {
    return this.currentType;
  }

  public hasSource(): boolean {
    if (this.currentType === 'image') {
      return this.imageElement !== null && this.imageElement.complete && this.imageElement.naturalWidth > 0;
    }
    if (this.currentType === 'video' || this.currentType === 'webcam') {
      return this.videoElement !== null && this.videoElement.videoWidth > 0;
    }
    if (this.currentType === 'synthetic') {
      return true;
    }
    return false;
  }

  public clearSource(): void {
    this.stopMediaStream();
    this.imageElement = null;
    if (this.onSourceChanged) this.onSourceChanged();
  }

  public getVideoElement(): HTMLVideoElement | null {
    return (this.currentType === 'video' || this.currentType === 'webcam') ? this.videoElement : null;
  }
}
