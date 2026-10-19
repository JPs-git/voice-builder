import { F0_CHART_RANGE, FORMANT_CHART_RANGE, F0_REFERENCE_ZONES, FORMANT_MIN_GAP_HZ } from '../config/analysisRanges'
import { AUDIO_WINDOW_SECONDS } from '../config/audioLimits'
import { VOWEL_PRESETS, presetShortLabel } from '../types'

export type HelpTopic = 'quick-start' | 'charts' | 'targets' | 'audio' | 'troubleshooting' | 'pitch-reference' | 'recording-statistics'
export type HelpLayout = 'portrait' | 'landscape'
export interface HelpSection { title: string; paragraphs: readonly string[] }
function getRecordingHelpSections(layout: HelpLayout): readonly HelpSection[] {
  const recordEntry = layout === 'portrait' ? '点击底部麦克风按钮' : '点击顶栏「开始录音」'
  const importEntry = layout === 'portrait'
    ? '准备页和结果页均通过右上角「更多 → 导入音频」选择文件。'
    : '准备页通过顶栏「导入音频」选择文件；结果页通过「更多 → 导入音频」选择文件。'
  return [
    { title: '安静录音，录后分析', paragraphs: [
      `可从三篇短文中选择参考材料，也可按自己的习惯自然说话。${recordEntry}开始采集；建议录制 30–60 秒，达到 60 秒后自动结束并分析。采集中只显示材料与计时，不显示声学反馈；再次点击录音按钮可提前结束并分析。`,
      '结果页点击「再录一段」先进入准备页，可以换短文、调字号，再点击「开始录音」；不会立即申请麦克风。有旧报告时可点击「返回结果」，不需要重新分析。',
    ] },
    { title: '导入与完整回放', paragraphs: [
      `可导入最多 60 秒的 WAV、MP3、M4A 等浏览器支持的音频。${importEntry}取消文件选择不会替换原结果。`,
      '结果页保留完整录音，可播放、暂停和拖动进度，从选定位置继续播放到结尾。统计过滤不会裁剪原音频，停顿和超上限音高对应的声音仍完整保留。',
    ] },
    { title: '中位数与 P10/P90', paragraphs: [
      '典型 F0 为有效音高中位数；P10/P90 描述常用音高范围的分位边界，不是最低/最高值。中间 80% 是分位范围的定义，边界值重复时实际落入范围的比例可能更高。直方图纵轴是有效音高时间占比，不是整段录音的时间占比。',
      '有效 F0 少于 3 秒时隐藏三项数值与图中分位标记；达到 3 秒但少于 10 秒时显示样本较少的说明。有有效数据时仍可看直方图，完整录音始终可回放。',
    ] },
    { title: '统计范围与限制', paragraphs: [
      '仅统计 60–500 Hz，包含 500 Hz。停顿、无效值和超过上限的检测值不按 0 Hz 计入，也不将高值压到 500 Hz。超上限排除数量、时长和比例可在报告「统计说明」中查看。',
      '范围过滤不能消除所有倍频或半频检测误差，也可能排除真实高音。有效时间比例不是识别准确率，报告不代表个人完整音域。',
    ] },
    { title: '数据与恢复', paragraphs: [
      '声音仅在本地处理。切页时停止本页采集并分析，保留本次结果；准备下一段时可点击「返回结果」，恢复旧报告与暂停后的回放位置，不自动播放。',
      '取消新任务不破坏上一份成功结果；分析失败可重试或返回旧结果，只有新结果成功后才替换旧报告。刷新或关闭页面后不保留声音数据。实时分析和音高参考仍使用最近 10 秒的窗口。',
    ] },
  ]
}
export const HELP_TOPIC_ORDER: readonly HelpTopic[] = ['quick-start', 'charts', 'targets', 'audio', 'troubleshooting', 'pitch-reference', 'recording-statistics']
const TITLES: Record<HelpTopic, string> = {
  'quick-start': '快速上手', charts: '读图与反馈', targets: '训练目标', audio: '录音与导入',
  troubleshooting: '遇到问题', 'pitch-reference': '音高参考', 'recording-statistics': '统计分析',
}
export function getHelpTopicTitle(topic: HelpTopic): string { return TITLES[topic] }

export function getQuickStartSteps(layout: HelpLayout) {
  return [
    { title: '开始录音', description: layout === 'portrait'
      ? '点击底部麦克风按钮开始录音；首次使用时，按浏览器提示允许麦克风权限。'
      : '点击顶栏「开始录音」；首次使用时，按浏览器提示允许麦克风权限。' },
    { title: '观察自己的声音', description: `选择一个元音发声，观察基频与共振峰曲线。${layout === 'portrait' ? '反馈中 ↑/↓ 表示偏高/偏低，✓ 表示命中目标。' : '反馈通过颜色和文字表示命中或偏离目标。'}基频图的固定参考色带与可编辑训练目标不同，命中目标不等于完整的声音评价。` },
    { title: '选择目标并回放', description: `${layout === 'portrait' ? '点击底部「当前目标」' : '使用左侧「目标区间」'}切换元音或调整范围。数字输入失焦后生效${layout === 'portrait' ? '，滑杆拖动实时生效' : ''}；恢复默认并确认会重置全部元音并切回 a。录音结束后点击「回放」听取当前声音。` },
  ] as const
}

export function getPresetRows() {
  return Object.entries(VOWEL_PRESETS).map(([key, preset]) => ({ vowel: presetShortLabel(key), ranges: [preset.f0, preset.f1, preset.f2] }))
}

export function getHelpSections(topic: HelpTopic, layout: HelpLayout): readonly HelpSection[] {
  const targetsEntry = layout === 'portrait' ? '底部「当前目标」' : '左侧「目标区间」'
  const importEntry = layout === 'portrait' ? '右上角「更多 → 导入音频」' : '顶栏「导入音频」'
  switch (topic) {
    case 'recording-statistics': return getRecordingHelpSections(layout)
    case 'quick-start': return getQuickStartSteps(layout).map(step => ({ title: step.title, paragraphs: [step.description] }))
    case 'charts': return [
      { title: '基频图：曲线与固定参考', paragraphs: [
        'F0 曲线用来观察声音高低的变化，横轴表示时间，纵轴单位为 Hz。',
        `色带是固定参考：${F0_REFERENCE_ZONES.map(zone => `${zone.label} ${zone.range[0]}–${zone.range[1]} Hz`).join('；')}。虚线位于各参考区间中点。`,
        '固定参考色带不是当前训练目标，更改目标不会改变这些色带。',
      ] },
      { title: '共振峰图：当前值与目标', paragraphs: [
        '这张图显示 F0、F1、F2 随时间的变化，以及当前元音对应的目标区间和目标线。',
        '点击图例中的 F0/F1/F2 可以隐藏或显示对应曲线和反馈。',
        `通过${targetsEntry}选择元音或修改目标；目标仅是参考，命中区间不等于对声音效果的完整评价。`,
      ] },
      { title: '实时反馈怎么看', paragraphs: [
        layout === 'portrait' ? '↑ 表示高于目标，↓ 表示低于目标，✓ 表示处于目标范围；绿色表示命中，橙色表示偏离。' : '实时反馈通过颜色和说明显示当前数值与目标的关系；绿色表示命中，橙色表示偏离。',
        '没有可用分析值时显示 --。曲线暂时中断不代表需要提高音量或强行调整发声。',
      ] },
    ]
    case 'targets': return [
      { title: '选择元音与默认预设', paragraphs: [`在${targetsEntry}选择 a/o/e/i/u/ü。每个元音保留自己的自定义目标，切换回来会恢复该元音的设置。下表是默认预设，不是你当前修改后的目标。`] },
      { title: '调整范围与生效时机', paragraphs: [
        `F0 可调范围 ${F0_CHART_RANGE.min}–${F0_CHART_RANGE.max} Hz；F1/F2 可调范围 ${FORMANT_CHART_RANGE.min}–${FORMANT_CHART_RANGE.max} Hz，与图谱范围一致。`,
        `F1/F2 自身上下限至少相隔 ${FORMANT_MIN_GAP_HZ} Hz，并保持 F1 下限 < F1 上限 ≤ F2 下限 < F2 上限。`,
        `数字输入在失焦或按 Enter 后校验并保存，越界时会自动调整到合法边界并说明原因。${layout === 'portrait' ? '滑杆拖动实时生效。' : ''}`,
      ] },
      { title: '恢复全部默认值', paragraphs: ['点击重置图标并确认，会清除全部元音的自定义目标，恢复默认预设并切回 a；取消则保留当前设置。'] },
    ]
    case 'audio': return [
      { title: '录音与回放', paragraphs: [
        '本主题介绍实时分析与音高参考页。60 秒录音统计与完整回放请查看「统计分析」主题。',
        `${getQuickStartSteps(layout)[0].description}再次点击录音按钮可停止；继续录音会接着追加数据。`,
        `实时曲线和回放保留最近 ${AUDIO_WINDOW_SECONDS} 秒的窗口，持续录音不会自动停止。停止录音后点击「回放」听取当前窗口。`,
        `点击${layout === 'portrait' ? '底部「清除图谱」' : '顶栏「清空」'}会停止录音并清除当前声音数据，但保留训练目标。`,
      ] },
      { title: '导入已有音频', paragraphs: [
        `通过${importEntry}选择文件；音频时长不能超过 ${AUDIO_WINDOW_SECONDS} 秒，较长文件请先裁剪。`,
        '可尝试 WAV、MP3、M4A 等音频；是否能读取取决于文件编码和浏览器支持，扩展名相同也不保证能解码。导入后可以查看图表和回放。',
        '从导入文件切换到麦克风录音会开始新的声音数据，请先完成需要的回放。',
      ] },
    ]
    case 'troubleshooting': return [
      { title: '麦克风权限未允许', paragraphs: ['检查地址栏附近的网站权限，允许此页面使用麦克风，再点击录音。阅读帮助不会申请麦克风权限。'] },
      { title: '找不到或无法连接麦克风', paragraphs: ['检查设备是否已连接、系统是否允许浏览器使用麦克风，以及其他应用是否正在占用设备。重新连接后再试；保留错误提示中的具体信息。'] },
      { title: '已经录音，但没有曲线', paragraphs: ['确认录音按钮处于录音状态，检查系统所选麦克风是否正确，试着说一句话。若基频有数据但共振峰暂时没有数据，可先观察基频并检查环境噪声，不要只依靠刷新页面排查。'] },
      { title: '共振峰曲线断续或波动', paragraphs: ['共振峰分析可能受录音环境和声音内容影响。检查麦克风收音，减少背景声；结合基频曲线与回放理解结果，不把单帧跳动当作训练结论。'] },
      { title: '导入文件过长或无法解码', paragraphs: [`先将文件裁剪到 ${AUDIO_WINDOW_SECONDS} 秒以内；若仍无法读取，尝试重新导出为浏览器可解码的 WAV/MP3/M4A 文件，并检查文件是否损坏。`] },
    ]
    case 'pitch-reference': return [
      { title: '听取参考音', paragraphs: ['从顶部页面导航切换到「音高参考」，点击琴键听取对应参考音。此页用于对照音高，声音分析与训练目标编辑位于「声音分析」页。'] },
      { title: '观察音高图', paragraphs: [
        '开始录音后，琴键与音高图会显示检测到的音高变化；没有声音数据时，可以先点击琴键熟悉参考音。',
        layout === 'portrait' ? '左右滑动钢琴键盘可以查看其他音域；底部录音、清除和回放操作与声音分析页共用。' : '横屏直接展示钢琴音域；录音、导入与回放仍通过顶栏操作。',
      ] },
    ]
  }
}
