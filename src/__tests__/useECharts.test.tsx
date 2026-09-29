import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useECharts } from '../hooks/useECharts'

const chart = vi.hoisted(() => ({ resize: vi.fn(), dispose: vi.fn(), setOption: vi.fn() }))
vi.mock('echarts', () => ({ init: () => chart }))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('chart resize lifecycle', () => {
  it('coalesces unchanged window/container notifications and releases the observer', () => {
    let notify = () => {}
    const disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { notify = callback }
      observe() {}
      disconnect = disconnect
    })
    function Chart() {
      const { chartRef } = useECharts()
      return <div ref={chartRef} data-testid="chart" />
    }
    const view = render(<Chart />)
    const el = view.getByTestId('chart')
    Object.defineProperty(el, 'clientWidth', { value: 320, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: 180, configurable: true })
    act(() => { notify(); notify(); window.dispatchEvent(new Event('resize')) })
    expect(chart.resize).toHaveBeenCalledTimes(1)
    Object.defineProperty(el, 'clientWidth', { value: 360, configurable: true })
    act(() => notify())
    expect(chart.resize).toHaveBeenCalledTimes(2)
    view.unmount()
    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(chart.dispose).toHaveBeenCalledTimes(1)
    act(() => window.dispatchEvent(new Event('resize')))
    expect(chart.resize).toHaveBeenCalledTimes(2)
  })
})
