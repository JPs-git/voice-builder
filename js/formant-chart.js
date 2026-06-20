export class FormantChartRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.freqMax = 500;
    this.data = [];
    this.windowSeconds = 3;
    this._dotRadius = 2;
    this._wavMode = false;
    this._wavData = [];
    this._hoverIdx = -1;

    this._boundResize = () => this._resize();
    this._boundMove = (e) => this._onMouseMove(e);
    this._boundLeave = () => this._onMouseLeave();
    window.addEventListener('resize', this._boundResize);
    this._resize();
  }

  destroy() {
    window.removeEventListener('resize', this._boundResize);
    this.canvas.removeEventListener('mousemove', this._boundMove);
    this.canvas.removeEventListener('mouseleave', this._boundLeave);
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
    if (this._wavMode) {
      this._drawWavTrace();
    }
  }

  _freqToY(freq) {
    return this.canvas.height - (freq / this.freqMax) * this.canvas.height;
  }

  pushFrame(formantFrame, time) {
    if (this._wavMode) return;
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

    const freq = formantFrame.f0;
    if (freq != null && !isNaN(freq)) {
      const y = Math.round(this._freqToY(freq));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(w - 1, y, 1, 1);
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
    const freq = frame.f0;
    if (freq != null && !isNaN(freq)) {
      const y = this._freqToY(freq);
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.arc(x, y, 3 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }

    return freq;
  }

  showWavF0Trace(f0Data, fileName, duration) {
    this._wavMode = true;
    this._wavData = f0Data;
    this._wavFileName = fileName;
    this._wavDuration = duration;
    this._hoverIdx = -1;
    this.canvas.addEventListener('mousemove', this._boundMove);
    this.canvas.addEventListener('mouseleave', this._boundLeave);
    this._drawWavTrace();
  }

  clearWavTrace() {
    this._wavMode = false;
    this._wavData = [];
    this._hoverIdx = -1;
    this.canvas.removeEventListener('mousemove', this._boundMove);
    this.canvas.removeEventListener('mouseleave', this._boundLeave);
    this.clear();
  }

  _drawWavTrace() {
    const ctx = this.ctx;
    const dpr = this._dpr || 1;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === 0 || h === 0) return;

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);

    const data = this._wavData;
    if (!data || data.length === 0) return;

    const marginTop = 16 * dpr;
    const marginLeft = 40 * dpr;
    const marginRight = 8 * dpr;
    const marginBottom = 20 * dpr;
    const plotW = w - marginLeft - marginRight;
    const plotH = h - marginTop - marginBottom;

    const f0Vals = data.map(d => d.f0).filter(v => v != null);
    if (f0Vals.length === 0) {
      ctx.fillStyle = '#555';
      ctx.font = `${12 * dpr}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('No voiced frames detected', w / 2, h / 2 + 4 * dpr);
      return;
    }

    const minF0 = Math.max(60, Math.min(...f0Vals));
    const maxF0 = Math.min(500, Math.max(...f0Vals));
    const range = Math.max(maxF0 - minF0, 1);

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.moveTo(marginLeft, marginTop);
    ctx.lineTo(marginLeft, h - marginBottom);
    ctx.lineTo(w - marginRight, h - marginBottom);
    ctx.stroke();

    ctx.fillStyle = '#555';
    ctx.font = `${9 * dpr}px sans-serif`;
    ctx.textAlign = 'right';
    const yStep = range > 100 ? 100 : 50;
    for (let f = Math.ceil(minF0 / yStep) * yStep; f <= maxF0; f += yStep) {
      const y = marginTop + (1 - (f - minF0) / range) * plotH;
      ctx.fillText(`${f} Hz`, marginLeft - 4 * dpr, y + 3 * dpr);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.moveTo(marginLeft, y);
      ctx.lineTo(w - marginRight, y);
      ctx.stroke();
    }

    const timeStep = Math.max(0.2, Math.ceil(this._wavDuration / 5 * 10) / 10);
    ctx.fillStyle = '#555';
    ctx.font = `${9 * dpr}px sans-serif`;
    ctx.textAlign = 'center';
    for (let t = 0; t <= this._wavDuration; t += timeStep) {
      const x = marginLeft + (t / this._wavDuration) * plotW;
      ctx.fillText(`${t.toFixed(1)}s`, x, h - marginBottom + 12 * dpr);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < data.length; i++) {
      const f0 = data[i].f0;
      if (f0 == null) { started = false; continue; }
      const x = marginLeft + (i / data.length) * plotW;
      const y = marginTop + (1 - (f0 - minF0) / range) * plotH;
      if (!started) { ctx.moveTo(x, y); started = true; }
      else { ctx.lineTo(x, y); }
    }
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `${10 * dpr}px sans-serif`;
    ctx.textAlign = 'left';
    const voiced = data.filter(d => d.f0 != null).length;
    ctx.fillText(`${this._wavFileName}  |  ${data.length} frames, ${voiced} voiced  |  ${this._wavDuration.toFixed(1)}s`, marginLeft + 4 * dpr, marginTop - 4 * dpr);

    if (this._hoverIdx >= 0 && this._hoverIdx < data.length) {
      const d = data[this._hoverIdx];
      const x = marginLeft + (this._hoverIdx / data.length) * plotW;

      ctx.strokeStyle = 'rgba(255,255,200,0.3)';
      ctx.lineWidth = 1 * dpr;
      ctx.setLineDash([3 * dpr, 3 * dpr]);
      ctx.beginPath();
      ctx.moveTo(x, marginTop);
      ctx.lineTo(x, h - marginBottom);
      ctx.stroke();
      ctx.setLineDash([]);

      if (d.f0 != null) {
        const y = marginTop + (1 - (d.f0 - minF0) / range) * plotH;
        ctx.fillStyle = '#ffe066';
        ctx.beginPath();
        ctx.arc(x, y, 3 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffe066';
        ctx.font = `${11 * dpr}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(`t=${d.time.toFixed(2)}s  F0=${d.f0.toFixed(1)} Hz`, x + 6 * dpr, Math.max(marginTop + 10 * dpr, y - 4 * dpr));
      } else {
        ctx.fillStyle = '#888';
        ctx.font = `${11 * dpr}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(`t=${d.time.toFixed(2)}s (unvoiced)`, x + 6 * dpr, marginTop + 10 * dpr);
      }
    }
  }

  _onMouseMove(e) {
    if (!this._wavMode || this._wavData.length === 0) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const idx = Math.round(ratio * (this._wavData.length - 1));
    if (idx !== this._hoverIdx) {
      this._hoverIdx = Math.max(0, Math.min(idx, this._wavData.length - 1));
      this._drawWavTrace();
    }
  }

  _onMouseLeave() {
    if (!this._wavMode) return;
    this._hoverIdx = -1;
    this._drawWavTrace();
  }

  clear() {
    this.data = [];
    this.ctx.fillStyle = '#111';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
