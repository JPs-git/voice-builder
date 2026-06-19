export class Complex {
  constructor(re, im) { this.re = re; this.im = im }

  add(c) { return new Complex(this.re + c.re, this.im + c.im) }
  sub(c) { return new Complex(this.re - c.re, this.im - c.im) }
  mul(c) { return new Complex(this.re * c.re - this.im * c.im, this.re * c.im + this.im * c.re) }
  div(c) {
    const d = c.re * c.re + c.im * c.im
    if (d === 0) throw new Error('Division by zero')
    return new Complex((this.re * c.re + this.im * c.im) / d, (this.im * c.re - this.re * c.im) / d)
  }
  abs() { return Math.sqrt(this.re * this.re + this.im * this.im) }
  conj() { return new Complex(this.re, -this.im) }
  sqrt() {
    const r = this.abs()
    const sign = this.im < 0 || (this.im === 0 && this.re < 0) ? -1 : 1
    return new Complex(Math.sqrt((this.re + r) / 2), sign * Math.sqrt((r - this.re) / 2))
  }
  static unityRoot(n, k) {
    const theta = (2 * Math.PI * k) / n
    return new Complex(Math.cos(theta), Math.sin(theta))
  }
}
