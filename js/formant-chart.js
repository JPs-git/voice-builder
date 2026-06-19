export class FormantChartRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.freqMax = 5000;
    this.data = [];
    this.windowSeconds = 3;
    this._dotRadius = 2;

    this._boundResize = () => this._resize();
    window.addEventListener('resize', this._boundResize);
    this._resize();
  }

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
  }

  _freqToY(freq) {
    return this.canvas.height - (freq / this.freqMax) * this.canvas.height;
  }

  pushFrame(formantFrame, time) {
    this.data.push({ ...formantFrame, time });
    const cutoff = time - this.windowSeconds;
    while (this.data.length > 1 && this.data[0].time < cutoff) {
      this.data.shift();
    }

    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === 0 || h === 0) return;

    const ctx = this.ctx;

    // Scroll left by 1px
    ctx.drawImage(this.canvas, 1, 0, w - 1, h, 0, 0, w - 1, h);

    const keys = ['f0', 'f1', 'f2', 'f3', 'f4'];
    const colors = {
      f0: '#ffffff',
      f1: '#ff4444',
      f2: '#4488ff',
      f3: '#44cc44',
      f4: '#ff8844',
    };
    const x = w - 1;

    for (const key of keys) {
      const freq = formantFrame[key];
      if (freq == null || isNaN(freq)) continue;

      const y = this._freqToY(freq);
      ctx.fillStyle = colors[key];
      ctx.beginPath();
      ctx.arc(x, y, this._dotRadius, 0, Math.PI * 2);
      ctx.fill();
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

    const labels = [
      { key: 'f0', color: 'rgba(255,255,255,0.4)' },
      { key: 'f1', color: '#ff4444' },
      { key: 'f2', color: '#4488ff' },
      { key: 'f3', color: '#44cc44' },
      { key: 'f4', color: '#ff8844' },
    ];

    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    let labelY = h - 4;
    for (const lbl of labels) {
      const freq = frame[lbl.key];
      if (freq == null || isNaN(freq)) continue;
      ctx.fillStyle = lbl.color;
      ctx.fillText(`${lbl.key}: ${Math.round(freq)} Hz`, x + 6, labelY);
      labelY -= 14;
    }
  }

  clear() {
    this.data = [];
    this.ctx.fillStyle = '#111';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
