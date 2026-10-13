# Cimoa 阶段五页面还原状态

阶段 5 尚未开始。旧文档把“存在路由、可以构建”误标为全部 verified，现已撤销。全部页面恢复为 pending；当前没有 in_progress 页面。阶段 1–4 的完成门槛通过前，不开始 Home。

| 顺序 | 页面 | 状态 | 原因 |
| --- | --- | --- | --- |
| 1 | Home | pending | 旧首页结构与原型不同；依赖页面闭环、资料统一、路由/骨架/安全区未验收 |
| 2 | Discover | pending | 应为个人照片浏览，而非旧推荐/帖子拼合页 |
| 3 | Events | pending | 等待前两页及基础数据完成 |
| 后续 | Profile、Messages、Auto Match、Connection、Auth、Settings、Coins、Safety、System | pending | 按入口依赖逐页进行，不能以业务域 mega-page 代替全部独立页面 |

完整状态以 [页面清单](./cimoa-page-inventory.json) 为准。Popover/Sheet 随首个使用页面完成，常驻挂载。任一时间最多一个页面 in_progress；验收、三项检查、提交和 push 全部完成后才能开始下一页。

## Home 验收证据

| 检查 | 结果 |
| --- | --- |
| 对照原 HTML 的布局、资源、颜色 | 未执行还原，未通过 |
| 全部 Home 入口及返回闭环 | 未执行，不能以旧错误目标页替代 |
| Loading、空、错误、长内容、持久化 | 未执行 |
| Tab 固定、骨架只消费一次 | 未执行 |
| iOS WKWebView 安全区、手势、滚动 | 未执行，需要现有宿主 |
| Home 专项 git commit / push | 未执行，当前仅阶段审计修正 |
