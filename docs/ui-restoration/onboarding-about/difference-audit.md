# Onboarding About 第一轮来源锁定与差异审计

## 当前结论

已锁定 HTML 原型 3056–3080 行及 5224、5582–5583、5652–5654 行行为。`/pages/onboarding/about` 是 Photos 的后继页、Interests 的来源页。来源结构、文案、进度、交互标识、持久化闭环与浏览器/WKWebView 证据均已通过，现为 `status: verified`、`visual_acceptance: passed`。

## 来源与实现差异

| ID | 项目 | 锁定来源 | 审计结论 | 处理 |
| --- | --- | --- | --- | --- |
| OBA-001 | 进度 | 50%，`4 / 8` | 原实现按十步 Store 显示 `5 / 10`、50% | 页面覆盖来源分子与总数，百分比保持 50% |
| OBA-002 | 返回 | 46×46 来源返回按钮 | 外观存在但缺 interaction ID | 增加 `obAbout.goBack.click.1`，返回 Photos |
| OBA-003 | 标题与说明 | 左对齐；说明上距 10px | 现有通用骨架尺寸一致 | 保留 |
| OBA-004 | 卡片与文本框 | 上距 18、padding 18、圆角 24、文本框最小高 150 | 现有 rpx 值一致 | 保留 |
| OBA-005 | 输入事件 | `onObBio`，最多 300 字符 | `v-model` 和 maxlength 已真实约束，但缺 interaction ID | 补 `obAbout.onObBio.change.1`，保留即时计数 |
| OBA-006 | 可选语义 | 空内容仍可 Continue | Store 校验允许空字符串 | 保留，不制造必填错误 |
| OBA-007 | 写入闭环 | 来源仅切页 | 项目约定要求 Loading 后 Store 原子持久化 | 验收零写入 Loading 阶段、单次提交、失败回滚和刷新恢复 |
| OBA-008 | 键盘与安全区 | 原型固定 393×852 | 生产需真实安全区和键盘适配 | 验收 393×852、320×568 和 iPhone 17 Pro 软件键盘 |

## 验收结果

- 393×852 来源完成帧已生成 actual、overlay、diff；平均绝对通道差为 `0.7989015518044654`。
- 空简介、300 字符边界、超长输入裁切、小屏滚动和计数通过浏览器 8/8 专项检查。
- Loading 前零写入、双击单次提交、失败回滚保留草稿、离页取消写入均通过。
- 刷新读取同一用户实体；Back 回 Photos；成功进入 Interests；注册链路回归和 Store 回归均通过。
- iPhone 17 Pro（iOS 26.5）`WKWebView` 通过 1/1 专项测试；覆盖真实安全区、软件键盘收起固定 footer、失败态及成功持久化。
