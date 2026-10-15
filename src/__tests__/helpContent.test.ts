import { expect, it } from 'vitest'
import { HELP_TOPIC_ORDER, getHelpSections, getHelpTopicTitle, getPresetRows, getQuickStartSteps } from '../content/helpContent'
import { F0_CHART_RANGE, FORMANT_CHART_RANGE, F0_REFERENCE_ZONES } from '../config/analysisRanges'
import { VOWEL_PRESETS } from '../types'

it('defines six named help topics with non-empty content', () => {
  expect(HELP_TOPIC_ORDER).toHaveLength(6)
  for (const topic of HELP_TOPIC_ORDER) {
    expect(getHelpTopicTitle(topic)).not.toBe('')
    expect(getHelpSections(topic, 'portrait').length).toBeGreaterThan(0)
  }
})
it('provides three steps with correct recording and goal entry positions', () => {
  expect(getQuickStartSteps('portrait')).toHaveLength(3)
  expect(getQuickStartSteps('portrait')[0].description).toContain('底部')
  expect(getQuickStartSteps('landscape')[0].description).toContain('顶栏')
})
it('reads targets from built-in presets rather than current customized settings', () => {
  expect(getPresetRows()).toHaveLength(6)
  const preset = VOWEL_PRESETS['vowel-a']
  expect(getPresetRows()[0]).toEqual({ vowel: 'a', ranges: [preset.f0, preset.f1, preset.f2] })
})
it('reads chart and target ranges from shared configuration', () => {
  const text = JSON.stringify(getHelpSections('targets', 'portrait'))
  expect(text).toContain(`${F0_CHART_RANGE.min}–${F0_CHART_RANGE.max}`)
  expect(text).toContain(`${FORMANT_CHART_RANGE.min}–${FORMANT_CHART_RANGE.max}`)
  for (const zone of F0_REFERENCE_ZONES) expect(JSON.stringify(getHelpSections('charts', 'portrait'))).toContain(`${zone.range[0]}–${zone.range[1]}`)
})
it('contains no obsolete WAV-only button or green-only target description', () => {
  const text = JSON.stringify(HELP_TOPIC_ORDER.map(topic => getHelpSections(topic, 'portrait')))
  expect(text).not.toContain('导入 WAV')
  expect(text).not.toContain('绿色区间为目标')
  expect(text).not.toContain('F3')
  expect(text).not.toContain('F4')
})
