# Cimoa 阶段五页面还原状态

阶段 5 尚未开始。旧文档把“存在路由、可以构建”误标为全部 verified，现已撤销。全部页面为 pending；当前没有 in_progress 页面。人物、费用和通话决策已确认，阶段 1–4 的其余完成门槛通过前，不开始 Home。

| 顺序 | 页面 | 状态 | 原因 |
| --- | --- | --- | --- |
| 1 | Home | pending | 已允许本页先验收；旧首页仍需重建，局部验收和完整依赖验收均未通过 |
| 2 | Discover | pending | 应为个人照片浏览，而非旧推荐/帖子拼合页 |
| 3 | Events | pending | 等待前两页及基础数据完成 |
| 后续 | Profile、Messages、Auto Match、Connection、Auth、Settings、Coins、Safety、System | pending | 按入口依赖逐页进行，不能以业务域 mega-page 代替全部独立页面 |

完整状态以 [页面清单](./cimoa-page-inventory.json) 为准。Popover/Sheet 随首个使用页面完成，常驻挂载。任一时间最多一个页面 in_progress。

## 用户授权的分段验收

Home 增加独立的 `local_acceptance` 和 `full_acceptance` 字段，均使用 pending / passed / failed。它们只表示验收结果，不改变页面的 pending / in_progress / verified 三态。

1. Home 成为唯一 in_progress 页面，完成本页 UI、Popover、Store 派生、状态覆盖和导航参数检查。
2. 本页通过后记录 `local_acceptance: passed`，列出依赖缺口；执行强制校验、专项提交和获授权的 push。等待依赖时将 Home 恢复 pending，不标记 verified。
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
| Tab 固定、骨架只消费一次 | 未执行 |
| iOS WKWebView 安全区、手势、滚动 | 未执行，需要现有宿主 |
| Home 专项 git commit / push | 未执行，当前仅阶段审计修正 |
