# 版本号自动同步设计

## 概述

消除 `package.json` 与 About 页面中版本号的重复维护问题。`package.json` 是版本号的唯一事实来源，About 页面在构建时自动读取。

## 方案：Vite JSON Import

利用 Vite 原生 JSON 导入能力，在 `AboutModal.tsx` 中直接 `import pkg from "../../package.json"` 并取 `pkg.version`。

## 改动范围

### `src/components/AboutModal.tsx`

- 新增顶部 import: `import pkg from "../../package.json"`
- 第 21 行 `版本：1.1.0` → `版本：{pkg.version}`
- changelog 保持硬编码不变

## 原理

Vite 编译时会将 `package.json` 中被引用的字段内联为字符串常量（tree-shaking），不会把整个 JSON 打包到产物中。运行时无需访问文件系统。

## 版本升级流程

```bash
npm version patch   # 1.1.1 → 1.1.2
npm version minor   # 1.1.1 → 1.2.0
npm version major   # 1.1.1 → 2.0.0
```

之后 `npm run build`，About 页面自动使用新版本号。

## 约束

- 不引入新的依赖
- 不修改 `vite.config.ts`
- changelog 保持手动维护
