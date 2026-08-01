export type FormantStatus = 'hit' | 'low' | 'high' | 'none'

export function getFormantStatus(
  value: number | null | undefined,
  range: [number, number],
): FormantStatus {
  if (value == null || !Number.isFinite(value)) return 'none'
  if (value < range[0]) return 'low'
  if (value > range[1]) return 'high'
  return 'hit'
}
