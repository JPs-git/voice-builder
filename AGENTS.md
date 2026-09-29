# AGENTS.md

## 分支命名规范

格式：`<type>/<kebab-case>`

- `type` 仅限：`feat`、`fix`、`refactor`、`docs`、`ci`、`chore`
- 全小写 kebab-case，无大写、无下划线、无 `type/type-` 类重复前缀
- 示例：`feat/practice-page`、`fix/piano-active-note-label`

## Worktree 管理规范

- 目录一律 `.worktrees/<分支名原样保留斜杠>`，例：分支 `fix/piano-label` → `.worktrees/fix/piano-label`
- `.worktrees/` 已在 `.gitignore` 中忽略，禁止追踪其内容
- 主 checkout 常驻 `master` 并保持干净；功能开发一律在 worktree + 对应分支内进行
- 一个分支对应一个 worktree；合并后执行 `git worktree remove` + `git branch -d` 清理

## PR 规范

- base 一律 `master`；一分支一 PR；标题 Conventional Commits 且 type 与分支一致，如分支 `fix/piano-label` → `fix(piano): xxx`
- 合并方式一律 Squash（历史 `#30-#39` 一致；`release.yml` 靠 master 的 squash 标题判断 feat→minor / fix→patch）
- 合并前必须 `npm test` + `npm run build` + `npx tsc --noEmit` 全过；`[skip ci]` 仅允许自动版本提交使用
- 合并后删除分支并 `git worktree remove` 清理 worktree（仓库已开 deleteBranchOnMerge）
