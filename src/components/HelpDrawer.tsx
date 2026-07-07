interface HelpDrawerProps {
  open: boolean
  onClose: () => void
}

export function HelpDrawer({ open, onClose }: HelpDrawerProps) {
  if (!open) return null
  return (
    <aside style={{
      position: 'fixed', inset: 0, zIndex: 30, display: 'flex', pointerEvents: 'auto',
    }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} />
      <div style={{
        width: 360, background: '#FFF', display: 'flex', flexDirection: 'column', boxShadow: '4px 0 12px rgba(0,0,0,0.1)',
      }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #E5E7EB' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>使用说明</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#6B7280' }}>×</button>
        </header>
        <div style={{ padding: 16, overflowY: 'auto', fontSize: 14, lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section>
            <h4 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>如何开始</h4>
            <p style={{ margin: 0, color: '#4B5563' }}>点击顶部「开始录音」，或点击「导入 WAV」选择已有音频文件。首次使用浏览器会询问麦克风权限。</p>
          </section>
          <section>
            <h4 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>基频</h4>
            <p style={{ margin: 0, color: '#4B5563' }}>展示 F0 基频随时间的变化曲线。蓝色区域为男性典型基频范围(80–150 Hz)，粉色区域为女性典型基频范围(180–300 Hz)。</p>
          </section>
          <section>
            <h4 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>共振峰</h4>
            <p style={{ margin: 0, color: '#4B5563' }}>F0 是基频（决定声音高低），F1/F2 决定音色。绿色区间为目标区间。</p>
          </section>
          <section>
            <h4 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>目标区间含义（女声普通话参考）</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  {['元音', 'F0', 'F1', 'F2', 'F3', 'F4'].map(h => (
                    <th key={h} style={{ padding: '4px 2px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
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
                  <tr key={row.v} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '3px 2px', fontWeight: 600 }}>{row.v}</td>
                    <td style={{ padding: '3px 2px' }}>{row.f0}</td>
                    <td style={{ padding: '3px 2px' }}>{row.f1}</td>
                    <td style={{ padding: '3px 2px' }}>{row.f2}</td>
                    <td style={{ padding: '3px 2px' }}>{row.f3}</td>
                    <td style={{ padding: '3px 2px' }}>{row.f4}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section>
            <h4 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>常见问题</h4>
            <ul style={{ margin: 0, paddingLeft: 16, color: '#4B5563' }}>
              <li>麦克风没反应？请检查浏览器地址栏的权限图标。</li>
              <li>曲线过于抖动？说话尽量持续、平稳会更稳定。</li>
              <li>看不到任何图像？刷新页面并重新开始录音。</li>
            </ul>
          </section>
        </div>
      </div>
    </aside>
  )
}
