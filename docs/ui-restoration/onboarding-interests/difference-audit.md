# Onboarding Interests 第一轮来源锁定与差异审计

## 当前结论

已锁定 HTML 原型 3083–3106 行及兴趣初始值、路由、17 个选项、计数和按钮状态行为。`/pages/onboarding/interests` 是 About 的后继页、Goal 的来源页；浏览器与 iPhone 17 Pro `WKWebView` 均已通过验收，当前为 `status: verified`、`visual_acceptance: passed`。

## 来源与实现差异

| ID | 项目 | 锁定来源 | 审计结论 | 处理 |
| --- | --- | --- | --- | --- |
| OBI-001 | 进度 | 62%，`5 / 8` | 原实现按十步 Store 显示 `6 / 10`、60% | 页面覆盖来源分子、总数和 62% 进度 |
| OBI-002 | 返回 | 46×46 来源返回按钮 | 外观存在但缺 interaction ID | 增加 `obInterests.goBack.click.1`，返回 About |
| OBI-003 | 文案 | 标题、说明、计数及 Continue | 实现文案一致 | 保留并做精确断言 |
| OBI-004 | 选项 | 17 个兴趣，顺序、emoji 和标签固定 | Store catalog ID 已按来源顺序映射到同一实体表 | 只从 getter 读取，不在页面复制业务目录 |
| OBI-005 | 默认来源帧 | Photography、Coffee、Live Music 已选，按钮可用 | 新用户真实流程应从空选择开始 | 来源截图使用同一 Store 的三项已选状态；另验收空状态与禁用按钮，不向真实新用户预填偏好 |
| OBI-006 | 选择反馈 | 选中渐变/白字，未选白底/深色字；计数即时变化 | 当前低交互 toggle 符合约定且无持久化 | 保留；验收取消、重选和最低三项门槛 |
| OBI-007 | 写入闭环 | 来源仅切页 | 项目约定要求 Loading 后 Store 原子持久化 | 验收 Loading 前零写入、双击单次提交、失败回滚和刷新恢复 |
| OBI-008 | 滚动与安全区 | 393×852 固定 footer、17 个 chips 在唯一滚动区 | 通用骨架为单一 scroll-view | 验收 393×852、320×568 和 iPhone 17 Pro 到达最后一项且 footer 不遮挡 |

## 验收结果

- 393×852 来源三项已选完成帧已生成 reference、actual、overlay、diff，平均绝对通道差为 `0.679018235793045`。
- 空状态、两项禁用、三项可继续、17 项全选、取消/重选和准确计数全部通过。
- Loading 前零写入；双击一次原子写入；持久化失败保留重试选择；离页取消延迟写入与隐藏导航。
- 刷新恢复同一用户实体；Back 回 About；成功进入 Goal；注册链路回归 12/12、Store 回归 10/10。
- 浏览器无宿主、320×568 短屏与 iPhone 17 Pro `WKWebView` 均验证了唯一滚动区、固定 footer、真实安全区和失败态。
