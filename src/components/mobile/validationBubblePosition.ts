interface Anchor { left: number; top: number; width: number }
interface Viewport { left: number; top: number; width: number; height: number }
interface Obstacle { top: number; bottom: number }

export function placeValidationBubble(anchor: Anchor, height: number, viewport: Viewport, obstacles: Obstacle[]) {
  const margin = 8
  const width = Math.min(anchor.width, viewport.width - margin * 2)
  const left = Math.max(viewport.left + margin, Math.min(anchor.left, viewport.left + viewport.width - margin - width))
  const visibleObstacles = obstacles.filter(rect => rect.bottom > viewport.top && rect.top < anchor.top)
    .sort((a, b) => b.top - a.top)
  height = Math.min(height, viewport.height - margin * 2)
  let top = anchor.top - height - margin
  for (const rect of visibleObstacles) {
    if (top < rect.bottom && top + height > rect.top) top = rect.top - height - margin
  }
  if (top < viewport.top + margin) {
    top = viewport.top + margin
    const ceiling = Math.min(anchor.top, ...visibleObstacles.map(rect => rect.top)) - margin
    height = Math.max(1, Math.min(height, ceiling - top))
  }
  return { left, top, width, height }
}
