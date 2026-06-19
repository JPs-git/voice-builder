export class SpectrogramRenderer {
  constructor(canvas, sampleRate = 44100) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sampleRate = sampleRate;
    this.freqMax = 5000;
    this.dynamicRange = 80;
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
    // After resize, fill with black (canvas content is lost anyway)
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  pushFrame(magnitudes, time) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === 0 || h === 0 || !magnitudes || magnitudes.length === 0) return;

    // Build 1px-wide column of colored pixels
    const imageData = this.ctx.createImageData(1, h);
    const data = imageData.data;
    const binCount = magnitudes.length;
    const nyquist = this.sampleRate / 2;

    for (let y = 0; y < h; y++) {
      const freq = this.freqMax - (y / h) * this.freqMax;
      const bin = Math.round(Math.min((freq / nyquist) * binCount, binCount - 1));
      const db = magnitudes[bin];
      let t = Math.max(0, Math.min(1, (db + this.dynamicRange) / this.dynamicRange));
      const ci = Math.round(t * 255) * 4;
      const off = y * 4;
      data[off] = this.colorMap[ci];
      data[off + 1] = this.colorMap[ci + 1];
      data[off + 2] = this.colorMap[ci + 2];
      data[off + 3] = 255;
    }

    // Scroll left by 1px, draw new column at right edge
    this.ctx.drawImage(this.canvas, 1, 0, w - 1, h, 0, 0, w - 1, h);
    this.ctx.putImageData(imageData, w - 1, 0);
  }

  clear() {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
