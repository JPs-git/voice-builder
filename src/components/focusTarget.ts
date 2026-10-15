// Used only when returning focus, not during the normal recording/render loop.
export function isAvailableFocusTarget(element: HTMLElement | null): element is HTMLElement {
  if (!element?.isConnected || element.matches(':disabled')) return false
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const style = getComputedStyle(node)
    if (node.hidden || node.hasAttribute('inert') || node.getAttribute('aria-hidden') === 'true'
      || style.display === 'none' || style.visibility === 'hidden') return false
  }
  return true
}
