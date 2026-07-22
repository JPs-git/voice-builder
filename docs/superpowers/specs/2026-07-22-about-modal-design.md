# About Modal 设计文档

## 概述

在顶部 toolbar 中间区域添加"关于"入口，点击弹出居中模态框，展示项目信息、版本号、GitHub 仓库地址、更新日志以及作者联系方式。toolbar 中间区域预留为未来导航切换入口的容器。

## 方案选择

方案 B（推荐）：grid 布局 + 复用 Drawer 的 state 模式。
- Toolbar 改用 `display: grid; grid-template-columns: 1fr auto 1fr`
- 提取可复用的 Modal 居中弹窗组件
- 通过 AnalysisContext 管理 aboutModalOpen 状态

## 文件变更

### 新增文件

| 文件 | 说明 |
|---|---|
| `src/components/Modal.tsx` | 居中弹窗通用组件，与 Drawer 对称 |
| `src/components/Modal.module.css` | Modal 样式 |
| `src/components/AboutModal.tsx` | "关于"内容组件，使用 Modal |
| `src/components/AboutModal.module.css` | AboutModal 内联样式 |

### 修改文件

| 文件 | 变更 |
|---|---|
| `src/components/Toolbar.tsx` | 添加 nav 区域和"关于"按钮 |
| `src/components/Toolbar.module.css` | flex → grid 三栏布局，新增 .nav 样式 |
| `src/contexts/AnalysisContext.tsx` | 新增 aboutModalOpen state 和 SET_ABOUT_MODAL action |
| `src/routes/AnalysisPage.tsx` | 引入 AboutModal，传入 state 和 dispatch |

## 详细设计

### 1. Modal 组件

API 与 Drawer 保持一致：

```tsx
interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}
```

- `open=false` 时返回 `null`
- 全屏遮罩层（rgba 半透明黑）
- 居中面板，`width: min(520px, 90vw)`，`max-height: 80vh`，内容超出滚动
- 点击遮罩层或 × 按钮触发 `onClose`
- 遮罩 fade-in + 面板 scale-in 动画，与 Drawer 风格一致

### 2. AboutModal 组件

使用 Modal 组件，title="关于"，包含以下预留区域：

- **项目信息**：名称（在线声音训练）、版本号（1.0.0，硬编码占位）
- **仓库地址**：可点击链接 `https://github.com/JPs-git/voice-builder`
- **更新日志**：占位区域，用户自行填入富文本/列表
- **作者 / 联系方式**：占位区域，用户自行填写

每个 section 用 `<section>` 包裹，排版复用 HelpDrawer 的 section 约定。

### 3. Toolbar 布局

```css
.toolbar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
}
```

`.nav` 区域在中间列，放置"关于"标签按钮。按键样式为胶囊状 tab 风格，与未来导航项风格一致。当前仅"关于"一项。

### 4. 状态管理

在 AnalysisContext 的 AnalysisState 中新增：

```ts
aboutModalOpen: boolean  // 初始值 false
```

新增 Action：

```ts
| { type: 'SET_ABOUT_MODAL'; open: boolean }
```

对应 reducer 分支：

```ts
case 'SET_ABOUT_MODAL':
  return { ...state, aboutModalOpen: action.open }
```

### 5. 响应式

- 移动端（≤768px）：Modal 宽度调整为 `90vw`
- toolbar 的 nav 区域在小屏保持可见，按鈕文字可隐藏只留图标

## 未来扩展

- toolbar nav 区域预留为 `<nav>` 容器，后续可直接添加 `<NavLink>` 组件实现路由切换
- 多个导航项时使用 flex 横向排列，样式保持一致
