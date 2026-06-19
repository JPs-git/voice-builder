import { Complex } from './complex.js'

export function autocorrelate(signal, order) {
  const r = new Array(order + 1).fill(0)
  for (let k = 0; k <= order; k++) {
    let sum = 0
    for (let i = 0; i < signal.length - k; i++) {
      sum += signal[i] * signal[i + k]
    }
    r[k] = sum
  }
  return r
}

export function levinsonDurbin(r, order) {
  const a = new Array(order + 1).fill(0)
  a[0] = 1
  if (r[0] === 0) return a

  const e = new Array(order + 1).fill(0)
  e[0] = r[0]

  for (let i = 1; i <= order; i++) {
    let k = r[i]
    for (let j = 1; j < i; j++) {
      k += a[j] * r[i - j]
    }
    k /= e[i - 1]

    const oldA = a.slice(0, i)
    a[i] = -k
    for (let j = 1; j < i; j++) {
      a[j] = oldA[j] - k * oldA[i - j]
    }

    e[i] = e[i - 1] * (1 - k * k)
  }

  return a
}

export function polyval(coeffs, z) {
  const n = coeffs.length - 1
  let result = new Complex(coeffs[n], 0)
  for (let i = n - 1; i >= 0; i--) {
    result = result.mul(z).add(new Complex(coeffs[i], 0))
  }
  return result
}

export function laguerre(coeffs, guess, maxIter = 100, tol = 1e-12) {
  const n = coeffs.length - 1
  if (n <= 0) return guess
  let x = guess

  for (let iter = 0; iter < maxIter; iter++) {
    let p = new Complex(coeffs[n], 0)
    let pp = new Complex(0, 0)
    let ppp = new Complex(0, 0)

    for (let i = n - 1; i >= 0; i--) {
      ppp = ppp.mul(x).add(pp)
      pp = pp.mul(x).add(p)
      p = p.mul(x).add(new Complex(coeffs[i], 0))
    }

    if (p.abs() < tol) break

    const G = pp.div(p)
    const twoPpp = new Complex(2, 0).mul(ppp)
    const H = G.mul(G).sub(twoPpp.div(p))
    const radicand = new Complex(n - 1, 0).mul(
      new Complex(n, 0).mul(H).sub(G.mul(G))
    )
    const sqrtTerm = radicand.sqrt()

    let denom
    if (G.add(sqrtTerm).abs() > G.sub(sqrtTerm).abs()) {
      denom = G.add(sqrtTerm)
    } else {
      denom = G.sub(sqrtTerm)
    }

    if (denom.abs() < 1e-15) {
      x = x.add(new Complex(0.1, 0.1))
      continue
    }

    const step = new Complex(n, 0).div(denom)
    x = x.sub(step)

    if (step.abs() < tol) break
  }

  return x
}

function deflateReal(a, r) {
  const n = a.length - 1
  const q = new Array(n)
  q[n - 1] = a[n]
  for (let i = n - 2; i >= 0; i--) {
    q[i] = a[i + 1] + r * q[i + 1]
  }
  return q
}

function deflateQuadratic(a, root) {
  const n = a.length - 1
  const b = -2 * root.re
  const c = root.re * root.re + root.im * root.im
  const q = new Array(n - 1)
  q[n - 2] = a[n]
  q[n - 3] = a[n - 1] - b * q[n - 2]
  for (let k = n - 2; k >= 2; k--) {
    q[k - 2] = a[k] - b * q[k - 1] - c * q[k]
  }
  return q
}

export function findRoots(coeffs) {
  let a = [...coeffs]
  // Strip leading zeros (highest-degree coefficients that are zero)
  while (a.length > 1 && Math.abs(a[a.length - 1]) < 1e-15) {
    a.pop()
  }

  const n = a.length - 1
  if (n <= 0) return []
  if (n === 1) return [new Complex(-a[0] / a[1], 0)]

  const roots = []
  let rootIdx = 0

  while (a.length > 3) {
    const deg = a.length - 1
    const guess = Complex.unityRoot(deg, rootIdx % deg)
    rootIdx++

    const root = laguerre(a, guess, 100, 1e-12)

    if (Math.abs(root.im) < 1e-10) {
      const realRoot = root.re
      roots.push(new Complex(realRoot, 0))
      a = deflateReal(a, realRoot)
    } else {
      roots.push(root)
      roots.push(root.conj())
      a = deflateQuadratic(a, root)
    }
  }

  if (a.length === 3) {
    const [a0, a1, a2] = a
    const disc = a1 * a1 - 4 * a0 * a2
    if (disc >= 0) {
      roots.push(new Complex((-a1 + Math.sqrt(disc)) / (2 * a2), 0))
      roots.push(new Complex((-a1 - Math.sqrt(disc)) / (2 * a2), 0))
    } else {
      roots.push(new Complex(-a1 / (2 * a2), Math.sqrt(-disc) / (2 * a2)))
      roots.push(new Complex(-a1 / (2 * a2), -Math.sqrt(-disc) / (2 * a2)))
    }
  } else if (a.length === 2) {
    roots.push(new Complex(-a[0] / a[1], 0))
  }

  return roots
}

export function rootsToFormants(roots, sampleRate) {
  const formants = []
  for (const root of roots) {
    if (root.im <= 0) continue
    const mag = root.abs()
    const poleMag = 1 / mag
    if (poleMag < 0.85 || poleMag > 1.02) continue

    const freq = Math.atan2(root.im, root.re) * sampleRate / (2 * Math.PI)
    const bw = -Math.log(Math.min(poleMag, 0.9999)) * sampleRate / Math.PI

    if (freq > 50 && freq < 5000) {
      formants.push({ freq, bw })
    }
  }

  formants.sort((a, b) => a.freq - b.freq)
  return formants
}

export function detectPitch(signal, sampleRate) {
  const minFreq = 60
  const maxFreq = 500
  const minPeriod = Math.max(Math.ceil(sampleRate / maxFreq), 1)
  const maxPeriod = Math.min(Math.floor(sampleRate / minFreq), signal.length - 1)

  if (maxPeriod < minPeriod) return null

  const r = new Array(maxPeriod + 1).fill(0)
  for (let k = 0; k <= maxPeriod; k++) {
    let sum = 0
    for (let i = 0; i < signal.length - k; i++) {
      sum += signal[i] * signal[i + k]
    }
    r[k] = sum
  }

  if (r[0] === 0) return null

  let maxR = 0
  let maxIdx = minPeriod
  for (let k = minPeriod; k <= maxPeriod; k++) {
    if (r[k] > maxR) {
      maxR = r[k]
      maxIdx = k
    }
  }

  if (maxR < r[0] * 0.3) return null

  return sampleRate / maxIdx
}

export function extractFormants(signal, sampleRate, maxFormants = 5) {
  const order = Math.min(2 * maxFormants + 4, Math.floor(signal.length / 3), 20)

  // Apply Hamming window to improve numerical conditioning
  const n = signal.length
  const windowed = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    windowed[i] = signal[i] * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (n - 1)))
  }

  const r = autocorrelate(windowed, order)
  const a = levinsonDurbin(r, order)
  const roots = findRoots(a)
  const formants = rootsToFormants(roots, sampleRate)
  const f0 = detectPitch(signal, sampleRate)
  return { f0, formants: formants.slice(0, maxFormants) }
}
