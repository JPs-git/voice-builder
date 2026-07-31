export class Complex {
  re: number
  im: number

  constructor(re: number, im: number) { this.re = re; this.im = im }

  add(c: Complex): Complex { return new Complex(this.re + c.re, this.im + c.im) }
  sub(c: Complex): Complex { return new Complex(this.re - c.re, this.im - c.im) }
  mul(c: Complex): Complex { return new Complex(this.re * c.re - this.im * c.im, this.re * c.im + this.im * c.re) }
  div(c: Complex): Complex {
    const d = c.re * c.re + c.im * c.im
    if (d === 0) throw new Error('Division by zero')
    return new Complex((this.re * c.re + this.im * c.im) / d, (this.im * c.re - this.re * c.im) / d)
  }
  abs(): number { return Math.sqrt(this.re * this.re + this.im * this.im) }
  conj(): Complex { return new Complex(this.re, -this.im) }
  sqrt(): Complex {
    const r = this.abs()
    const sign = this.im < 0 || (this.im === 0 && this.re < 0) ? -1 : 1
    return new Complex(Math.sqrt((this.re + r) / 2), sign * Math.sqrt((r - this.re) / 2))
  }
  static unityRoot(n: number, k: number): Complex {
    const theta = (2 * Math.PI * k) / n
    return new Complex(Math.cos(theta), Math.sin(theta))
  }
}
