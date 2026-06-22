export class SpectrogramRenderer {
  constructor(canvas, sampleRate = 16000) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sampleRate = sampleRate;
    this.freqMax = 5000;
    this.dynamicRange = 80;
    this._windowDuration = 10;
    this._frames = [];
    this._throttled = false;
    this._precomputeColorMap();

    this._boundResize = () => this._resize();
    window.addEventListener('resize', this._boundResize);
    this._resize();
  }

  destroy() {
    window.removeEventListener('resize', this._boundResize);
  }

  _precomputeColorMap() {
    this.colorMap = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      let r, g, b;
      if (t < 0.25) {
        const t2 = t / 0.25;
        r = 0; g = 0; b = 30 + t2 * 170;
      } else if (t < 0.50) {
        const t2 = (t - 0.25) / 0.25;
        r = 0; g = t2 * 200; b = 200;
      } else if (t < 0.75) {
        const t2 = (t - 0.50) / 0.25;
        r = t2 * 200; g = 200; b = 200 - t2 * 200;
      } else {
        const t2 = (t - 0.75) / 0.25;
        r = 200; g = 200 - t2 * 200; b = 0;
      }
      const off = i * 4;
      this.colorMap[off] = r;
      this.colorMap[off + 1] = g;
      this.colorMap[off + 2] = b;
      this.colorMap[off + 3] = 255;
    }
  }

  _resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = rect.height;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  pushFrame(magnitudes, time) {
    if (!magnitudes || magnitudes.length === 0) return;

    this._frames.push({ magnitudes, time });

    const cutoff = time - this._windowDuration;
    while (this._frames.length > 0 && this._frames[0].time < cutoff) {
      this._frames.shift();
    }

    if (!this._throttled) {
      this._throttled = true;
      requestAnimationFrame(() => {
        this._renderWindow()
        this._throttled = false;
      });
    }
  }

  _renderWindow() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === 0 || h === 0 || this._frames.length === 0) return;

    const currentTime = this._frames[this._frames.length - 1].time;
    const windowStart = currentTime - this._windowDuration;
    const binCount = this._frames[0].magnitudes.length;
    const nyquist = this.sampleRate / 2;

    const imageData = this.ctx.createImageData(w, h);
    const pixels = imageData.data;

    let frameIdx = 0;
    const frameCount = this._frames.length;

    for (let x = 0; x < w; x++) {
      const colTime = windowStart + (x / w) * this._windowDuration;

      while (frameIdx + 1 < frameCount && this._frames[frameIdx + 1].time <= colTime) {
        frameIdx++;
      }

      let bestIdx = frameIdx;
      if (frameIdx + 1 < frameCount) {
        const dCur = Math.abs(this._frames[frameIdx].time - colTime);
        const dNext = Math.abs(this._frames[frameIdx + 1].time - colTime);
        if (dNext < dCur) bestIdx = frameIdx + 1;
      } else if (frameIdx > 0) {
        const dCur = Math.abs(this._frames[frameIdx].time - colTime);
        const dPrev = Math.abs(this._frames[frameIdx - 1].time - colTime);
        if (dPrev < dCur) bestIdx = frameIdx - 1;
      }

      const mags = this._frames[bestIdx].magnitudes;

      for (let y = 0; y < h; y++) {
        const freq = this.freqMax - (y / h) * this.freqMax;
        const bin = Math.round(Math.min((freq / nyquist) * binCount, binCount - 1));
        const db = mags[bin];
        let t = Math.max(0, Math.min(1, (db + this.dynamicRange) / this.dynamicRange));
        const ci = Math.round(t * 255);
        const off = (y * w + x) * 4;
        pixels[off] = this.colorMap[ci * 4];
        pixels[off + 1] = this.colorMap[ci * 4 + 1];
        pixels[off + 2] = this.colorMap[ci * 4 + 2];
        pixels[off + 3] = 255;
      }
    }

    this.ctx.putImageData(imageData, 0, 0);
  }

  displayAll(frames) {
    if (frames.length === 0) return;
    this._frames = frames;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === 0 || h === 0) return;

    const binCount = frames[0].magnitudes.length;
    const imageData = this.ctx.createImageData(w, h);
    const pixels = imageData.data;
    const nyquist = this.sampleRate / 2;

    for (let x = 0; x < w; x++) {
      const frameIdx = Math.floor((x / w) * frames.length);
      const mags = frames[frameIdx].magnitudes;
      for (let y = 0; y < h; y++) {
        const freq = this.freqMax - (y / h) * this.freqMax;
        const bin = Math.round(Math.min((freq / nyquist) * binCount, binCount - 1));
        const db = mags[bin];
        let t = Math.max(0, Math.min(1, (db + this.dynamicRange) / this.dynamicRange));
        const ci = Math.round(t * 255);
        const off = (y * w + x) * 4;
        pixels[off] = this.colorMap[ci * 4];
        pixels[off + 1] = this.colorMap[ci * 4 + 1];
        pixels[off + 2] = this.colorMap[ci * 4 + 2];
        pixels[off + 3] = 255;
      }
    }
    this.ctx.putImageData(imageData, 0, 0);
  }

  clear() {
    this._frames = [];
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
