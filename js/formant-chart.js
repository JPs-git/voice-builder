export class FormantChartRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.freqMax = 5000;
    this.data = [];
    this.windowSeconds = 3;
    this._dotRadius = 2;
    this._batchMode = false;
    this._snapshot = null;
    this._dpr = 1;

    this._boundResize = () => this._resize();
    window.addEventListener('resize', this._boundResize);
    this._resize();
  }

  get batchMode() { return this._batchMode }

  destroy() {
    window.removeEventListener('resize', this._boundResize);
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
    this.ctx.fillStyle = '#111';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this._dpr = dpr;
    if (this._batchMode && this.data.length > 0) {
      this._drawAllFrames();
    }
  }

  _freqToY(freq) {
    return this.canvas.height - (freq / this.freqMax) * this.canvas.height;
  }

  pushFrame(formantFrame, time) {
    if (this._batchMode) return;
    this.data.push({ ...formantFrame, time });
    const cutoff = time - this.windowSeconds;
    while (this.data.length > 1 && this.data[0].time < cutoff) {
      this.data.shift();
    }

    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === 0 || h === 0) return;

    const ctx = this.ctx;

    ctx.drawImage(this.canvas, 1, 0, w - 1, h, 0, 0, w - 1, h);

    ctx.fillStyle = '#111';
    ctx.fillRect(w - 1, 0, 1, h);

    const keys = ['f0', 'f1', 'f2', 'f3', 'f4'];
    const colors = { f0: '#ffffff', f1: '#ff4444', f2: '#4488ff', f3: '#44cc44', f4: '#ff8844' };

    for (const key of keys) {
      const freq = formantFrame[key];
      if (freq == null || isNaN(freq)) continue;
      const y = Math.round(this._freqToY(freq));
      ctx.fillStyle = colors[key];
      if (key === 'f0' && this._lastF0 != null && !isNaN(this._lastF0)) {
        const lastY = Math.round(this._freqToY(this._lastF0));
        const minY = Math.min(lastY, y);
        const maxY = Math.max(lastY, y);
        ctx.fillRect(w - 1, minY, 1, maxY - minY + 1);
      } else {
        ctx.fillRect(w - 1, y, 1, 1);
      }
    }
    this._lastF0 = formantFrame.f0 != null && !isNaN(formantFrame.f0) ? formantFrame.f0 : null;
  }

  saveSnapshot() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w > 0 && h > 0) {
      this._snapshot = this.ctx.getImageData(0, 0, w, h);
    }
  }

  restoreSnapshot() {
    if (this._snapshot) {
      this.ctx.putImageData(this._snapshot, 0, 0);
    }
  }

  displayAll(frames) {
    this._batchMode = true;
    this.data = frames;
    this._drawAllFrames();
    this.saveSnapshot();
  }

  _drawAllFrames() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === 0 || h === 0 || this.data.length === 0) return;

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);

    const keys = ['f0', 'f1', 'f2', 'f3', 'f4'];
    const colors = { f0: '#ffffff', f1: '#ff4444', f2: '#4488ff', f3: '#44cc44', f4: '#ff8844' };

    for (const key of keys) {
      ctx.strokeStyle = colors[key];
      ctx.fillStyle = colors[key];
      ctx.lineWidth = 1.5 * this._dpr;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < this.data.length; i++) {
        const freq = this.data[i][key];
        if (freq == null || isNaN(freq)) { started = false; continue; }
        const x = (i / this.data.length) * w;
        const y = this._freqToY(freq);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else { ctx.lineTo(x, y); }
      }
      ctx.stroke();
    }
  }

  showVerticalLine(x, frame) {
    const ctx = this.ctx;
    const h = this.canvas.height;

    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.setLineDash([]);

    const dpr = this._dpr || 1;
    const labels = [
      { key: 'f0', color: '#ffe066' },
      { key: 'f1', color: '#ff4444' },
      { key: 'f2', color: '#4488ff' },
      { key: 'f3', color: '#44cc44' },
      { key: 'f4', color: '#ff8844' },
    ];

    for (const lbl of labels) {
      const freq = frame[lbl.key];
      if (freq == null || isNaN(freq)) continue;
      const y = Math.round(this._freqToY(freq));
      ctx.fillStyle = lbl.color;
      ctx.beginPath();
      ctx.arc(x, y, 3 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  clear() {
    this._snapshot = null;
    this.data = [];
    this._lastF0 = null;
    this._batchMode = false;
    this.ctx.fillStyle = '#111';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
