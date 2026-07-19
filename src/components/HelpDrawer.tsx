import { Drawer } from './Drawer'
import styles from './HelpDrawer.module.css'

interface HelpDrawerProps {
  open: boolean
  onClose: () => void
}

export function HelpDrawer({ open, onClose }: HelpDrawerProps) {
  return (
    <Drawer open={open} title="使用说明" onClose={onClose}>
      <section>
        <h4>如何开始</h4>
        <p>点击顶部「开始录音」，或点击「导入 WAV」选择已有音频文件。首次使用浏览器会询问麦克风权限。</p>
      </section>
      <section>
        <h4>基频</h4>
        <p>展示 F0 基频随时间的变化曲线。蓝色区域为男性典型基频范围(80–150 Hz)，粉色区域为女性典型基频范围(180–300 Hz)。</p>
      </section>
      <section>
        <h4>共振峰</h4>
        <p>F0 是基频（决定声音高低），F1/F2 决定音色。绿色区间为目标区间。</p>
      </section>
      <section>
        <h4>目标区间含义（女声普通话参考）</h4>
        <table className={styles.refTable}>
          <thead>
            <tr>
              {['元音', 'F0 (Hz)', 'F1 (Hz)', 'F2 (Hz)', 'F3 (Hz)', 'F4 (Hz)'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { v: 'a', f0: '200–280', f1: '800–1000', f2: '1100–1400', f3: '2700–3100', f4: '3800–4200' },
              { v: 'o', f0: '200–280', f1: '480–620', f2: '700–1000', f3: '2700–3100', f4: '3700–4100' },
              { v: 'e', f0: '200–280', f1: '500–660', f2: '1000–1300', f3: '2700–3200', f4: '3800–4200' },
              { v: 'i', f0: '220–300', f1: '280–380', f2: '2500–3000', f3: '3200–3600', f4: '4000–4400' },
              { v: 'u', f0: '200–280', f1: '300–400', f2: '600–900', f3: '2500–3000', f4: '3600–4000' },
              { v: 'ü', f0: '220–300', f1: '280–380', f2: '1800–2200', f3: '2400–2900', f4: '3800–4200' },
            ].map(row => (
              <tr key={row.v}>
                <td>{row.v}</td>
                <td>{row.f0}</td>
                <td>{row.f1}</td>
                <td>{row.f2}</td>
                <td>{row.f3}</td>
                <td>{row.f4}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h4>常见问题</h4>
        <ul>
          <li>麦克风没反应？请检查浏览器地址栏的权限图标。</li>
          <li>曲线过于抖动？说话尽量持续、平稳会更稳定。</li>
          <li>看不到任何图像？刷新页面并重新开始录音。</li>
        </ul>
      </section>
    </Drawer>
  )
}
