# Cimoa 阶段五页面还原状态

阶段 5 尚未开始。全部页面为 pending；当前没有 in_progress 页面。阶段 1–4 的基础代码、28 项专项测试、8 项 H5 实测及三项强制检查已通过，基础提交为 `adb4e92`。本轮两次向用户确认的可信远端推送均因 Git 连接 `github.com:443` 超时失败，按约定停止发布和后续页面推进，待连接恢复并成功推送后只将 Home 设为 in_progress。不能把本轮共用骨架工作当成三个业务页还原。

| 顺序 | 页面 | 状态 | 原因 |
| --- | --- | --- | --- |
| 1 | Home | pending | 前置基础已校验；Git 推送连接超时阻塞。旧首页业务仍需重建，局部/完整验收均未通过 |
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

该授权不允许空目标页、Toast 假成功、页面级业务副本，也不取消阶段 1–4。当前两个验收字段均为 pending。

## Home 验收证据

| 检查 | 结果 |
| --- | --- |
| 对照原 HTML 的布局、资源、颜色 | 未执行还原，未通过 |
| 全部 Home 入口及返回闭环 | 未执行，不能以旧错误目标页替代 |
| Loading、空、错误、长内容、持久化 | 未执行 |
| Tab 固定、骨架只消费一次 | 共用基础 H5 实测已通过；Home 新业务布局尚未还原，需随本页回归 |
| iOS WKWebView 安全区、手势、滚动 | 未执行，需要现有宿主 |
| Home 专项 git commit / push | 未执行，当前仅阶段审计修正 |
