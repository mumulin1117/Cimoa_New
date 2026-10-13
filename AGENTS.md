# 项目开发规则

本文件是仓库级强制指令。任何 AI 或自动化开发工具在修改代码前，必须完整阅读并遵循 [DEVELOPMENT_CONVENTIONS.md](./DEVELOPMENT_CONVENTIONS.md) 与 [INTERACTION_CONVENTIONS.md](./INTERACTION_CONVENTIONS.md)。本文件只保留不可省略的执行规则；详细实现以两个约定文件为准，如果开发约定文件满足开发需求，就不必去阅读uniapp的开发规范文档。

## 开始任务前

1. 确认工作目录是本项目根目录，并完整读取 `DEVELOPMENT_CONVENTIONS.md` 与 `INTERACTION_CONVENTIONS.md`。
2. 检查目标页面及其关联的组件、Store、工具层和路由配置，复用已有实现，不重复造轮子。
3. 当用户需求与开发约定冲突、约定缺失或无法安全执行时，先说明原因并请求决策；不得自行降级或绕过约定。

## 命令执行规则

```
## Command Execution Rules

1. 所有命令必须尽可能使用一次性、可退出的命令。
2. 禁止启动长期驻留进程。
3. 禁止启动 dev server、watch、daemon、后台服务，除非当前任务明确要求。
4. 如果必须启动服务：
   - 记录启动的 PID；
   - 完成测试后立即停止；
   - 同时清理该进程创建的子进程。
5. 禁止重复启动相同服务。
6. 执行 npm、pnpm、vite 等命令后，检查是否产生残留进程。
7. 不要使用无限等待命令。
8. 不要使用 watch 模式。
9. 不要执行持续输出日志的命令。
10. 构建、测试、检查优先使用一次性命令。
11. 如果命令可能运行超过 2 分钟，请考虑更短的验证方式。
12. 每完成一个较大的任务，检查并清理本次任务产生的后台进程。
```

## 实现硬性要求

- 使用 Vue 3 `<script setup>`、uni-app 组件/API 和 `rpx` 尺寸；安全区 `env(..., 0px)` 回退值除外。
- 主题颜色、文本颜色、按钮色和图标色只来自 `src/config/theme.json`，并映射为 CSS 变量。
- 业务数据只通过 Pinia Store 或 `src/utils` 的业务接口读写；页面和组件不得直接写入浏览器 storage。
- 涉及 localStorage、IndexedDB 或业务状态写入的交互，必须先显示对应的自定义 Loading 400–600ms（点赞、收藏、复选框等低交互类型的无需loading），Loading 结束后再执行写入，并在卸载时清理定时器。
- 主 Tab、二级页、三级页、Loading、确认弹窗、过渡动画、安全区和滚动容器必须按开发约定中的现有模式实现。
- 所有确认操作使用 `src/components/*ConfirmDialog.vue`，不得使用浏览器原生 `confirm`。
- 所有页面上的可点击入口必须按 `INTERACTION_CONVENTIONS.md` 完成真实数据闭环；实现交互前先检查已有组件、Store action 和工具层，避免只做静态跳转或局部假状态。
- 没有主动要求，不得修改开发约定文件和交互约定文件。

## 完成任务前

对代码有修改的任务(非代码修改任务跳过)，必须依次执行并修复所有错误：

```powershell
corepack pnpm check:conventions
git diff --check
corepack pnpm build:h5
```

`check:conventions` 的警告需要在交付说明中说明；新增代码不得引入新的警告。最终回复需列出改动文件、遵循的关键约定和校验结果。
