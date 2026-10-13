# Cimoa 阶段五页面还原状态

阶段 5 已按用户的继续指令开始，Home 是唯一 in_progress 页面。阶段 1–4 基础提交为 `adb4e92`。本轮对同一可信远端再次推送仍连接 `github.com:443` 超时（75021ms）。依流程 5.3 先完成安全的 Home 本页工作，发布门槛恢复前不进入 Discover；未授权扩展其他页面的分段验收。

| 顺序 | 页面 | 状态 | 原因 |
| --- | --- | --- | --- |
| 1 | Home | in_progress | local_acceptance passed；Git 推送阻塞，full_acceptance pending；不开始下一页 |
| 2 | Discover | pending | 应为个人照片浏览，而非旧推荐/帖子拼合页 |
| 3 | Events | pending | 基础数据已完成，等待前两页按序验收 |
| 后续 | Profile、Messages、Auto Match、Connection、Auth、Settings、Coins、Safety、System | pending | 按入口依赖逐页进行，不能以业务域 mega-page 代替全部独立页面 |

完整状态以 [页面清单](./cimoa-page-inventory.json) 为准。Popover/Sheet 随首个使用页面完成，常驻挂载。任一时间最多一个页面 in_progress。

## 用户授权的分段验收

唯一流程依据为 [开发流程阶段 5.2](../模板项目开发流程.md#52-home-分段验收用户已授权的唯一例外)。以下仅记录执行状态，不扩展到其他页面，也不因约定更新推进状态。

Home 增加独立的 `local_acceptance` 和 `full_acceptance` 字段，均使用 pending / passed / failed。它们只表示验收结果，不改变页面的 pending / in_progress / verified 三态。

1. Home 成为唯一 in_progress 页面，完成本页 UI、Popover、Store 派生、状态覆盖和导航参数检查。
2. 本页通过后记录 `local_acceptance: passed`，按 interaction_id 列出 deferred 的目标、参数和未测步骤；执行强制校验、专项提交和获授权的 push。等待依赖时将 Home 恢复 pending，不标记 verified。
3. 按 Home → Discover → Events 的主 Tab 顺序，再按入口依赖逐页推进。进入一个页面时，不保留另一个 in_progress 页面。
4. 依赖补齐后，Home 再次成为唯一 in_progress 页面，执行真实目标页/返回、跨页同步、刷新恢复和 WKWebView 回归。
5. `local_acceptance`、`full_acceptance` 都通过，且全部校验与提交推送有证据，才将 Home 标记 verified。

该授权不允许空目标页、Toast 假成功、页面级业务副本，也不取消阶段 1–4。当前 local_acceptance passed、full_acceptance pending。Home 与首次新增的 CimoaBrand、ConnectionGoalsPopover、UserAvatar 均不标记 verified；推送成功后才能把 Home 暂回 pending 并进入下一页。

## Home 验收证据

| 检查 | 结果 |
| --- | --- |
| 对照原 HTML 的布局、资源、颜色 | 源尺寸/资源比对及独立 H5 截图检查通过；保留固定骨架技术适配 |
| 全部 Home 入口及返回闭环 | 本页 Popover/Tab 和实体参数检查通过；Profile、Chat、Request、Auto Match 真实目标/返回 deferred |
| Loading、空、错误、长内容、持久化 | 认证后单次骨架、空态、错误重试、长列表、头像 Blob 刷新、UTC 跨日通过 |
| Tab 固定、骨架只消费一次 | Home 新布局回归通过，三 Tab 两轮往返栈深保持1 |
| iOS WKWebView 安全区、手势、滚动 | 未执行，需要现有宿主 |
| Home 专项 git commit / push | 本地专项提交 cc59a36；本轮 Git 推送连接超时，未推送 |

详细范围、改动文件、22 项 H5 结果与 deferred 清单见 [Home 本页验收](./cimoa-stage5-home-acceptance.md)。阶段五整体尚未完成。
